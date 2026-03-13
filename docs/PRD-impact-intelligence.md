# PRD: Verifiable Impact Intelligence

**Product:** Regen Atlas — Impact Intelligence Module
**Version:** 0.4.0
**Date:** 2026-02-25
**Status:** Shipped (Phase 2.5 complete — Filecoin CID live on Calibration Testnet)

---

## 1. Problem

The voluntary environmental asset market suffers from a fundamental legibility problem: there is no standardized way to compare the ecological value of assets across protocols, methodologies, and credit types. Investors, researchers, and policymakers face three specific failures:

1. **No cross-protocol comparison.** Toucan carbon credits, Regen Network biodiversity credits, and Glow renewable energy certificates each live in isolated registries with incompatible data formats. There's no unified view of their ecological impact or market pricing.

2. **The Ecological Impact Gap is invisible.** Markets price environmental assets at a fraction of their estimated ecosystem service value (EPA Social Cost of Carbon, TEEB biome valuations), but this gap isn't surfaced anywhere. No tool shows the ratio between what carbon trades for ($1-5/tCO2e) and what it costs society ($51-190/tCO2e per EPA 2024).

3. **Valuations are opaque.** When valuations do exist, the methodology is buried — what formula was used, what inputs, what confidence level, what citations. There's no way to trace a dollar figure back to its scientific basis.

---

## 2. Solution

A cross-protocol intelligence layer that ingests live data from three onchain environmental protocols, composes verifiable provenance objects with full methodology traces, and stores them on Filecoin.

### Core Concept: Verifiable Provenance

Every environmental asset gets a `VerifiableProvenance` object — a structured record containing:

- **Source chain**: Protocol, endpoint, query params, block height, fetch timestamp
- **Impact metrics**: tCO2e, hectares, MWh — quantified and typed by domain
- **Valuation**: Dollar range (low/high) with full methodology trace (formula, inputs, citations, confidence level)
- **Gap analysis**: Service value vs. market price, per asset and per protocol
- **MRV status**: Verification state, provider, document CIDs
- **Origin**: Project ID, developer, location, methodology, date range

These are composed client-side from live API data, matched against the Regen Atlas asset registry (500+ green assets), and optionally uploaded to Filecoin via Synapse SDK for permanent, content-addressed storage.

---

## 3. Architecture

```
[Toucan Subgraph]  [Regen LCD]  [Glow R2 Archives]  [CoinGecko/DEX]
       │                │              │                    │
       └────────────────┴──────────────┴────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Source Adapters      │
                    │  toucan.ts / regen.ts  │
                    │  glow.ts / prices.ts   │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Composition Layer    │
                    │     compose.ts         │
                    │  VerifiableProvenance  │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Valuation Engine     │
                    │    valuation.ts        │
                    │   methodologies.ts     │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
    ┌─────────▼──────┐  ┌──────▼──────┐  ┌───────▼───────┐
    │  Asset Matcher  │  │  Gap Engine │  │  Filecoin     │
    │ ProvenanceServ. │  │ compose.ts  │  │  Synapse SDK  │
    └─────────┬──────┘  └──────┬──────┘  └───────┬───────┘
              │                │                  │
              └────────────────┴──────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     Dashboard UI       │
                    │  ImpactDashboard.tsx   │
                    │  ProtocolPanel.tsx     │
                    │  GapChart.tsx          │
                    └───────────────────────┘
```

### Tech Stack

- **Frontend:** React 18, TypeScript, Vite 7, Tailwind + DaisyUI
- **Charts:** Recharts 3.7
- **Maps:** React Map GL + Mapbox GL
- **Blockchain:** Wagmi 2, Ethers 6, Viem 2, ConnectKit
- **Storage:** Filecoin via @filoz/synapse-sdk 0.37
- **Data:** Supabase (asset registry), The Graph (Toucan), Regen LCD (Regen Network), Glow R2 (Glow)

---

## 4. Data Sources

