# Regen Atlas × Hedera: Environmental Intelligence for AI Agents

**Hedera Hello Future Hackathon — Sustainability Track**

Regen Atlas aggregates environmental impact data from 6 Guardian-based platforms on Hedera and publishes the first AI-agent-native environmental intelligence methodology (RAEIS) back to Hedera using three native services.

## What It Does

1. **Reads** ~46 environmental actions from Hedera Mirror Node — tokenized carbon credits across DOVU, Tolam Earth, Capturiant, OrbexCO2, Global Carbon Registry, and TYMLEZ
2. **Values** each action using EPA Social Cost of Carbon ($51–$190/tCO2e), with trust-weighted confidence based on certification tier (Verra VCS, Gold Standard, self-certified, bare HTS)
3. **Publishes** a three-layer intelligence standard back to Hedera:
   - **Layer 1 (HCS):** RAEIS methodology topic — the machine-readable standard
   - **Layer 2 (HCS):** Per-bioregion intelligence feeds with agent directives (VERIFY, BOUNTY, ALERT)
   - **Layer 3 (HTS):** RAVA NFT collection — one attestation NFT per verified action

## Hedera Services Used

| Service | Usage |
|---------|-------|
| **Mirror Node API** | Ingests HTS tokens from 9 treasury accounts across 6 Guardian platforms, extracts Guardian topic IDs from token memos for provenance tracing |
| **Hedera Consensus Service (HCS)** | Publishes methodology standard + 7 bioregion intelligence feeds (structured JSON messages) |
| **Hedera Token Service (HTS)** | Mints RAVA NFT collection with 46 verification attestation NFTs |

**Total: 63 Hedera transactions** — all verifiable on HashScan.

## Architecture

```
Mirror Node (read)          HCS (write)              HTS (write)
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ 9 treasury accts │    │ RAEIS Methodology│    │ RAVA NFT         │
│ 6 Guardian plats │───>│ 7 Bioregion Feeds│    │ Collection       │
│ ~46 env actions  │    │ Agent Directives │    │ 46 attestations  │
└─────────────────┘    └──────────────────┘    └──────────────────┘
        │                       │                       │
        v                       v                       v
┌─────────────────────────────────────────────────────────────────┐
│                    Regen Atlas Intelligence                      │
│  SCC-EPA valuation · Trust hierarchy · Gap analysis             │
│  Cross-protocol aggregation · Bioregion mapping                 │
└─────────────────────────────────────────────────────────────────┘
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Explore — Map of 125+ ecological assets with bioregion panels |
| `/intelligence` | Intelligence — Cross-protocol valuation, asset vs action analysis, gap charts |
| `/actions` | Actions — Environmental actions from Hedera, Atlantis, Silvi with protocol icons and filters |
| `/publish` | Publish — RAEIS methodology, bioregion feeds, RAVA NFTs, full transaction log with HashScan links |

## Quick Start

```bash
npm install
npm run dev              # http://localhost:5173
```

### Publish to Hedera (testnet)

```bash
cd integrations
npm install
npm run publish:hedera            # Live publish to testnet
npm run publish:hedera:dry-run    # Preview without submitting
```

Requires `integrations/.env`:
```
HEDERA_OPERATOR_ID=0.0.XXXXX
HEDERA_OPERATOR_KEY=302e...
HEDERA_NETWORK=testnet
```

## RAEIS: Three-Layer Standard

### Layer 1 — Methodology (HCS)

A machine-readable methodology published to Hedera consensus. Defines how bioregional service value is calculated, what certifications mean, how to interpret tCO2e across platforms, and what agents need to implement to be RAEIS-compliant.

```json
{
  "schema": "RAEIS/Methodology/v1",
  "methodology": {
    "valuation": "SCC-EPA-2024",
    "carbonPrice": { "low": 51, "high": 190, "unit": "USD/tCO2e" },
    "trustHierarchy": ["guardian+registry", "guardian+self", "bare-hts"]
  },
  "agentInterface": {
    "capabilities": ["eii-interpret", "gap-analysis", "capital-routing"],
    "taskTypes": ["GROUND_TRUTH", "SPECIES_SURVEY", "WATER_SAMPLE"]
  }
}
```

### Layer 2 — Bioregional Intelligence Feeds (HCS)

One HCS topic per bioregion. Agents subscribe to these for real-time intelligence. Each message includes structured directives telling agents what to DO with the data.

```json
{
  "schema": "RAEIS/BioregionalIntelligence/v1",
  "bioregion": { "code": "PA12", "name": "Western European Broadleaf Forests" },
  "aggregate": {
    "platforms": 3, "actions": 7, "tCO2e": 15420.5,
    "serviceValue": { "low": 786445, "high": 2929895 }
  },
  "agentDirectives": [
    { "type": "VERIFY", "target": "tCO2e", "confidence": 0.7 },
    { "type": "BOUNTY", "taskType": "GROUND_TRUTH", "budget": 500 },
    { "type": "ALERT", "channel": "economic", "signal": "gap_factor_infinite" }
  ]
}
```

### Layer 3 — Verification NFTs (HTS)

One HTS NFT collection: RAVA (RAEIS Verified Action). Each serial = one independently verified environmental action. Onchain metadata (≤100 bytes) references full provenance on IPFS.

## Data Pipeline

**Guardian ingestion:** Mirror Node API enumerates HTS tokens from 9 treasury accounts, extracts Guardian topic IDs from token memos (DOVU format: `DOVU:SYMBOL:topic_id`; Tolam/GCR: direct topic in memo; Capturiant: IPFS CID in memo).

**Additional sources:** Toucan Protocol (Polygon subgraph), Regen Network (Cosmos LCD), Glow (weekly JSON archives), Atlantis and Silvi (Supabase).

**Valuation engine:**
- EPA Social Cost of Carbon 2024: $51–$190/tCO2e
- TEEB biome-level ecosystem service values (Costanza 2014, de Groot 2012)
- Trust hierarchy: Guardian+Registry (1.0) > Guardian+Self (0.7) > Bare HTS (0.3)
- Per-provenance confidence scoring (high/medium/low)
- Live market prices: CoinGecko (CHAR/Biochar), DexScreener (GLW), Regen marketplace

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS + Recharts + Mapbox GL
- **Hedera:** @hashgraph/sdk (HCS + HTS), Mirror Node REST API
- **Data:** Supabase, The Graph (Toucan), Regen Network LCD, CoinGecko, DexScreener
- **Storage:** Filecoin Calibration (Synapse SDK)

## What Existed Before

Regen Atlas is an open-source registry of 125+ tokenized ecological assets with a multi-protocol intelligence pipeline (Toucan, Regen Network, Glow), Filecoin provenance layer, and scientific valuation engine. Built during PL_Genesis hackathon.

**New for Hedera Hello Future:**
- Hedera Guardian ingestion (Mirror Node → 46 actions from 6 platforms)
- RAEIS three-layer standard (HCS methodology + feeds + HTS NFTs)
- Intelligence panel redesign (asset/action protocol split, gap analysis)
- Actions page with Hedera, Atlantis, Silvi protocol support
- `/publish` page with interactive judge documentation

## Team

**Pat Rawson** — [@papa-raw](https://github.com/papa-raw) · [ecofrontiers.xyz](https://ecofrontiers.xyz)

Built with [Regen Atlas](https://regenatlas.xyz) infrastructure.

## License

MIT
