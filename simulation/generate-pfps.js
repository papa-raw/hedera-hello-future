#!/usr/bin/env node
/**
 * Pre-generate agent PFPs via Replicate Flux Schnell.
 * Saves base64 data URLs to public/simulation/pfps.json
 * for loading into IndexedDB on first Parliament visit.
 *
 * Usage: node simulation/generate-pfps.js
 *
 * Requires: VITE_REPLICATE_API_TOKEN in .env
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
const envPath = resolve(__dirname, '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const REPLICATE_API_TOKEN = process.env.VITE_REPLICATE_API_TOKEN;
if (!REPLICATE_API_TOKEN) {
  console.error('Missing VITE_REPLICATE_API_TOKEN in .env');
  process.exit(1);
}

const MODEL = 'black-forest-labs/flux-schnell';
const API_BASE = 'https://api.replicate.com/v1';

// All 20 agents: 8 seed + 12 expanded archetypes
const AGENTS = [
  // Seed 8
  { id: 'flamingo', class: 'species', pfpType: 'REPRESENTATION' },
  { id: 'wetland_biome', class: 'biome', pfpType: 'MONITORING' },
  { id: 'carbon_cycle', class: 'climate_system', pfpType: 'MONITORING' },
  { id: 'commons_economy', class: 'economic_model', pfpType: 'ECONOMIC' },
  { id: 'eu_habitats', class: 'compliance', pfpType: 'SPECIALIST' },
  { id: 'verra_vcs', class: 'compliance', pfpType: 'SPECIALIST' },
  { id: '7th_generation', class: 'future', pfpType: 'REPRESENTATION' },
  { id: 'sentinel_watcher', class: 'mrv', pfpType: 'SPECIALIST' },
  // Expanded 12
  { id: 'posidonia_meadow', class: 'species', pfpType: 'REPRESENTATION' },
  { id: 'stone_curlew', class: 'species', pfpType: 'REPRESENTATION' },
  { id: 'salt_marsh', class: 'biome', pfpType: 'MONITORING' },
  { id: 'mediterranean_basin', class: 'biome', pfpType: 'MONITORING' },
  { id: 'water_cycle', class: 'climate_system', pfpType: 'MONITORING' },
  { id: 'token_economy', class: 'economic_model', pfpType: 'ECONOMIC' },
  { id: 'rice_agriculture', class: 'economic_model', pfpType: 'ECONOMIC' },
  { id: 'indigenous_treaty', class: 'compliance', pfpType: 'SPECIALIST' },
  { id: 'restoration_corps', class: 'restoration', pfpType: 'MONITORING' },
  { id: 'community_voice', class: 'social', pfpType: 'SOCIAL' },
  { id: 'nitrogen_cycle', class: 'climate_system', pfpType: 'MONITORING' },
  { id: 'marine_reserve', class: 'biome', pfpType: 'MONITORING' },
];

const baseStyle = 'digital art portrait, sci-fi, glowing eyes, futuristic, clean background, high detail';

const TYPE_PROMPTS = {
  MONITORING: `A sentient environmental sensor being, ${baseStyle}, green and blue color scheme, nature-tech hybrid, covered in small leaves and circuitry, wise ancient eyes`,
  ECONOMIC: `A financial AI entity, ${baseStyle}, gold and amber color scheme, geometric patterns, data streams flowing, confident expression, crystalline structure`,
  SOCIAL: `A community network spirit, ${baseStyle}, purple and pink color scheme, interconnected nodes floating around, warm friendly expression, holographic features`,
  SPECIALIST: `A scientific research android, ${baseStyle}, blue and silver color scheme, lens-like eyes, scanning patterns, precise analytical look, tool appendages`,
  REPRESENTATION: `A nature guardian spirit representing ecosystems, ${baseStyle}, earth tones and greens, animal features subtly blended, ancient and wise, forest elements`,
};

const VARIATIONS = ['ethereal glow', 'crystalline texture', 'organic patterns', 'geometric design', 'holographic shimmer'];

function generatePrompt(agentId, pfpType) {
  const seed = agentId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const base = TYPE_PROMPTS[pfpType] || TYPE_PROMPTS.MONITORING;
  const variation = VARIATIONS[seed % VARIATIONS.length];
  return `${base}, ${variation}`;
}

async function generatePFP(agent) {
  const seed = agent.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const prompt = generatePrompt(agent.id, agent.pfpType);

  console.log(`  Generating: ${agent.id} (${agent.pfpType})...`);

  const res = await fetch(`${API_BASE}/models/${MODEL}/predictions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Prefer': 'wait',
    },
    body: JSON.stringify({
      input: {
        prompt,
        seed,
        aspect_ratio: '1:1',
        output_format: 'webp',
        output_quality: 80,
        num_outputs: 1,
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error(`  FAILED: ${agent.id} - ${error}`);
    return null;
  }

  let prediction = await res.json();

  // Poll if needed
  let attempts = 0;
  while ((prediction.status === 'starting' || prediction.status === 'processing') && attempts < 30) {
    await new Promise(r => setTimeout(r, 1000));
    const pollRes = await fetch(`${API_BASE}/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    });
    prediction = await pollRes.json();
    attempts++;
  }

  if (prediction.status === 'succeeded' && prediction.output?.[0]) {
    // Download and convert to base64
    const imgRes = await fetch(prediction.output[0]);
    const blob = await imgRes.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = blob.type || 'image/webp';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    console.log(`  OK: ${agent.id} (${Math.round(base64.length / 1024)}KB)`);
    return dataUrl;
  }

  console.error(`  FAILED: ${agent.id} - status: ${prediction.status}`);
  return null;
}

async function main() {
  const outPath = resolve(__dirname, '..', 'public', 'simulation', 'pfps.json');

  // Load existing if available
  let existing = {};
  if (existsSync(outPath)) {
    try {
      existing = JSON.parse(readFileSync(outPath, 'utf-8'));
      console.log(`Loaded ${Object.keys(existing).length} existing PFPs`);
    } catch { /* ignore */ }
  }

  console.log(`\nGenerating PFPs for ${AGENTS.length} agents...\n`);

  const results = { ...existing };
  let generated = 0;
  let skipped = 0;

  for (const agent of AGENTS) {
    const cacheKey = `${agent.id.toLowerCase()}-${agent.pfpType}`;

    if (results[cacheKey]) {
      console.log(`  Skip (cached): ${agent.id}`);
      skipped++;
      continue;
    }

    const dataUrl = await generatePFP(agent);
    if (dataUrl) {
      results[cacheKey] = dataUrl;
      generated++;

      // Save after each successful generation (in case of interruption)
      writeFileSync(outPath, JSON.stringify(results, null, 0));
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  // Final save
  writeFileSync(outPath, JSON.stringify(results, null, 0));

  console.log(`\nDone: ${generated} generated, ${skipped} skipped (cached)`);
  console.log(`Total: ${Object.keys(results).length} PFPs saved to ${outPath}`);
  console.log(`File size: ${Math.round(readFileSync(outPath).length / 1024)}KB`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
