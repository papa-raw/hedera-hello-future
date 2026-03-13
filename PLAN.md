# Hedera Hello Future Apex — Hackathon Plan

**Track:** Sustainability
**Deadline:** Mar 24, 2026
**Base:** Regen Atlas ecospatial (forked)
**Fresh Code Rule:** Existing project OK if credited; new Hedera ingestion layer is all new code

---

## Framing

Regen Atlas is a **cross-chain environmental intelligence aggregator**. It already ingests green assets from Toucan (Polygon subgraph), Regen Network (Cosmos LCD), and Glow (JSON archives), normalizing them into a unified VerifiableProvenance schema with scientific valuation.

**For this hackathon, we add Hedera as the fourth ingestion source.** We pull existing sustainability data from Hedera's ecosystem — Guardian-verified credits, HTS environmental tokens, and governance audit trails — into Regen Atlas alongside the other chains.

The Atlas doesn't change shape for Hedera. Hedera data flows into the Atlas.

---

## Pitch (1 sentence)

Regen Atlas makes Hedera's sustainability ecosystem visible — pulling 155+ environmental tokens from DOVU, Tolam Earth, Capturiant, OrbexCO2, and Guardian-verified projects into a cross-chain intelligence map with scientific valuation, provenance tracking, and asset/action classification.

---

## The Ecosystem We're Ingesting (Research Complete)

### Reality Check
- **~155 environmental tokens** on Hedera mainnet across 10+ operators
- **~85 confirmed Guardian-minted**, rest are direct HTS
- **4 projects do 95% of the work:** DOVU, Tolam Earth, OrbexCO2, Capturiant
- **3 "known" projects are dead:** EcoGuard, RECDeFi, BCarbon (domains for sale)
- **No biodiversity tokens exist yet** — ValueNature planned but not deployed
- **Ecosystem is real but thin** — mostly pilot-scale, not production volume

### Classification

No Hedera environmental tokens trade on any crypto marketplace (no Uniswap, SaucerSwap, OpenSea, KlimaDAO). DOVU Market and Capturiant OfferBoard are fiat/KYC-gated closed platforms, not crypto-native exchanges. Therefore: **everything with onchain representation is an action.** The tokens are records of environmental activity, not tradeable instruments.

**Action** = onchain record of something that happened. Credit issuance, bridge event, retirement, measurement, tokenization. If it's onchain, it's evidence of environmental activity.
**Delisted** = dead project, orphaned token, domain for sale. Filtered out of the map.
**Not ingested:** Platform/governance tokens ($DOV, $TRUST, dgBOND) — except $DOVU is noted as a governance agent (see Agents section below).

### Actions (All Onchain Environmental Records)

| Platform | What the Tokens Record | Count | Marketplace (offchain) |
|----------|----------------------|-------|----------------------|
| **DOVU** | Carbon credit issuance (Ketrawe, Vaca Diez, Savimbo, ELV, sold-out farms), retirement NFTs, Green Bond cert, policy templates | ~22 tokens | app.dovu.market (fiat, primary) |
| **Tolam Earth** | Bridge events: Verra VCUs, EcoRegistry credits, C-Sink credits tokenized on Hedera. Tokenization certificates. | ~20 tokens | tolam.io (enterprise B2B) |
| **Capturiant** | Forward carbon credit issuance (Miller Mountain 2024-2043, Warrior 2024-2033), NFT attestation certs | 37 tokens | capturiant.offerboard.com (FINRA/SEC regulated) |
| **OrbexCO2** | Industrial emissions measurements: CO2e per tonne of commodity metal. Paired credit+commodity tokens per lot. | 70+ tokens | None found (bilateral OTC) |
| **GCR** | Gold Standard credit tokenizations (Rwanda Safe Water, Westcom POC) | 5 tokens | Gold Standard registry (offchain) |
| **iREC** | Renewable energy certificate tokenizations via Guardian | 3 tokens | Evident/Xpansiv (offchain) |
| **TYMLEZ** | Carbon emissions accounting (37 tCO2e), GHG Corporate Standard | 4 tokens | None (dormant) |
| **Atma.io** | Supply chain carbon tracking (1.6M tCO2e, Avery Dennison) | 3 tokens | None (internal) |
| **TOKERE** | Post-retirement attestations | 14+ tokens | None |
| **Carbon Neutral NFTs** | Proof-of-offset attestations (2021) | ~19 tokens | None |

