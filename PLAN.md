# Hedera Hello Future Apex — Hackathon Plan

**Track:** Sustainability
**Deadline:** Mar 23, 2026 (11:59 PM ET)
**Base:** Regen Atlas ecospatial (forked)
**Fresh Code Rule:** Existing project OK if credited; new Hedera ingestion layer is all new code

---

## Framing

Regen Atlas is a **cross-chain environmental intelligence aggregator**. It already ingests green assets from Toucan (Polygon subgraph), Regen Network (Cosmos LCD), and Glow (JSON archives), normalizing them into a unified VerifiableProvenance schema with scientific valuation.

**For this hackathon, we add Hedera as the fourth ingestion source.** We pull existing sustainability data from Hedera's ecosystem — Guardian-verified credits, HTS environmental tokens, and governance audit trails — into Regen Atlas alongside the other chains.

The Atlas doesn't change shape for Hedera. Hedera data flows into the Atlas.

---

## Pitch (1 sentence)

Regen Atlas is the missing intelligence layer for Hedera Guardian — pulling ~60 environmental Actions from 6 platforms into a cross-chain map with scientific valuation, registry certifications, and provenance verification that Guardian itself doesn't provide.

---

## Infrastructure Status (Updated 2026-03-13)

### What We Have

**Pawel's work is done.** Two production repos provide the full data pipeline:

