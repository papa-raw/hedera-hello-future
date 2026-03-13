#!/usr/bin/env node

/**
 * Parliament Simulation API Server (V2 — 7-phase epoch)
 * Runs alongside Vite dev server. Exposes:
 *   GET  /api/parliament/status     — current state
 *   POST /api/parliament/run        — trigger an epoch (body: { agentCount?, epochId? })
 *   GET  /api/parliament/stream     — SSE stream of live feed messages during run
 *   GET  /api/parliament/epochs     — list available epoch archives
 *   POST /api/parliament/pause      — toggle pause/resume
 */

import { createServer } from 'http';
import { createHash } from 'crypto';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import { AGENTS as SEED_AGENTS, BIOREGION, SEED_PROPOSALS } from './agents.js';
import { generateFullCensus, censusSummary } from './generate-agents.js';
import { llmCall, llmBatch, buildAgentSystemPrompt, getStats } from './llm.js';
import { buildAtlasDigest, ATLAS_ASSETS, ATLAS_ORGS, VALUATION_CONTEXT, BOUNTY_TEMPLATES } from './data/atlas-context.js';
import { loadPreviousEpoch, loadMemoryChain, extractMemories, buildMemoryPrompt, saveMemory, buildProvenanceEntry } from './memory.js';

const PORT = parseInt(process.env.SIM_PORT || '3001');
const PUBLIC_DIR = resolve(import.meta.dirname, '../public/simulation');
const OUTPUT_DIR = resolve(import.meta.dirname, 'output');

// ── State ──
let running = false;
let paused = false;
let currentEpoch = null;
let progress = { phase: 'idle', message: '', agentCount: 0, feedCount: 0, llmCalls: 0 };
const sseClients = new Set();

