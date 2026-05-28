# Screenshots to capture

CLI can't grab n8n canvases — capture these from your browser at `http://localhost:5678`. Save to `docs/img/` and embed in the README.

## Workflow canvases (one per workflow)

For each, open the workflow, fit-to-view, hide the right-side panel for a clean shot:

| File | Workflow | Suggested name |
|------|----------|----------------|
| `workflows/01_ingest.json` | 01 Ingest — Discovery | `docs/img/01_ingest.png` |
| `workflows/02_enrich.json` | 02 Enrich — Decision-Makers | `docs/img/02_enrich.png` |
| `workflows/03_score.json` | 03 Score — Fit-score | `docs/img/03_score.png` |
| `workflows/04_research.json` | 04 Deep Research + Hunter | `docs/img/04_research.png` |
| `workflows/05_draft.json` | 05 Draft — Outreach | `docs/img/05_draft.png` |
| `workflows/06_approve.json` | 06 Approve — HITL Gate | `docs/img/06_approve.png` |

## Execution evidence

| File | What | Where |
|------|------|-------|
| `docs/img/exec_01_ingest.png` | Successful execution with 4 projects produced | Executions tab of `01_ingest` |
| `docs/img/exec_05_draft.png` | Successful run showing 8 drafts | Executions tab of `05_draft` |
| `docs/img/form_approve.png` | The approval form rendered | Navigate to `/form/approve-lead` |

## Quick capture commands (Linux)

If on the host running n8n, use `flameshot gui` or `gnome-screenshot`:

```bash
mkdir -p docs/img
flameshot gui --path docs/img/
```

Then drop the saved PNGs into the table above and reference them from the README as:

```markdown
![01 Ingest workflow](docs/img/01_ingest.png)
```
