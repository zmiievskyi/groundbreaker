# Architecture

`groundbreaker` is eight n8n workflows over a shared PostgreSQL store. Each workflow owns one pipeline stage and advances a lead's `status`. All stages are idempotent and logged to the `runs` table.

```mermaid
flowchart TD
    subgraph discovery
        A[serp.dev queries<br/>+ CEQAnet / planning portals] --> B[OpenAI: extract project fields]
        B --> C[geocode + assign region]
        C --> D[(projects: new)]
    end

    D --> E[ENRICH<br/>owner / GC / earthworks-sub<br/>+ decision-makers]
    E --> F[(leads: enriched)]
    F --> G[SCORE<br/>OpenAI weighted fit-score]
    G --> H{score >= MIN_FIT_SCORE?}
    H -- no --> X[park]
    H -- yes --> I[DEEP RESEARCH<br/>Claude Code headless agent]
    I --> J[DRAFT<br/>Anthropic API: email + LinkedIn]
    J --> K[APPROVE<br/>human gate: Airtable / Slack]
    K -- approved --> L[SEND<br/>dry-run -> sandbox]
    K -- rejected --> X
    L --> M[FOLLOW-UP<br/>cron sequence]
    M --> K
```

## Workflow map

| # | Workflow | Trigger | Engine | Advances status to |
|---|----------|---------|--------|--------------------|
| 1 | INGEST | cron | serp.dev + OpenAI | `projects.new` |
| 2 | ENRICH | new projects | serp.dev + Hunter + browser agent | `enriched` |
| 3 | SCORE | enriched | OpenAI | `scored` |
| 4 | DEEP RESEARCH | scored ≥ threshold | Claude Code | `researched` |
| 5 | DRAFT | researched | Anthropic API | `drafted` |
| 6 | APPROVE | drafted | human (Airtable/Slack) | `approved` / `rejected` |
| 7 | SEND | approved | Gmail/SMTP (sandbox) | `sent` |
| 8 | FOLLOW-UP | cron | Claude | `followup` |

## Cross-cutting

- **Idempotency:** `projects.dedup_hash` prevents reprocessing; upserts everywhere.
- **Reliability:** retry + exponential backoff on every HTTP node; an error-catch workflow posts failures to Slack.
- **Observability:** every run writes to `runs`; a metrics view reports counts per stage and estimated hours saved.
- **Config:** `TARGET_REGIONS` and `MIN_FIT_SCORE` are env-driven — no hardcoded geo or thresholds.
