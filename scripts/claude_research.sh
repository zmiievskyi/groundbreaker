#!/usr/bin/env bash
# DEEP RESEARCH stage — invoked by n8n (Execute Command) for top-scored leads.
# Runs Claude Code headless as an agent to gather personalization hooks.
#
# Usage: claude_research.sh '<project_json>' '<company_json>'
# Emits JSON: { "hooks": [ { "type": "...", "text": "...", "source": "..." } ] }
#
# Placeholder — wire to `claude -p` with a research prompt + allowed tools.

set -euo pipefail

PROJECT_JSON="${1:?project json required}"
COMPANY_JSON="${2:?company json required}"

PROMPT="You are researching a sales lead for Lumina (autonomous electric excavation).
Given this project and company, find 2-4 concrete, recent personalization hooks
(specific project details, public pain points, exec statements, timelines).
Return only JSON: {\"hooks\":[{\"type\":\"\",\"text\":\"\",\"source\":\"\"}]}.

PROJECT: ${PROJECT_JSON}
COMPANY: ${COMPANY_JSON}"

# TODO: enable web tooling / serp.dev MCP for the agent
claude -p "${PROMPT}" --output-format json
