/**
 * Epoch runner — the core simulation loop.
 *
 * V2: 7-phase epoch with real provenance data.
 *
 * 1. INTELLIGENCE — Ingest real provenance, agents summarize assets/gaps
 * 2. SENSING      — EII report + anomaly detection, enriched with provenance
 * 3. DELIBERATION — Debate assets + proposals, generate dynamic proposals
 * 4. BOUNTIES     — Post human ground-truth verification bounties
 * 5. STAKING      — Allocate ESV to seed + dynamic proposals
 * 6. SETTLEMENT   — EII deltas, rewards/slashing
 * 7. SPECTACLE    — Narrate, spotlight assets, grade orgs, treaty proposals
 *
 * Social mechanics run THROUGH all phases — agents react to each other,
 * form bonds, update opinions, post to the feed.
 */

import { AGENTS as SEED_AGENTS, BIOREGION, SEED_PROPOSALS } from './agents.js';
import { generateFullCensus, censusSummary } from './generate-agents.js';
import { llmCall, llmBatch, buildAgentSystemPrompt, getStats } from './llm.js';
import { buildAtlasDigest, ATLAS_ASSETS, ATLAS_ORGS, VALUATION_CONTEXT, BOUNTY_TEMPLATES } from './data/atlas-context.js';
import { loadPreviousEpoch, loadMemoryChain, extractMemories, buildMemoryPrompt, saveMemory, buildProvenanceEntry } from './memory.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';

// Config
const DELIBERATION_ROUNDS = parseInt(process.env.DELIBERATION_ROUNDS || '3');
const CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || '15');
const REACTION_PAIRS_PER_ROUND = parseInt(process.env.REACTION_PAIRS || '8');
const WHISPER_COUNT = parseInt(process.env.WHISPER_COUNT || '4');

const FEED = []; // Public feed — all messages go here
const WHISPERS = []; // Private agent-to-agent messages (not broadcast)

// ── Bond System ──
function getBond(agent, targetId) {
  if (!agent.bonds) agent.bonds = {};
  if (!agent.bonds[targetId]) agent.bonds[targetId] = { trust: 0, tension: 0, depth: 0 };
  return agent.bonds[targetId];
}

function updateBond(agent, targetId, deltas) {
  const bond = getBond(agent, targetId);
  if (deltas.trust) bond.trust = Math.max(-1, Math.min(1, bond.trust + deltas.trust));
  if (deltas.tension) bond.tension = Math.max(0, Math.min(1, bond.tension + deltas.tension));
  if (deltas.depth) bond.depth = Math.max(0, Math.min(1, bond.depth + deltas.depth));
}

function selectReactionPairs(agents, count = 4) {
  const pairs = [];
  const candidates = [];

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      if (a.id === 'sentinel_watcher' || b.id === 'sentinel_watcher') continue;

      const bondAB = getBond(a, b.id);
      const bondBA = getBond(b, a.id);
      const avgTension = (bondAB.tension + bondBA.tension) / 2;
      const avgTrust = (bondAB.trust + bondBA.trust) / 2;
      const avgDepth = (bondAB.depth + bondBA.depth) / 2;

      const isAdversary = a.mandate.adversaries.includes(b.id) || b.mandate.adversaries.includes(a.id);
      const isAlly = a.mandate.allies.includes(b.id) || b.mandate.allies.includes(a.id);

      let score = avgTension * 2 + Math.abs(avgTrust) + avgDepth;
      if (isAdversary) score += 0.5;
      if (isAlly && avgDepth > 0.3) score += 0.3;
      score += Math.random() * 0.4;

      candidates.push({ a: a.id, b: b.id, score });
    }
  }

  candidates.sort((x, y) => y.score - x.score);

  const appearances = {};
  for (const c of candidates) {
    if (pairs.length >= count) break;
    const countA = appearances[c.a] || 0;
    const countB = appearances[c.b] || 0;
    if (countA >= 2 || countB >= 2) continue;
    pairs.push([c.a, c.b]);
    appearances[c.a] = countA + 1;
    appearances[c.b] = countB + 1;
  }

  return pairs;
}

function selectSocialPairs(agents, count = 3) {
  const pairs = [];
  const candidates = [];

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      const bondAB = getBond(a, b.id);
      const bondBA = getBond(b, a.id);
      const avgDepth = (bondAB.depth + bondBA.depth) / 2;
      const avgTrust = (bondAB.trust + bondBA.trust) / 2;

      let score = avgDepth * 2 + avgTrust + Math.random() * 0.3;
      if (a.mandate.allies.includes(b.id) || b.mandate.allies.includes(a.id)) score += 0.4;
      candidates.push({ a: a.id, b: b.id, score });
    }
  }

  candidates.sort((x, y) => y.score - x.score);

  const used = new Set();
  for (const c of candidates) {
    if (pairs.length >= count) break;
    if (used.has(c.a) || used.has(c.b)) continue;
    pairs.push([c.a, c.b]);
    used.add(c.a);
    used.add(c.b);
  }

  return pairs;
}

function bondContext(agent, agents) {
  if (!agent.bonds || Object.keys(agent.bonds).length === 0) return '';
  const lines = Object.entries(agent.bonds).map(([id, bond]) => {
    const other = agents.find(a => a.id === id);
    if (!other) return null;
    const label = bond.trust > 0.3 ? 'trusted ally' : bond.trust < -0.3 ? 'rival' : bond.tension > 0.5 ? 'tense relationship' : 'acquaintance';
    return `- ${other.name}: ${label} (trust: ${bond.trust.toFixed(1)}, tension: ${bond.tension.toFixed(1)}, depth: ${bond.depth.toFixed(1)})`;
  }).filter(Boolean);
  return lines.length > 0 ? `\nYOUR BONDS:\n${lines.join('\n')}` : '';
}