| Repo | What It Does | Status |
|------|-------------|--------|
| [regen-atlas-admin](https://github.com/Regen-Atlas/regen-atlas-admin) | Admin dashboard — full CRUD for actions, action protocols, actors, proofs, SDGs, orgs, assets, tokens, certifications | **Live** |
| [regen-atlas-integrations](https://github.com/Regen-Atlas/regen-atlas-integrations) | Connector framework — pluggable fetcher/parser/runner with Vercel cron. Atlantis + Silvi connectors live. | **Live** |

### Actions Schema (Supabase — known from migration `20260108053153`)

```
actions               — id, title, description, status, geography(Point,4326), country_code, region,
                        action_start_date, action_end_date, main_image, created_at
actions_actors        — id, name, website
actions_actors_map    — action_id, actor_id (join table)
actions_proofs        — id, action_id, protocol_id, platform_id, proof_link, proof_metadata_link,
                        proof_image_link, proof_transaction_hash, proof_explorer_link, minted_at
actions_protocols     — id, name, logo, website, color
actions_sdgs_map      — action_id, sdg_id
actions_view          — materialized view joining all above
```

### Connector Pattern (from regen-atlas-integrations)

```
src/connectors/<protocol-id>/
├── index.ts     — exports Connector implementation
├── fetcher.ts   — fetch raw data from external source
└── parser.ts    — transform to ParsedActionData for Supabase insert

src/core/
├── types.ts     — Connector interface, ParsedActionData
├── database.ts  — Supabase upsert operations
├── runner.ts    — orchestrates fetch → parse → insert
└── sdgs.ts      — SDG name→ID mapping
```

CLI: `npx tsx src/cli.ts sync <protocol-id> [--chain X] [--dry-run]`
Cron: Vercel cron jobs per chain, daily 6:00 UTC

### What This Means

All open questions from the PRD are resolved:

| Question | Answer |
|----------|--------|
| Do we have Supabase admin access? | Yes — credentials in `.env` |
| What's the actions schema? | Fully known (see above) |
| Is Pawel's Actions code latest? | Yes — production in regen-atlas-admin |
| Is there data in Supabase? | Yes — Atlantis + Silvi connectors populate it |

---

## The Ecosystem We're Ingesting (Research Complete)

### Reality Check
- **~155 HTS tokens** on Hedera mainnet across 10+ operators (raw onchain count)
- **~115 Actions ingested** across 6 platforms after cuts (iREC, Atma.io, TOKERE, Carbon Neutral NFTs removed — no locatable geography or not environmental production)
- **~85 confirmed Guardian-minted**, rest are direct HTS
- **~60 deduplicated Actions** after merging paired tokens (OrbexCO2 CO2+commodity = 1 Action) and filtering zero-supply
- **6 platforms ingested:** DOVU (~22), Tolam Earth (~20), Capturiant (37), OrbexCO2 (70+), GCR (5), TYMLEZ (1)
- **3 "known" projects are dead:** EcoGuard, RECDeFi, BCarbon (domains for sale)
- **No biodiversity tokens exist yet** — ValueNature planned but not deployed
- **Ecosystem is real but thin** — mostly pilot-scale, not production volume

### Classification

No Hedera environmental tokens trade on any crypto marketplace (no Uniswap, SaucerSwap, OpenSea, KlimaDAO). DOVU Market and Capturiant OfferBoard are fiat/KYC-gated closed platforms, not crypto-native exchanges. Therefore: **everything with onchain representation is an action.** The tokens are records of environmental activity, not tradeable instruments.

**Action** = onchain record of something that happened. Credit issuance, bridge event, retirement, measurement, tokenization. If it's onchain, it's evidence of environmental activity.
**Delisted** = dead project, orphaned token, domain for sale. Filtered out of the map.
**Not ingested:** Platform/governance tokens ($DOV, $DOVU, $TRUST, dgBOND) — no material reality relationship. DOVU is an Org, not an Asset or Action.

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

### No Hedera Assets

$DOVU trades on SaucerSwap (~$500K liquidity) but has no relationship to the underlying material reality — it's a platform utility/fee token, not carbon-backed. Not an Asset in the Atlas sense. Every Hedera environmental token is an Action.

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

## Guardian as First-Class Concept

### The Insight

Guardian is the most rigorous environmental token engine in crypto, but nobody can see what it's produced across deployments. Each operator (DOVU, Tolam, GCR, iREC) runs their own Guardian instance — there's no unified view of the Guardian ecosystem. Regen Atlas provides that view.

### How Guardian Maps to Our Ontology (Zero Schema Changes)

| Guardian Concept | Supabase Field | VerifiableProvenance Field |
|---|---|---|
| Guardian policy (e.g., DOVU dMRV) | `actions_protocols` (one per policy) | `origin.methodology` |
| Guardian vs bare HTS | Certifier confidence (Guardian-verified + registry > self-certified > no certifier) | Certifier on Action (replaces `mrv.status` binary) |
| HCS topic (policy chain) | `actions_proofs` (proof 2: topic link) | `mrv.documentCIDs[]` |
| Token on HashScan | `actions_proofs` (proof 1: token link) | `source.endpoint` + `asset.contractAddress` |
| Registry serial (Verra/GS) | `actions_proofs` (proof 3: registry link) | `mrv.provider` |
| MRV methodology | `actions.description` | `impact.metrics.climate.methodology` |
| Operator | `actions_actors` | `origin.developer` |
| SDGs | `actions_sdgs_map` | (not in VP — derived) |
| Geography | `actions.geography` (PostGIS Point) | `origin.location` |

### Guardian Detection (Key Config Heuristic)

```
admin_key present + supply_key = same key        → Guardian Standard Registry
admin_key present + all keys = same key           → Guardian Template
admin_key = ProtobufEncoded (multi-sig)           → Bridge/DAO
admin_key = null, supply_key present              → Direct HTS (bare)
admin_key = null, supply_key = null               → Fixed supply immutable
```

### Protocol: Hedera Guardian

One protocol for all Hedera proofs: **Hedera Guardian**. This appears as the proof badge on Action cards (like "SILVI" appears on Silvi proofs). Differentiation between operators happens at the Org level, and between validation standards at the Certifier level.

The Guardian detection heuristic (key config) is still used internally to set Certifier confidence, but it's not a separate protocol per operator.

---

## Actor Ontology & Ecosystem Wiring

### The Actor Hierarchy

Actors is the umbrella category on the Explore map. Three subtypes:

```
Actors
├── Ecosystems   — collections of Orgs and Agents
├── Orgs         — committed to a Bioregion or a point within one
└── Agents       — committed to a Bioregion, may be deployed by an Org (but a separate Actor)
```

The navbar already has `Assets | Actors | Actions` as separate entity toggles, with Actors splitting into `Orgs | Agents`. Actions are done by Actors. Actions are a separate entity from Actors and Assets.

### Orgs = Platforms (Parallel to Issuers for Assets)

Orgs are the entities that tokenize environmental data on Hedera — the same role as Issuers for Assets. We don't need to resolve the underlying project developer; that's what Certifiers handle (Verra, Gold Standard, etc. validate the claim). This keeps the ontology clean:

- **Org** = who brought it onchain (DOVU, Tolam, Capturiant, GCR, OrbexCO2, TYMLEZ)
- **Certifier** = who validated the underlying claim (Verra VCS, Gold Standard, EcoRegistry, dMRV Standard)
- **Project developer** = metadata on the Action if available (from IPFS `registryProjectName`), not a separate Org

**Note:** GCR stands for Global Climate Registry (NOT Gold Standard despite similar initials). It's a digital carbon registry built on Hedera by Carbonbase/ImpactX.

### Geography Cuts

Actions without geography are not Actions. Research results:

| Token Set | Geography Found? | Decision |
|-----------|-----------------|----------|
| **iREC** (3 tokens) | No — locked behind multi-hop HCS → IPFS VP retrieval, not practically extractable | **Cut** |
| **Atma.io** (1.6M tCO2e) | No — global supply chain aggregate across 50+ countries, truly unlocatable | **Cut** |
| **TYMLEZ CET** (37 tCO2e) | **Yes** — Gold Coast Health & Knowledge Precinct, QLD, Australia (-27.96, 153.38) | **Keep** |

### "Hedera Guardian" as an Ecosystem

Create **"Hedera Guardian"** as an Ecosystem in the admin. Orgs within it are placed where they operate (via their Actions), not where they're headquartered.

**Ecosystem:** Hedera Guardian
**Orgs (all platforms that tokenize environmental data on Hedera):**

| Org Name | Operates In | Bioregion(s) | Certifiers Used |
|----------|------------|--------------|-----------------|
| DOVU | UK (Worcestershire farms), Bulgaria, France | PA12, PA1 | DOVU dMRV Standard (self-certified via Guardian) |
| Tolam Earth | Mexico, USA, Singapore, Colombia, Brazil, India | Multiple | Verra VCS, EcoRegistry, Global C-Sink |
| Capturiant | Virginia, North Carolina, USA | NA22, NA26 | Capturiant Standard (SEC-regulated) |
| OrbexCO2 | USA multi-state (TN, KY, AL, CA, IL, IN) | Various NA | None (self-measured industrial MRV) |
| GCR | Rwanda | AT7 | Gold Standard TPDDTEC |
| TYMLEZ | Gold Coast, QLD, Australia | AA8 | None (self-measured GHG) |

**Cut (no locatable Actions):**

| Entity | Why Cut |
|--------|---------|
| iREC (3 tokens) | No extractable geography (locked behind multi-hop HCS → IPFS VP retrieval) |
| Atma.io / Avery Dennison (1.6M tCO2e) | Global supply chain aggregate across 50+ countries, truly unlocatable |
| TOKERE | Retirement attestations — records of consumption, not production of environmental value |
| Carbon Neutral NFTs | Dormant since 2021, content unreachable |

**Org placement:** Org `coordinates` = HQ (the pin on the map). Org is ALSO surfaced in every Bioregion where it has Actions — an Action in a bioregion automatically commits that Org to that bioregion as an Actor. So Tolam Earth's HQ pin might be in one place, but it appears in 6+ bioregions via its Actions.

Each Org gets: name, description, website, logo, color, coordinates (HQ), treasury (Hedera address), social links, ecosystem = "Hedera Guardian".

**Action images:** Use project-specific imagery where available from IPFS metadata. Default to Org logo when no image exists.

### Extending Certifications to Actions

Assets already have a `certifications` array with Certifiers (registry standards bodies). Actions need the same — the registry that validated the underlying environmental claim is a Certifier, not an Org.

**Current Asset certification schema:**
```typescript
certifications: Array<{
  id: number;
  value: number;              // numeric rating/score
  description: string;        // full text
  description_short: string;  // compact label
  certification_source: string; // external URL to registry
  certifier: { id: number; name: string; short_name: string; };
}>;
```

**Extend to Actions with the same structure.** This separates:
- **Org = who tokenized it** (parallel to Issuer for Assets) — DOVU, Tolam, Capturiant, GCR, OrbexCO2, TYMLEZ
- **Certifier = who validated the underlying claim** — Verra, Gold Standard, EcoRegistry, DOVU dMRV Standard

| Org (Platform) | Certifier | Certification Source |
|----------------|-----------|---------------------|
| Tolam Earth | Verra (VCS) | `registry.verra.org/app/projectDetail/{registryProjectId}` |
| Tolam Earth | EcoRegistry | `ecoregistry.io/projects/{registryProjectId}` |
| Tolam Earth | Global C-Sink | Global C-Sink registry link |
| GCR | Gold Standard | `goldstandard.org/projects` |
| DOVU | DOVU dMRV | `app.dovu.market` (self-certified via Guardian dMRV policy) |
| Capturiant | Capturiant Standard | `capturiant.com` (self-validated, SEC-regulated) |
| OrbexCO2 | — | No external certifier (self-measured industrial MRV) |
| TYMLEZ | — | No external certifier (self-measured GHG at Gold Coast precinct) |

**Supabase schema extension needed:**
- `actions_certifications` join table (action_id, certification_id) — links Actions to existing `certifications` rows
- Reuse existing `certifiers` + `certifications` tables (same architecture as Assets, not parallel tables)
- Create new Certifier rows for Hedera-specific standards (DOVU dMRV, Capturiant Standard) alongside existing registries
- Update `actions_view` materialized view to include certifications array

### Wiring: Actions ↔ Orgs ↔ Ecosystems

**Approach:** Match by name convention. When we create actions via the Hedera connector, the `actor_name` (e.g., "DOVU") matches the Org name exactly. The frontend joins Actions to Orgs by actor name → org name matching. This avoids schema changes while enabling the Ecosystem → Org → Actions chain at query time.

```
Ecosystem ("Hedera Guardian")
  → Org ("Tolam Earth")         — via ecosystems_orgs join (admin)
    → Actions                   — via actions_actors.name = orgs.name (convention)
      → Certifications          — Verra VCS, Gold Standard, etc. (same schema as Asset certs)
      → Proofs                  — HashScan, Guardian HCS topic, registry link
```

### Ecosystem Filter in Navbar

Add an **Ecosystem** filter pill in the navbar alongside the existing asset filters (Type | Issuer | Chain). When active, it filters:
- **Orgs** — only show Orgs belonging to selected Ecosystem(s)
- **Actions** — only show Actions whose actor name matches an Org in the selected Ecosystem(s)
- **Agents** — only show Agents deployed by Orgs in the selected Ecosystem(s)

Implementation mirrors the Chain filter pattern:
- `filters.ecosystems: number[]` in filter state
- `SET_ECOSYSTEM_FILTER` / `RESET_ECOSYSTEM_FILTER` actions
- Ecosystem list from `allOrgs` → extract unique ecosystems
- Filter applies across Orgs and Actions (not Assets — Assets have Chain)

The filter should appear when Actors toggle is active (same position as Orgs/Agents sub-toggles).

### Impact Provenance for Actions

Each Action needs an estimated ecosystem service value and EII contribution, same as Assets. The methodology:

1. **Ecosystem Service Value** — SCC-EPA carbon pricing ($51–$190/tCO2e range) applied to each Action's tCO2e. Same `valuateCarbon()` engine used for Assets.

2. **EII Contribution** — Calculate estimated EII value per Action based on:
   - Asset type (soil carbon, bridged credit, forward carbon, industrial MRV, clean water)
   - Certifier confidence (Verra-certified > self-certified > no certifier)
   - Methodology specificity (project-specific > category-default > global estimate)

3. **Certifier as confidence signal** — Actions can have multiple certifications. For provenance scoring, use the most specific methodology available:
   - Tolam VRA action with Verra VCS certification → project-specific methodology from Verra
   - DOVU action with dMRV self-certification → DOVU Generic dMRV Standard
   - OrbexCO2 action with no certifier → category-default industrial MRV

4. **Intelligence page integration** — Hedera Guardian appears as 4th source protocol:
   - Service Value bar (sum SCC-EPA across all Hedera Actions)
   - Market Value = $0 (no crypto trading) → gap factor is infinite (or "N/A — no market")
   - This IS the insight: Hedera's environmental tokens have real ecological service value but zero market price discovery

5. **Precision tracking** — Most Hedera Actions are "project-specific" precision (DOVU farm names, Tolam registry project IDs, Capturiant IPFS metadata). This is higher precision than many existing Assets which use "global estimate."

### Bioregional Vaults ↔ Actions Gap

The Bioregion panel has an `Actions (N)` tab that uses point-in-polygon matching (action lat/lng inside bioregion polygon). This works — Hedera actions with geography will appear in the correct bioregion's Actions tab automatically.

The Bioregion **Vault** page (NT17 Bioregion Vault) currently shows DeFi actions (Deposit to Vault, Submit Proposal, Commit as Agent) but does NOT show environmental Actions from the Actions ontology. For the hackathon, the vault page should surface the environmental Actions within that bioregion as evidence of real-world activity backing the vault's ecological claims. This connects the financial layer (vault deposits, yield) to the evidence layer (verified environmental actions).

---

## Parser Spec (Mirror Node Metadata → Actions + VerifiableProvenance)

### DOVU

**Source data:**
- Memo pattern: `DOVU:<SYMBOL>:<topic_id>` (original) or empty (Guardian reissue)
- Name: farm name (e.g., "Summerley Hall Fruit Farm", "Briyastovo Wheat Farm")
- Supply: `total_supply / 10^decimals` = tCO2e (decimals vary: 6, 8, 3, 4)
- Topic IDs: in memo, always `token_id - 2` for originals
- NFT metadata: base64-encoded Hedera timestamps (NOT IPFS)
- Guardian key: `902d8719...` (admin+supply) — reissue tokens
- DOVU operational key: `f17b8c55...` (supply+fee_schedule) — original tokens

**Filter out:** test tokens (name ∈ {"Matt token", "Test", "ppp", "e2e test token", "Hello"}), meme tokens ("elonDOV"), utility tokens (symbol "DOV[hts]", "DOVU", "PACK"), templates (name "DOVU CCP (TEMPLATE)"), zero-supply tokens

**Action mapping:**
```
title:              token.name (strip "(Guardian Reissue)" / "(guardian-v1-reissue)" suffix)
description:        "Soil carbon credits from {farm_name}. {supply} tCO2e issued.
                     Verified under DOVU dMRV Standard. Guardian topic: {topic_id}."
action_start_date:  token.created_timestamp → ISO 8601
geography:          static lookup by farm name (see Geography Table below)
country_code:       from geography lookup
sdg_ids:            [13, 15] — Climate Action + Life on Land (soil carbon / agriculture)
actor_name:         "DOVU"
protocol_id:        "Hedera Guardian"
proof_link:         hashscan.io/mainnet/token/{token_id}
proof_explorer_link: hashscan.io/mainnet/token/{token_id}
proof_metadata_link: hashscan.io/mainnet/topic/{topic_id} (from memo)
platform_id:        "hedera"
```

**VerifiableProvenance mapping:**
```
source.protocol:    "hedera"
asset.type:         "Carbon Credit"
asset.subtype:      "Soil Carbon"
asset.chain:        "hedera-mainnet"
asset.contractAddress: token_id
asset.assetActionClass: "action"
impact.metrics.climate.tCO2e:        total_supply / 10^decimals
impact.metrics.climate.methodology:  "DOVU Generic dMRV Standard"
impact.metrics.climate.standard:     "DOVU dMRV"
impact.metrics.climate.vintage:      year from created_timestamp (or symbol MMYY)
valuation:          valuateCarbon(tCO2e) — SCC-EPA engine
origin.project:     token.name (farm name)
origin.developer:   "DOVU"
origin.methodology: "DOVU Generic dMRV Standard v1.0"
mrv.status:         "verified" if Guardian key, "pending" if direct HTS
mrv.provider:       "Guardian / DOVU"
mrv.documentCIDs:   ["hcs://mainnet/topic/{topic_id}"]
```

### Tolam Earth

**Source data:**
- Name patterns (4 registries):
  - Verra: `"VRA - VCS-VCU-{methodology}-VER-{country}-{field}-{projectId}-{startDDMMYYYY}-{endDDMMYYYY}-0"`
  - EcoRegistry: `"ERA - CDC_{projectId}_{fields}_{roundCode}_XX_{country}_{fields}_{year}"`
  - Global C-Sink: `"GCSR - {projectId}.{startUnix}.{endUnix}"`
  - Smoke Test: `"TOLAM SMOKE TEST REGISTRY - ..."` (filter out)
- Supply: NFTs, 1 serial = 1 tCO2e. total_supply = tCO2e count.
- IPFS metadata (per serial, base64 CID in NFT metadata field):
  ```json
  { "name": "serial#", "description": "1 tCO2e",
    "properties": { "registryOfOrigin": "verra"|"ecoregistry"|"global-c-sink-registry",
                     "registryProjectId": "VCS4018", "registryProjectName": "...",
                     "monitoringPeriodStartDate": "ISO", "monitoringPeriodEndDate": "ISO",
                     "trustChainHook": "hedera_timestamp" } }
  ```
- Certificate tokens: memo = Guardian topic ID, metadata = Hedera timestamp
- Country codes: in Verra symbol `VER-{country}`, EcoRegistry `_XX_{country}_`

**Filter out:** Smoke Test tokens (name starts with "TOLAM SMOKE TEST"), empty tokens (total_supply=0 AND name is generic "EcoRegistry Asset")

**Action mapping (per asset token):**
```
title:              "{registryProjectName} ({country}, {vintage})"
                    parsed from IPFS properties or token name
description:        "{total_supply} tCO2e bridged from {registryOfOrigin} to Hedera.
                     Registry project: {registryProjectId}. Monitoring: {start}–{end}.
                     Trust chain: {trustChainHook}."
action_start_date:  monitoringPeriodStartDate from IPFS
action_end_date:    monitoringPeriodEndDate from IPFS
geography:          country code from symbol → lat/lng lookup
country_code:       from VER-{XX} or _XX_{CC}_
sdg_ids:            [13] — Climate Action
actor_name:         "Tolam Earth"
protocol_id:        "Hedera Guardian"
proof_link:         hashscan.io/mainnet/token/{token_id}
proof_metadata_link: IPFS CID URL (from NFT serial metadata)
proof_explorer_link: hashscan.io/mainnet/token/{token_id}
platform_id:        "hedera"
```

**VerifiableProvenance mapping:**
```
asset.type:         "Carbon Credit"
asset.subtype:      "Verra VCS" | "EcoRegistry" | "Global C-Sink"
impact.metrics.climate.tCO2e:        total_supply
impact.metrics.climate.methodology:  "VM{code}" from Verra symbol, or registry name
impact.metrics.climate.standard:     "Verra VCS" | "EcoRegistry" | "Global C-Sink"
impact.metrics.climate.vintage:      from monitoring period dates
origin.methodology: "Tolam Earth Multi-Registry Bridge"
mrv.status:         "verified" (all Tolam tokens are Guardian-governed)
mrv.provider:       "Guardian / Tolam Earth"
mrv.documentCIDs:   ["hcs://mainnet/topic/{cert_memo_topic}", "ipfs://{nft_cid}"]
```

### Capturiant

**Source data:**
- Name: `"Forward-{Project} Project-Capturiant standard-{Vintage}"`
- Symbol: `F{M|W}{ProjectType}C{Vintage}` (e.g., FMOtherC2026)
- Memo: plain IPFS CID (bafkrei...) — resolvable at `{CID}.ipfs.w3s.link/`
- IPFS JSON: `{ projectName, projectType, country, vintage, validationDate, standard, sdgs[] }`
- **SDGs from IPFS:** Miller Mountain: [13, 9], Warrior: [13, 15, 12]
- **Country from IPFS:** "United States of America"
- Supply: `total_supply` at decimals=0 = raw unit count
- Key config: admin+supply+wipe (Guardian pattern)

**Action mapping:**
```
title:              "{projectName} — Forward Carbon {vintage}"
description:        "Forward carbon credit for {projectName}, {country}. Vintage {vintage}.
                     Validated {validationDate}. Standard: {standard}."
action_start_date:  validationDate from IPFS
geography:          {lat: 37.8, lng: -79.5} Miller Mountain, VA / {lat: 35.5, lng: -82.5} Warrior, NC
country_code:       "US"
sdg_ids:            from IPFS sdgs[] — [13, 9] or [13, 15, 12]
actor_name:         "Capturiant"
protocol_id:        "Hedera Guardian"
proof_link:         hashscan.io/mainnet/token/{token_id}
proof_metadata_link: https://{CID}.ipfs.w3s.link/
platform_id:        "hedera"
```

**VerifiableProvenance mapping:**
```
asset.type:         "Carbon Credit"
asset.subtype:      "Forward Carbon"
impact.metrics.climate.tCO2e:        total_supply
impact.metrics.climate.standard:     "Capturiant Standard"
impact.metrics.climate.vintage:      from IPFS vintage field
origin.location:    {lat, lng, jurisdiction: "United States"}
mrv.status:         "verified" (Guardian key config)
mrv.provider:       "Guardian / Capturiant"
mrv.documentCIDs:   ["ipfs://{memo_cid}"]
```

### OrbexCO2

**Source data:**
- Dual-token model: commodity token + CO2 credit token (paired via UUID in memo)
- Commodity memo: `{"OrbexMarket": "{uuid},Origin-US-{STATE}", "uom": "MT"}`
- CO2 credit memo: `{"OrbexMarket": "{uuid}", "uom": "tCO2e/MT", "tokenLink": "0.0.XXXX"}`
- Name: material type (e.g., "AluminumExtrusions", "dFerr-1223", "OrbexCO2-Credit")
- **Geography from memo:** `Origin-US-{STATE}` — states: TN, KY, AL, CA, IL, IN
- Supply: immutable (supply_key=null), total_supply at decimals=0
- Material categories: dFerr (steel), dAlum (aluminum), dCopp (copper), dSS (stainless), Mix, dTher (coal), dPlas (plastic)

**Parser strategy:** Only ingest CO2 credit tokens (have `tokenLink` in memo). Reference the paired commodity token for material context and geography.

**Action mapping:**
```
title:              "OrbexCO2 — {material_category} Recycled ({state})"
description:        "Industrial carbon intensity measurement: {tCO2e/MT} for recycled
                     {material}. Origin: {state}, USA. Linked commodity: {tokenLink}."
geography:          US state centroid from Origin-US-{STATE}
country_code:       "US"
sdg_ids:            [13, 12] — Climate Action + Responsible Consumption
actor_name:         "OrbexCO2"
protocol_id:        "Hedera Guardian"
proof_link:         hashscan.io/mainnet/token/{token_id}
proof_metadata_link: hashscan.io/mainnet/token/{tokenLink} (paired commodity)
platform_id:        "hedera"
```

### GCR (Gold Standard)

**Source data:**
- Name: `"GCR - GS TPDDTEC v{version} - {project_name}"`
- Memo: Guardian topic ID (token_id - 1)
- NFT metadata: base64 Hedera timestamps → Guardian VP creation messages
- Key config: admin+freeze+supply+wipe (all different keys per token)
- Supply: NFT count (10, 6, 0, 100, 2)

**Action mapping:**
```
title:              parsed project name ("Safe Water Project (Rwanda)", "Westcom POC")
                    or "GCR Gold Standard TPDDTEC v{version}" if no project name
description:        "Gold Standard verified emission reductions under TPDDTEC v{version}.
                     {supply} credits. Guardian topic: {topic_id}."
geography:          static: Rwanda → POINT(29.87, -1.94)
country_code:       "RW" for Rwanda, null for others
sdg_ids:            [13, 6] — Climate Action + Clean Water (Rwanda Safe Water)
                    [13] for non-water projects
actor_name:         "GCR"
protocol_id:        "Hedera Guardian"
proof_link:         hashscan.io/mainnet/token/{token_id}
proof_metadata_link: hashscan.io/mainnet/topic/{memo_topic}
platform_id:        "hedera"
```

### TYMLEZ

**Source data:**
- CET: fungible, 37 tCO2e (3700 / 10^2). Only token with supply.
- CRU, GOO, REC: all supply=0 (never minted)
- Key config: kyc_key present
- Memo: empty

**Action mapping (CET only — skip zero-supply):**
```
title:              "TYMLEZ — Gold Coast Health Precinct Carbon Measurement"
description:        "37 tCO2e accounted under GHG Corporate Standard.
                     Behind-the-meter energy monitoring at Cohort Innovation Space,
                     Gold Coast Health & Knowledge Precinct, QLD, Australia.
                     First carbon emissions tracking project on Hedera mainnet."
geography:          {lat: -27.96, lng: 153.38} — Gold Coast Health & Knowledge Precinct
country_code:       "AU"
sdg_ids:            [13, 12] — Climate Action + Responsible Consumption
actor_name:         "TYMLEZ"
protocol_id:        "Hedera Guardian"
platform_id:        "hedera"
```

### CUT: Atma.io, TOKERE, Carbon Neutral NFTs, iREC

- **Atma.io** — Global supply chain aggregate (1.6M tCO2e across 50+ countries). No locatable geography.
- **TOKERE** — Retirement attestations (records of consumption, not production). Beneficiary ≠ environmental actor.
- **Carbon Neutral NFTs** — Dormant since Dec 2021, content unreachable, zero supply.
- **iREC** — Geography locked behind multi-hop HCS → IPFS VP retrieval. Not practically extractable.

---

## Geography Lookup Table

| Token / Platform | Location | Lat | Lng | Source |
|---|---|---|---|---|
| DOVU Summerley Hall Fruit Farm | Worcestershire, UK | 52.15 | -2.22 | Farm name |
| DOVU Setka Gosheva Farm | Bulgaria | 42.70 | 25.48 | Farm name |
| DOVU Omarchevo Farm | Bulgaria | 42.75 | 25.50 | Farm name |
| DOVU Briyastovo Wheat Farm | Bulgaria | 42.05 | 24.35 | Farm name |
| DOVU Distillerie Coquerel | Normandy, France | 48.85 | -1.15 | Farm name |
| DOVU Red Hill Farm | UK | 52.50 | -1.50 | Farm name |
| Tolam VRA VER-MX | Mexico | 23.63 | -102.55 | Symbol country code |
| Tolam VRA VER-US (VCS4018) | US/Canada | 39.83 | -98.58 | Symbol + IPFS project name |
| Tolam VRA VER-SG (VCS4019) | Singapore | 1.35 | 103.82 | Symbol country code |
| Tolam ERA _CO_ (CDC-109) | Colombia | 4.57 | -74.30 | Symbol country code |
| Tolam ERA _BR_ (CDC-153) | Brazil | -14.24 | -51.93 | Symbol country code |
| Tolam GCSR GCSP1024 | India | 20.59 | 78.96 | IPFS "Carboneers SRC India" |
| Capturiant Miller Mountain | Virginia, USA | 37.80 | -79.50 | Project name |
| Capturiant Warrior | North Carolina, USA | 35.50 | -82.50 | Project name |
| OrbexCO2 Origin-US-TN | Tennessee | 35.52 | -86.58 | Memo JSON |
| OrbexCO2 Origin-US-KY | Kentucky | 37.84 | -84.27 | Memo JSON |
| OrbexCO2 Origin-US-AL | Alabama | 32.32 | -86.90 | Memo JSON |
| OrbexCO2 Origin-US-CA | California | 36.78 | -119.42 | Memo JSON |
| OrbexCO2 Origin-US-IL | Illinois | 40.63 | -89.40 | Memo JSON |
| OrbexCO2 Origin-US-IN | Indiana | 40.27 | -86.13 | Memo JSON |
| GCR Rwanda Safe Water | Rwanda | -1.94 | 29.87 | Token name |
| TYMLEZ CET | Gold Coast, QLD, Australia | -27.96 | 153.38 | Research: QLD Govt pilot at Cohort Innovation Space |

---

## Architecture (Two Paths — Both Proceed)

### Path A: Hedera Connector (regen-atlas-integrations pattern)

**This is the primary deliverable.** A new connector in the integrations repo that syncs Hedera environmental tokens into Supabase as Actions.

```
regen-atlas-integrations/src/connectors/hedera/
├── index.ts     — Connector impl (register as "hedera")
├── fetcher.ts   — Mirror Node REST client, treasury enumeration, IPFS resolution
└── parser.ts    — Transform HederaToken → ParsedActionData (actions schema)
```

**Fetcher responsibilities:**
- Enumerate tokens from 11 treasury accounts
- Fetch token detail (name, memo, supply, key config, creation timestamp)
- Resolve NFT metadata (serials, IPFS CIDs) for Tolam/DOVU/iREC
- Filter delisted tokens

**Parser responsibilities:**
- Map each token to `actions` row: title, description, geography, country_code, dates
- Create single `actions_protocols` entry: "Hedera Guardian" (all platforms share one protocol)
- Create `actions_proofs` entries: HashScan links (`hashscan.io/mainnet/token/<id>`)
- Create `actions_actors` entries: platform operators
- Map to SDGs: climate action (SDG 13), life on land (SDG 15), clean energy (SDG 7)
- Resolve locations from token names → lat/lng → PostGIS point

**Key mapping: HederaToken → Action**
```
token.name            → action.title (e.g., "Summerley Farm Carbon Credits")
token.memo + metadata → action.description
token.created_at      → action.action_start_date
token.treasury_id     → actor (platform operator lookup)
hashscan.io URL       → action_proof.proof_link
hashscan.io URL       → action_proof.proof_explorer_link
token lat/lng         → action.geography (PostGIS Point)
platform name         → action_protocol (DOVU, Tolam, etc.)
```

### Path B: Intelligence Pipeline (local, this repo)

Same as before — `sources/hedera.ts` → compose → valuate. Produces VerifiableProvenance objects for the intelligence dashboard (gap analysis, methodology traces, scientific valuation).

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

### How the Paths Relate

```
                    Mirror Node API
                         │
              ┌──────────┴──────────┐
              │                     │
    Path A: Connector         Path B: Pipeline
    (integrations repo)       (this repo)
              │                     │
    Supabase Actions DB     VerifiableProvenance
              │                     │
    Explore Map + Cards     Intelligence Dashboard
    Actions Panel           Gap Analysis
    Detail Pages            Valuations
```

Both share the same Mirror Node fetcher logic. Path A is the primary deliverable (visible data on the map). Path B is the differentiator (scientific valuation, cross-chain comparison).

---

## Hackathon Compliance Notes

**Judging criteria:** Execution 20%, Success 20%, Integration 15%, Validation 15%, Innovation 10%, Feasibility 10%, Pitch 10%.

**Integration gap:** Read-only Mirror Node scores weak on Integration (15%) and near-zero on Success (20%). Past Sustainability winners all used Guardian + HTS minting. Mitigation: add HCS (Hedera Consensus Service) provenance writes — post attestations via `TopicCreateTransaction` + `TopicMessageSubmitTransaction` when syncing Actions. Creates real Hedera transactions, addresses "on-chain verification tools" in track description, deepens integration. Low friction — just Hiero JS SDK, no smart contracts.

**Submission requirements (all mandatory):** GitHub repo, project details (100 words), pitch deck PDF, 5-min demo video (YouTube), live demo link.

**Pre-existing code:** Allowed if documented. All new Hedera work must have commits in Feb 17 – Mar 23 window.

---

## Build Timeline (11 days: Mar 13–23)

### Phase 1: Hedera Connector + Supabase (Mar 13–16, 4 days)

**Goal:** All Hedera environmental tokens appear as Actions in Supabase with Guardian provenance.

- [ ] Fork/clone regen-atlas-integrations locally
- [ ] Create `src/connectors/hedera/` following Atlantis/Silvi pattern
- [ ] `fetcher.ts` — Mirror Node REST client
  - [ ] Enumerate all treasury accounts → token list
  - [ ] Token detail fetcher (name, memo, supply, keys, timestamp)
  - [ ] IPFS resolution for Capturiant (w3s.link) and Tolam (NFT serial CIDs)
  - [ ] OrbexCO2 memo JSON parser (extract UUID, origin state, tokenLink)
  - [ ] Filter: delisted tokens, test tokens, zero-supply, utility/governance tokens
  - [ ] Guardian detection: key config → protocol assignment
- [ ] `parser.ts` — Transform to ParsedActionData per platform
  - [ ] DOVU parser: memo regex, farm name extraction, topic ID, supply normalization (6/8/3dp)
  - [ ] Tolam parser: 4 registry name patterns (VRA/ERA/GCSR), IPFS metadata fetch, country codes
  - [ ] Capturiant parser: IPFS CID from memo → fetch JSON → SDGs, country, vintage
  - [ ] OrbexCO2 parser: CO2 credit tokens only, pair with commodity via tokenLink, state geography
  - [ ] GCR parser: project name from token name, topic ID from memo
  - [ ] TYMLEZ parser: CET only (Gold Coast precinct, 37 tCO2e)
  - [ ] Geography table: farm names / country codes / US states → PostGIS Point
  - [ ] SDG mapping: from IPFS (Capturiant) or static per-platform table
  - [ ] Multi-proof insertion: proof 1 = HashScan token, proof 2 = Guardian topic, proof 3 = registry
- [ ] `index.ts` — Register connector, wire CLI
- [ ] Create single `actions_protocols` entry: "Hedera Guardian"
- [ ] `npx tsx src/cli.ts sync hedera --dry-run` → verify all ~60 Actions parse correctly
  - [ ] IPFS fallback: if CID doesn't resolve (Tolam/Capturiant), use token name as title, skip metadata fields, log warning
- [ ] `npx tsx src/cli.ts sync hedera` → populate Supabase
- [ ] Verify in regen-atlas-admin: Hedera actions visible with Guardian protocol badges + multi-proof chains
- [ ] Create "Hedera Guardian" Ecosystem in admin
- [ ] Create Orgs: DOVU, Tolam Earth, Capturiant, OrbexCO2, GCR, TYMLEZ — all platforms, placed where they operate
  - [ ] Each Org: name, description, website, logo, color, coordinates, treasury (Hedera), ecosystem = "Hedera Guardian"
  - [ ] Actor names in actions = Org names (name convention for join)
- [ ] Create Certifiers: Verra (VCS), EcoRegistry, Global C-Sink, Gold Standard, DOVU dMRV Standard, Capturiant Standard
- [ ] Extend certifications to Actions (reuse existing certifiers + certifications architecture)
  - [ ] `actions_certifications` join table (action_id → certification_id)
  - [ ] New Certifier rows: DOVU dMRV Standard, Capturiant Standard (alongside existing registries)
  - [ ] Update `actions_view` materialized view to include certifications array
- [ ] Cut from ingestion: iREC (no geography), Atma.io (global aggregate), TOKERE (retirements not production), Carbon Neutral NFTs (dormant)

### Phase 2: Intelligence Pipeline + Valuation (Mar 17–19, 3 days)

**Goal:** Scientific valuation + Guardian provenance in VerifiableProvenance objects.

- [ ] `sources/hedera.ts` — Mirror Node client (extract shared fetcher from connector)
- [ ] Add `"hedera"` to SourceProtocol union + sourceBreakdown in aggregateImpact()
- [ ] `composeHedera*Provenance()` functions:
  - [ ] `composeHederaDovuProvenance()` — soil carbon, dMRV methodology, topic CIDs
  - [ ] `composeHederaTolamProvenance()` — per-registry (Verra/EcoRegistry/GCSR), IPFS properties
  - [ ] `composeHederaCapturiantProvenance()` — forward carbon, IPFS metadata
  - [ ] `composeHederaOrbexProvenance()` — industrial MRV, paired tokens
  - [ ] `composeHederaGCRProvenance()` — Gold Standard TPDDTEC
  - [ ] `composeHederaTymlezProvenance()` — GHG Corporate Standard, Gold Coast precinct
- [ ] Add Guardian methodology entries to `methodologies.ts`:
  - [ ] DOVU dMRV: project-specific, soil carbon, $30-45/tCO2e range
  - [ ] Tolam Verra Bridge: project-specific, bridged VCS credits, $51-190/tCO2e (SCC range)
  - [ ] Capturiant Forward: category-default, forward carbon discount
  - [ ] GCR TPDDTEC: project-specific, Gold Standard thermal performance
  - [ ] OrbexCO2: category-default, industrial recycling avoided emissions
- [ ] Wire through valuation engine (SCC-EPA for carbon, avoided-emissions for industrial)
- [ ] Map rendering — Hedera actions on Explore map with chain badge + Guardian badge
- [ ] Action detail view: HashScan links, supply, vintage, valuation, methodology trace

### Phase 3: Guardian Ecosystem Dashboard + Wiring (Mar 20–21, 2 days)

**Goal:** Make Guardian's cross-deployment output legible for the first time. Wire Ecosystem/Org/Action relationships.

- [ ] Ecosystem filter in navbar (alongside Type | Issuer | Chain)
  - [ ] `filters.ecosystems: number[]` in filter context
  - [ ] `SET_ECOSYSTEM_FILTER` / `RESET_ECOSYSTEM_FILTER` actions
  - [ ] Extract ecosystem list from `allOrgs` → unique ecosystems
  - [ ] Filter Orgs by ecosystem, filter Actions by actor name matching filtered Orgs
  - [ ] Render as pill in MapFilterBar when Actors toggle is active
- [ ] Surface environmental Actions on Bioregion Vault page
  - [ ] Reuse point-in-polygon matching from bioregion panel Actions tab
  - [ ] Show Actions list on vault page as evidence backing the vault's ecological claims
- [ ] Guardian Ecosystem panel: filter `source.protocol === "hedera"`, group by `mrv.provider`
  - [ ] Operators: how many Guardian deployments, what methodologies
  - [ ] Coverage: soil carbon, bridge credits, RECs, industrial MRV, supply chain, forward carbon
  - [ ] Gaps: no biodiversity, no marine, no cookstoves beyond GCR
  - [ ] Confidence spectrum: Guardian + Verra > Guardian + self-certified > bare HTS (via Certifier model)
- [ ] Cross-chain comparison: DOVU soil carbon vs Toucan NCT vs Regen CarbonPlus
  - [ ] Same asset type, different chains, different governance, different pricing
  - [ ] Methodology trace comparison (dMRV vs Verra VCS vs Regen methodology)
- [ ] Hedera as 4th source protocol on Intelligence page (alongside Toucan, Regen Network, Glow)
  - [ ] Service Value bar: sum SCC-EPA valuations across all Hedera Actions
  - [ ] Market Value bar: $0 (no DEX trading for environmental tokens)
  - [ ] Gap factor: service value / $0 → handle infinite gap edge case
  - [ ] Actions count in "Assets vs Actions" donut
- [ ] Gap analysis: Hedera ecosystem service value vs zero market value (no trading = infinite gap)

### Phase 4: Polish + Submit (Mar 22–24, 3 days)

- [ ] Demo video — "Guardian's intelligence layer"
- [ ] README with architecture diagram showing Guardian provenance flow
- [ ] Vercel cron entries for Hedera connector (daily sync)
- [ ] Deploy to Vercel
- [ ] Submission on StackUp

---

## What Makes This Compelling for Judges

1. **We did the research they haven't.** We mapped the entire Hedera sustainability ecosystem — 155 tokens, 10+ operators, classified and cut down to ~115 tokens across 6 platforms with locatable geography. No other project has done this.

2. **We found the bodies.** EcoGuard, RECDeFi, BCarbon — domains for sale. The "2M BCarbon credits" narrative is vaporware. We surface what's ACTUALLY deployed, not what's been press-released.

3. **Scientific valuation is unique.** Nobody else applies SCC-EPA carbon pricing or TEEB biome valuation to Hedera tokens. We surface the economic value of what exists.

4. **Cross-chain context.** Hedera assets appear alongside Toucan, Regen Network, Glow — judges see how Hedera's sustainability ecosystem compares to other chains. This is valuable to the Hedera Foundation.

5. **Real data, not a demo.** 155+ actual mainnet tokens from actual projects. No testnet, no mocks.

6. **Asset/action classification is novel.** We programmatically distinguish tradeable instruments from attestations based on token key configuration. Nobody else does this.

7. **Production connector pattern.** The Hedera connector follows the same pluggable architecture as Atlantis and Silvi. It's not a hackathon hack — it's a production connector that syncs daily via Vercel cron.

---

## Demo Narrative (2 min)

1. **"Hedera's sustainability ecosystem is invisible."** Show mirror node JSON — raw, unstructured, impossible to navigate.
2. **"We mapped it."** Show the ecosystem map — 155 tokens researched, 115 ingested across 6 platforms, 3 dead projects exposed. "We found what's real."
3. **"Now it's on the Atlas."** Switch to Explore map — filter by "Hedera Guardian" ecosystem. UK farms, Mexican VCS, Rwandan water, Brazilian REDD+, Australian GHG precinct alongside Toucan/Regen/Glow.
4. **"Orgs, Actions, Certifications."** Click DOVU Org → see its Actions across UK/Bulgaria/France bioregions. Click Tolam Action → see Verra VCS certification + Guardian proof chain.
5. **"Scientific valuation reveals the value."** Click Capturiant forward carbon — show SCC-EPA pricing, ecological impact gap, vintage timeline.
6. **"Cross-chain intelligence."** Side-by-side: DOVU soil carbon (Hedera) vs Toucan NCT (Polygon). Same asset type, different governance, different pricing.
7. **"One map. Four chains. Ecosystem intelligence."** Zoom out.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token metadata is sparse (no location in most tokens) | Parse names (Summerley = UK, PAPARIKO = Kenya, Envira = Brazil), follow IPFS CIDs, cross-reference project databases |
| OrbexCO2 geography is state-level centroids only | US state centroid from `Origin-US-{STATE}` in memo — coarse but locatable |
| Some tokens are test/spam | Filter by known treasury accounts + minimum supply thresholds |
| Mirror node rate limits | Cache aggressively — token data doesn't change frequently |
| ~~Pawel's Actions panel code arrives late~~ | ~~RESOLVED: regen-atlas-admin + regen-atlas-integrations are both live~~ |

---

## What NOT to Build

- No Guardian Docker deployment (we READ, we don't WRITE)
- No HTS minting (we INGEST, we don't CREATE)
- No wallet connect (server-side mirror node queries)
- No custom smart contracts
- No Hedera-specific UI chrome — Hedera actions render using existing Action components
- No custom Guardian policies
- No testnet work — we pull from MAINNET
