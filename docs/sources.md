# Data sources

Hero vertical: **data centers** — huge site grading, a hot 2025–2026 build cycle, and leads that are discoverable in free press and public permits. Sources are free-first; paid enrichment is optional and swap-in via API key.

## Discovery (serp.dev)

Region-parameterized queries, e.g.:

- `("AWS" OR "Microsoft" OR "Google" OR "Meta" OR "QTS" OR "Vantage") data center "{state}" construction permit 2025..2026`
- `"{county}" planning commission data center grading permit`
- `site:datacenterdynamics.com {region} construction groundbreaking`

## Free portals

| Source | Gives | Notes |
|--------|-------|-------|
| **CEQAnet** (ceqanet.opr.ca.gov) | grading cut/fill **cubic yards**, owner, acreage | ⭐ CA gold — the earthworks-volume signal, for free |
| County / city planning + permit open data (DataSF, LA County) | permits, owners, timelines | per-jurisdiction |
| Data Center Dynamics / Data Center Frontier | owner + GC from news | RSS + scrape |
| SEC filings / hyperscaler press releases | capex, project scale | — |
| Construction Dive / ENR | GC names, project announcements | RSS |

## Enrichment

| Layer | Free | Paid upgrade (swap-in key) |
|-------|------|----------------------------|
| Firmographics | gov portals + press (owner/GC already named) | Dodge / ConstructConnect |
| Contact email | Hunter free tier, RocketReach free, company site | Apollo / Clay |
| People search | browser agent on LinkedIn + Google + LLM extraction | Sales Navigator |

### Hunter budget — reserve for top-scored leads

Hunter Free tier = **50 searches + 50 verifications / month** (resets monthly), the scarcest
resource in the stack. CLAUDE.md targets enrichment "over hundreds of records," so Hunter
**cannot** run during bulk ENRICH. Policy:

- **Firmographics + decision-maker _names_** resolve early (gov portals + press + browser agent),
  at **zero Hunter cost** — this is what feeds the fit-score.
- **Hunter email lookup runs only in DEEP RESEARCH (stage 4)**, after the `MIN_FIT_SCORE` gate,
  so credits are spent only on leads that already cleared the bar.
- Lookups are **cached/deduped by company domain** — a domain is never spent twice.

## Compliance

Respect each source's ToS and rate limits. The pipeline is dry-run: it discovers and drafts only.
