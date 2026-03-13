#!/usr/bin/env npx tsx
/**
 * Transform connector output (actions.json) → frontend-ready static JSON
 *
 * Produces:
 *   public/data/hedera-actions.json  — Action[] for the frontend
 *   public/data/hedera-orgs.json     — Org[] for the 6 platform operators
 *   public/data/hedera-provenance.json — VerifiableProvenance[] for intelligence pipeline
 *
 * Usage: npx tsx src/build-static.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const INPUT = join(import.meta.dirname, "../output/actions.json");
const OUTPUT_DIR = join(import.meta.dirname, "../../public/data");

// SDG reference data (matches Supabase sdgs table)
const SDG_DATA: Record<number, { code: string; title: string }> = {
  1: { code: "1", title: "No Poverty" },
  2: { code: "2", title: "Zero Hunger" },
  3: { code: "3", title: "Good Health and Well-being" },
  4: { code: "4", title: "Quality Education" },
  5: { code: "5", title: "Gender Equality" },
  6: { code: "6", title: "Clean Water and Sanitation" },
  7: { code: "7", title: "Affordable and Clean Energy" },
  8: { code: "8", title: "Decent Work and Economic Growth" },
  9: { code: "9", title: "Industry, Innovation and Infrastructure" },
  10: { code: "10", title: "Reduced Inequalities" },
  11: { code: "11", title: "Sustainable Cities and Communities" },
  12: { code: "12", title: "Responsible Consumption and Production" },
  13: { code: "13", title: "Climate Action" },
  14: { code: "14", title: "Life Below Water" },
  15: { code: "15", title: "Life on Land" },
  16: { code: "16", title: "Peace, Justice and Strong Institutions" },
  17: { code: "17", title: "Partnerships for the Goals" },
};

// Org data for the 6 Hedera platforms
const HEDERA_ORGS = [
  {
    id: 9001,
    name: "DOVU",
    status: "PUBLISHED",
    link: "https://dovu.earth",
    coordinates: { latitude: 52.15, longitude: -2.22 },
    description:
      "Soil carbon marketplace on Hedera. Guardian-verified dMRV for UK and European farms. Pioneer of tokenized soil carbon credits.",
    impact_link: "https://app.dovu.market",
    established: "2021",
    address: null,
    social: [{ platform: "twitter", link: "https://twitter.com/dovuofficial" }],
    treasury: [
      { link: "https://hashscan.io/mainnet/account/0.0.610168", platform: "hedera" },
      { link: "https://hashscan.io/mainnet/account/0.0.1357309", platform: "hedera" },
    ],
    main_image: null,
    issuers: [],
    ecosystems: [{ id: 901, name: "Hedera Guardian", status: "PUBLISHED", icon: "" }],
    assets: [],
    country_codes: ["GB", "BG", "FR"],
    bioregion_codes: ["PA12", "PA1"],
  },
  {
    id: 9002,
    name: "Tolam Earth",
    status: "PUBLISHED",
    link: "https://tolam.io",
    coordinates: { latitude: 39.83, longitude: -98.58 },
    description:
      "Multi-registry carbon credit bridge on Hedera. Tokenizes Verra VCS, EcoRegistry, and Global C-Sink credits via Guardian.",
    impact_link: "https://tolam.io",
    established: "2022",
    address: null,
    social: [{ platform: "twitter", link: "https://twitter.com/tolamearth" }],
    treasury: [
      { link: "https://hashscan.io/mainnet/account/0.0.6144372", platform: "hedera" },
      { link: "https://hashscan.io/mainnet/account/0.0.6138881", platform: "hedera" },
    ],
    main_image: null,
    issuers: [],
    ecosystems: [{ id: 901, name: "Hedera Guardian", status: "PUBLISHED", icon: "" }],
    assets: [],
    country_codes: ["MX", "US", "SG", "IN", "BR", "CO"],
    bioregion_codes: [],
  },
  {
    id: 9003,
    name: "Capturiant",
    status: "PUBLISHED",
    link: "https://capturiant.com",
    coordinates: { latitude: 37.8, longitude: -79.5 },
    description:
      "SEC-regulated forward carbon credit marketplace on Hedera. IPFS-backed metadata with Guardian provenance for US forestry projects.",
    impact_link: "https://capturiant.offerboard.com",
    established: "2023",
    address: null,
    social: [{ platform: "twitter", link: "https://twitter.com/capturiant" }],
    treasury: [
      { link: "https://hashscan.io/mainnet/account/0.0.4640644", platform: "hedera" },
      { link: "https://hashscan.io/mainnet/account/0.0.5054978", platform: "hedera" },
    ],
    main_image: null,
    issuers: [],
    ecosystems: [{ id: 901, name: "Hedera Guardian", status: "PUBLISHED", icon: "" }],
    assets: [],
    country_codes: ["US"],
    bioregion_codes: ["NA22", "NA26"],
  },
  {
    id: 9004,
    name: "OrbexCO2",
    status: "PUBLISHED",
    link: "https://orbex.co",
    coordinates: { latitude: 35.52, longitude: -86.58 },
    description:
      "Industrial carbon intensity measurement on Hedera. Paired commodity+CO2 credit tokens for recycled metals across US states. Self-measured MRV.",
    impact_link: null,
    established: "2023",
    address: null,
    social: [],
    treasury: [
      { link: "https://hashscan.io/mainnet/account/0.0.4576278", platform: "hedera" },
    ],
    main_image: null,
    issuers: [],
    ecosystems: [{ id: 901, name: "Hedera Guardian", status: "PUBLISHED", icon: "" }],
    assets: [],
    country_codes: ["US"],
    bioregion_codes: [],
  },
  {
    id: 9005,
    name: "GCR",
    status: "PUBLISHED",
    link: "https://globalclimateregistry.com",
    coordinates: { latitude: -1.94, longitude: 29.87 },
    description:
      "Global Climate Registry — Gold Standard TPDDTEC credit tokenization on Hedera. Safe water and clean cookstove projects in Rwanda.",
    impact_link: null,
    established: "2023",
    address: null,
    social: [],
    treasury: [
      { link: "https://hashscan.io/mainnet/account/0.0.3843565", platform: "hedera" },
    ],
    main_image: null,
    issuers: [],
    ecosystems: [{ id: 901, name: "Hedera Guardian", status: "PUBLISHED", icon: "" }],
    assets: [],
    country_codes: ["RW"],
    bioregion_codes: ["AT7"],
  },
  {
    id: 9006,
    name: "TYMLEZ",
    status: "PUBLISHED",
    link: "https://tymlez.com",
    coordinates: { latitude: -27.96, longitude: 153.38 },
    description:
      "GHG Corporate Standard carbon emissions accounting on Hedera. Gold Coast Health & Knowledge Precinct pilot — first carbon measurement on Hedera mainnet.",
    impact_link: null,
    established: "2022",
    address: null,
    social: [{ platform: "twitter", link: "https://twitter.com/tymlezgroup" }],
    treasury: [
      { link: "https://hashscan.io/mainnet/account/0.0.1810743", platform: "hedera" },
    ],
    main_image: null,
    issuers: [],
    ecosystems: [{ id: 901, name: "Hedera Guardian", status: "PUBLISHED", icon: "" }],
    assets: [],
    country_codes: ["AU"],
    bioregion_codes: ["AA8"],
  },
];

// Parse WKT POINT(lng lat) → { latitude, longitude }
function parseWKT(wkt: string): { latitude: number; longitude: number } | null {
  const match = wkt.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/);
  if (!match) return null;
  return { latitude: parseFloat(match[2]), longitude: parseFloat(match[1]) };
}

// Default action image per platform — sourced image or Hedera logo fallback
function getDefaultImage(actorName: string): string {
  switch (actorName) {
    case "Tolam Earth": return "/images/hedera/bridge-credit.jpg";
    case "DOVU": return "/images/hedera/soil-carbon.jpg";
    case "Capturiant": return "/images/hedera/forward-carbon.jpg";
    case "OrbexCO2": return "/images/hedera/industrial-mrv.jpg";
    case "GCR": return "/images/hedera/clean-water.jpg";
    case "TYMLEZ": return "/images/hedera/ghg-accounting.jpg";
    default: return "/chains/hedera.svg";
  }
}

// Extract tCO2e from description
function extractTCO2e(desc: string | null): number {
  if (!desc) return 0;
  const match = desc.match(/([\d,.]+)\s*tCO2e/);
  if (!match) return 0;
  return parseFloat(match[1].replace(/,/g, ""));
}

// Determine asset subtype from actor
function getSubtype(actorName: string): string {
  switch (actorName) {
    case "DOVU": return "Soil Carbon";
    case "Tolam Earth": return "Bridged Credit";
    case "Capturiant": return "Forward Carbon";
    case "OrbexCO2": return "Industrial MRV";
    case "GCR": return "Gold Standard";
    case "TYMLEZ": return "GHG Accounting";
    default: return "Carbon Credit";
  }
}

// Determine methodology from actor
function getMethodology(actorName: string): string {
  switch (actorName) {
    case "DOVU": return "DOVU Generic dMRV Standard v1.0";
    case "Tolam Earth": return "Tolam Earth Multi-Registry Bridge";
    case "Capturiant": return "Capturiant Standard (SEC-regulated)";
    case "OrbexCO2": return "OrbexCO2 Industrial MRV";
    case "GCR": return "Gold Standard TPDDTEC";
    case "TYMLEZ": return "GHG Corporate Standard";
    default: return "Unknown";
  }
}

// Determine MRV status from actor
function getMrvStatus(actorName: string): "verified" | "pending" {
  // Guardian-verified platforms
  if (["DOVU", "Tolam Earth", "Capturiant", "GCR"].includes(actorName)) return "verified";
  return "pending";
}

// Get country name from country code
function getCountryName(code: string): string {
  const map: Record<string, string> = {
    GB: "United Kingdom", BG: "Bulgaria", FR: "France", AR: "Argentina",
    BO: "Bolivia", CO: "Colombia", MX: "Mexico", US: "United States",
    SG: "Singapore", IN: "India", BR: "Brazil", RW: "Rwanda",
    AU: "Australia", KE: "Kenya",
  };
  return map[code] || code;
}

// Infer country code from location or title
function inferCountryCode(action: any): string | null {
  // Check state abbreviation in title for OrbexCO2
  const stateMatch = action.title.match(/\(([A-Z]{2})\)$/);
  if (stateMatch && action.actor_name === "OrbexCO2") return "US";

  // Try known patterns
  if (action.actor_name === "TYMLEZ") return "AU";
  if (action.actor_name === "GCR" && action.title.includes("Rwanda")) return "RW";

  // Geography-based
  if (!action.geography) return null;
  const loc = parseWKT(action.geography);
  if (!loc) return null;

  // Rough continental match
  if (loc.latitude > 40 && loc.longitude < 0 && loc.longitude > -10) return "GB";
  if (loc.latitude > 40 && loc.longitude > 20 && loc.longitude < 30) return "BG";
  if (loc.latitude > 45 && loc.longitude < 0 && loc.longitude > -5) return "FR";
  if (loc.latitude > 20 && loc.latitude < 50 && loc.longitude < -60) return "US";
  if (loc.latitude < 0 && loc.longitude > 100) return "AU";
  if (loc.latitude < 0 && loc.longitude > 25 && loc.longitude < 35) return "RW";

  return null;
}

interface RawAction {
  title: string;
  description: string | null;
  main_image: string | null;
  geography: string | null;
  action_start_date: string | null;
  action_end_date: string | null;
  sdg_ids: number[];
  actor_name: string | null;
  protocol_id: string;
  proof_link: string | null;
  proof_metadata_link: string;
  proof_image_link: string | null;
  platform_id: string;
  explorer_link: string;
  _key: string;
  _synced_at: string;
}

function main() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const raw: RawAction[] = JSON.parse(readFileSync(INPUT, "utf-8"));
  console.log(`📦 Loaded ${raw.length} raw actions from output/actions.json`);

  // Transform to frontend Action[]
  const actions = raw.map((a, i) => {
    const location = a.geography ? parseWKT(a.geography) : null;
    const countryCode = inferCountryCode(a);

    return {
      id: `hedera-${i + 1}`,
      title: a.title,
      description: a.description,
      status: "PUBLISHED",
      location,
      country_code: countryCode,
      region: null,
      action_start_date: a.action_start_date,
      action_end_date: a.action_end_date,
      main_image: a.main_image || getDefaultImage(a.actor_name || ""),
      created_at: a._synced_at,
      edited_at: null,
      actors: a.actor_name
        ? [{ id: `actor-${a.actor_name.toLowerCase().replace(/\s+/g, "-")}`, name: a.actor_name, website: null }]
        : [],
      sdg_outcomes: a.sdg_ids.map((id) => ({
        id,
        code: SDG_DATA[id]?.code || String(id),
        title: SDG_DATA[id]?.title || `SDG ${id}`,
      })),
      proofs: [
        {
          id: `proof-${i + 1}`,
          proof_link: a.proof_link || a.explorer_link,
          minted_at: a.action_start_date,
          proof_metadata_link: a.proof_metadata_link,
          proof_image_link: a.proof_image_link,
          proof_transaction_hash: null,
          proof_explorer_link: a.explorer_link,
          protocol: {
            id: "hedera-guardian",
            name: "Hedera Guardian",
            logo: "/protocols/hedera-guardian.svg",
            color: "#8259EF",
            website: "https://guardian.hedera.com",
          },
          platform: {
            id: "hedera-hashgraph",
            name: "Hedera",
            shortname: "Hedera",
            color: "#8259EF",
            image: {
              thumb: "/chains/hedera.svg",
              small: "/chains/hedera.svg",
              large: "/chains/hedera.svg",
            },
          },
        },
      ],
    };
  });

  // Aggregate actions by normalized title + location (same site, different issuance periods)
  // Strip trailing year (2020-2099), state codes like "(CA)", and vintage suffixes
  const normalizeTitle = (title: string) =>
    title
      .replace(/\s+20[2-9]\d\s*$/, "")       // trailing year: "Forward Carbon 2029"
      .replace(/\s*\(\d{4}\)\s*$/, "")         // "(2029)" suffix
      .replace(/\s*#\d+\s*$/, "")              // "#3" suffix
      .replace(/\s*-\s*\d{4}\s*$/, "")         // "- 2029" suffix
      .trim();

  const aggregationKey = (a: any) => {
    const loc = a.location ? `${a.location.latitude},${a.location.longitude}` : "none";
    return `${normalizeTitle(a.title)}|${loc}`;
  };

  const groups = new Map<string, any[]>();
  for (const a of actions) {
    const key = aggregationKey(a);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }

  const aggregatedActions: any[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      aggregatedActions.push(group[0]);
      continue;
    }
    // Sort by date ascending
    group.sort((a: any, b: any) =>
      (a.action_start_date || "").localeCompare(b.action_start_date || "")
    );
    const first = group[0];
    const last = group[group.length - 1];

    // Build periods array from individual actions
    const periods = group.map((a: any) => ({
      date: a.action_start_date || a.created_at,
      description: a.description,
      proof_id: a.proofs[0]?.id || a.id,
    }));

    // Merge proofs from all actions
    const allProofs = group.flatMap((a: any) => a.proofs);

    // Merge SDGs (dedupe by code)
    const sdgMap = new Map<string, any>();
    for (const a of group) {
      for (const sdg of a.sdg_outcomes) {
        if (!sdgMap.has(sdg.code)) sdgMap.set(sdg.code, sdg);
      }
    }

    aggregatedActions.push({
      ...first,
      id: first.id,
      title: normalizeTitle(first.title),
      action_start_date: first.action_start_date,
      action_end_date: last.action_end_date || last.action_start_date,
      proofs: allProofs,
      sdg_outcomes: Array.from(sdgMap.values()),
      periods,
    });
  }

  console.log(`  🔗 Aggregated ${actions.length} → ${aggregatedActions.length} actions (${actions.length - aggregatedActions.length} merged)`);

  // Build VerifiableProvenance objects for intelligence pipeline
  const provenances = raw.map((a, i) => {
    const location = a.geography ? parseWKT(a.geography) : null;
    const tCO2e = extractTCO2e(a.description);
    const actorName = a.actor_name || "Unknown";
    const subtype = getSubtype(actorName);
    const methodology = getMethodology(actorName);
    const mrvStatus = getMrvStatus(actorName);
    const countryCode = inferCountryCode(a);
    const vintage = a.action_start_date ? new Date(a.action_start_date).getFullYear().toString() : "Unknown";

    // SCC-EPA valuation: $51-$190 per tCO2e
    const sccLow = 51;
    const sccHigh = 190;
    const totalLow = tCO2e * sccLow;
    const totalHigh = tCO2e * sccHigh;

    return {
      attestor: "Regen Atlas",
      attestedAt: a._synced_at,
      schemaVersion: "1.0",
      source: {
        protocol: "hedera",
        endpoint: `https://mainnet-public.mirrornode.hedera.com/api/v1/tokens`,
        queryParams: {},
        fetchedAt: a._synced_at,
      },
      asset: {
        type: "Carbon Credit",
        subtype,
        name: a.title,
        chain: "hedera-mainnet",
        contractAddress: a.explorer_link.split("/").pop() || "",
        mechanismType: "direct-credit",
        assetActionClass: "action",
      },
      impact: {
        metrics: {
          climate: {
            tCO2e,
            methodology,
            vintage,
            standard: subtype,
          },
        },
        creditingPathway: "action",
      },
      valuation: {
        methodology: "SCC-EPA-2024",
        valuePerUnit: { low: sccLow, high: sccHigh, unit: "tCO2e", currency: "USD" },
        totalValue: { low: totalLow, high: totalHigh, currency: "USD" },
        tokenMarketContext: undefined,
        gapFactor: undefined, // No market price → infinite gap
      },
      origin: {
        project: a.title,
        developer: actorName,
        location: location
          ? { lat: location.latitude, lng: location.longitude, jurisdiction: countryCode ? getCountryName(countryCode) : "Unknown" }
          : { lat: 0, lng: 0, jurisdiction: "Unknown" },
        methodology,
        startDate: a.action_start_date || undefined,
      },
      mrv: {
        status: mrvStatus,
        provider: `Guardian / ${actorName}`,
        documentCIDs: [a.proof_metadata_link],
      },
    };
  });

  // Write outputs
  writeFileSync(join(OUTPUT_DIR, "hedera-actions.json"), JSON.stringify(aggregatedActions, null, 2));
  console.log(`  ✅ Wrote ${aggregatedActions.length} aggregated actions to public/data/hedera-actions.json`);

  writeFileSync(join(OUTPUT_DIR, "hedera-orgs.json"), JSON.stringify(HEDERA_ORGS, null, 2));
  console.log(`  ✅ Wrote ${HEDERA_ORGS.length} orgs to public/data/hedera-orgs.json`);

  writeFileSync(join(OUTPUT_DIR, "hedera-provenance.json"), JSON.stringify(provenances, null, 2));
  console.log(`  ✅ Wrote ${provenances.length} provenance objects to public/data/hedera-provenance.json`);

  // Summary stats
  const totalTCO2e = provenances.reduce((s, p) => s + (p.impact.metrics.climate?.tCO2e || 0), 0);
  const totalValueLow = provenances.reduce((s, p) => s + p.valuation.totalValue.low, 0);
  const totalValueHigh = provenances.reduce((s, p) => s + p.valuation.totalValue.high, 0);
  const withGeo = actions.filter((a) => a.location).length;

  console.log(`\n📊 Pipeline summary:`);
  console.log(`  Actions:     ${actions.length} (${withGeo} with geography)`);
  console.log(`  Orgs:        ${HEDERA_ORGS.length}`);
  console.log(`  tCO2e:       ${totalTCO2e.toLocaleString()}`);
  console.log(`  Value range: $${totalValueLow.toLocaleString()} – $${totalValueHigh.toLocaleString()} (SCC-EPA)`);
}

main();
