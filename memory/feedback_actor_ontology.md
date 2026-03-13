---
name: Actor ontology clarification
description: Actors = Ecosystems + Orgs + Agents. Ecosystems are collections of Orgs and Agents. Orgs commit to bioregions/points. Agents commit to bioregions and may be deployed by Orgs but are separate Actors.
type: feedback
---

Actors is the umbrella category. Three subtypes:
- **Ecosystems** — collections of Orgs and Agents (e.g., "Hedera Guardian")
- **Orgs** — committed to a Bioregion or a point within a Bioregion
- **Agents** — committed to a Bioregion, may be deployed by an Org but are themselves separate Actors

**Why:** User corrected assumption that ActionActor (name/website on action records) was the full actor model. The real actor taxonomy is richer — Ecosystems group Orgs and Agents, and the navbar needs an Ecosystem filter alongside the existing Orgs/Agents toggles.

**How to apply:** When wiring Hedera Guardian, create it as an Ecosystem (not just a tag). DOVU, Tolam, etc. are Orgs within that Ecosystem. Don't conflate `actions_actors` (flat join table) with the Actor entity hierarchy.

Map placement rules:
- Org `coordinates` = HQ pin. Org is also surfaced in every Bioregion where it has Actions (automatic commitment).
- Actions MUST have geography — if no location is extractable, cut the token.
- Orgs = platforms that tokenized on Hedera (parallel to Issuers for Assets). Registries (Verra, Gold Standard) are Certifiers, not Orgs.
- Hedera = Ecosystem filter, NOT Chain filter (Chain is for Assets only).
- Action images: find project-specific imagery, default to Org logo.
