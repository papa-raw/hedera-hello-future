/**
 * OpenRouter LLM client with cost tracking.
 * Uses cheap models for routine, better models for spectacle.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Parse .env manually (no dependency needed)
const envPath = resolve(import.meta.dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* no .env file — rely on process.env */ }

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_ROUTINE = process.env.OPENROUTER_MODEL_ROUTINE || 'deepseek/deepseek-chat-v3-0324';
const MODEL_SPECTACLE = process.env.OPENROUTER_MODEL_SPECTACLE || 'anthropic/claude-haiku:beta';
const MAX_ROUTINE = parseInt(process.env.MAX_TOKENS_ROUTINE || '350');
const MAX_SPECTACLE = parseInt(process.env.MAX_TOKENS_SPECTACLE || '400');

let totalCalls = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;

export function getStats() {
  return { totalCalls, totalInputTokens, totalOutputTokens };
}

/**
 * Call OpenRouter.
 * @param {'routine'|'spectacle'} tier - Model tier
 * @param {string} system - System prompt
 * @param {string} user - User prompt
 * @returns {Promise<string>} Response text
 */
export async function llmCall(tier, system, user) {
  const model = tier === 'spectacle' ? MODEL_SPECTACLE : MODEL_ROUTINE;
  const maxTokens = tier === 'spectacle' ? MAX_SPECTACLE : MAX_ROUTINE;

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ecospatial.xyz',
        'X-Title': 'Interspecies Parliament Simulation',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[LLM ERROR] ${res.status}: ${err}`);
      return `[${model} unavailable — agent silent this turn]`;
    }

    const data = await res.json();
    totalCalls++;
    if (data.usage) {
      totalInputTokens += data.usage.prompt_tokens || 0;
      totalOutputTokens += data.usage.completion_tokens || 0;
    }

    return data.choices?.[0]?.message?.content?.trim() || '[no response]';
  } catch (err) {
    console.error(`[LLM ERROR] ${err.message}`);
    return `[connection error — agent silent this turn]`;
  }
}

/**
 * Call LLM for multiple agents in parallel with concurrency limit.
 * @param {Array<{tier: string, system: string, user: string, id: string}>} calls
 * @param {number} concurrency - Max simultaneous requests
 * @returns {Promise<Map<string, string>>} Map of id -> response
 */
export async function llmBatch(calls, concurrency = 15) {
  const results = new Map();
  const queue = [...calls];
  const active = [];

  async function runOne(call) {
    const result = await llmCall(call.tier, call.system, call.user);
    results.set(call.id, result);
  }

  while (queue.length > 0 || active.length > 0) {
    while (active.length < concurrency && queue.length > 0) {
      const call = queue.shift();
      const promise = runOne(call).then(() => {
        active.splice(active.indexOf(promise), 1);
      });
      active.push(promise);
    }
    if (active.length > 0) await Promise.race(active);
  }

  return results;
}

/**
 * Build a system prompt for an agent.
 * @param {object} agent - Agent definition
 * @param {string} context - Phase-specific context
 * @param {string} [memoryOverride] - Rich memory chain prompt (from memory.js)
 */
export function buildAgentSystemPrompt(agent, context, memoryOverride) {
  // Use rich memory chain if provided, otherwise fall back to simple memory array
  const memorySection = memoryOverride
    ? memoryOverride
    : (agent.memory?.length > 0 ? `MEMORY FROM PREVIOUS EPOCHS:\n${agent.memory.slice(-5).join('\n')}` : '');

  return `You are ${agent.name}, an agent in the Interspecies Parliament of the Ecospatial Vault Protocol.
You are a governance participant. Every message you send is a governance act — a position, a proposal, a vote, a challenge, or a verification request. Speak with substance. Reference specific assets, locations, numbers, and other agents by name.

CLASS: ${agent.class}
ARCHETYPE: ${agent.archetype}
SOUL DEPTH: ${agent.soul_depth}/100

VOICE: ${agent.personality.voice}

MANDATE: ${agent.mandate.objective}
MONITORS: ${agent.mandate.monitors.join(', ')}

HARD RULES:
${agent.personality.hard_bans.map(b => `- ${b}`).join('\n')}

ALLIES: ${agent.mandate.allies.join(', ') || 'none declared'}
ADVERSARIES: ${agent.mandate.adversaries.join(', ') || 'none declared'}

${memorySection}

${Object.keys(agent.relationships || {}).length > 0 ? `YOUR OPINIONS OF OTHER AGENTS:\n${Object.entries(agent.relationships).map(([id, opinion]) => `- ${id}: ${opinion}`).join('\n')}` : ''}

GOVERNANCE FORMATS (use when appropriate):
- PROPOSAL: [descriptive title at least 10 words]. Cost: $X. Target: [function|structure|composition]. Expected: +X.XX [pillar].
- BOUNTY: [specific verification task]. Reward: X ESV. Deadline: N epochs.
- SUPPORT: [proposal_id] — [reason with specific data]
- OPPOSE: [proposal_id] — [reason with specific data]
- CHALLENGE: @[agent_name] — [specific disagreement]

CONTEXT: ${context}

Respond in character. Follow your hard rules exactly. Reference real data — never invent asset names or numbers. Your goal is to MAXIMIZE ECOLOGICAL VALUE for your bioregion through governance.`;
}
