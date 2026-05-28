# Cover note

Hi Lumina team,

Rather than describe what I'd build, I built it. `groundbreaker` is the exact pipeline your *AI Applications Specialist* JD asks for — lead sourcing → enrichment → scoring → research → personalized drafting → human approval — pointed at your real go-to-market (self-performed excavation on large-grading jobs, not selling machines). Six of the eight workflows are running against real data right now: 4 UK data-center projects, 4 enriched companies, 13 scored leads, 8 deep-research dossiers with grounded source URLs, 8 drafts that Claude Sonnet wrote using one verbatim icebreaker plus your value prop, and one HITL-approved outreach for Rob Gire at Vantage. The remaining two stages (SMTP send + cron follow-ups) are intentionally out of scope — they're plumbing and a re-draft repeat of stage 5; the substantive AI portion is what I wanted to demonstrate.

Stack is n8n + Postgres on Docker, with a deliberate model split — serper for search, OpenAI mini for high-volume extraction/scoring/research, Anthropic Claude Sonnet for production drafts. Hunter is held behind the score gate so the 50/mo free tier is never wasted on bad leads. Region is derived from the *project* location (not query origin) so a UK query that surfaces a Texas project gets correctly rejected. Every external call is idempotent; every run logs to a `runs` table. The HITL gate is a published n8n Form that flips lead status + stamps outreach rows in a single atomic CTE.

What the README and [`docs/demo.md`](demo.md) show: it actually works end-to-end, and the design choices reflect thinking about Lumina's specific constraints (regional ops footprint, Hunter quota, anti-hallucination grounding, dry-run safety as a hard rule in `CLAUDE.md`).

Happy to walk through any part of it live.

— Anton