async function waitIfPaused() {
  while (paused) {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

function updateProgress(phase, message, extra = {}) {
  progress = { ...progress, phase, message, ...extra };
  broadcast({ type: 'progress', ...progress });
}

// ── V2 epoch runner (inline, with SSE) ──
async function runEpochInProcess(epochId, agentCount) {
  if (running) throw new Error('Already running');
  running = true;
  paused = false;
  currentEpoch = epochId;

  const FEED = [];
  const WHISPERS = [];
  const CONCURRENCY = 15;

  // ── Load previous epoch state and memory chain ──
  const prevEpoch = loadPreviousEpoch(epochId);
  const memoryChain = loadMemoryChain(epochId);

  // ── EII Carry-Forward: read EII/treasury from previous epoch ──
  const bioregionState = {
    ...BIOREGION,
    eii: prevEpoch?.eii_after
      ? { ...prevEpoch.eii_after }
      : { ...BIOREGION.eii },
    eii_previous: prevEpoch?.eii_before
      ? { ...prevEpoch.eii_before }
      : { ...BIOREGION.eii_previous },
    treasury_usdc: prevEpoch?.settlement?.treasury_remaining ?? BIOREGION.treasury_usdc,
  };

  // If previous epoch exists, use its agent states as starting point
  let agents;
  if (prevEpoch && prevEpoch.agent_states && agentCount <= prevEpoch.agent_states.length) {
    // Carry forward agent state: bonds, memory, soul_depth
    agents = prevEpoch.agent_states.map(a => ({
      ...a,
      personality: SEED_AGENTS.find(s => s.id === a.id)?.personality || { voice: '', hard_bans: [], rhetoric: '' },
      mandate: SEED_AGENTS.find(s => s.id === a.id)?.mandate || { objective: '', monitors: [], allies: [], adversaries: [] },
      archetype: SEED_AGENTS.find(s => s.id === a.id)?.archetype || 'Unknown',
      relationships: {},
    }));
    updateProgress('init', `Loaded ${agents.length} agents with state from epoch ${prevEpoch.epoch_id}. Memory chain: ${memoryChain.length} epochs.`);
  } else if (agentCount > 8) {
    agents = generateFullCensus(agentCount);
  } else {
    agents = [...SEED_AGENTS.map(a => ({ ...a, relationships: {}, memory: [...a.memory], bonds: {} }))];
  }

  const proposals = SEED_PROPOSALS.map(p => ({ ...p, supporters: [], opposers: [] }));

  // Build per-agent memory prompts from the chain
  const agentMemoryPrompts = {};
  for (const agent of agents) {
    agentMemoryPrompts[agent.id] = buildMemoryPrompt(agent.id, memoryChain);
  }

  // Helper: build system prompt with memory injection
  function agentPrompt(agent, context) {
    return buildAgentSystemPrompt(agent, context, agentMemoryPrompts[agent.id] || undefined);
  }

  const summary = censusSummary(agents);
  updateProgress('init', `Census: ${summary.total} agents, ${Object.entries(summary.byClass).map(([k,v])=>`${k}(${v})`).join(', ')}`, {
    agentCount: agents.length, feedCount: 0, llmCalls: 0,
  });

  function post(from, to, type, content, structured_data = {}) {
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: from.name || from, from_id: from.id || from,
      to: to === 'broadcast' ? 'ALL' : (to.name || to),
      to_id: to === 'broadcast' ? 'broadcast' : (to.id || to),
      type, content, structured_data, timestamp: new Date().toISOString(),
    };
    FEED.push(msg);
    updateProgress(progress.phase, `[${msg.from}] ${content.slice(0, 80)}...`, {
      feedCount: FEED.length, llmCalls: getStats().totalCalls,
    });
    broadcast({ type: 'feed', msg });
    return msg;
  }

  // Init bonds
  for (const agent of agents) {
    if (!agent.bonds) agent.bonds = {};
    for (const allyId of agent.mandate.allies) {
      if (!agent.bonds[allyId]) agent.bonds[allyId] = { trust: 0.2, tension: 0, depth: 0.1 };
    }
    for (const advId of agent.mandate.adversaries) {
      if (!agent.bonds[advId]) agent.bonds[advId] = { trust: -0.2, tension: 0.3, depth: 0.1 };
    }
  }

  const bounties = [];

  try {
    // ── PHASE 1: INTELLIGENCE (NEW) ──
    updateProgress('intelligence', 'Intelligence agents scanning provenance data...');
    const atlasDigest = buildAtlasDigest();

    const intelAgents = agents.filter(a => a.class === 'mrv' || a.class === 'compliance').slice(0, 4);
    if (intelAgents.length === 0) intelAgents.push(agents[0]);

    const intelCalls = intelAgents.map(agent => ({
      id: agent.id, tier: 'routine',
      system: agentPrompt(agent,
        `You are scanning real provenance data from the Regen Atlas. Summarize for the parliament. Reference specific asset names, protocols, and numbers. ${agent.class === 'compliance' ? 'Focus on methodology compliance and missing baselines.' : 'Focus on data gaps and MRV anomalies.'}`),
      user: `${atlasDigest}\n\nDeliver your intelligence report. Reference specific assets and orgs by name.`,
    }));
    const intelResults = await llmBatch(intelCalls, CONCURRENCY);
    for (const agent of intelAgents) {
      const r = intelResults.get(agent.id);
      if (r) post(agent, 'broadcast', 'intelligence_report', r);
    }

    await waitIfPaused();

    // ── PHASE 2: SENSING (enhanced) ──
    updateProgress('sensing', 'Sentinel reporting EII + provenance correlation...');
    const sentinel = agents.find(a => a.class === 'mrv') || agents[0];
    const eiiContext = `Current EII: overall=${bioregionState.eii.overall} (function=${bioregionState.eii.function}, structure=${bioregionState.eii.structure}, composition=${bioregionState.eii.composition}). Previous: overall=${bioregionState.eii_previous.overall}. Delta: ${(bioregionState.eii.overall - bioregionState.eii_previous.overall).toFixed(3)}.`;

    const report = await llmCall('routine',
      agentPrompt(sentinel, 'Report EII readings. Correlate with provenance data (Toucan retirements, Regen credits, Glow output). Be factual.'),
      `${eiiContext}\nCorrelate with: TCO2 retirements in Camargue, C04-003 credits, SolarCamargue-7 MWh.`
    );
    post(sentinel, 'broadcast', 'eii_report', report);

    await waitIfPaused();

    // ── PHASE 3: DELIBERATION (enhanced — dynamic proposals) ──
    const proposalSummary = proposals.map(p => `- [${p.id}] ${p.title}: ${p.description} (cost: $${p.cost_usdc}, target: ${p.target_pillar}, expected: +${p.estimated_eii_delta} ${p.target_pillar})`).join('\n');
    const limitingPillar = ['function', 'structure', 'composition']
      .reduce((min, p) => bioregionState.eii[p] < bioregionState.eii[min] ? p : min, 'function');
    const deliberationContext = `BIOREGION: ${bioregionState.name} (${bioregionState.locality})
EII: overall=${bioregionState.eii.overall} | function=${bioregionState.eii.function} | structure=${bioregionState.eii.structure} | composition=${bioregionState.eii.composition}
LIMITING FACTOR: ${limitingPillar} at ${bioregionState.eii[limitingPillar]}
TREASURY: $${bioregionState.treasury_usdc.toLocaleString()} USDC

STANDING PROPOSALS:
${proposalSummary}

ATLAS PROVENANCE:
${atlasDigest}`;

    // Round 1
    updateProgress('deliberation', `Round 1: ${agents.length} agents forming positions on assets + proposals...`);
    const deliberatingAgents = agents.filter(a => a.class !== 'mrv');
    const round1Calls = deliberatingAgents.map(agent => ({
      id: agent.id, tier: 'routine',
      system: agentPrompt(agent, `DELIBERATION ROUND 1. You must do exactly ONE of these governance acts:
1. SUPPORT or OPPOSE a standing proposal (cite the proposal ID and give specific reasons from your mandate)
2. PROPOSE a new action based on the provenance data (use format: PROPOSAL: [descriptive title]. Cost: $X. Target: [pillar]. Expected: +X.XX [pillar].)
3. CHALLENGE another agent's likely position based on your adversaries list

Reference specific assets by name (BCT, C04-003, SolarCamargue-7). Use real numbers. Do not be vague.`),
      user: deliberationContext,
    }));
    const round1Results = await llmBatch(round1Calls, CONCURRENCY);
    for (const agent of deliberatingAgents) {
      const r = round1Results.get(agent.id);
      if (r) post(agent, 'broadcast', 'deliberation', r);
    }

    // Extract dynamic proposals — greedy capture for title, then parse fields from the full match
    const proposalPattern = /PROPOSAL:\s*([^\n.]{10,})/gi;
    let dynCount = 0;
    for (const [agentId, text] of round1Results) {
      if (!text || dynCount >= 3) continue;
      const agent = agents.find(a => a.id === agentId);
      let match;
      while ((match = proposalPattern.exec(text)) !== null && dynCount < 3) {
        const fullMatch = match[1].trim();
        // Extract title: everything before "Cost:" or "Target:" or end
        const titleMatch = fullMatch.match(/^(.+?)(?:\s*(?:Cost|Target|Expected|Budget)[:\s]|$)/i);
        const title = (titleMatch ? titleMatch[1] : fullMatch).replace(/[.*]+$/, '').trim().slice(0, 80);
        if (title.length < 10) continue; // Skip garbage extractions
        // Extract cost, pillar, delta from the rest of the text after PROPOSAL:
        const afterProposal = text.slice(match.index, match.index + 300);
        const costMatch = afterProposal.match(/Cost:\s*\$?([\d,]+)/i);
        const pillarMatch = afterProposal.match(/Target:\s*(function|structure|composition)/i);
        const deltaMatch = afterProposal.match(/Expected:\s*\+?([\d.]+)/i);
        const cost = costMatch ? parseInt(costMatch[1].replace(/,/g, '')) : 10000;
        const pillar = pillarMatch ? pillarMatch[1].toLowerCase() : 'structure';
        const delta = deltaMatch ? Math.min(parseFloat(deltaMatch[1]), 0.05) : 0.01;
        proposals.push({
          id: `proposal_dynamic_${dynCount + 1}`, title,
          description: `Dynamic proposal from ${agent?.name || agentId}.`,
          target_pillar: pillar, estimated_eii_delta: delta,
          cost_usdc: Math.min(cost, 50000), status: 'active',
          source: 'deliberation', proposed_by: agent?.name,
          supporters: [], opposers: [],
        });
        dynCount++;
      }
    }

    // Rounds 2-3
    for (let round = 2; round <= 3; round++) {
      await waitIfPaused();
      updateProgress('deliberation', `Round ${round}: Cross-agent reactions...`);
      const pairsCount = Math.min(Math.ceil(agents.length / 3), 20);
      const shuffled = agents.filter(a => a.class !== 'mrv').sort(() => Math.random() - 0.5);
      const pairs = [];
      for (let i = 0; i < shuffled.length - 1 && pairs.length < pairsCount; i += 2) {
        pairs.push([shuffled[i], shuffled[i + 1]]);
      }

      const reactionCalls = pairs.map(([reactor, target]) => {
        const targetPost = FEED.filter(m => m.from_id === target.id).pop();
        const isAlly = reactor.mandate.allies.includes(target.id);
        const isAdversary = reactor.mandate.adversaries.includes(target.id);
        const relationship = isAlly ? `${target.name} is your ALLY.` : isAdversary ? `${target.name} is your ADVERSARY.` : '';
        return {
          id: `${reactor.id}_to_${target.id}`, tier: 'routine',
          system: agentPrompt(reactor, `DELIBERATION ROUND ${round}. ${relationship} React to ${target.name}'s governance position. You must either:
1. SUPPORT their position (and add your own reasoning)
2. OPPOSE their position (with specific counter-evidence)
3. AMEND their proposal (suggest a modification)
Be direct. Name the specific proposal or asset you're responding to.`),
          user: `${target.name} said:\n"${(targetPost?.content || 'no position yet').slice(0, 400)}"\n\nRespond as a governance act, not a comment.`,
        };
      });
      const reactionResults = await llmBatch(reactionCalls, CONCURRENCY);
      for (const [reactor, target] of pairs) {
        const r = reactionResults.get(`${reactor.id}_to_${target.id}`);
        if (r) post(reactor, target, 'reaction', r);
      }
    }

    // Whispers
    updateProgress('deliberation', 'Whisper channel...');
    const allyPairs = agents.flatMap(a =>
      a.mandate.allies.map(allyId => agents.find(x => x.id === allyId)).filter(Boolean).map(ally => [a, ally])
    ).sort(() => Math.random() - 0.5).slice(0, 4);

    const whisperCalls = allyPairs.map(([s, r]) => ({
      id: `w_${s.id}_${r.id}`, tier: 'routine',
      system: agentPrompt(s, `Privately message ${r.name}, your ally. One sentence.`),
      user: `What do you whisper to ${r.name}?`,
    }));
    const whisperResults = await llmBatch(whisperCalls, CONCURRENCY);
    for (const [sender, receiver] of allyPairs) {
      const r = whisperResults.get(`w_${sender.id}_${receiver.id}`);
      if (r) {
        WHISPERS.push({ id: `whisper_${Date.now()}`, from: sender.name, from_id: sender.id, to: receiver.name, to_id: receiver.id, type: 'whisper', content: r, timestamp: new Date().toISOString() });
        broadcast({ type: 'whisper', from: sender.name, to: receiver.name, content: r });
      }
    }

    await waitIfPaused();

    // ── PHASE 4: BOUNTIES (NEW) ──
    updateProgress('bounties', 'Agents posting ground-truth verification bounties...');
    const bountyAgents = agents.filter(a => a.class === 'mrv' || a.class === 'compliance' || a.class === 'restoration')
      .sort(() => Math.random() - 0.5).slice(0, 5);

    if (bountyAgents.length > 0) {
      const templateList = BOUNTY_TEMPLATES.map(t => `- "${t.template}" (${t.default_reward} ESV, ${t.category})`).join('\n');
      const bountyCalls = bountyAgents.map(agent => ({
        id: agent.id, tier: 'routine',
        system: agentPrompt(agent,
          `Post a BOUNTY for human ground-truth verification. This is a task you need a human to physically do in the Camargue. Be specific about what needs to be measured, photographed, or verified. Include the exact location or asset name.`),
        user: `VERIFICATION GAPS THIS EPOCH:
- SolarCamargue-7: MRV status pending, panel count unverified
- Camargue peatland: VM0036 baseline establishment missing, no soil core data
- Zone 7-12 corridor: Flamingo nesting site count outdated (last survey 6 months ago)
- C04-003 Regen credits: Field verification of wetland restoration progress needed
- Water levels: Station 4 telemetry offline, manual reading required

BOUNTY TEMPLATES:
${templateList}

Post exactly ONE bounty using this format:
BOUNTY: [specific task description, 15+ words, naming the exact asset/location]. Reward: [X] ESV. Deadline: [N] epochs.`,
      }));
      const bountyResults = await llmBatch(bountyCalls, CONCURRENCY);
      for (const agent of bountyAgents) {
        const r = bountyResults.get(agent.id);
        if (!r) continue;
        // Greedy capture for bounty description — grab everything after BOUNTY: up to Reward: or newline
        const bMatch = r.match(/BOUNTY:\s*([^\n]{10,})/i);
        const fullDesc = bMatch ? bMatch[1].trim() : r.slice(0, 150);
        // Strip trailing "Reward:" and beyond from description
        const descClean = fullDesc.replace(/\s*Reward:.*$/i, '').replace(/\s*Deadline:.*$/i, '').replace(/[.*]+$/, '').trim();
        const rewardMatch = r.match(/Reward:\s*(\d+)/i);
        const deadlineMatch = r.match(/Deadline:\s*(\d+)/i);
        const bounty = {
          id: `bounty_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
          description: descClean.length >= 10 ? descClean.slice(0, 150) : r.replace(/BOUNTY:\s*/i, '').slice(0, 150),
          reward_esv: rewardMatch ? parseInt(rewardMatch[1]) : 30,
          deadline_epochs: deadlineMatch ? parseInt(deadlineMatch[1]) : undefined,
          posted_by: agent.name, posted_by_id: agent.id, status: 'open',
          category: agent.class === 'mrv' ? 'field-verification' : agent.class === 'compliance' ? 'mrv-audit' : 'monitoring',
        };
        bounties.push(bounty);
        post(agent, 'broadcast', 'bounty_post', r, { bounty });
      }
    }

    await waitIfPaused();

    // ── PHASE 5: STAKING (enhanced) ──
    updateProgress('staking', `${agents.filter(a => a.stake.esv > 0).length} agents staking on ${proposals.length} proposals...`);
    const stakingAgents = agents.filter(a => a.stake.esv > 0);
    const proposalList = proposals.map(p => {
      const tag = p.source === 'deliberation' ? ' [NEW]' : '';
      return `- ${p.id}: ${p.title}${tag} ($${p.cost_usdc}, target: ${p.target_pillar})`;
    }).join('\n');

    // Build deliberation digest so agents stake informed by debate
    const deliberationMsgs = FEED.filter(m => m.type === 'deliberation' || m.type === 'reaction');
    const deliberationDigest = deliberationMsgs
      .slice(-20)
      .map(m => `[${m.from}] ${m.content.slice(0, 120)}`)
      .join('\n');

    const stakingCalls = stakingAgents.map(agent => ({
      id: agent.id, tier: 'routine',
      system: agentPrompt(agent, `STAKING PHASE. Allocate your ESV to proposals that align with your mandate. You can split across multiple proposals or concentrate on one. Explain WHY each allocation serves your mandate. Zero-allocate proposals you oppose. Consider what other agents argued during deliberation.`),
      user: `YOUR ESV BALANCE: ${agent.stake.esv} ESV

DELIBERATION SUMMARY (what agents argued):
${deliberationDigest}

PROPOSALS TO STAKE ON:
${proposalList}

Allocate using this exact format (one per line):
PROPOSAL_ID: AMOUNT ESV — [reason tied to your mandate]

You must allocate at least some ESV. Total cannot exceed ${agent.stake.esv}.`,
    }));
    const stakingResults = await llmBatch(stakingCalls, CONCURRENCY);
    for (const agent of stakingAgents) {
      const allocation = stakingResults.get(agent.id);
      if (!allocation) continue;
      post(agent, 'broadcast', 'staking', allocation);
      for (const proposal of proposals) {
        const match = allocation.match(new RegExp(`${proposal.id}[:\\s]+(\\d+)`, 'i'));
        if (match) {
          const amount = parseInt(match[1]);
          if (amount > 0) proposal.supporters.push({ agent_id: agent.id, amount });
        }
      }
    }

    await waitIfPaused();

    // ── PHASE 6: SETTLEMENT ──
    updateProgress('settlement', 'Calculating outcomes...');
    const ranked = proposals.map(p => ({
      ...p, total_stake: p.supporters.reduce((sum, s) => sum + s.amount, 0),
    })).sort((a, b) => b.total_stake - a.total_stake);

    const funded = [];
    let remaining = bioregionState.treasury_usdc;
    for (const proposal of ranked) {
      if (remaining >= proposal.cost_usdc && proposal.total_stake > 0) {
        funded.push(proposal);
        remaining -= proposal.cost_usdc;
      }
    }

    const startEii = { ...bioregionState.eii };
    const eii_after = { ...bioregionState.eii };

    // Natural decay: ecosystems degrade without intervention
    const DECAY = 0.005;
    for (const pillar of ['function', 'structure', 'composition']) {
      eii_after[pillar] = Math.max(0, eii_after[pillar] - DECAY);
    }

    // Funded proposal effects with noise
    for (const p of funded) {
      const noise = (Math.random() - 0.5) * 0.01;
      const effect = (p.estimated_eii_delta || 0.01) * 0.7 + noise;
      eii_after[p.target_pillar] = Math.min(1, eii_after[p.target_pillar] + effect);
    }

    // Cross-pillar coupling: structure improvements help composition slightly
    const structureDelta = eii_after.structure - startEii.structure;
    if (structureDelta > 0) {
      eii_after.composition = Math.min(1, eii_after.composition + structureDelta * 0.15);
    }

    eii_after.overall = Math.min(eii_after.function, eii_after.structure, eii_after.composition);

    const settlement = {
      funded: funded.map(p => ({ id: p.id, title: p.title, cost: p.cost_usdc, stake: p.total_stake, source: p.source || 'standing' })),
      unfunded: ranked.filter(p => !funded.includes(p)).map(p => p.id),
      treasury_remaining: remaining,
      eii_before: bioregionState.eii, eii_after,
      eii_delta: {
        function: +(eii_after.function - bioregionState.eii.function).toFixed(4),
        structure: +(eii_after.structure - bioregionState.eii.structure).toFixed(4),
        composition: +(eii_after.composition - bioregionState.eii.composition).toFixed(4),
        overall: +(eii_after.overall - bioregionState.eii.overall).toFixed(4),
      },
    };

    broadcast({ type: 'settlement', settlement });

    await waitIfPaused();

    // ── PHASE 7: SPECTACLE (enhanced) ──
    updateProgress('spectacle', 'Generating spectacle...');

    // Asset spotlight
    const spotlightAgent = agents.filter(a => a.class === 'economic_model' || a.class === 'climate_system').sort(() => Math.random() - 0.5)[0];
    if (spotlightAgent) {
      const asset = ATLAS_ASSETS[Math.floor(Math.random() * ATLAS_ASSETS.length)];
      const spotlight = await llmCall('spectacle',
        agentPrompt(spotlightAgent, 'Spotlight a specific atlas asset. Comment on its significance and valuation.'),
        `Asset: ${asset.name} (${asset.type}, ${asset.protocol}). ${asset.tCO2e ? `${asset.tCO2e} tCO2e.` : ''} ${asset.credits ? `${asset.credits} credits.` : ''} ${asset.mwh_generated ? `${asset.mwh_generated} MWh.` : ''} SCC: $${VALUATION_CONTEXT.scc.low}-$${VALUATION_CONTEXT.scc.high}/tCO2e.`
      );
      post(spotlightAgent, 'broadcast', 'asset_spotlight', spotlight, { asset_name: asset.name });
    }

    // Org report card
    const reportAgent = agents.filter(a => a.class === 'compliance').sort(() => Math.random() - 0.5)[0];
    if (reportAgent) {
      const org = ATLAS_ORGS[Math.floor(Math.random() * ATLAS_ORGS.length)];
      const orgReport = await llmCall('spectacle',
        agentPrompt(reportAgent, 'Grade this organization\'s performance. Be specific.'),
        `Organization: ${org.name}. Role: ${org.role}.`
      );
      post(reportAgent, 'broadcast', 'org_report', orgReport, { org_name: org.name });
    }

    // Treaty proposal
    const treatyAgent = agents.filter(a => a.class === 'future' || a.class === 'social').sort(() => Math.random() - 0.5)[0];
    if (treatyAgent) {
      const treaty = await llmCall('spectacle',
        agentPrompt(treatyAgent, 'Propose a cross-bioregion treaty. Reference BKC nodes.'),
        'BKC has 4 active nodes: Greater Victoria, Front Range, Cascadia Valley, Octo. Propose cooperation.'
      );
      post(treatyAgent, 'broadcast', 'treaty_proposal', treaty);
    }

    // Settlement reactions + social
    const spectacleAgents = agents.sort(() => Math.random() - 0.5).slice(0, 4);
    const spectacleCalls = spectacleAgents.map(agent => ({
      id: agent.id, tier: 'spectacle',
      system: agentPrompt(agent, 'The epoch has settled. React to the outcome. Be personal, in character.'),
      user: `Funded: ${funded.map(p => p.title).join(', ')}. EII delta: ${settlement.eii_delta.overall > 0 ? '+' : ''}${settlement.eii_delta.overall}. ${bounties.length} bounties posted.`,
    }));
    const spectacleResults = await llmBatch(spectacleCalls, CONCURRENCY);
    for (const agent of spectacleAgents) {
      const r = spectacleResults.get(agent.id);
      if (r) post(agent, 'broadcast', r.includes('reflect') || agent.class === 'future' ? 'epoch_reflection' : 'settlement_reaction', r);
    }

    // ── ARCHIVE ──
    updateProgress('archiving', 'Writing epoch archive...');
    const archive = {
      epoch_id: epochId,
      bioregion: BIOREGION.id,
      timestamp: new Date().toISOString(),
      version: 2,
      phases: ['INTELLIGENCE', 'SENSING', 'DELIBERATION', 'BOUNTIES', 'STAKING', 'SETTLEMENT', 'SPECTACLE'],
      eii_before: bioregionState.eii, eii_after, eii_delta: settlement.eii_delta,
      settlement: { funded: settlement.funded, unfunded: settlement.unfunded, treasury_remaining: remaining },
      proposals: proposals.map(p => ({
        id: p.id, title: p.title, target_pillar: p.target_pillar,
        total_stake: p.supporters.reduce((sum, s) => sum + s.amount, 0),
        supporters: p.supporters, source: p.source || 'standing',
        proposed_by: p.proposed_by || null,
      })),
      bounties,
      agent_states: agents.map(a => ({ id: a.id, name: a.name, class: a.class, soul_depth: a.soul_depth, bonds: a.bonds || {}, memory: a.memory, stake: a.stake })),
      feed: FEED, whispers: WHISPERS,
      provenance: {
        data_sources: ['sentinel-2', 'landbanking-eii-api', 'toucan-polygon-subgraph', 'regen-cosmos-lcd', 'glow-r2-archive'],
        methodology: 'EII limiting factor + atlas provenance cross-reference',
        confidence: 0.80, verifiers: agents.filter(a => a.class === 'compliance').map(a => a.id), cid: null,
      },
      atlas_context: { assets_referenced: ATLAS_ASSETS.length, orgs_referenced: ATLAS_ORGS.length },
      llm_stats: getStats(),
    };

    const archiveJson = JSON.stringify(archive);
    const hash = createHash('sha256').update(archiveJson).digest('hex').slice(0, 32);
    archive.provenance.cid = `local:sha256:${hash}`;

    mkdirSync(OUTPUT_DIR, { recursive: true });
    mkdirSync(PUBLIC_DIR, { recursive: true });

    const filename = `epoch_${epochId}.json`;
    writeFileSync(resolve(OUTPUT_DIR, filename), JSON.stringify(archive, null, 2));
    writeFileSync(resolve(PUBLIC_DIR, filename), JSON.stringify(archive, null, 2));

    // ── MEMORY EXTRACTION ──
    // Extract structured memories from this epoch and save alongside archive.
    // These memories feed into the next epoch's agent prompts, forming the recursive loop.
    updateProgress('archiving', 'Extracting memories for recursive learning...');
    const memory = extractMemories(archive);

    // Link to previous epoch's memory CID if available
    const prevMemoryPath = resolve(PUBLIC_DIR, `memory_${epochId - 1}.json`);
    if (existsSync(prevMemoryPath)) {
      try {
        const prevMemory = JSON.parse(readFileSync(prevMemoryPath, 'utf-8'));
        memory.previous_memory_cid = prevMemory.provenance_cid || null;
      } catch { /* no previous memory */ }
    }

    // Hash the memory for provenance
    const memoryJson = JSON.stringify(memory);
    const memoryHash = createHash('sha256').update(memoryJson).digest('hex').slice(0, 32);
    memory.provenance_cid = `local:sha256:${memoryHash}`;

    const memoryFilename = saveMemory(memory);

    // Build provenance DAG entry — use real Filecoin CID from previous epoch if available
    let previousCid = null;
    if (prevEpoch?.provenance?.cid) {
      previousCid = prevEpoch.provenance.cid; // Real Filecoin CID if pinned, local hash otherwise
    } else if (memoryChain.length > 0) {
      previousCid = memoryChain[memoryChain.length - 1].provenance_cid || null;
    }
    const provenanceEntry = buildProvenanceEntry(archive, memory, previousCid);
    writeFileSync(resolve(OUTPUT_DIR, `provenance_${epochId}.json`), JSON.stringify(provenanceEntry, null, 2));
    writeFileSync(resolve(PUBLIC_DIR, `provenance_${epochId}.json`), JSON.stringify(provenanceEntry, null, 2));

    const epochs = [];
    for (let i = 1; i <= epochId; i++) epochs.push(i);
    writeFileSync(resolve(PUBLIC_DIR, 'index.json'), JSON.stringify(epochs));

    const stats = getStats();
    updateProgress('complete', `Epoch ${epochId} complete. ${FEED.length} messages, ${stats.totalCalls} LLM calls, ${bounties.length} bounties. Memory saved: ${memoryFilename}. Chain: ${memoryChain.length + 1} epochs.`, {
      feedCount: FEED.length, llmCalls: stats.totalCalls,
    });
    broadcast({ type: 'complete', epochId, stats, feedCount: FEED.length, memoryFile: memoryFilename, memoryChainLength: memoryChain.length + 1 });

    return archive;

  } finally {
    running = false;
    currentEpoch = null;
  }
}

// ── HTTP Server ──
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/parliament/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running, paused, currentEpoch, progress }));
    return;
  }

  if (url.pathname === '/api/parliament/epochs' && req.method === 'GET') {
    try {
      const indexPath = resolve(PUBLIC_DIR, 'index.json');
      const epochs = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf-8')) : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(epochs));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  if (url.pathname === '/api/parliament/pause' && req.method === 'POST') {
    if (!running) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No epoch running' }));
      return;
    }
    paused = !paused;
    broadcast({ type: 'pause', paused });
    updateProgress(paused ? 'paused' : progress.phase, paused ? 'Paused by user' : 'Resumed');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ paused, state: paused ? 'paused' : 'resumed' }));
    return;
  }

  // ── Pin CID: write real Filecoin CID back to epoch archive + provenance ──
  if (url.pathname === '/api/parliament/pin' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const { epochId, pieceCid } = JSON.parse(body);
    if (!epochId || !pieceCid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'epochId and pieceCid required' }));
      return;
    }

    // Update epoch archive with real CID
    for (const dir of [PUBLIC_DIR, OUTPUT_DIR]) {
      const archivePath = resolve(dir, `epoch_${epochId}.json`);
      if (existsSync(archivePath)) {
        try {
          const archive = JSON.parse(readFileSync(archivePath, 'utf-8'));
          archive.provenance.cid = pieceCid;
          archive.provenance.pinned_at = new Date().toISOString();
          writeFileSync(archivePath, JSON.stringify(archive, null, 2));
        } catch (err) {
          console.error(`Failed to update archive in ${dir}:`, err.message);
        }
      }
      // Update provenance DAG entry
      const provPath = resolve(dir, `provenance_${epochId}.json`);
      if (existsSync(provPath)) {
        try {
          const prov = JSON.parse(readFileSync(provPath, 'utf-8'));
          prov.archive_cid = pieceCid;
          prov.pinned_at = new Date().toISOString();
          writeFileSync(provPath, JSON.stringify(prov, null, 2));
        } catch (err) {
          console.error(`Failed to update provenance in ${dir}:`, err.message);
        }
      }
    }

    console.log(`📌 Epoch ${epochId} pinned to Filecoin: ${pieceCid}`);
    broadcast({ type: 'pinned', epochId, pieceCid });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, epochId, pieceCid }));
    return;
  }

  // ── Clear: remove all epoch/memory/provenance archives to start fresh ──
  if (url.pathname === '/api/parliament/clear' && req.method === 'POST') {
    const patterns = [/^epoch_\d+\.json$/, /^memory_\d+\.json$/, /^provenance_\d+\.json$/, /^index\.json$/];
    let removed = 0;
    for (const dir of [PUBLIC_DIR, OUTPUT_DIR]) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir)) {
        if (patterns.some(p => p.test(file))) {
          try {
            unlinkSync(resolve(dir, file));
            removed++;
          } catch {}
        }
      }
    }
    console.log(`🗑️  Cleared ${removed} archive files`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, removed }));
    return;
  }

  if (url.pathname === '/api/parliament/run' && req.method === 'POST') {
    if (running) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Epoch already running', currentEpoch }));
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    const params = body ? JSON.parse(body) : {};
    const agentCount = params.agentCount || 145;

    let nextEpoch = 1;
    try {
      const indexPath = resolve(PUBLIC_DIR, 'index.json');
      if (existsSync(indexPath)) {
        const epochs = JSON.parse(readFileSync(indexPath, 'utf-8'));
        nextEpoch = Math.max(...epochs, 0) + 1;
      }
    } catch {}

    // Check if previous epoch is pinned (skip for epoch 1)
    if (nextEpoch > 1) {
      const prevArchivePath = resolve(PUBLIC_DIR, `epoch_${nextEpoch - 1}.json`);
      if (existsSync(prevArchivePath)) {
        try {
          const prevArchive = JSON.parse(readFileSync(prevArchivePath, 'utf-8'));
          const prevCid = prevArchive.provenance?.cid;
          if (prevCid?.startsWith('local:')) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Epoch ${nextEpoch - 1} has not been pinned to Filecoin yet. Pin it first to maintain provenance chain integrity.`,
              unpinnedEpoch: nextEpoch - 1,
            }));
            return;
          }
        } catch {}
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ started: true, epochId: nextEpoch, agentCount }));

    runEpochInProcess(nextEpoch, agentCount).catch(err => {
      console.error('Epoch error:', err);
      updateProgress('error', err.message);
      running = false;
    });
    return;
  }

  if (url.pathname === '/api/parliament/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', running, paused, progress })}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🏛️  Parliament Simulation API V2 running on http://localhost:${PORT}`);
  console.log(`   POST /api/parliament/run     — trigger 7-phase epoch`);
  console.log(`   POST /api/parliament/pin     — write Filecoin CID to epoch archive`);
  console.log(`   GET  /api/parliament/stream   — SSE live feed`);
  console.log(`   GET  /api/parliament/status   — current state\n`);
});
