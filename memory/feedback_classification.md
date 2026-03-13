---
name: Classification and provenance rules
description: Actions must have geography. $DOVU is not an Asset. Single protocol "Hedera Guardian". Certifiers replace mrv.status. Calculate EII contribution for Actions same as Assets.
type: feedback
---

Key classification decisions:

1. **Actions must have geography** — if no location is extractable, cut the token. No exceptions.
2. **$DOVU is NOT an Asset** — no relationship to underlying material reality. It's a platform utility token. DOVU is an Org.
3. **Single protocol: "Hedera Guardian"** — not 12 per-operator protocols. Differentiation via Orgs (who tokenized) and Certifiers (who validated).
4. **Certifiers replace mrv.status** — Actions can have multiple certifications. Use the most specific methodology available for provenance scoring. No binary verified/pending.
5. **EII contribution for Actions** — calculate estimated EII value same as Assets, using SCC-EPA and methodology specificity.
6. **Orgs = platforms** — parallel to Issuers for Assets. Registries (Verra, Gold Standard) are Certifiers, not Orgs.
7. **Hedera = Ecosystem filter**, not Chain filter. Chain is for Assets only.

**Why:** User clarified that the Atlas organizes by material reality and geographic impact. Tokens without geography aren't Actions. Tokens without material backing aren't Assets. The protocol badge identifies the system (Hedera Guardian), while Org and Certifier carry the domain meaning.

**How to apply:** When building parsers, every token must resolve to a lat/lng or get dropped. When building UI, use Ecosystem filter for Actors/Actions, Chain filter for Assets only. When scoring provenance, use Certifier as the confidence signal.