| Protocol | Source | Data | Items |
|----------|--------|------|-------|
| **Toucan** | The Graph subgraph (Polygon) | TCO2 tokens, pool amounts, retirements, project metadata | ~500 tokens |
| **Regen Network** | LCD REST API (regen-1 chain) | Projects, credit batches, supply (tradable/retired), class metadata | ~90 projects |
| **Glow** | R2 archives + audit API | Weekly power reports, per-farm audit data, carbon credits | ~3-120 farms |

### Price Feeds

| Token | Source | Used For |
|-------|--------|----------|
| CHAR (Toucan) | CoinGecko | Direct credit gap (price per tCO2e) |
| GLW (Glow) | CoinGecko | Protocol equity gap (market cap vs. service value) |
| RGEN (Regen) | Regen DEX sell orders | Direct credit gap |

---

## 5. Valuation Engine

### Three-Tier Methodology Hierarchy

Every valuation is tagged with a methodology tier and confidence level:

| Tier | Label | Confidence | When Used | Example |
|------|-------|------------|-----------|---------|
| 1. Project-Specific | "Project-Specific" | High | Registry match in `methodologies.ts` | CarbonPlus Grasslands: $15-45/tCO2e |
| 2. Biome-Specific | "Biome-Level" | Medium | Real hectare data + biome type available | TEEB Tropical Forest: $5,382-16,400/ha/yr |
| 3. Category Default | "Global Estimate" | Medium-Low | No project or biome data | EPA SCC: $51-190/tCO2e |

### Valuation Functions

| Function | Input | Formula | Source |
|----------|-------|---------|--------|
| `valuateCarbon` | tCO2e | quantity x SCC range | EPA 2024 |
| `valuateBiodiversity` | hectares + biome | hectares x TEEB biome rate | Costanza 2014, de Groot 2012 |
| `valuateRenewableEnergy` | MWh | MWh x grid_factor x SCC | EPA eGRID + EPA SCC |
| `valuateMarineStewardship` | hectares | hectares x TEEB coastal rate | Barbier 2011 |
| `valuateProjectSpecific` | quantity | quantity x project rate | Per-project methodology |

### Gap Analysis

For every priced asset, the engine computes:

```
Gap Factor = Ecosystem Service Value / Market Price
```

- **Direct credits** (Toucan, Regen): gap = SCC per unit / market price per unit
- **Protocol equity** (Glow): gap = NPV(annual service value, 3%, 30yr) / market cap

Gap factors surface the ratio between ecological value (what the science says an ecosystem service is worth) and market reality (what people actually pay).

### Methodology Trace

Every valuation carries a `MethodologyTrace` object:

```typescript
{
  tier: "category-default",
  confidence: "medium",
  methodologyName: "EPA Social Cost of Carbon 2024",
  formula: "tCO2e x SCC range ($51-$190)",
  inputs: [
    { label: "Quantity", value: "1,234 tCO2e" },
    { label: "SCC Range", value: "$51-$190/tCO2e", source: "EPA 2024" }
  ],
  citations: [
    { name: "EPA Technical Support Document", url: "...", year: 2024 }
  ]
}
```

This is rendered in the UI as an expandable card showing exactly how each number was computed.

---

## 6. Dashboard

### Layout: Three-Panel Protocol Comparison

