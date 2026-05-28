#!/usr/bin/env node
// Generate frontend/src/workflows-meta.json from workflows/*.json
//
// The dashboard's "workflow internals" section renders a node-by-node
// breakdown auto-derived from the same JSON that's checked into the repo —
// single source of truth, can't drift from the live workflow.

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const WORKFLOWS_DIR = resolve(REPO_ROOT, 'workflows');
const OUT_PATH = resolve(REPO_ROOT, 'frontend', 'src', 'workflows-meta.json');

// Friendly type → category + label so the UI can colour-code without knowing
// the full n8n type registry. Keep this conservative — fall back to "node".
const TYPE_MAP = {
  'n8n-nodes-base.scheduleTrigger':  { kind: 'trigger', label: 'cron trigger' },
  'n8n-nodes-base.webhook':           { kind: 'trigger', label: 'webhook trigger' },
  'n8n-nodes-base.formTrigger':       { kind: 'trigger', label: 'form trigger' },
  'n8n-nodes-base.manualTrigger':     { kind: 'trigger', label: 'manual trigger' },
  'n8n-nodes-base.code':              { kind: 'code',    label: 'code' },
  'n8n-nodes-base.httpRequest':       { kind: 'http',    label: 'http request' },
  'n8n-nodes-base.postgres':          { kind: 'db',      label: 'postgres' },
  'n8n-nodes-base.set':               { kind: 'transform', label: 'set' },
  'n8n-nodes-base.respondToWebhook':  { kind: 'respond', label: 'respond' },
  'n8n-nodes-base.splitOut':          { kind: 'transform', label: 'split out' },
  'n8n-nodes-base.if':                { kind: 'control', label: 'if' },
  'n8n-nodes-base.merge':             { kind: 'control', label: 'merge' },
  '@n8n/n8n-nodes-langchain.informationExtractor': { kind: 'ai', label: 'information extractor' },
  '@n8n/n8n-nodes-langchain.chainLlm':              { kind: 'ai', label: 'llm chain' },
  '@n8n/n8n-nodes-langchain.agent':                 { kind: 'ai', label: 'agent' },
  '@n8n/n8n-nodes-langchain.lmChatOpenAi':          { kind: 'ai-model', label: 'OpenAI chat' },
  '@n8n/n8n-nodes-langchain.lmChatAnthropic':       { kind: 'ai-model', label: 'Anthropic chat' },
};

function classify(type) {
  return TYPE_MAP[type] ?? { kind: 'node', label: type.replace(/^.*\./, '') };
}

// Topological order using main-edge connections. Falls back to x-position
// if the graph is disconnected (which happens with parallel branches).
function orderNodes(nodes, connections) {
  const byName = new Map(nodes.map((n) => [n.name, n]));
  const indeg = new Map(nodes.map((n) => [n.name, 0]));
  const adj = new Map(nodes.map((n) => [n.name, []]));

  for (const [src, outputs] of Object.entries(connections ?? {})) {
    if (!byName.has(src)) continue;
    const mainOutputs = outputs.main ?? [];
    for (const branch of mainOutputs) {
      for (const edge of branch ?? []) {
        if (!byName.has(edge.node)) continue;
        adj.get(src).push(edge.node);
        indeg.set(edge.node, (indeg.get(edge.node) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm; ties broken by smaller x-position then smaller y
  const sortByPos = (a, b) => {
    const A = byName.get(a), B = byName.get(b);
    return A.position[0] - B.position[0] || A.position[1] - B.position[1];
  };
  const ready = [...indeg].filter(([, d]) => d === 0).map(([k]) => k).sort(sortByPos);
  const out = [];
  while (ready.length) {
    const cur = ready.shift();
    out.push(cur);
    for (const next of adj.get(cur) ?? []) {
      indeg.set(next, indeg.get(next) - 1);
      if (indeg.get(next) === 0) {
        ready.push(next);
        ready.sort(sortByPos);
      }
    }
  }
  // any leftover (cycle or unreachable) — append in position order
  const seen = new Set(out);
  for (const n of [...nodes].sort((a, b) => a.position[0] - b.position[0]).map((n) => n.name)) {
    if (!seen.has(n)) out.push(n);
  }
  return out;
}

// Collect non-main edges (e.g. ai_languageModel) so each main node carries
// its attached subnodes (model, tools, memory) as a flat hint.
function collectSubnodes(nodes, connections) {
  const subs = new Map(nodes.map((n) => [n.name, []]));
  for (const [src, outputs] of Object.entries(connections ?? {})) {
    for (const [edgeType, branches] of Object.entries(outputs)) {
      if (edgeType === 'main') continue;
      for (const branch of branches) {
        for (const edge of branch ?? []) {
          // The "ai_*" connection direction in n8n is subnode→parent, so the
          // subnode is `src` and the parent (the main node) is `edge.node`.
          subs.get(edge.node)?.push({ name: src, edgeType });
        }
      }
    }
  }
  return subs;
}

async function processWorkflow(filePath) {
  const raw = JSON.parse(await readFile(filePath, 'utf8'));
  const wf = Array.isArray(raw) ? raw[0] : raw;
  const order = orderNodes(wf.nodes, wf.connections);
  const subs = collectSubnodes(wf.nodes, wf.connections);
  const byName = new Map(wf.nodes.map((n) => [n.name, n]));

  const subnodeNames = new Set();
  for (const arr of subs.values()) for (const s of arr) subnodeNames.add(s.name);

  const nodes = order
    .filter((name) => !subnodeNames.has(name))   // hide subnodes from main flow
    .map((name) => {
      const n = byName.get(name);
      const cls = classify(n.type);
      const attached = (subs.get(name) ?? []).map((s) => {
        const sn = byName.get(s.name);
        return { name: s.name, ...classify(sn?.type ?? '') };
      });
      return { name, kind: cls.kind, label: cls.label, attached };
    });

  return {
    file: basename(filePath),
    name: wf.name,
    description: wf.description ?? null,
    nodeCount: wf.nodes.length,
    nodes,
  };
}

async function main() {
  const files = (await readdir(WORKFLOWS_DIR))
    .filter((f) => f.endsWith('.json'))
    .sort();
  const meta = {};
  for (const f of files) {
    const slug = f.replace(/\.json$/, '');
    meta[slug] = await processWorkflow(resolve(WORKFLOWS_DIR, f));
  }
  await writeFile(OUT_PATH, JSON.stringify(meta, null, 2) + '\n');
  console.log(`wrote ${OUT_PATH} (${Object.keys(meta).length} workflows)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