### Agents (Environmental Governance)

| Token | Governance Scope | Evidence |
|-------|-----------------|----------|
| **$DOVU** (0.0.3716059) | dMRV methodology standard-setting. Token holders voted on Generic dMRV Standard — determines how ecological credits are verified. | gov.dovu.earth, 6 proposals since Mar 2023, 42% staking rate, ~$17M staked |

$DOVU is the only governance token on Hedera with demonstrated environmental governance activity. Thin (1 environmental vote out of 6 total proposals), but real — token holders influenced verification methodology.

### Delisted (Filtered Out)

| Token | Why |
|-------|-----|
| PAPARIKO forward credits (5 tokens) | Senken abandoned blockchain Jan 2024. All in treasury, orphaned. |
| Carbonext Envira Amazonia (1 token) | Dormant, 1 holder, no marketplace, no activity. |
| Early EUA/TCO2E tokens (2 tokens) | 2021 era, no provenance, no marketplace. |
| EcoGuard, RECDeFi, BCarbon | Projects dead, domains for sale. Zero mainnet tokens found. |

### Confirmed Token IDs & Treasury Accounts

Full registry at: `ref/hedera-token-registry.md`
Ecosystem map at: `prospecting/hedera-sustainability-ecosystem-map.md`

**Mirror Node API (no auth):** `https://mainnet-public.mirrornode.hedera.com/api/v1`

Key treasury accounts for bulk ingestion:
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

## Architecture

Same pattern as existing intelligence pipeline. Each source has: **fetch** (API client) → **compose** (normalize to VerifiableProvenance) → **valuate** (scientific pricing).

```
src/modules/intelligence/
├── sources/
│   ├── toucan.ts      ← Polygon subgraph (existing)
│   ├── regen.ts       ← Cosmos LCD (existing)
│   ├── glow.ts        ← JSON archives (existing)
│   └── hedera.ts      ← Mirror Node API (NEW)
├── compose.ts         ← Add composeHedera*() functions
├── types.ts           ← Add "hedera" to SourceProtocol
└── valuation.ts       ← Already handles carbon/energy/biodiversity
```

### Hedera Source Module Design

```typescript
// sources/hedera.ts

// 1. Fetch all tokens from known treasury accounts
async function fetchTreasuryTokens(treasuryId: string): HederaToken[]

// 2. Fetch individual token metadata
async function fetchTokenDetail(tokenId: string): HederaTokenDetail

// 3. Fetch NFT serials + metadata (for Tolam VRA/ERA, DOVU certs, iREC)
async function fetchNFTMetadata(tokenId: string): HederaNFT[]

// 4. Classify: key config → asset vs action
function classifyToken(token: HederaTokenDetail): "asset" | "action"
//   - Has freeze+wipe+KYC keys → Guardian asset (permissioned)
//   - Has no admin controls → attestation/action
//   - Fungible + transferable → asset
//   - NFT named "Certificate" / "Tokenization" → action

// 5. Parse project metadata from token name/memo/IPFS
function parseProjectMetadata(token: HederaTokenDetail): ProjectMeta
//   - DOVU: name = farm name, memo = "DOVU:<SYMBOL>:<topic_id>"
//   - Tolam: name = "<REGISTRY> - <SERIAL>", parse VCS serial numbers
//   - Capturiant: name = "Forward-<PROJECT>-<STANDARD>-<VINTAGE>"
//   - OrbexCO2: memo = JSON with uuid, uom, tokenLink
//   - PAPARIKO: memo = IPFS CID
```

### Compose Functions

```typescript
// compose.ts additions

composeHederaDovuProvenance(token, nfts?)     → VerifiableProvenance
composeHederaTolam Provenance(token, nfts)     → VerifiableProvenance
composeHederaCapturiantProvenance(token)       → VerifiableProvenance
composeHederaOrbexProvenance(token)            → VerifiableProvenance
composeHederaGCRProvenance(token, nfts)        → VerifiableProvenance
composeHederaIRECProvenance(token, nfts)       → VerifiableProvenance
composeHederaGenericProvenance(token)          → VerifiableProvenance  // fallback
```

