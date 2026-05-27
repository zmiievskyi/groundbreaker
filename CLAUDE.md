# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

`groundbreaker` is an autonomous outbound BD pipeline built as proof-of-work for Lumina's *AI Applications Specialist* role. It sources large-earthworks construction projects (data centers first), enriches companies + decision-makers, scores fit for Lumina's excavation-as-a-service, and drafts personalized outreach behind a human approval gate.

**Lumina context:** SF-HQ startup building the Moonlander ML6 (32-ton autonomous electric dozer). GTM = self-perform excavation (they do NOT sell machines), so targets are owners/GCs/earthworks-subs of big-grading projects. Ops start ~Jan 2026, fleet operates in the US (CA/US-West first); UK is only where the prototype is assembled.

## Repository layout

```
docker-compose.yml   # n8n + postgres
db/init/             # postgres schema (auto-run on first boot)
workflows/           # n8n workflow JSON exports (01_ingest … 08_followup)
prompts/             # LLM prompts (extraction, scoring, drafting)
scripts/             # helper scripts (Claude Code research agent, etc.)
docs/                # architecture, scoring, sources
```

## Model assignment (use the right model for the job)

- **serp.dev** — discovery / search queries
- **OpenAI (mini class)** — high-volume per-lead extraction + scoring (cheap, runs over hundreds of records)
- **Anthropic API** (native n8n node) — production draft generation
- **Claude Code headless** (`claude -p`) — agentic deep-research on top-scored leads

## Conventions

- Lead pipeline status flows strictly: `new → enriched → scored → researched → drafted → approved → sent → followup_n`. Don't skip stages.
- Every external call is idempotent and deduped (`projects.dedup_hash`). Add retry + backoff on HTTP nodes.
- Log every workflow run to the `runs` table for observability.
- Geo is **region-configurable** (default `us-west`, seeded with `us-west` + `uk`). Never hardcode a single region.

## Hard rules

- **Dry-run only.** The system drafts; it does not send to real third parties. The `send` stage targets sandbox addresses in the demo and always requires human approval.
- Respect source ToS and rate limits when scraping.
