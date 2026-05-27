# Fit-score

Each lead gets a 0–100 fit score for Lumina's excavation-as-a-service. Stored as `leads.fit_score`, with per-dimension points in `leads.score_breakdown` (jsonb) and a one-line rationale in `leads.score_reason`.

| Dimension | Max | Logic |
|-----------|-----|-------|
| **Geo reachability** | 30 | Distance from the project site to Lumina's operating zone, banded. **Hard gate:** outside all `TARGET_REGIONS` → disqualified. |
| **Earthworks volume** | 25 | Estimated cut/fill cubic yards (from CEQA docs or LLM estimate). Larger jobs maximize the D9-class cost advantage. |
| **Project type** | 15 | Mass-grading / site-prep heavy (data center, solar = high) vs vertical-only (low). |
| **Timeline** | 15 | Groundbreaking aligned with Lumina's ops window (~2026). Too early (years out) or already finished → lower. |
| **Decision-maker reachability** | 15 | A real persona identified with a verified contact (`email_confidence`). No contact → capped. |

## Hard gates (auto-disqualify)

- Project outside every configured region.
- Project already completed.

## Why these weights

Lumina self-performs excavation and must physically bring a 32-ton dozer to site, so **geography is the single largest factor** — a perfect job in the wrong country is unreachable today. Earthworks volume is next because Lumina's economics (~$0.33/cu yd vs ~$0.57 diesel) compound with scale.

Weights live in config and are meant to be tuned as Lumina's operating footprint expands.