Each compose function maps to the existing VerifiableProvenance schema:
- `source.protocol: "hedera"`
- `source.endpoint`: mirror node URL
- `asset.chain: "hedera-mainnet"`
- `asset.contractAddress`: token ID (e.g., "0.0.617742")
- `impact.metrics.climate.tCO2e`: from token supply (DOVU, Capturiant, OrbexCO2)
- `impact.metrics.energy.mwhGenerated`: from iREC/TYMLEZ REC tokens
- `valuation`: existing SCC-EPA/TEEB engine handles the rest
- `mrv.status`: "verified" for Guardian tokens (has admin+KYC keys), "pending" for others
- `origin.location`: parsed from token names (Kenya, Brazil, UK, Rwanda, Mexico, US...)

### Asset/Action Routing

```
Mirror Node → classify() → asset?  → Explore map (asset cards, pins)
                         → action? → Actions panel (verification events, retirement receipts)
```

---

## The Three Ingestion Layers

### 1. Assets → Explore Map

Pull all transferable environmental tokens and render them as map pins alongside Toucan/Regen/Glow assets.

**What appears on the map:**
- DOVU farm credits (UK/EU/Bolivia) — with farm locations
- Tolam VRA credits (Verra projects — Mexico, US, Singapore, Brazil)
- Capturiant forward carbon (US soil/forestry — Miller Mountain, Warrior)
- GCR Gold Standard (Rwanda safe water)
- iREC certificates
- PAPARIKO Kenya mangrove (Kwale County)
- Carbonext Brazil (Acre state)
- OrbexCO2 industrial (commodity-level, no specific location)

**Each pin shows:**
- Token name + project
- Chain: Hedera (with badge)
- Type: Carbon Credit / Forward Carbon / REC / Industrial CO2e
- Supply + vintage
- Scientific valuation (SCC-EPA for carbon, TEEB for biodiversity/marine)
- Proof: HashScan link to token ID
- Platform: DOVU / Tolam / Capturiant / etc.

### 2. Actions → Actions Panel

Pull all non-transferable attestations and render them as verified activities.

**What appears in Actions:**
- DOVU retirement certificates (ELV, Green Bond)
- Tolam tokenization certificates (proof that a Verra/EcoRegistry credit was bridged)
- TYMLEZ emissions measurements (37 tCO2e accounted)
- Atma.io supply chain tracking (1.6M tCO2e of Avery Dennison products)
- TOKERE post-retirement attestations
- Carbon Neutral NFTs (proof-of-offset for ~25 entities)
- COP28 advocacy offsets

**Each action shows:**
- What happened (retirement, bridge, measurement, offset)
- When (token creation timestamp)
- Who (treasury account → platform name)
- Methodology (Guardian policy if applicable)
- Proof: HashScan link

### 3. Agents → Governance Intelligence

Surface the governance layer — how tokens were issued, what policies govern them, what the audit trail looks like.

**What this provides:**
- Per-asset governance card: "This credit was minted by Guardian policy X, verified by registry Y, methodology Z"
- Cross-chain comparison: "DOVU soil carbon (Hedera) vs Toucan carbon (Polygon) vs Regen carbon (Cosmos)" — same asset type, different chains, different governance models
- AI agent commentary: agents analyze the Hedera sustainability landscape and surface insights (e.g., "70% of Hedera's environmental tokens are from 4 operators", "no biodiversity tokens exist yet")

**Implementation:** Lighter than the other two layers. Primarily a data display + AI analysis layer over the asset/action data already ingested.

---

## Build Timeline (12 days: Mar 13–24)

### Phase 1: Mirror Node Client + Token Enumeration (Mar 13–15, 3 days)
- [ ] `src/modules/intelligence/sources/hedera.ts` — mirror node REST client
- [ ] Enumerate all known treasury accounts (11 accounts → ~155 tokens)
- [ ] Token detail fetcher with IPFS metadata resolution
- [ ] Asset/action classifier (key config heuristic)
- [ ] Project metadata parser (DOVU, Tolam, Capturiant, OrbexCO2 naming patterns)
- [ ] Add `"hedera"` to SourceProtocol union

