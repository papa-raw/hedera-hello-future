/**
 * Recursive Memory System for Interspecies Parliament.
 *
 * Each epoch produces structured memories that feed into the next epoch.
 * Memories are compressed from the full feed/settlement/bonds into
 * agent-specific context that fits within token budgets.
 *
 * Memory chain:
 *   epoch_1.json -> memory_1.json -> injected into epoch_2 prompts
 *   epoch_2.json -> memory_2.json -> injected into epoch_3 prompts
 *   ...
 *
 * Stored alongside epoch archives in public/simulation/ and on Filecoin
 * via CID references. The memory chain forms a provenance DAG.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const PUBLIC_DIR = resolve(import.meta.dirname, '../public/simulation');
const OUTPUT_DIR = resolve(import.meta.dirname, 'output');

/**
 * Load the previous epoch's archive to extract memories.
 * Returns null if no previous epoch exists.
 */
export function loadPreviousEpoch(currentEpochId) {
  const prevId = currentEpochId - 1;
  if (prevId < 1) return null;

  // Try public dir first (from server.js), then output dir (from epoch.js)
  for (const dir of [PUBLIC_DIR, OUTPUT_DIR]) {
    const path = resolve(dir, `epoch_${prevId}.json`);
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf-8'));
      } catch { continue; }
    }
  }
  return null;
}

/**
 * Load the cumulative memory chain for a given epoch.
 * Returns an array of all memory snapshots up to (but not including) the current epoch.
 */
export function loadMemoryChain(currentEpochId) {
  const chain = [];
  for (let i = 1; i < currentEpochId; i++) {
    const memPath = resolve(PUBLIC_DIR, `memory_${i}.json`);
    if (existsSync(memPath)) {
      try {
        chain.push(JSON.parse(readFileSync(memPath, 'utf-8')));
      } catch { /* skip corrupted */ }
    }
  }
  return chain;
}

/**
 * Extract structured memories from a completed epoch archive.
 * This is the core compression step: full epoch -> agent-relevant memories.
 *
 * Memory structure per agent:
 *   - what_happened: one-line epoch summary
 *   - eii_trajectory: EII before/after/delta + whether agent's target pillar improved
 *   - my_positions: what this agent argued for
 *   - outcomes: what was funded, what wasn't
 *   - bonds_formed: who became ally/rival
 *   - lessons: what worked/failed for maximizing ecological value
 *   - recursive_goal: updated strategy for next epoch
 */
