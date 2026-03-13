#!/usr/bin/env node

/**
 * Interspecies Parliament Simulation — Runner
 *
 * Usage: node simulation/run.js [epochCount] [agentCount]
 *
 * Examples:
 *   node simulation/run.js 1         # 1 epoch, 8 seed agents
 *   node simulation/run.js 1 200     # 1 epoch, 200 agents (generated census)
 *   node simulation/run.js 3 200     # 3 epochs, 200 agents
 */

import { runEpoch } from './epoch.js';

const epochCount = parseInt(process.argv[2] || '1');
const agentCount = parseInt(process.argv[3] || '0'); // 0 = use seed agents

console.log(`\n🌍 INTERSPECIES PARLIAMENT SIMULATION`);
console.log(`   Running ${epochCount} epoch(s)${agentCount > 0 ? ` with ${agentCount} agents` : ' (seed agents)'}...\n`);

for (let i = 1; i <= epochCount; i++) {
  await runEpoch(i, { agentCount });
  if (i < epochCount) {
    console.log('\n────────────────────────────────────────────────────────');
    console.log('  Epoch transition... agents carry memory forward.');
    console.log('────────────────────────────────────────────────────────');
  }
}

console.log('\n🏁 Simulation complete.');
