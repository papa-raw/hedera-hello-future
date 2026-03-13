# PRD: Hedera Ingestion into Regen Atlas

**Track:** Hedera Hello Future Apex — Sustainability
**Deadline:** Mar 24, 2026
**Status:** Research complete, implementation pending

---

## Goal

Add Hedera as the 4th ingestion source in Regen Atlas. Pull all existing environmental tokens from Hedera mainnet into the Atlas alongside Toucan (Polygon), Regen Network (Cosmos), and Glow (Ethereum).

---

## Two Data Paths in Regen Atlas

The codebase has two separate data systems. Both need Hedera integration.

### Path A: Supabase (UI data)
- Assets, Actions, Orgs stored in Supabase, fetched via `useSupabaseTable`
- Actions come from `actions_published_view` — rich schema: actors, proofs (protocol logos), SDG outcomes, images, locations
- Feeds: Explore map, card lists, detail pages, standalone `/actions` route
- Type: `Action` in `src/shared/types.ts`

### Path B: Intelligence Pipeline (scientific valuation layer)
- Sources (`src/modules/intelligence/sources/`) fetch directly from external APIs
- `compose.ts` normalizes to `VerifiableProvenance` objects
- `valuation.ts` applies SCC-EPA / TEEB pricing
- Feeds: Intelligence dashboard (gap analysis, methodology traces, aggregate stats)
- Completely client-side, no Supabase

### Integration Strategy

**Both paths, in order:**

1. **Intelligence pipeline first** (`sources/hedera.ts` → compose → valuate)
   - Pure code, no DB dependency
   - Follows existing source module pattern exactly
   - Produces the "new Hedera code" the hackathon wants to see
   - Mirror Node REST API (no auth, free)

2. **Supabase seeding second**
   - Script that transforms Mirror Node data into the `Action` shape
   - Inserts into Supabase so Hedera actions appear on the map with full UI treatment
   - Requires: Supabase admin access, schema compatibility check

---

## Classification (Research Complete)

All ~155 Hedera environmental tokens are classified as:

**Actions** (~155 tokens) — No Hedera environmental token trades on any crypto marketplace. DOVU Market, Capturiant OfferBoard, and Tolam are fiat/KYC-gated closed platforms. Everything with onchain representation is a record of environmental activity.

**Agents** (1) — $DOVU governance token. One demonstrated environmental governance vote (dMRV Standard).

**Delisted** (3 projects) — EcoGuard, RECDeFi, BCarbon. Domains for sale, zero mainnet tokens.

Full registry: `ref/hedera-token-registry.md`

---

## Actions by Platform

| Platform | What the Tokens Record | Count | Offchain Marketplace |
|----------|----------------------|-------|---------------------|
| **DOVU** | Carbon credit issuance (UK/EU farms), retirement NFTs, Green Bond cert | ~22 | app.dovu.market (fiat) |
| **Tolam Earth** | Bridge events: Verra VCUs, EcoRegistry, C-Sink credits tokenized on Hedera | ~20 | tolam.io (enterprise B2B) |
| **Capturiant** | Forward carbon credit issuance (US soil/forestry, 2024-2043) | 37 | capturiant.offerboard.com (FINRA/SEC) |
| **OrbexCO2** | Industrial emissions measurements: CO2e per tonne of commodity metal | 70+ | None (bilateral OTC) |
| **GCR** | Gold Standard credit tokenizations (Rwanda Safe Water) | 5 | Gold Standard registry |
| **iREC** | Renewable energy certificate tokenizations via Guardian | 3 | Evident/Xpansiv |
| **TYMLEZ** | Carbon emissions accounting (37 tCO2e, GHG Corporate Standard) | 4 | None (dormant) |
| **Atma.io** | Supply chain carbon tracking (1.6M tCO2e, Avery Dennison) | 3 | None (internal) |
| **TOKERE** | Post-retirement attestations | 14+ | None |
| **Carbon Neutral NFTs** | Proof-of-offset attestations (2021) | ~19 | None |

---

## Architecture: Intelligence Pipeline (Path B)

### New Files

```
src/modules/intelligence/sources/hedera.ts  ← Mirror Node REST client
```

### Pattern (follows toucan.ts exactly)

```typescript
// 1. Mirror Node client
const MIRROR_NODE = "https://mainnet-public.mirrornode.hedera.com/api/v1";

// 2. Fetch tokens from known treasury accounts
async function fetchTreasuryTokens(treasuryId: string): HederaToken[]

// 3. Fetch individual token metadata
async function fetchTokenDetail(tokenId: string): HederaTokenDetail

// 4. Fetch NFT serials + metadata
async function fetchNFTMetadata(tokenId: string): HederaNFT[]

// 5. Classify by key config
function classifyToken(token: HederaTokenDetail): "action" | "delisted"

// 6. Parse project metadata from token name/memo/IPFS
function parseProjectMetadata(token: HederaTokenDetail): ProjectMeta
```