export function extractMemories(archive) {
  const { epoch_id, eii_before, eii_after, eii_delta, settlement, proposals,
    agent_states, feed, whispers, bounties, provenance } = archive;

  // Global epoch context
  const fundedTitles = settlement.funded.map(p => p.title);
  const unfundedIds = settlement.unfunded;
  const totalEIIDelta = eii_delta.overall;
  const improved = totalEIIDelta > 0;
  const limitingPillar = ['function', 'structure', 'composition']
    .reduce((min, p) => eii_after[p] < eii_after[min] ? p : min, 'function');

  const globalContext = {
    epoch_id,
    eii_before,
    eii_after,
    eii_delta,
    improved,
    limiting_pillar: limitingPillar,
    funded: fundedTitles,
    unfunded_count: unfundedIds.length,
    treasury_remaining: settlement.treasury_remaining,
    bounties_posted: (bounties || []).length,
    provenance_cid: provenance?.cid || null,
  };

  // Per-agent memories
  const agentMemories = {};
  for (const agent of agent_states) {
    // What did this agent say?
    const myPosts = feed.filter(m => m.from_id === agent.id);
    const myDeliberations = myPosts.filter(m => m.type === 'deliberation').map(m => m.content.slice(0, 200));
    const myReactions = myPosts.filter(m => m.type === 'reaction').map(m => m.content.slice(0, 150));
    const myStaking = myPosts.find(m => m.type === 'staking')?.content?.slice(0, 200) || '';

    // What proposals did this agent's staking support?
    const supportedProposals = proposals
      .filter(p => p.supporters?.some(s => s.agent_id === agent.id))
      .map(p => ({
        title: p.title,
        pillar: p.target_pillar,
        funded: fundedTitles.includes(p.title),
        stake: p.supporters.find(s => s.agent_id === agent.id)?.amount || 0,
      }));

    // Did the agent's target pillar improve?
    const monitoredPillars = agent.class === 'species' ? ['structure']
      : agent.class === 'biome' ? ['function']
      : agent.class === 'climate_system' ? ['function', 'composition']
      : agent.class === 'economic_model' ? ['function', 'structure', 'composition']
      : agent.class === 'compliance' ? []
      : agent.class === 'mrv' ? []
      : ['structure', 'composition'];

    const pillarResults = monitoredPillars.map(p => ({
      pillar: p,
      delta: eii_delta[p],
      improved: eii_delta[p] > 0,
    }));

    // Bond changes
    const significantBonds = Object.entries(agent.bonds || {})
      .filter(([_, b]) => Math.abs(b.trust) > 0.2 || b.tension > 0.3 || b.depth > 0.3)
      .map(([id, b]) => {
        const other = agent_states.find(a => a.id === id);
        return {
          agent: other?.name || id,
          trust: b.trust,
          tension: b.tension,
          depth: b.depth,
          relationship: b.trust > 0.3 ? 'ally' : b.trust < -0.3 ? 'rival' : b.tension > 0.5 ? 'tense' : 'neutral',
        };
      });

    // Whispers received
    const whispersReceived = whispers
      .filter(w => w.to_id === agent.id)
      .map(w => ({ from: w.from, content: w.content.slice(0, 100) }));

    // Strategy assessment: did my approach work?
    const myFunded = supportedProposals.filter(p => p.funded);
    const myUnfunded = supportedProposals.filter(p => !p.funded);
    const strategyWorked = myFunded.length > myUnfunded.length;
    const pillarImproved = pillarResults.some(p => p.improved);

    // Recursive lesson
    let lesson;
    if (strategyWorked && pillarImproved) {
      lesson = `Strategy effective. ${myFunded.length} supported proposals funded. Target pillars improved. Continue current approach.`;
    } else if (strategyWorked && !pillarImproved) {
      lesson = `Proposals funded but pillars did not improve. Need to advocate for higher-impact proposals or challenge the EII delta estimates.`;
    } else if (!strategyWorked && pillarImproved) {
      lesson = `My proposals were not funded, but pillars improved anyway. Other agents' proposals may be sufficient. Consider coalition building.`;
    } else {
      lesson = `Neither proposals funded nor pillars improved. Strategy needs revision. Consider: (1) building stronger coalitions, (2) proposing lower-cost actions, (3) challenging rival positions more directly.`;
    }

    agentMemories[agent.id] = {
      epoch_id,
      agent_id: agent.id,
      agent_name: agent.name,
      agent_class: agent.class,
      soul_depth: agent.soul_depth,

      // What happened
      what_happened: `Epoch ${epoch_id}: EII ${improved ? 'improved' : 'declined'} (overall ${totalEIIDelta > 0 ? '+' : ''}${totalEIIDelta.toFixed(4)}). Limiting pillar: ${limitingPillar}. ${fundedTitles.length} proposals funded. ${(bounties || []).length} bounties posted.`,

      // EII trajectory
      eii_trajectory: {
        before: eii_before,
        after: eii_after,
        delta: eii_delta,
        my_pillars: pillarResults,
      },

      // My actions
      my_positions: myDeliberations.slice(0, 3),
      my_reactions: myReactions.slice(0, 2),
      my_staking: myStaking,
      supported_proposals: supportedProposals,

      // Outcomes
      strategy_worked: strategyWorked,
      pillar_improved: pillarImproved,

      // Social
      bonds: significantBonds,
      whispers_received: whispersReceived,

      // Recursive learning
      lesson,
      recursive_goal: pillarImproved
        ? `Maintain approach. Focus on ${limitingPillar} pillar as limiting factor.`
        : `Adjust strategy: ${limitingPillar} is limiting. Propose actions targeting ${limitingPillar}. Build coalitions with agents whose mandates align.`,
    };
  }

  return {
    epoch_id,
    timestamp: archive.timestamp,
    global: globalContext,
    agents: agentMemories,
    provenance_cid: archive.provenance?.cid || null,
    // Chain reference: points to previous epoch's memory
    previous_memory_cid: null, // Set during archival
  };
}

/**
 * Build the memory injection for an agent's system prompt.
 * Compresses the full memory chain into a token-efficient string.
 *
 * Token budget: ~200 tokens per epoch of memory, max 3 epochs back.
 */
