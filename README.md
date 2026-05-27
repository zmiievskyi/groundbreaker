# groundbreaker

**Autonomous outbound pipeline for autonomous earthmoving.** Built for [Lumina](https://luminatech.co).

`groundbreaker` is an end-to-end, agent-driven business-development pipeline that sources large-earthworks construction projects (starting with data centers), enriches the companies and decision-makers behind them, scores each lead against Lumina's excavation-as-a-service fit, and drafts personalized outreach — with a human approval gate before anything is sent.

It is a working demonstration of the exact "fully automated outbound pipeline (lead sourcing → enrichment → messaging → follow-up)" described in Lumina's *AI Applications Specialist* role, pointed at Lumina's real go-to-market: they don't sell machines, they self-perform excavation, so their leads are the owners and contractors of big-grading projects.

## Pipeline

```
discover → enrich → score → deep-research → draft → approve → send (dry-run) → follow-up
```

| Stage | What it does | Engine |
|-------|--------------|--------|
| **discover** | Find data-center construction projects in target regions | serp.dev + free portals (CEQAnet, planning data) |
| **enrich** | Resolve owner / GC / earthworks-sub companies + decision-makers | serp.dev + Hunter (free) + browser agent |
| **score** | Fit-score each lead (geo × earthworks volume × type × timeline × reachability) | OpenAI (mini) |
| **deep-research** | Multi-step research on top leads → personalization hooks | Claude Code (headless agent) |
| **draft** | Personalized email + LinkedIn variant w/ Lumina value prop | Anthropic API |
| **approve** | Human-in-the-loop review (Airtable / Slack) | — |
| **send** | Gated send (**dry-run to sandbox addresses** in demo) | Gmail / SMTP |
| **follow-up** | Scheduled follow-up sequence | Claude + cron |

See [`docs/architecture.md`](docs/architecture.md) for the full diagram, [`docs/scoring.md`](docs/scoring.md) for the fit-score formula, and [`docs/sources.md`](docs/sources.md) for data sources.

## Stack

- **n8n** (self-hosted) — orchestration
- **PostgreSQL** — lead pipeline store
- **serp.dev** — discovery / search
- **OpenAI API** — high-volume extraction + scoring
- **Anthropic API + Claude Code** — drafting + agentic research
- Deployed on a self-hosted VM via Docker Compose

## Quickstart

```bash
cp .env.example .env        # fill in API keys
docker compose up -d        # starts n8n + postgres
# open http://localhost:5678 and import workflows/ JSON exports
```

## Guardrails

This is a **dry-run** system. It sources and drafts; it does **not** blast real third parties. Sending requires explicit human approval and, in the demo, targets sandbox addresses only.

---

*Built as proof-of-work for the Lumina AI Applications Specialist role.*