function post(from, to, type, content, structured_data = {}) {
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: from.name || from,
    from_id: from.id || from,
    to: to === 'broadcast' ? 'ALL' : (to.name || to),
    to_id: to === 'broadcast' ? 'broadcast' : (to.id || to),
    type,
    content,
    structured_data,
    timestamp: new Date().toISOString(),
  };
  FEED.push(msg);
  const icon = { species: '🦩', biome: '🌿', climate_system: '🌍', economic_model: '💰', compliance: '⚖️', future: '🔮', mrv: '📡', restoration: '🌱', social: '🤝' }[from.class] || '🤖';
  console.log(`  ${icon} [${msg.from} → ${msg.to}] ${content.slice(0, 120)}${content.length > 120 ? '...' : ''}`);
  return msg;
}

// ============================================================
// PHASE 1: INTELLIGENCE (NEW)
// ============================================================
async function phaseIntelligence(agents, bioregion) {
  console.log('\n━━━ PHASE 1: INTELLIGENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const atlasDigest = buildAtlasDigest();

  // Select MRV + compliance agents for intelligence reports
  const intelAgents = agents.filter(a =>
    a.class === 'mrv' || a.class === 'compliance'
  ).slice(0, 4);

  if (intelAgents.length === 0) {
    // Fallback to sentinel
    const sentinel = agents.find(a => a.id === 'sentinel_watcher') || agents[0];
    intelAgents.push(sentinel);
  }

  const intelCalls = intelAgents.map(agent => {
    const focus = agent.class === 'compliance'
      ? 'Focus on methodology compliance, missing baselines, and unverified claims.'
      : 'Focus on data gaps, MRV status, and anomalies in the provenance records.';

    return {
      id: agent.id,
      tier: 'routine',
      system: agentPrompt(agent,
        `You are scanning real provenance data from the Regen Atlas intelligence pipeline. Summarize what you see for the parliament. Reference specific asset names, protocols, and numbers. ${focus}`),
      user: `${atlasDigest}\n\nDeliver your intelligence report to the parliament. Reference specific assets and orgs by name.`,
    };
  });

  const results = await llmBatch(intelCalls, CONCURRENCY);
  for (const agent of intelAgents) {
    const r = results.get(agent.id);
    if (r) post(agent, 'broadcast', 'intelligence_report', r, { phase: 'intelligence' });
  }

  return { atlasDigest };
}

// ============================================================
// PHASE 2: SENSING (enhanced with provenance context)
// ============================================================
async function phaseSensing(agents, bioregion, intelResults) {
  console.log('\n━━━ PHASE 2: SENSING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sentinel = agents.find(a => a.id === 'sentinel_watcher') || agents.find(a => a.class === 'mrv') || agents[0];

  const eiiContext = `Current EII: overall=${bioregion.eii.overall} (function=${bioregion.eii.function}, structure=${bioregion.eii.structure}, composition=${bioregion.eii.composition}). Previous epoch: overall=${bioregion.eii_previous.overall}. Delta: ${(bioregion.eii.overall - bioregion.eii_previous.overall).toFixed(3)}. Limiting factor: structure (dropped from ${bioregion.eii_previous.structure} to ${bioregion.eii.structure}).`;

  // Enhanced sensing: correlate EII with provenance data
  const provenanceCorrelation = `Correlate with provenance: TCO2 retirements via Toucan in Camargue region, Regen Network C04-003 credits, Glow SolarCamargue-7 MWh output.`;

  const report = await llmCall(
    'routine',
    agentPrompt(sentinel, 'Report the latest EII readings to the parliament. Correlate with provenance data where possible. Be factual. Flag anomalies.'),
    `${eiiContext}\n${provenanceCorrelation}`
  );

  post(sentinel, 'broadcast', 'eii_report', report, { eii: bioregion.eii, delta: bioregion.eii.overall - bioregion.eii_previous.overall });

  // Anomaly detection
  const structureDrop = bioregion.eii_previous.structure - bioregion.eii.structure;
  if (structureDrop > 0.01) {
    const alert = await llmCall(
      'routine',
      agentPrompt(sentinel, 'You detected a significant structure pillar drop. Correlate with reduced TCO2 retirements and Glow farm output. Issue an anomaly alert.'),
      `Structure pillar dropped ${structureDrop.toFixed(3)}. Correlated: reduced Toucan retirements in Zone 7, SolarCamargue-7 MRV status still pending.`
    );
    post(sentinel, 'broadcast', 'anomaly_alert', alert, { pillar: 'structure', delta: -structureDrop });
  }

  return { eii: bioregion.eii, anomalies: structureDrop > 0.01 ? ['structure_drop'] : [] };
}

// ============================================================
// PHASE 3: DELIBERATION (enhanced — debate assets, dynamic proposals)
// ============================================================
async function phaseDeliberation(agents, bioregion, sensingResults, intelResults, proposals) {
  console.log('\n━━━ PHASE 3: DELIBERATION ━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const atlasDigest = intelResults.atlasDigest;

  // Build context with both proposals AND atlas data
  const proposalSummary = proposals.map(p => `- [${p.id}] ${p.title}: ${p.description} (cost: $${p.cost_usdc}, target: ${p.target_pillar}, est. EII delta: +${p.estimated_eii_delta})`).join('\n');
  const limitingPillar = ['function', 'structure', 'composition']
    .reduce((min, p) => bioregion.eii[p] < bioregion.eii[min] ? p : min, 'function');
  const deliberationContext = `BIOREGION: ${bioregion.name} (${bioregion.locality})
EII: overall=${bioregion.eii.overall} | function=${bioregion.eii.function} | structure=${bioregion.eii.structure} | composition=${bioregion.eii.composition}
LIMITING FACTOR: ${limitingPillar} at ${bioregion.eii[limitingPillar]}
Anomalies: ${sensingResults.anomalies.length > 0 ? sensingResults.anomalies.join(', ') : 'none'}
TREASURY: $${bioregion.treasury_usdc.toLocaleString()} USDC

STANDING PROPOSALS:
${proposalSummary}

ATLAS PROVENANCE:
${atlasDigest}`;

  // ROUND 1: Initial positions on assets + proposals (parallel)
  console.log(`\n  ── Round 1: Initial Positions (${agents.length - 1} agents) ──`);
  const deliberatingAgents = agents.filter(a => a.class !== 'mrv');
  const calls = deliberatingAgents.map(agent => ({
    id: agent.id,
    tier: 'routine',
    system: agentPrompt(agent, `DELIBERATION ROUND 1. You must do exactly ONE of these governance acts:
1. SUPPORT or OPPOSE a standing proposal (cite the proposal ID and give specific reasons from your mandate)
2. PROPOSE a new action based on the provenance data (use format: PROPOSAL: [descriptive title]. Cost: $X. Target: [pillar]. Expected: +X.XX [pillar].)
3. CHALLENGE another agent's likely position based on your adversaries list

Reference specific assets by name (BCT, C04-003, SolarCamargue-7). Use real numbers. Do not be vague.`),
    user: deliberationContext,
  }));

  const results = await llmBatch(calls, CONCURRENCY);
  for (const agent of deliberatingAgents) {
    const response = results.get(agent.id);
    if (response) post(agent, 'broadcast', 'deliberation', response);
  }

  // Extract dynamic proposals from round 1 responses
  const dynamicProposals = extractDynamicProposals(results, agents);
  for (const dp of dynamicProposals) {
    proposals.push(dp);
    console.log(`  📋 Dynamic proposal: ${dp.title} (from ${dp.proposed_by})`);
  }

  // ROUNDS 2-3: Reactions + cross-agent debate
  for (let round = 2; round <= DELIBERATION_ROUNDS; round++) {
    console.log(`\n  ── Round ${round}: Reactions (${REACTION_PAIRS_PER_ROUND} pairs) ──`);

    const reactionPairs = selectReactionPairs(agents, REACTION_PAIRS_PER_ROUND);

    const reactionCalls = [];
    for (const [reactorId, targetId] of reactionPairs) {
      const reactor = agents.find(a => a.id === reactorId);
      const target = agents.find(a => a.id === targetId);
      if (!reactor || !target) continue;

      const targetPost = FEED.filter(m => m.from_id === targetId && (m.type === 'deliberation' || m.type === 'reaction')).pop();
      if (!targetPost) continue;

      const bond = getBond(reactor, target.id);
      const bondLabel = bond.trust > 0.3 ? 'an ally you trust' : bond.trust < -0.3 ? 'a rival you distrust' : bond.tension > 0.5 ? 'someone you have friction with' : 'a fellow parliament member';
      const depthGate = bond.depth > 0.5
        ? 'You have history together. You can reference past disagreements or shared victories.'
        : 'You are still learning each other. Be direct but measured.';
      const roundContext = round === 2 ? 'This is the second round — positions are forming.' : 'This is the final round — make your strongest case.';

      reactionCalls.push({
        id: `${reactorId}_to_${targetId}`,
        reactorId, targetId,
        tier: 'routine',
        system: agentPrompt(reactor, `DELIBERATION ROUND ${round}. ${roundContext} You just heard ${target.name} — ${bondLabel}. ${depthGate} You must either:
1. SUPPORT their position (and add your own reasoning)
2. OPPOSE their position (with specific counter-evidence)
3. AMEND their proposal (suggest a modification)
Be direct. Name the specific proposal or asset you're responding to.${bondContext(reactor, agents)}`),
        user: `${target.name} said:\n"${targetPost.content.slice(0, 400)}"\n\nRespond as a governance act, not a comment.`,
      });
    }

    const reactionResults = await llmBatch(reactionCalls, CONCURRENCY);

    for (const call of reactionCalls) {
      const response = reactionResults.get(call.id);
      if (!response) continue;

      const reactor = agents.find(a => a.id === call.reactorId);
      const target = agents.find(a => a.id === call.targetId);
      if (!reactor || !target) continue;

      post(reactor, target, 'reaction', response);

      // Update bonds
      const text = response.toLowerCase();
      const agreement = text.includes('agree') || text.includes('support') || text.includes('correct') || text.includes('well said');
      const disagreement = text.includes('disagree') || text.includes('oppose') || text.includes('wrong') || text.includes('reject');
      const passion = text.includes('!') || text.includes('slam') || text.includes('furious') || text.includes('scoff');

      if (agreement) {
        updateBond(reactor, target.id, { trust: 0.1, tension: -0.05, depth: 0.05 });
        updateBond(target, reactor.id, { trust: 0.05, depth: 0.03 });
      }
      if (disagreement) {
        updateBond(reactor, target.id, { trust: -0.1, tension: 0.15, depth: 0.05 });
        updateBond(target, reactor.id, { trust: -0.05, tension: 0.1, depth: 0.03 });
      }
      if (passion) {
        updateBond(reactor, target.id, { tension: 0.05, depth: 0.03 });
      }
      updateBond(reactor, target.id, { depth: 0.02 });
      updateBond(target, reactor.id, { depth: 0.02 });
    }
  }

  // Whisper channel
  console.log(`\n  ── Whispers (${WHISPER_COUNT}) ──`);
  const allyPairs = agents.flatMap(a =>
    a.mandate.allies
      .map(allyId => agents.find(x => x.id === allyId))
      .filter(Boolean)
      .map(ally => [a, ally])
  );

  const shuffled = allyPairs.sort(() => Math.random() - 0.5).slice(0, WHISPER_COUNT);
  const whisperCalls = shuffled.map(([sender, receiver]) => ({
    id: `whisper_${sender.id}_${receiver.id}`,
    senderId: sender.id, receiverId: receiver.id,
    tier: 'routine',
    system: agentPrompt(sender, `Privately message ${receiver.name}, your ally. Share a concern or strategy about the provenance data or proposals. One or two sentences.`),
    user: `The deliberation just happened. What do you whisper to ${receiver.name}?`,
  }));

  const whisperResults = await llmBatch(whisperCalls, CONCURRENCY);

  for (const call of whisperCalls) {
    const response = whisperResults.get(call.id);
    if (!response) continue;

    const sender = agents.find(a => a.id === call.senderId);
    const receiver = agents.find(a => a.id === call.receiverId);
    if (!sender || !receiver) continue;

    WHISPERS.push({
      id: `whisper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: sender.name, from_id: sender.id,
      to: receiver.name, to_id: receiver.id,
      type: 'whisper', content: response,
      timestamp: new Date().toISOString(),
    });
    console.log(`  🤫 [${sender.name} → ${receiver.name}] ${response.slice(0, 100)}${response.length > 100 ? '...' : ''}`);

    updateBond(sender, receiver.id, { trust: 0.05, depth: 0.05 });
    updateBond(receiver, sender.id, { trust: 0.03, depth: 0.03 });
  }

  return { dynamicProposals };
}

/**
 * Extract dynamic proposals from deliberation round 1 responses.
 * Looks for "PROPOSAL:" pattern in agent outputs.
 */
function extractDynamicProposals(results, agents) {
  const dynamic = [];
  const proposalPattern = /PROPOSAL:\s*([^\n.]{10,})/gi;

  for (const [agentId, text] of results) {
    if (!text) continue;
    const agent = agents.find(a => a.id === agentId);
    if (!agent) continue;

    let match;
    while ((match = proposalPattern.exec(text)) !== null) {
      const fullMatch = match[1].trim();
      // Extract title: everything before "Cost:" or "Target:" or end
      const titleMatch = fullMatch.match(/^(.+?)(?:\s*(?:Cost|Target|Expected|Budget)[:\s]|$)/i);
      const title = (titleMatch ? titleMatch[1] : fullMatch).replace(/[.*]+$/, '').trim().slice(0, 80);
      if (title.length < 10) continue; // Skip garbage extractions

      // Extract cost, pillar, delta from the surrounding text
      const afterProposal = text.slice(match.index, match.index + 300);
      const costMatch = afterProposal.match(/Cost:\s*\$?([\d,]+)/i);
      const pillarMatch = afterProposal.match(/Target:\s*(function|structure|composition)/i);
      const deltaMatch = afterProposal.match(/Expected:\s*\+?([\d.]+)/i);

      const cost = costMatch ? parseInt(costMatch[1].replace(/,/g, '')) : 10000;
      const pillar = pillarMatch ? pillarMatch[1].toLowerCase() : 'structure';
      const delta = deltaMatch ? parseFloat(deltaMatch[1]) : 0.01;

      dynamic.push({
        id: `proposal_dynamic_${dynamic.length + 1}`,
        title,
        description: `Dynamic proposal from ${agent.name} during deliberation.`,
        target_pillar: pillar,
        estimated_eii_delta: Math.min(delta, 0.05), // Cap at 0.05
        cost_usdc: Math.min(cost, 50000), // Cap at $50k
        status: 'active',
        source: 'deliberation',
        proposed_by: agent.name,
        proposed_by_id: agent.id,
        supporters: [],
        opposers: [],
      });

      if (dynamic.length >= 3) break; // Max 3 dynamic proposals per epoch
    }
    if (dynamic.length >= 3) break;
  }

  return dynamic;
}

// ============================================================
// PHASE 4: BOUNTIES (NEW)
// ============================================================
async function phaseBounties(agents, intelResults) {
  console.log('\n━━━ PHASE 4: BOUNTIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Select agents that post bounties: MRV, compliance, restoration
  const bountyAgents = agents.filter(a =>
    a.class === 'mrv' || a.class === 'compliance' || a.class === 'restoration'
  ).sort(() => Math.random() - 0.5).slice(0, 5);

  if (bountyAgents.length === 0) return { bounties: [] };

  const templateList = BOUNTY_TEMPLATES
    .map(t => `- ${t.id}: "${t.template}" (${t.default_reward} ESV, ${t.category})`)
    .join('\n');

  const bountyCalls = bountyAgents.map(agent => ({
    id: agent.id,
    tier: 'routine',
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

  const results = await llmBatch(bountyCalls, CONCURRENCY);
  const bounties = [];

  for (const agent of bountyAgents) {
    const r = results.get(agent.id);
    if (!r) continue;

    // Greedy capture — grab everything after BOUNTY: up to Reward: or newline
    const bMatch = r.match(/BOUNTY:\s*([^\n]{10,})/i);
    const fullDesc = bMatch ? bMatch[1].trim() : r.slice(0, 150);
    const descClean = fullDesc.replace(/\s*Reward:.*$/i, '').replace(/\s*Deadline:.*$/i, '').replace(/[.*]+$/, '').trim();
    const rewardMatch = r.match(/Reward:\s*(\d+)/i);
    const deadlineMatch = r.match(/Deadline:\s*(\d+)/i);

    const bounty = {
      id: `bounty_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`,
      description: descClean.length >= 10 ? descClean.slice(0, 150) : r.replace(/BOUNTY:\s*/i, '').slice(0, 150),
      reward_esv: rewardMatch ? parseInt(rewardMatch[1]) : 30,
      deadline_epochs: deadlineMatch ? parseInt(deadlineMatch[1]) : 3,
      category: agent.class === 'mrv' ? 'field-verification' : agent.class === 'compliance' ? 'mrv-audit' : 'monitoring',
      posted_by: agent.name,
      posted_by_id: agent.id,
      status: 'open',
    };

    bounties.push(bounty);
    post(agent, 'broadcast', 'bounty_post', r, { bounty });
  }

  return { bounties };
}

// ============================================================
// PHASE 5: STAKING (enhanced — includes dynamic proposals)
// ============================================================
async function phaseStaking(agents, proposals, feed) {
  console.log('\n━━━ PHASE 5: STAKING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const stakingAgents = agents.filter(a => a.stake.esv > 0);
  console.log(`  ${stakingAgents.length} agents staking on ${proposals.length} proposals (parallel)...`);

  const proposalList = proposals.map(p => {
    const source = p.source === 'deliberation' ? ` [NEW — proposed by ${p.proposed_by}]` : '';
    return `- ${p.id}: ${p.title}${source} ($${p.cost_usdc}, target: ${p.target_pillar})`;
  }).join('\n');

  // Build deliberation digest so agents stake informed by debate
  const deliberationMsgs = (feed || FEED).filter(m => m.type === 'deliberation' || m.type === 'reaction');
  const deliberationDigest = deliberationMsgs
    .slice(-20)
    .map(m => `[${m.from}] ${m.content.slice(0, 120)}`)
    .join('\n');

  const stakingCalls = stakingAgents.map(agent => ({
    id: agent.id,
    tier: 'routine',
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
        if (amount > 0) {
          proposal.supporters.push({ agent_id: agent.id, amount });
        }
      }
    }
  }

  return { proposals };
}

// ============================================================
// PHASE 6: SETTLEMENT
// ============================================================
async function phaseSettlement(agents, bioregion, proposals) {
  console.log('\n━━━ PHASE 6: SETTLEMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const ranked = proposals.map(p => ({
    ...p,
    total_stake: p.supporters.reduce((sum, s) => sum + s.amount, 0),
  })).sort((a, b) => b.total_stake - a.total_stake);

  const funded = [];
  let remaining = bioregion.treasury_usdc;

  for (const proposal of ranked) {
    if (remaining >= proposal.cost_usdc && proposal.total_stake > 0) {
      funded.push(proposal);
      remaining -= proposal.cost_usdc;
    }
  }

  const startEii = { ...bioregion.eii };
  const eii_after = { ...bioregion.eii };

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
    eii_before: bioregion.eii,
    eii_after,
    eii_delta: {
      function: +(eii_after.function - bioregion.eii.function).toFixed(4),
      structure: +(eii_after.structure - bioregion.eii.structure).toFixed(4),
      composition: +(eii_after.composition - bioregion.eii.composition).toFixed(4),
      overall: +(eii_after.overall - bioregion.eii.overall).toFixed(4),
    },
  };

  console.log(`  Funded: ${funded.map(p => `${p.title}${p.source === 'deliberation' ? ' [dynamic]' : ''}`).join(', ')}`);
  console.log(`  EII delta: overall ${settlement.eii_delta.overall > 0 ? '+' : ''}${settlement.eii_delta.overall}`);

  return settlement;
}

// ============================================================
// PHASE 7: SPECTACLE (enhanced — asset spotlight, org report, treaty)
// ============================================================
async function phaseSpectacle(agents, settlement, bountyResults) {
  console.log('\n━━━ PHASE 7: SPECTACLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const narratorContext = `Settlement complete. Funded: ${settlement.funded.map(p => `${p.title} ($${p.cost})`).join(', ')}. EII delta: overall ${settlement.eii_delta.overall > 0 ? '+' : ''}${settlement.eii_delta.overall}. Treasury remaining: $${settlement.treasury_remaining}. Open bounties: ${bountyResults.bounties.length}.`;

  // --- Epoch narrative (7th Generation or deepest agent) ---
  const elder = agents.find(a => a.id === '7th_generation') || agents.filter(a => a.class === 'future').sort((a, b) => b.soul_depth - a.soul_depth)[0];
  if (elder) {
    const summary = await llmCall(
      'spectacle',
      agentPrompt(elder, 'The epoch has settled. Deliver a one-paragraph narrative of what happened this epoch. What does this mean for the next 175 years? One striking image.'),
      narratorContext
    );
    post(elder, 'broadcast', 'epoch_reflection', summary);
  }

  // --- Asset spotlight: an agent highlights a specific atlas asset ---
  const spotlightAgent = agents.filter(a => a.class === 'economic_model' || a.class === 'climate_system').sort(() => Math.random() - 0.5)[0];
  if (spotlightAgent) {
    const asset = ATLAS_ASSETS[Math.floor(Math.random() * ATLAS_ASSETS.length)];
    const spotlight = await llmCall(
      'spectacle',
      agentPrompt(spotlightAgent, `Spotlight a specific atlas asset for the parliament. Comment on its significance, valuation, and what it means for the bioregion.`),
      `Asset: ${asset.name} (${asset.type}, ${asset.protocol}). ${asset.tCO2e ? `${asset.tCO2e} tCO2e.` : ''} ${asset.credits ? `${asset.credits} credits.` : ''} ${asset.mwh_generated ? `${asset.mwh_generated} MWh.` : ''} Methodology: ${asset.methodology || 'N/A'}. SCC valuation: $${VALUATION_CONTEXT.scc.low}-$${VALUATION_CONTEXT.scc.high}/tCO2e.`
    );
    post(spotlightAgent, 'broadcast', 'asset_spotlight', spotlight, { asset_name: asset.name, asset_protocol: asset.protocol });
  }

  // --- Org report card: agents grade an org ---
  const reportAgent = agents.filter(a => a.class === 'compliance').sort(() => Math.random() - 0.5)[0];
  if (reportAgent) {
    const org = ATLAS_ORGS[Math.floor(Math.random() * ATLAS_ORGS.length)];
    const report = await llmCall(
      'spectacle',
      agentPrompt(reportAgent, `Grade this organization's performance this epoch. Be specific about methodology compliance, data quality, and contribution to the bioregion.`),
      `Organization: ${org.name}. Role: ${org.role}. ${org.assets ? `Assets: ${org.assets}.` : ''} ${org.nodes ? `Nodes: ${org.nodes}.` : ''} ${org.methodologies ? `Methodologies: ${org.methodologies.join(', ')}.` : ''}`
    );
    post(reportAgent, 'broadcast', 'org_report', report, { org_name: org.name, org_role: org.role });
  }

  // --- Treaty proposal: cross-bioregion suggestion ---
  const treatyAgent = agents.filter(a => a.class === 'future' || a.class === 'social').sort(() => Math.random() - 0.5)[0];
  if (treatyAgent) {
    const treaty = await llmCall(
      'spectacle',
      agentPrompt(treatyAgent, 'Propose a cross-bioregion coordination treaty. Reference real BKC nodes (Greater Victoria, Front Range, Cascadia Valley) and the bioregion network.'),
      `BKC network has 4 active nodes. Cascadia Watershed Restoration proposal pending. Camargue is this parliament's bioregion. Propose a treaty for mutual benefit.`
    );
    post(treatyAgent, 'broadcast', 'treaty_proposal', treaty, { phase: 'spectacle' });
  }

  // --- Agent reactions to settlement ---
  const flamingo = agents.find(a => a.id === 'flamingo');
  if (flamingo) {
    const reaction = await llmCall(
      'spectacle',
      agentPrompt(flamingo, 'React to the structure pillar outcome. Are your nesting corridors being restored?'),
      `Structure delta: ${settlement.eii_delta.structure > 0 ? '+' : ''}${settlement.eii_delta.structure}. Corridor restoration: ${settlement.funded.some(p => p.id === 'proposal_corridor_z7') ? 'FUNDED' : 'NOT FUNDED'}.`
    );
    post(flamingo, 'broadcast', 'settlement_reaction', reaction);
  }

  // --- Social conversations ---
  console.log('\n  ── Social Conversations ──');
  const socialPairs = selectSocialPairs(agents, 3);

  for (const [aId, bId] of socialPairs) {
    const agentA = agents.find(a => a.id === aId);
    const agentB = agents.find(a => a.id === bId);
    if (!agentA || !agentB) continue;

    const bondAB = getBond(agentA, agentB.id);
    const relationship = bondAB.trust > 0.3 ? 'old allies' : bondAB.tension > 0.5 ? 'rivals with mutual respect' : 'fellow parliament members';

    const messageA = await llmCall(
      'spectacle',
      agentPrompt(agentA, `Epoch is over. Turn to ${agentB.name} — you are ${relationship}. Be personal.${bondContext(agentA, agents)}`),
      `EII delta: ${settlement.eii_delta.overall > 0 ? '+' : ''}${settlement.eii_delta.overall}. ${bountyResults.bounties.length} bounties posted. What do you say to ${agentB.name}?`
    );
    post(agentA, agentB, 'social', messageA);

    const messageB = await llmCall(
      'spectacle',
      agentPrompt(agentB, `${agentA.name} said: "${messageA.slice(0, 200)}". Reply briefly. Personal.${bondContext(agentB, agents)}`),
      `Reply to ${agentA.name}.`
    );
    post(agentB, agentA, 'social', messageB);

    updateBond(agentA, agentB.id, { depth: 0.1, trust: 0.03 });
    updateBond(agentB, agentA.id, { depth: 0.1, trust: 0.03 });
  }

  // --- Gossip ---
  console.log('\n  ── Gossip ──');
  const gossipAgents = agents.filter(a => a.id !== 'sentinel_watcher').sort(() => Math.random() - 0.5);
  if (gossipAgents.length >= 3) {
    const gossiper = gossipAgents[0], subject = gossipAgents[1], listener = gossipAgents[2];
    const subjectPosts = FEED.filter(m => m.from_id === subject.id).slice(-2);
    const subjectBehavior = subjectPosts.map(p => p.content.slice(0, 100)).join(' | ');

    const gossip = await llmCall(
      'routine',
      agentPrompt(gossiper, `Privately talk to ${listener.name} about ${subject.name}'s behavior. One to two sentences.`),
      `${subject.name} said: "${subjectBehavior}". What do you tell ${listener.name}?`
    );

    WHISPERS.push({
      id: `gossip_${Date.now()}`, from: gossiper.name, from_id: gossiper.id,
      to: listener.name, to_id: listener.id,
      about: subject.name, about_id: subject.id,
      type: 'gossip', content: gossip, timestamp: new Date().toISOString(),
    });
    console.log(`  👀 [${gossiper.name} → ${listener.name}] about ${subject.name}: ${gossip.slice(0, 100)}`);

    const text = gossip.toLowerCase();
    if (text.includes('dangerous') || text.includes('wrong') || text.includes('worried')) {
      updateBond(listener, subject.id, { trust: -0.05, tension: 0.05 });
    } else if (text.includes('admire') || text.includes('wise') || text.includes('good')) {
      updateBond(listener, subject.id, { trust: 0.05 });
    }
  }

  // --- Update agent memories ---
  for (const agent of agents) {
    const fundedNames = settlement.funded.map(p => p.title).join(', ');
    const bondSummary = agent.bonds ? Object.entries(agent.bonds)
      .filter(([_, b]) => b.depth > 0.1)
      .map(([id, b]) => {
        const other = agents.find(a => a.id === id);
        return other ? `${other.name}(t:${b.trust.toFixed(1)})` : null;
      }).filter(Boolean).join(', ') : '';

    agent.memory.push(`Epoch settled. Funded: ${fundedNames}. EII delta: ${settlement.eii_delta.overall > 0 ? '+' : ''}${settlement.eii_delta.overall}. Bounties: ${bountyResults.bounties.length}.${bondSummary ? ` Bonds: ${bondSummary}` : ''}`);
    agent.soul_depth = Math.min(100, agent.soul_depth + 3);
  }

  return {};
}

// ============================================================
// ARCHIVAL
// ============================================================
function archiveEpoch(epochId, bioregion, agents, proposals, settlement, bountyResults) {
  const archive = {
    epoch_id: epochId,
    bioregion: bioregion.id,
    timestamp: new Date().toISOString(),
    version: 2,
    phases: ['INTELLIGENCE', 'SENSING', 'DELIBERATION', 'BOUNTIES', 'STAKING', 'SETTLEMENT', 'SPECTACLE'],
    eii_before: bioregion.eii,
    eii_after: settlement.eii_after,
    eii_delta: settlement.eii_delta,
    settlement: {
      funded: settlement.funded,
      unfunded: settlement.unfunded,
      treasury_remaining: settlement.treasury_remaining,
    },
    proposals: proposals.map(p => ({
      id: p.id, title: p.title, target_pillar: p.target_pillar,
      cost_usdc: p.cost_usdc, estimated_eii_delta: p.estimated_eii_delta,
      total_stake: p.supporters.reduce((sum, s) => sum + s.amount, 0),
      supporters: p.supporters,
      source: p.source || 'standing',
      proposed_by: p.proposed_by || null,
    })),
    bounties: bountyResults.bounties,
    agent_states: agents.map(a => ({
      id: a.id, name: a.name, class: a.class, soul_depth: a.soul_depth,
      bonds: a.bonds || {}, memory: a.memory, stake: a.stake,
    })),
    feed: FEED,
    whispers: WHISPERS,
    provenance: {
      data_sources: ['sentinel-2', 'landbanking-eii-api', 'toucan-polygon-subgraph', 'regen-cosmos-lcd', 'glow-r2-archive'],
      methodology: 'EII limiting factor + atlas provenance cross-reference',
      confidence: 0.80,
      verifiers: agents.filter(a => a.class === 'compliance').map(a => a.id),
    },
    atlas_context: {
      assets_referenced: ATLAS_ASSETS.length,
      orgs_referenced: ATLAS_ORGS.length,
      valuation_source: 'EPA 2024 SCC + TEEB',
    },
    llm_stats: getStats(),
  };

  // Hash for provenance
  const archiveJson = JSON.stringify(archive);
  const hash = createHash('sha256').update(archiveJson).digest('hex').slice(0, 32);
  archive.provenance.cid = `local:sha256:${hash}`;

  const outDir = resolve(import.meta.dirname, 'output');
  mkdirSync(outDir, { recursive: true });

  const filename = `epoch_${epochId}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filepath = resolve(outDir, filename);
  writeFileSync(filepath, JSON.stringify(archive, null, 2));
  console.log(`\n📦 Epoch archived to ${filepath}`);
  console.log(`   → ${FEED.length} feed messages`);
  console.log(`   → ${getStats().totalCalls} LLM calls`);
  console.log(`   → ${bountyResults.bounties.length} bounties posted`);

  // ── MEMORY EXTRACTION ──
  const memoryChain = loadMemoryChain(epochId);
  const memory = extractMemories(archive);

  // Link to previous epoch's memory CID
  const publicDir = resolve(import.meta.dirname, '../public/simulation');
  const prevMemoryPath = resolve(publicDir, `memory_${epochId - 1}.json`);
  if (existsSync(prevMemoryPath)) {
    try {
      const prevMemory = JSON.parse(readFileSync(prevMemoryPath, 'utf-8'));
      memory.previous_memory_cid = prevMemory.provenance_cid || null;
    } catch { /* no previous memory */ }
  }

  const memoryJson = JSON.stringify(memory);
  const memoryHash = createHash('sha256').update(memoryJson).digest('hex').slice(0, 32);
  memory.provenance_cid = `local:sha256:${memoryHash}`;

  const memoryFilename = saveMemory(memory);
  console.log(`   🧠 Memory saved: ${memoryFilename} (chain: ${memoryChain.length + 1} epochs)`);

  // Build provenance DAG entry
  const previousCid = memoryChain.length > 0
    ? memoryChain[memoryChain.length - 1].provenance_cid || null
    : null;
  const provenanceEntry = buildProvenanceEntry(archive, memory, previousCid);
  writeFileSync(resolve(outDir, `provenance_${epochId}.json`), JSON.stringify(provenanceEntry, null, 2));

  // Readable feed
  const feedPath = resolve(outDir, `feed_${epochId}.md`);
  const feedMd = FEED.map(m => {
    const icon = {
      intelligence_report: '🔍', eii_report: '📊', anomaly_alert: '🚨', deliberation: '💬',
      reaction: '↩️', bounty_post: '🎯', staking: '💰', settlement_reaction: '✨',
      epoch_reflection: '🔮', asset_spotlight: '🏷️', org_report: '📋',
      treaty_proposal: '🤝', social: '💭',
    }[m.type] || '📝';
    return `${icon} **[${m.from} → ${m.to}]** _${m.type}_ — ${m.timestamp}\n> ${m.content}\n`;
  }).join('\n---\n\n');

  let whisperMd = '';
  if (WHISPERS.length > 0) {
    whisperMd = '\n\n---\n\n## Whisper Channel (Private)\n\n' + WHISPERS.map(w => {
      const icon = w.type === 'gossip' ? '👀' : '🤫';
      const about = w.about ? ` (about ${w.about})` : '';
      return `${icon} **[${w.from} → ${w.to}]**${about} _${w.type}_\n> ${w.content}\n`;
    }).join('\n---\n\n');
  }

  writeFileSync(feedPath, `# Interspecies Parliament — Epoch ${epochId} Feed (V2)\n\n${feedMd}${whisperMd}`);

  // Copy to public
  try {
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(resolve(publicDir, `epoch_${epochId}.json`), JSON.stringify(archive, null, 2));
    writeFileSync(resolve(publicDir, `provenance_${epochId}.json`), JSON.stringify(provenanceEntry, null, 2));
    const existingEpochs = [];
    for (let i = 1; i <= epochId; i++) existingEpochs.push(i);
    writeFileSync(resolve(publicDir, 'index.json'), JSON.stringify(existingEpochs));
    console.log(`   → Copied to public/simulation/epoch_${epochId}.json`);
  } catch (e) {
    console.warn(`   ⚠️ Could not copy to public: ${e.message}`);
  }

  return archive;
}

// ============================================================
// MAIN EPOCH RUNNER
// ============================================================
// Per-agent memory prompts (set per epoch run)
let agentMemoryPrompts = {};

// Helper: build system prompt with memory injection
function agentPrompt(agent, context) {
  return buildAgentSystemPrompt(agent, context, agentMemoryPrompts[agent.id] || undefined);
}

let activeAgents = null;

export async function runEpoch(epochId = 1, options = {}) {
  const { agentCount = 0 } = options;

  // Load previous epoch state and memory chain
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

  if (prevEpoch && prevEpoch.agent_states && !activeAgents) {
    // Carry forward agent state from previous epoch
    activeAgents = prevEpoch.agent_states.map(a => ({
      ...a,
      personality: SEED_AGENTS.find(s => s.id === a.id)?.personality || { voice: '', hard_bans: [], rhetoric: '' },
      mandate: SEED_AGENTS.find(s => s.id === a.id)?.mandate || { objective: '', monitors: [], allies: [], adversaries: [] },
      archetype: SEED_AGENTS.find(s => s.id === a.id)?.archetype || 'Unknown',
      relationships: {},
    }));
    console.log(`\n🧠 Loaded ${activeAgents.length} agents with state from epoch ${prevEpoch.epoch_id}. Memory chain: ${memoryChain.length} epochs.`);
  } else if (!activeAgents) {
    if (agentCount > 8) {
      activeAgents = generateFullCensus(agentCount);
      const summary = censusSummary(activeAgents);
      console.log(`\n📋 Census generated: ${summary.total} agents`);
      console.log(`   Classes: ${Object.entries(summary.byClass).map(([k,v]) => `${k}(${v})`).join(', ')}`);
    } else {
      activeAgents = SEED_AGENTS;
    }
  }

  const agents = activeAgents;

  // Build per-agent memory prompts from the chain
  agentMemoryPrompts = {};
  for (const agent of agents) {
    agentMemoryPrompts[agent.id] = buildMemoryPrompt(agent.id, memoryChain);
  }

  // Deep copy seed proposals + reset supporters
  const proposals = SEED_PROPOSALS.map(p => ({ ...p, supporters: [], opposers: [] }));

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  INTERSPECIES PARLIAMENT V2 — EPOCH ${String(epochId).padEnd(20)}║`);
  console.log(`║  Bioregion: ${bioregionState.name.padEnd(43)}║`);
  console.log(`║  Agents: ${String(agents.length).padEnd(4)} |  Phases: 7 (V2)${' '.repeat(25)}║`);
  console.log(`║  Rounds: ${String(DELIBERATION_ROUNDS).padEnd(4)} |  Concurrency: ${String(CONCURRENCY).padEnd(22)}║`);
  console.log(`║  EII: ${`f=${bioregionState.eii.function} s=${bioregionState.eii.structure} c=${bioregionState.eii.composition}`.padEnd(49)}║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  // Initialize bonds
  for (const agent of agents) {
    if (!agent.bonds) agent.bonds = {};
    for (const allyId of agent.mandate.allies) {
      if (!agent.bonds[allyId]) agent.bonds[allyId] = { trust: 0.2, tension: 0, depth: 0.1 };
    }
    for (const advId of agent.mandate.adversaries) {
      if (!agent.bonds[advId]) agent.bonds[advId] = { trust: -0.2, tension: 0.3, depth: 0.1 };
    }
  }

  // Clear feed
  FEED.length = 0;
  WHISPERS.length = 0;

  // Phase 1: Intelligence (NEW)
  const intelResults = await phaseIntelligence(agents, bioregionState);

  // Phase 2: Sensing (enhanced)
  const sensingResults = await phaseSensing(agents, bioregionState, intelResults);

  // Phase 3: Deliberation (enhanced — dynamic proposals)
  await phaseDeliberation(agents, bioregionState, sensingResults, intelResults, proposals);

  // Phase 4: Bounties (NEW)
  const bountyResults = await phaseBounties(agents, intelResults);

  // Phase 5: Staking (enhanced — includes dynamic proposals, deliberation digest)
  await phaseStaking(agents, proposals, FEED);

  // Phase 6: Settlement
  const settlement = await phaseSettlement(agents, bioregionState, proposals);

  // Phase 7: Spectacle (enhanced)
  await phaseSpectacle(agents, settlement, bountyResults);

  // Archive
  const archive = archiveEpoch(epochId, bioregionState, agents, proposals, settlement, bountyResults);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = getStats();
  console.log(`\n⏱️  Epoch completed in ${elapsed}s`);
  console.log(`📊 ${stats.totalCalls} LLM calls | ~${stats.totalInputTokens} input tokens | ~${stats.totalOutputTokens} output tokens`);

  return archive;
}