export function buildMemoryPrompt(agentId, memoryChain) {
  if (!memoryChain || memoryChain.length === 0) return '';

  // Take last 3 epochs of memory
  const recent = memoryChain.slice(-3);
  const lines = ['MEMORY FROM PREVIOUS EPOCHS (use this to improve your strategy):'];
  // Note: each memory references a Filecoin CID anchoring the provenance chain

  for (const memory of recent) {
    const agentMem = memory.agents?.[agentId];
    if (!agentMem) {
      // Agent didn't exist in this epoch, just use global
      lines.push(`\n[Epoch ${memory.epoch_id}] ${memory.global.improved ? 'EII improved' : 'EII declined'} (${memory.global.eii_delta.overall > 0 ? '+' : ''}${memory.global.eii_delta.overall.toFixed(4)}). Limiting: ${memory.global.limiting_pillar}. Funded: ${memory.global.funded.join(', ')}.`);
      continue;
    }

    lines.push(`\n[Epoch ${agentMem.epoch_id}] ${agentMem.what_happened}`);

    // My strategy assessment
    lines.push(`  Strategy: ${agentMem.strategy_worked ? 'WORKED' : 'FAILED'}. Pillars ${agentMem.pillar_improved ? 'IMPROVED' : 'DID NOT IMPROVE'}.`);
    lines.push(`  Lesson: ${agentMem.lesson}`);
    lines.push(`  Goal: ${agentMem.recursive_goal}`);

    // Key bonds
    const allies = agentMem.bonds.filter(b => b.relationship === 'ally');
    const rivals = agentMem.bonds.filter(b => b.relationship === 'rival');
    if (allies.length > 0) lines.push(`  Allies: ${allies.map(b => b.agent).join(', ')}`);
    if (rivals.length > 0) lines.push(`  Rivals: ${rivals.map(b => b.agent).join(', ')}`);

    // What I supported and whether it worked
    if (agentMem.supported_proposals.length > 0) {
      const funded = agentMem.supported_proposals.filter(p => p.funded);
      const unfunded = agentMem.supported_proposals.filter(p => !p.funded);
      if (funded.length > 0) lines.push(`  Funded: ${funded.map(p => p.title).join(', ')}`);
      if (unfunded.length > 0) lines.push(`  Unfunded: ${unfunded.map(p => p.title).join(', ')}`);
    }

    // Cross-agent intelligence: what happened to allies/rivals
    const agentBonds = new Map();
    for (const bond of agentMem.bonds || []) {
      agentBonds.set(bond.agent, bond.relationship);
    }
    const relatedAgents = Object.entries(memory.agents || {})
      .filter(([id]) => id !== agentId && agentBonds.has(memory.agents[id]?.agent_name))
      .slice(0, 3);

    if (relatedAgents.length > 0) {
      lines.push(`  Intelligence on key relationships:`);
      for (const [id, rm] of relatedAgents) {
        const rel = agentBonds.get(rm.agent_name) || 'peer';
        lines.push(`    ${rm.agent_name} (${rel}): ${rm.strategy_worked ? 'succeeded' : 'failed'}. Lesson: "${(rm.lesson || '').slice(0, 80)}"`);
      }
    }
  }

  // Add cumulative EII trajectory
  if (recent.length > 1) {
    const first = recent[0].global;
    const last = recent[recent.length - 1].global;
    const totalDelta = {
      function: +(last.eii_after.function - first.eii_before.function).toFixed(4),
      structure: +(last.eii_after.structure - first.eii_before.structure).toFixed(4),
      composition: +(last.eii_after.composition - first.eii_before.composition).toFixed(4),
      overall: +(last.eii_after.overall - first.eii_before.overall).toFixed(4),
    };
    lines.push(`\nCUMULATIVE EII CHANGE (${recent.length} epochs): function ${totalDelta.function > 0 ? '+' : ''}${totalDelta.function}, structure ${totalDelta.structure > 0 ? '+' : ''}${totalDelta.structure}, composition ${totalDelta.composition > 0 ? '+' : ''}${totalDelta.composition}, overall ${totalDelta.overall > 0 ? '+' : ''}${totalDelta.overall}`);
    // Include provenance chain CID for verifiability
    const lastCid = recent[recent.length - 1].provenance_cid;
    if (lastCid && !lastCid.startsWith('local:')) {
      lines.push(`PROVENANCE CHAIN: Anchored to Filecoin CID ${lastCid}. All previous epoch decisions are verifiable onchain.`);
    }
    lines.push(`YOUR MISSION: Maximize ecological value. Learn from what worked and what didn't. Adapt your strategy.`);
  }

  return lines.join('\n');
}

/**
 * Save memory snapshot to disk (alongside epoch archive).
 */
export function saveMemory(memory) {
  mkdirSync(PUBLIC_DIR, { recursive: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const filename = `memory_${memory.epoch_id}.json`;
  writeFileSync(resolve(PUBLIC_DIR, filename), JSON.stringify(memory, null, 2));
  writeFileSync(resolve(OUTPUT_DIR, filename), JSON.stringify(memory, null, 2));

  return filename;
}

/**
 * Build the provenance DAG entry for this epoch.
 * Links to previous epoch's CID and includes memory hash.
 */
export function buildProvenanceEntry(archive, memory, previousCid) {
  return {
    epoch_id: archive.epoch_id,
    bioregion: archive.bioregion,
    timestamp: archive.timestamp,
    archive_cid: archive.provenance?.cid || null,
    memory_cid: null, // Set after Filecoin upload
    previous_epoch_cid: previousCid || null,
    eii_delta: archive.eii_delta,
    funded_count: archive.settlement.funded.length,
    agent_count: archive.agent_states.length,
    feed_count: archive.feed.length,
    llm_stats: archive.llm_stats,
    // DAG structure: each epoch points to previous
    dag: {
      type: 'epoch_provenance',
      version: 2,
      chain_length: archive.epoch_id,
    },
  };
}
