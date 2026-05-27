# Prompt: extract project fields

Used in INGEST (OpenAI). Turns a messy search result / article / permit page into a structured project record.

## System

You extract structured data about large construction projects from unstructured text. Return only valid JSON matching the schema. Use `null` for anything not stated — never guess.

## Schema

```json
{
  "name": "string|null",
  "project_type": "datacenter|solar|highway|residential|mining|landfill|other|null",
  "location_raw": "string|null",
  "state": "string|null",
  "county": "string|null",
  "owner_company": "string|null",
  "gc_company": "string|null",
  "earthworks_sub": "string|null",
  "est_earthworks_cu_yd": "integer|null",
  "site_acres": "number|null",
  "timeline_stage": "announced|permitting|breaking_ground|under_construction|completed|null",
  "groundbreak_date_est": "YYYY-MM-DD|null",
  "capex_est": "number|null"
}
```

## User (template)

```
SOURCE: {{source_url}}
TEXT:
{{raw_text}}
```