```
┌─────────────────────────────────────────────────────────────┐
│  [Ingest]  [Upload to Filecoin]                             │
├─────────────────────────────────────────────────────────────┤
│  73 of 505 Regen Atlas assets enriched                    > │
├─────────────────────────────────────────────────────────────┤
│  Service Value: $X-$Y  |  Market: $Z  |  Gap: Nx  |  N/N   │
├──────────────────────────┬──────────────────────────────────┤
│  Service vs Market Chart │  Assets vs Actions Pie           │
├─────────┬────────────────┴────────────┬─────────────────────┤
│ TOUCAN  │  REGEN NETWORK              │  GLOW               │
│ ─────── │  ──────────────             │  ────               │
│ credits │  projects                   │  farms              │
│ $X-$Y   │  $X-$Y                      │  $X-$Y              │
│ N items │  N items                    │  N items            │
│         │                             │                     │
│ [rows]  │  [rows]                     │  [rows]             │
│ ...     │  ...                        │  ...                │
└─────────┴─────────────────────────────┴─────────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| `ImpactDashboard` | Page container — ingestion controls, progress, layout orchestration |
| `AggregateSummaryBar` | Full-width KPI bar: total value, market value, gap, methodology coverage |
| `ProtocolGapChart` | Grouped bar chart: service value vs. market value per protocol |
| `AssetActionChart` | Pie chart: tradable assets vs. retired credits |
| `ProtocolPanel` | Vertical panel per protocol with header metrics, formula, scrollable provenance list |
| `MethodologyTraceCard` | Expandable card showing tier, confidence, formula, inputs, citations |

### Key Interactions

- **Ingest Protocol Data**: Fetches live data from all three protocols, composes provenance objects, matches against asset registry
- **Expand provenance row**: Shows full methodology trace (formula, inputs, citations)
- **Upload to Filecoin**: Batch-uploads all provenance objects via Synapse SDK (requires wallet connection to Filecoin Calibration)
- **Asset enrichment**: Links provenance data back to Regen Atlas asset cards

---

## 7. Filecoin Integration

Provenance objects are content-addressed and uploaded to Filecoin via Synapse SDK:

1. Each `VerifiableProvenance` is serialized to JSON
2. SHA-256 hash computed for deduplication (local CID)
3. Uploaded to Filecoin Calibration network via Synapse
4. `pieceCid` and `dataSetId` stamped back onto the provenance object
5. Progress shown in UI (uploaded N/total)

**Requires:** Wallet connected to Filecoin Calibration network (MetaMask/ConnectKit).

---

## 8. Asset Matching

Provenance objects are automatically matched to the Regen Atlas registry (500+ assets) using a cascade:

1. **Contract address** (exact, case-insensitive)
2. **Protocol issuer** → name similarity within same issuer
3. **Coordinate proximity** (within ~3.5km, tight to avoid default coords)
4. **Country code** + hash distribution (deterministic spread across same-country assets)

Matched assets are enriched with provenance data and shown as linked chips in the dashboard.

---

## 9. Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Biodiversity credits without area data use SCC floor ($51-190/credit) instead of TEEB per-hectare rates | Undervalues biodiversity projects that do cover large areas | Methodology trace marks these as "category-default" with low confidence |
| Regen project metadata mostly unresolvable (content hashes, not HTTP URLs) | No project-specific size, biome, or methodology data for most projects | Falls through to category-default tier; surfaced in UI as "Global Estimate" |
| Glow network currently has very few active farms (~3 in recent weeks) | Glow panel shows minimal data | Historical data still available from earlier weeks |
| TEEB biome rates are total ecosystem value, not marginal credit value | Overstates per-hectare values when applied to credit-based projects | Only applied when real hectare data is available from metadata |
| Price feeds depend on CoinGecko rate limits | Prices may be stale or unavailable | Graceful degradation: gap analysis omitted when prices unavailable |
| 90% of valuations are "Global Estimate" tier | Low precision across the board | Methodology coverage shown in UI; project-specific registry is extensible |

---

## 10. File Inventory

### Business Logic (2,380 LOC)

| File | LOC | Purpose |
|------|-----|---------|
| `src/modules/intelligence/types.ts` | 254 | Full type system |
| `src/modules/intelligence/compose.ts` | 568 | Provenance composition + aggregation |
| `src/modules/intelligence/valuation.ts` | 336 | Valuation functions + gap analysis |
| `src/modules/intelligence/methodologies.ts` | 240 | Methodology registry |
| `src/modules/intelligence/bioregionIntelligence.ts` | 217 | Bioregion-specific logic |
| `src/modules/intelligence/sources/toucan.ts` | 213 | Toucan adapter |
| `src/modules/intelligence/sources/glow.ts` | 209 | Glow adapter |
| `src/modules/intelligence/sources/prices.ts` | 191 | Price feeds |
| `src/modules/intelligence/sources/regen.ts` | 141 | Regen Network adapter |
| `src/modules/intelligence/index.ts` | 11 | Exports |

### Provenance Service (923 LOC)

| File | LOC | Purpose |
|------|-----|---------|
| `src/modules/filecoin/ProvenanceService.ts` | 633 | Ingestion orchestrator + localStorage persistence + 0-tCO2e filtering |
| `src/modules/filecoin/useSynapse.ts` | 163 | Synapse SDK lifecycle, bundle upload, CDN retrieval |
| `src/modules/filecoin/useProvenance.ts` | 137 | React state hook + cache hydration + restoreCid |
| `src/modules/filecoin/index.ts` | 12 | Exports |

### Dashboard + Asset UI (~1,250 LOC)

| File | LOC | Purpose |
|------|-----|---------|
| `src/Intelligence/ImpactDashboard.tsx` | 267 | Main page + archive link + restore CID button |
| `src/Intelligence/ProtocolPanel.tsx` | 264 | Protocol panels |
| `src/Intelligence/GapChart.tsx` | 178 | Charts |
| `src/Intelligence/MethodologyTraceCard.tsx` | 89 | Methodology trace |
| `src/Intelligence/AggregateSummaryBar.tsx` | 88 | KPI bar |
| `src/Intelligence/formatUtils.ts` | 61 | Formatting utilities |
| `src/Intelligence/ProtocolMiniChart.tsx` | 47 | Mini charts |
| `src/AssetDetails/AssetDetails.tsx` | ~260 | Rich ProvenanceSection: origin, metrics, valuation, gap, MRV, CID |
| `src/Explore/AssetBioregionCard.tsx` | — | "Verified on Filecoin" signal pill + provenance accordion |

**Total: ~4,500 LOC**

---

## 11. Development Phases

### Phase 1: Ecological Impact Gap Framework (Complete)

- Cross-protocol ingestion pipeline (Toucan, Regen, Glow)
- EPA SCC + TEEB biome valuations
- Live market price feeds (CoinGecko)
- Gap analysis: service value vs. market price
- Filecoin upload via Synapse
- Asset matching against Regen Atlas registry

### Phase 2: Methodology Hierarchy + Dashboard Redesign (Complete)

- Three-tier methodology cascade (project-specific > biome-specific > category-default)
- Methodology trace objects on every valuation (formula, inputs, citations, confidence)
- Methodology registry with 5 project-specific + 9 biome-specific entries
- Dashboard redesign: 3-panel protocol comparison layout
- Aggregate summary bar with methodology coverage percentages
- Data accuracy fixes: Toucan wei conversion, Glow kWh/MWh units, Glow double-counting, Regen biodiversity credit-as-hectare inflation

### Phase 2.5: Provenance UI + Filecoin Finalization (Complete)

- **`AssetBioregionCard.tsx`**: "Verified on Filecoin" badge in signal pills + full provenance accordion section
- **`AssetDetails.tsx`**: Swapped old `NewAssetCard` for `AssetBioregionCard`; rich ProvenanceSection (~260 lines) with origin, metrics, valuation, gap, MRV, CID
- **`ProvenanceService.ts`**: localStorage persistence (auto-restore on load), filter out 0-tCO2e tokens
- **`compose.ts`**: Human-readable methodology names (25+ Verra/Puro codes → e.g., "Afforestation, Reforestation and Revegetation"), standard name normalization, vintage date formatting
- **Bundle CID on Calibration Testnet**: `bafkzcibe7onr2eecyla3n3dxe62o3uu5osjf7kldf5xm5szruc4nrazsxw6zjlrfcy`
- **CDN retrieval**: `calibration.filbeam.io`

### Phase 3: Potential Next Steps

- **Deeper metadata resolution**: Resolve Regen content hashes to get real project size, biome type, and methodology data — unlocks biome-specific and project-specific tiers for more projects
- **Historical price tracking**: Cache price snapshots over time to show gap factor trends
- **Additional protocols**: Moss (6h), KlimaDAO (8h), Plastiks (16h), Jasmine Energy (18h), Hypercerts (30h) — see `ref/integration-priority.md`
- **Methodology registry expansion**: Add more project-specific methodologies as data becomes available
- **Agentic evaluators**: LLM-based impact evaluators (per Dao/Rekhan, Protocol Labs) producing `VerifiableProvenance` objects via the same pipeline
- **Export/API**: Expose provenance data via REST API for integration with other platforms
- **Attestation layer**: EAS attestations for provenance verification (component exists in Windfall)
