# Demo — real artifacts from the pipeline

Below are actual rows from a Postgres dump after one full run through stages 1–6, captured 2026-05-28.

## Stage 1 — projects discovered

The discovery cron used region-parameterized serper.dev queries against `TARGET_REGIONS=us-west,uk` and OpenAI mini extracted structured project rows. All four projects are real, in-region, and have a verifiable source URL.

| id | name | owner | region | state | source |
|----|------|-------|--------|-------|--------|
| 1 | Second London data center campus | Vantage Data Centers | uk | London | [vantage-dc.com press release](https://vantage-dc.com/news/vantage-data-centers-announces-opening-of-second-london-campus-with-landmark-public-art-installation/) |
| 2 | Docklands data center campus | Ada Infrastructure | uk | – | [adainfrastructure.com press release](https://adainfrastructure.com/en-US/insights/news/ada-infrastructure-celebrates-groundbreaking-of-its-210-megawatt-docklands-data-center-campus-in-london) |
| 3 | Kao Data park third data centre | Kao Data | uk | England | [bbc.co.uk article](https://www.bbc.co.uk/news/articles/cz7p5llgjxro) |
| 4 | new UK data centre in Waltham Cross | Google | uk | UK | [blog.google announcement](https://blog.google/company-news/inside-google/around-the-globe/google-europe/united-kingdom/google-1-billion-investment-in-a-new-uk-data-centre/) |

## Stage 2 — companies enriched

Firmographics resolved via Serper LinkedIn search + ScrapingBee LinkedIn page fetch. The "about-us__" data-test markers in LinkedIn HTML are parsed into structured fields.

| id | name | domain | hq | industry | size |
|----|------|--------|------|----------|------|
| 1 | Vantage Data Centers | `vantage-dc.com` | Denver, Colorado | IT Services and IT Consulting | 1,001–5,000 |
| 6 | Ada Infrastructure | `adainfrastructure.com` | Bellevue, Washington | Data Infrastructure and Analytics | 51–200 |
| 8 | Kao Data | `kaodata.com` | Harlow, Essex | IT Services and IT Consulting | 11–50 |
| 11 | Google | `google.com` *(normalized from `goo.gle`)* | Mountain View, CA | Software Development | 10,001+ |

## Stage 3 — leads scored

13 leads, scored 0–100 by OpenAI mini against the [fit-score formula](scoring.md). Persona regex correctly returns `null` for non-target buyer types (CCO, mechanical engineer, workplace services, finance) — they still get scored but at lower values.

| score | contact | title | persona | status |
|-------|---------|-------|---------|--------|
| **82** | Lead-A | VP of Construction | `gc_project_exec` | **approved** |
| 81 | Lead-B | Senior Director of Construction | `gc_project_exec` | drafted |
| 80 | Lead-C | Director, Construction, North America | `gc_project_exec` | drafted |
| 79 | Lead-D | VP of Construction | `gc_project_exec` | drafted |
| 78 | Lead-E | VP, North American Development Lead | `site_dev_mgr` | drafted |
| 76 | Lead-F | Head of Real Estate Development | `site_dev_mgr` | drafted |
| 73 | Lead-G | SVP Business Development | `null` | **rejected** |
| 73 | Lead-H | Vice President | `null` | drafted |
| 66 | Lead-I | Technical Director | `null` | scored (parked) |
| 62 | Lead-J | Chief Commercial Officer | `null` | scored (parked) |
| 62 | Lead-K | Chartered mechanical engineer | `null` | scored (parked) |
| 61 | Lead-L | VP/Controller | `null` | scored (parked) |
| 58 | Lead-M | Senior Director of Workplace Services | `null` | scored (parked) |

Each score comes with a one-line LLM-written rationale stored in `leads.score_reason`. Example for Lead-A:

> Top drivers: strong persona fit (VP of Construction contact) and project is a datacenter. Primary negative: unknown earthworks volume limits confidence on project scope.

## Stage 4 — research dossier (top lead)

The Research Lead Information Extractor runs OpenAI mini with the Responses API + `builtInTools.webSearch` enabled. Reasoning effort is `medium`, search context size `high`. Strict prompt forces grounded real URLs; if the model returns a fictional source, the icebreaker is rejected.

```json
{
  "sources": "https://vantage-dc.com,https://www.linkedin.com/company/vantage-data-centers",
  "summary": "Lead: Second London data center campus (London, UK) — Vantage Data Centers. Contact: Lead-A, Vice President of Construction (persona: gc_project_exec). Company HQ: Denver, Colorado. Industry: IT Services and IT Consulting. Employee size: 1,001-5,000. Project stage: unknown. Sources: company website and LinkedIn profiles.",
  "recent_news": "No recent public announcements specifically about Vantage's Second London campus were found in the provided sources.",
  "icebreaker_1": "Lead-A — congrats on your role at Vantage. For London campuses with tight footprints and deep excavations, how are you approaching mass excavation sequencing and cut/fill to minimize equipment congestion and local traffic impacts?",
  "icebreaker_2": "Lead-A — would you be open to a brief 15-minute call to explore whether an excavation-as-a-service or equipment-sharing model could shorten mobilization and reduce equipment overlap on Vantage's Second London campus?"
}
```

Email resolved by Hunter (in-budget — only top-scored leads ever touch the API): `r***@vantage-dc.com` (confidence 81).

## Stage 5 — drafts (Claude Sonnet 4.6)

Both an email and a LinkedIn variant get produced per approved lead. The system prompt is in [`prompts/draft_outreach.md`](../prompts/draft_outreach.md); the model is instructed to use one icebreaker from the dossier verbatim, then bridge to Lumina's value prop (32-ton autonomous electric dozer, ~50% lower $/cu yd vs diesel, zero emissions).

**Email — Lead-A (subject: "Excavation approach for London campus")**

> Lead-A — congrats on your role at Vantage. For London campuses with tight footprints and deep excavations, how are you approaching mass excavation sequencing and cut/fill to minimize equipment congestion and local traffic impacts?
>
> We self-perform excavation with a 32-ton autonomous electric dozer that costs roughly 50% less per cubic yard than a diesel D9, runs zero emissions, and removes operators from hazardous grading work. On constrained urban sites, the smaller footprint and teleoperated operation often cut mobilization time and reduce equipment overlap.
>
> Worth a 15-minute call to see if it…

**LinkedIn variant (single paragraph, no subject)**

> Lead-A — for London's tight footprints and deep cuts, how are you sequencing excavation to minimize congestion? We self-perform with a 32-ton autonomous electric dozer: ~50% lower cost/cy, zero emissions, teleoperated. Often cuts mobilization and equipment overlap on constrained sites. Open to a quick call?

## Stage 6 — HITL decision

The reviewer opened `http://localhost:5678/form/approve-lead`, picked the lead from the form description's SQL hint (which queries pending drafts inline), submitted `approve` for Lead-A and `reject` for Lead-G.

```text
 lead | contact   | decision | leads.status | outreach.approved_by
 ---- | --------- | -------- | ------------ | --------------------
   4  | Lead-A  | approve  | approved     | demo reviewer (both rows: email, linkedin)
   2  | Lead-G | reject   | rejected     | NULL (no stamp)
```

`outreach.approved_at` and `outreach.approved_by` are set in the *same* CTE that flips `leads.status`, gated by `WHERE leads.status='drafted'` so re-submissions are no-ops.

## Runs log (observability)

Every workflow execution writes one row to `runs`:

```sql
SELECT id, workflow, finished_at, items_out, notes FROM runs ORDER BY id DESC LIMIT 8;
```

This makes "what happened in the last hour" and "did stage X advance any leads" answerable from a single table, no log scraping required.