### Compose Functions (compose.ts additions)

```typescript
composeHederaDovuProvenance(token, nfts?)      → VerifiableProvenance
composeHederaTolamProvenance(token, nfts)       → VerifiableProvenance
composeHederaCapturiantProvenance(token)        → VerifiableProvenance
composeHederaOrbexProvenance(token)             → VerifiableProvenance
composeHederaGCRProvenance(token, nfts)         → VerifiableProvenance
composeHederaIRECProvenance(token, nfts)        → VerifiableProvenance
composeHederaGenericProvenance(token)           → VerifiableProvenance  // fallback
```

### Type Changes

```typescript
// types.ts
export type SourceProtocol = "toucan" | "regen-network" | "glow" | "hedera";

// New raw data types for Hedera tokens
export interface HederaToken { ... }
export interface HederaTokenDetail { ... }
export interface HederaNFT { ... }
```

### Mapping to VerifiableProvenance

- `source.protocol: "hedera"`
- `source.endpoint`: mirror node URL
- `asset.chain: "hedera-mainnet"`
- `asset.contractAddress`: token ID (e.g., "0.0.617742")
- `asset.assetActionClass: "action"` (all Hedera tokens)
- `impact.metrics.climate.tCO2e`: from token supply (DOVU, Capturiant, OrbexCO2)
- `impact.metrics.energy.mwhGenerated`: from iREC/TYMLEZ REC tokens
- `valuation`: existing SCC-EPA/TEEB engine
- `mrv.status`: "verified" for Guardian tokens (admin+KYC keys), "pending" for others
- `origin.location`: parsed from token names

---

## Architecture: Supabase Seeding (Path A)

### Open Questions (must resolve before implementation)

1. **Do we have Supabase admin access?** Need to insert rows into the actions tables.
2. **What's the Supabase schema for actions?** The `actions_published_view` is a view — what are the underlying tables? Need: actions, action_actors, action_proofs, action_sdg_outcomes, action_protocols.
3. **Is Pawel's Actions code the latest?** The PLAN.md lists "Merge Pawel's Actions panel code" as pending. The Actions files exist in the repo (copied from Regen Atlas v1) but may not be his latest work.
4. **Is there data in Supabase?** Unknown whether `actions_published_view` returns any rows currently.

### Seeding Script Design

```
scripts/seed-hedera-actions.ts
```

- Fetches all tokens from Mirror Node
- Transforms each into the Supabase Action shape
- Creates protocol entries for Hedera/HashScan
- Inserts proof links as HashScan URLs (e.g., hashscan.io/mainnet/token/0.0.617742)
- Resolves locations from token names → lat/lng
- Runs as one-time seed, not continuous sync

---

## Key Treasury Accounts (Mirror Node Entry Points)

```
0.0.610168   — DOVU original (~8 tokens)
0.0.1357309  — DOVU Guardian reissue (~14 tokens)
0.0.6144372  — Tolam Earth assets (~15 tokens)
0.0.6138881  — Tolam Earth certificates (~5 tokens)
0.0.4640644  — Capturiant Miller Mountain (20 tokens)
0.0.5054978  — Capturiant Warrior (10 tokens)
0.0.4576278  — OrbexCO2 (70+ tokens)
0.0.3843565  — GCR Gold Standard (5 tokens)
0.0.1810743  — TYMLEZ (4 tokens)
0.0.3844944  — PAPARIKO (5 tokens)
0.0.1682833  — Atma.io (3 tokens)
```

---

## Build Order

### Phase 1: Mirror Node Client + Token Enumeration
- `sources/hedera.ts` — REST client, treasury enumeration, token detail fetcher
- IPFS metadata resolution
- Key-config classifier
- Platform-specific metadata parsers (DOVU naming, Tolam registry codes, OrbexCO2 JSON memos)

### Phase 2: Compose + Valuate
- `composeHedera*Provenance()` functions per platform
- Wire through existing valuation engine
- Location resolution (token name → lat/lng)
- Add `"hedera"` to `SourceProtocol` union, update `aggregateImpact` sourceBreakdown

### Phase 3: Actions UI Integration
- Resolve Pawel's Actions code status
- Supabase schema investigation
- Seed script for Hedera actions
- Hedera actions appear on Explore map with chain badge + HashScan links

### Phase 4: Polish
- Cross-chain comparison (Hedera vs Toucan vs Regen)
- Dashboard: "Hedera Sustainability at a Glance"
- Demo video

---

## Risks

| Risk | Mitigation |
|------|------------|
| No Supabase access | Intelligence pipeline works standalone; Supabase seeding is Phase 3 |
| Pawel's Actions code arrives late | Hedera ingestion is independent of Actions UI |
| Token metadata is sparse | Parse names, follow IPFS CIDs, cross-reference project databases |
| Mirror node rate limits | Cache aggressively — token data changes infrequently |
| OrbexCO2 has no location data | Render as "Global" or cluster by commodity type |