### Phase 2: Compose + Valuate (Mar 16–18, 3 days)
- [ ] `composeHedera*Provenance()` functions for each platform
- [ ] Wire Hedera tokens through existing valuation engine (SCC-EPA, TEEB)
- [ ] Location resolution (token name → lat/lng for map pins)
- [ ] Map rendering — Hedera assets appear on Explore map with chain badge
- [ ] Asset detail view for Hedera tokens (HashScan links, supply, vintage)

### Phase 3: Actions + Classification (Mar 19–20, 2 days)
- [ ] Route attestation tokens to Actions panel
- [ ] Action cards for retirement events, bridge events, measurements
- [ ] Merge Pawel's Actions panel code (when repo arrives)
- [ ] Cross-chain asset type comparison view

### Phase 4: Agents + Governance Layer (Mar 21–22, 2 days)
- [ ] Governance card per asset (policy, methodology, registry)
- [ ] AI agent analysis of Hedera sustainability landscape
- [ ] Dashboard: "Hedera Sustainability at a Glance" (token counts, platforms, types)
- [ ] Ecological impact gap analysis for Hedera assets vs other chains

### Phase 5: Polish + Submit (Mar 23–24, 2 days)
- [ ] Demo video — walkthrough of Hedera data flowing into Atlas
- [ ] README with architecture diagram
- [ ] Deploy to Vercel
- [ ] Submission on StackUp

---

## What Makes This Compelling for Judges

1. **We did the research they haven't.** We mapped the entire Hedera sustainability ecosystem — 155 tokens, 10+ operators, assets vs actions, live vs dead. No other project has done this.

2. **We found the bodies.** EcoGuard, RECDeFi, BCarbon — domains for sale. The "2M BCarbon credits" narrative is vaporware. We surface what's ACTUALLY deployed, not what's been press-released.

3. **Scientific valuation is unique.** Nobody else applies SCC-EPA carbon pricing or TEEB biome valuation to Hedera tokens. We surface the economic value of what exists.

4. **Cross-chain context.** Hedera assets appear alongside Toucan, Regen Network, Glow — judges see how Hedera's sustainability ecosystem compares to other chains. This is valuable to the Hedera Foundation.

5. **Real data, not a demo.** 155+ actual mainnet tokens from actual projects. No testnet, no mocks.

6. **Asset/action classification is novel.** We programmatically distinguish tradeable instruments from attestations based on token key configuration. Nobody else does this.

---

## Demo Narrative (2 min)

1. **"Hedera's sustainability ecosystem is invisible."** Show mirror node JSON — raw, unstructured, impossible to navigate.
2. **"We mapped it."** Show the ecosystem map — 155 tokens, 10 operators, 3 dead projects. "We found what's real."
3. **"Now it's on the Atlas."** Switch to map — Hedera pins (UK farms, Kenyan mangroves, Mexican VCS, Rwandan water, Brazilian REDD+) alongside Toucan/Regen/Glow.
4. **"Assets and actions, classified automatically."** Show an asset (DOVU Summerley farm credit) and an action (Tolam Verra tokenization certificate). Explain the key-config heuristic.
5. **"Scientific valuation reveals the value."** Click Capturiant forward carbon — show SCC-EPA pricing, ecological impact gap, vintage timeline.
6. **"Cross-chain intelligence."** Side-by-side: DOVU soil carbon (Hedera) vs Toucan NCT (Polygon). Same asset type, different governance, different pricing.
7. **"One map. Four chains. 280+ green assets."** Zoom out.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token metadata is sparse (no location in most tokens) | Parse names (Summerley = UK, PAPARIKO = Kenya, Envira = Brazil), follow IPFS CIDs, cross-reference project databases |
| OrbexCO2 has no location data (commodity-level) | Show as "Global" or cluster by commodity type rather than geography |
| Some tokens are test/spam | Filter by known treasury accounts + minimum supply thresholds |
| Pawel's Actions panel code arrives late | Hedera ingestion is independent — can demo on Explore view alone |
| Mirror node rate limits | Cache aggressively — token data doesn't change frequently |

---

## What NOT to Build

- No Guardian Docker deployment (we READ, we don't WRITE)
- No HTS minting (we INGEST, we don't CREATE)
- No wallet connect (server-side mirror node queries)
- No custom smart contracts
- No Hedera-specific UI chrome — Hedera assets render same as other chains
- No custom Guardian policies
- No testnet work — we pull from MAINNET
