import { useEffect, useState } from 'react';

// ----------------------------------------------------------------------------
// Types matching the /api/state payload (returned by n8n workflow `99 API`)
// ----------------------------------------------------------------------------

type Stats = {
  projects: number;
  companies: number;
  contacts: number;
  contacts_with_email: number;
  leads: number;
  researched: number;
  drafted: number;
  approved: number;
  rejected: number;
  outreach: number;
  runs: number;
};

type Project = {
  id: number;
  name: string;
  owner: string | null;
  region: string;
  state: string | null;
  source_url: string;
};

type Lead = {
  id: number;
  contact: string;
  title: string;
  persona: string | null;
  company: string;
  domain: string;
  email: string | null;
  project: string;
  fit_score: number | null;
  score_reason: string | null;
  status: string;
};

type Draft = {
  channel: string;
  subject: string | null;
  body: string;
  approved_by: string | null;
};

type FeaturedLead = {
  id: number;
  contact: string;
  title: string;
  company: string;
  project: string;
  fit_score: number;
  research_dossier: {
    summary: string;
    icebreaker_1: string;
    icebreaker_2: string;
    sources: string;
    recent_news: string;
  } | null;
  drafts: Draft[];
};

type Run = {
  id: number;
  workflow: string;
  finished_at: string;
  items_out: number;
};

type State = {
  stats: Stats;
  projects: Project[];
  leads: Lead[];
  featured_lead: FeaturedLead | null;
  recent_runs: Run[];
};

// ----------------------------------------------------------------------------
// Stage explainer content (static — fundamentals don't change between runs)
// ----------------------------------------------------------------------------

type Stage = {
  num: string;
  name: string;
  status: 'built' | 'oos';
  what: string;
  engine: string;
  input: string;
  output: string;
  notes?: string;
};

const STAGES: Stage[] = [
  {
    num: '01',
    name: 'INGEST',
    status: 'built',
    what: 'Find large-grading construction projects in target regions (data centers first).',
    engine: 'serper.dev (search) → OpenAI mini (Information Extractor).',
    input: '"<region> data center construction permit 2025..2026"',
    output: '{ name: "Second London data center campus", owner: "Vantage Data Centers", region: "uk", source_url: "https://vantage-dc.com/news/..." }',
    notes: 'Grounding gate: extracted name must appear in the search snippet. Region is derived from the project state, not the query origin.',
  },
  {
    num: '02',
    name: 'ENRICH',
    status: 'built',
    what: 'Resolve decision-makers (people) + company firmographics (domain, industry, HQ, headcount).',
    engine: 'serper LinkedIn search → ScrapingBee page fetch → OpenAI mini extractor → persona regex.',
    input: 'project { name, owner_company }',
    output: 'contact { name, title, persona } + company { domain, industry, hq, size }',
    notes: 'Persona regex classifies into gc_project_exec / site_dev_mgr / earthworks_sub / owners_rep — non-target buyers (sales, finance, MEP, FM) correctly stay null.',
  },
  {
    num: '03',
    name: 'SCORE',
    status: 'built',
    what: 'Assign a 0–100 fit score per lead against Lumina excavation-as-a-service criteria.',
    engine: 'OpenAI mini (Information Extractor, structured JSON).',
    input: 'lead { project, company, contact_title, persona, region, ... }',
    output: '{ fit_score: 82, score_breakdown: {...}, score_reason: "VP Construction + data center project; weakness: unknown earthworks volume" }',
    notes: 'Hard gate: leads below MIN_FIT_SCORE (default 70) are parked, not researched.',
  },
  {
    num: '04',
    name: 'RESEARCH',
    status: 'built',
    what: 'Web-grounded research on top-scored leads → personalization hooks + email lookup.',
    engine: 'OpenAI mini (Responses API + builtInTools.webSearch, reasoning=medium) + Hunter.io.',
    input: 'top-scored lead',
    output: '{ summary, icebreaker_1, icebreaker_2, sources: [real URLs] } + contact.email',
    notes: 'Hunter is held behind the score gate — free tier (50/mo) is never spent on parked leads.',
  },
  {
    num: '05',
    name: 'DRAFT',
    status: 'built',
    what: 'Generate personalized email + LinkedIn variants.',
    engine: 'Anthropic Claude Sonnet 4.6 (Information Extractor, temperature 0.5).',
    input: 'researched lead with dossier',
    output: '{ email: {subject, body}, linkedin: {body} }',
    notes: 'System prompt forces use of one icebreaker verbatim from the dossier, then bridges to Lumina value prop (32-ton autonomous electric dozer, ~50% lower $/cu yd).',
  },
  {
    num: '06',
    name: 'APPROVE',
    status: 'built',
    what: 'Human-in-the-loop gate. Reviewer approves or rejects each draft before any send.',
    engine: 'n8n Form Trigger → single CTE that stamps outreach rows and advances lead status.',
    input: 'lead_id + decision (approve / reject) + approver',
    output: 'leads.status = approved | rejected; outreach.approved_by + approved_at stamped on approve.',
  },
  {
    num: '07',
    name: 'SEND',
    status: 'oos',
    what: 'Gmail/SMTP send of approved outreach → SANDBOX_OUTREACH_EMAIL only (per dry-run hard rule).',
    engine: 'Gmail node (intentionally out of scope — pure plumbing).',
    input: 'leads with status=approved',
    output: 'outreach.send_status = sent + scheduled_at timestamp; leads.status = sent',
    notes: 'Intentionally not built. The dry-run guardrail is already enforced by the HITL gate at stage 06.',
  },
  {
    num: '08',
    name: 'FOLLOW-UP',
    status: 'oos',
    what: 'Cron sequence with declining tempo (T+3d, T+7d, T+14d) re-drafting each touch.',
    engine: 'Anthropic Claude — pattern-repeats stage 05 with different tone.',
    input: 'leads with status=sent + no reply',
    output: 'leads.status = followup_n; new outreach row with re-drafted body',
    notes: 'Intentionally out of scope — pattern repeat, no new AI design.',
  },
];

// ----------------------------------------------------------------------------
// Small UI atoms
// ----------------------------------------------------------------------------

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <div className="text-muted uppercase tracking-widest text-[10px] mb-6">{label}</div>
      {children}
    </section>
  );
}

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="border border-line bg-white px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="text-2xl mt-1">{value}</div>
      {sublabel && <div className="text-[11px] text-muted mt-0.5">{sublabel}</div>}
    </div>
  );
}

function StageBox({ s }: { s: Stage }) {
  const oos = s.status === 'oos';
  return (
    <div className={`border ${oos ? 'border-dashed border-line text-muted' : 'border-line'} bg-white px-3 py-2 text-center min-w-[88px]`}>
      <div className="text-[10px] text-muted">{s.num}</div>
      <div className="text-[12px] tracking-wider">{s.name}</div>
    </div>
  );
}

function PersonaTag({ p }: { p: string | null }) {
  if (!p)
    return <span className="text-muted">—</span>;
  return <span className="border border-line px-1.5 py-0.5 text-[10px]">{p}</span>;
}

function StatusTag({ status }: { status: string }) {
  const color =
    status === 'approved' ? 'bg-accent text-white' :
    status === 'rejected' ? 'bg-neutral-200 text-muted line-through' :
    status === 'drafted' ? 'border border-line bg-white' :
    'text-muted';
  return <span className={`${color} px-1.5 py-0.5 text-[10px]`}>{status}</span>;
}

// ----------------------------------------------------------------------------
// Main app
// ----------------------------------------------------------------------------

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAllLeads, setShowAllLeads] = useState(false);

  useEffect(() => {
    fetch('/api/state')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setState)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="border border-line bg-white p-6">
          <div className="text-[10px] uppercase tracking-widest text-muted mb-2">api error</div>
          <div>{error}</div>
          <div className="text-muted mt-4 text-[11px]">
            The dashboard fetches live pipeline state from <code>/api/state</code>. If you're seeing this, the n8n
            workflow <code>99 API</code> is not reachable.
          </div>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-muted">loading…</div>
      </main>
    );
  }

  const { stats, projects, leads, featured_lead, recent_runs } = state;
  const visibleLeads = showAllLeads ? leads : leads.slice(0, 6);

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      {/* HERO ---------------------------------------------------------------- */}
      <header>
        <div className="text-[10px] uppercase tracking-widest text-muted">groundbreaker</div>
        <h1 className="text-2xl mt-1 leading-tight">
          autonomous outbound BD pipeline
        </h1>
        <p className="text-muted mt-2 max-w-2xl">
          Sources large-grading construction projects, enriches the companies + decision-makers behind them, scores each lead
          against Lumina's excavation-as-a-service fit, then drafts personalized outreach behind a human approval gate.
        </p>
        <p className="text-muted text-[11px] mt-3">
          Built solo over ~3 days as proof-of-work for Lumina's <em>AI Applications Specialist</em> role. Dashboard reads
          live state from the running Postgres pipeline.
        </p>
      </header>

      {/* STATS --------------------------------------------------------------- */}
      <Section label="live pipeline state">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard label="projects" value={stats.projects} sublabel="discovered" />
          <StatCard label="leads" value={stats.leads} sublabel={`${stats.researched} researched`} />
          <StatCard label="drafted" value={stats.outreach} sublabel={`${stats.drafted} leads × 2 channels`} />
          <StatCard label="approved" value={stats.approved} sublabel={`${stats.rejected} rejected`} />
        </div>
        <div className="text-[11px] text-muted mt-3">
          {stats.contacts} contacts identified · {stats.contacts_with_email} with Hunter-resolved emails · {stats.runs} workflow runs logged
        </div>
      </Section>

      {/* PIPELINE VISUAL ----------------------------------------------------- */}
      <Section label="pipeline">
        <div className="flex flex-wrap items-center gap-1 text-[12px]">
          {STAGES.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1">
              <StageBox s={s} />
              {i < STAGES.length - 1 && <span className="text-muted">→</span>}
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted mt-3">
          stages <span className="text-ink">01–06</span> are built, published, and verified end-to-end ·{' '}
          stages <span className="text-muted">07–08</span> are intentionally out of scope (pure plumbing + pattern-repeat
          of stage 05 — see explainers below)
        </div>
      </Section>

      {/* STAGE EXPLAINERS ---------------------------------------------------- */}
      <Section label="how each stage works">
        <div className="space-y-3">
          {STAGES.map((s) => {
            const isOpen = expanded === s.num;
            const oos = s.status === 'oos';
            return (
              <div key={s.num} className={`border ${oos ? 'border-dashed' : ''} border-line bg-white`}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : s.num)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted text-[11px]">{s.num}</span>
                    <span className="tracking-wider">{s.name}</span>
                    {oos && <span className="text-[10px] text-muted">— out of scope</span>}
                  </div>
                  <span className="text-muted text-[11px]">{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-line text-[12px]">
                    <Row k="what" v={s.what} />
                    <Row k="engine" v={s.engine} />
                    <Row k="input" v={<code className="text-ink">{s.input}</code>} />
                    <Row k="output" v={<code className="text-ink whitespace-pre-wrap break-words">{s.output}</code>} />
                    {s.notes && <Row k="notes" v={<span className="text-muted">{s.notes}</span>} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* DISCOVERED PROJECTS ------------------------------------------------- */}
      <Section label="discovered projects">
        <div className="border border-line bg-white">
          <table className="w-full text-[12px]">
            <thead className="text-muted text-[10px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-3 py-2 w-10">#</th>
                <th className="text-left px-3 py-2">project</th>
                <th className="text-left px-3 py-2">owner</th>
                <th className="text-left px-3 py-2">region</th>
                <th className="text-left px-3 py-2">source</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-3 py-2 text-muted">{p.id}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.owner ?? '—'}</td>
                  <td className="px-3 py-2 text-muted">{p.region}{p.state ? ` · ${p.state}` : ''}</td>
                  <td className="px-3 py-2">
                    <a href={p.source_url} target="_blank" rel="noreferrer">link</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* LEADS RANKED BY SCORE ---------------------------------------------- */}
      <Section label="leads ranked by fit score">
        <div className="border border-line bg-white">
          <table className="w-full text-[12px]">
            <thead className="text-muted text-[10px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-3 py-2 w-10">score</th>
                <th className="text-left px-3 py-2">contact</th>
                <th className="text-left px-3 py-2">title</th>
                <th className="text-left px-3 py-2">company</th>
                <th className="text-left px-3 py-2">persona</th>
                <th className="text-left px-3 py-2">status</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((l) => (
                <tr key={l.id} className="border-t border-line">
                  <td className="px-3 py-2 tabular-nums">{l.fit_score ?? '—'}</td>
                  <td className="px-3 py-2">{l.contact}</td>
                  <td className="px-3 py-2 text-muted">{l.title}</td>
                  <td className="px-3 py-2">{l.company}</td>
                  <td className="px-3 py-2"><PersonaTag p={l.persona} /></td>
                  <td className="px-3 py-2"><StatusTag status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length > 6 && (
          <button
            type="button"
            className="text-[11px] text-muted underline decoration-line mt-3 hover:text-ink"
            onClick={() => setShowAllLeads((v) => !v)}
          >
            {showAllLeads ? `[ collapse — show top 6 only ]` : `[ show all ${leads.length} leads ]`}
          </button>
        )}
      </Section>

      {/* FEATURED LEAD — full drill-in --------------------------------------- */}
      {featured_lead && (
        <Section label="featured lead — end-to-end output">
          <div className="border border-line bg-white p-5">
            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-base">{featured_lead.contact}</div>
              <div className="text-muted">{featured_lead.title}</div>
              <div className="text-muted">@ {featured_lead.company}</div>
              <span className="border border-accent text-accent px-1.5 py-0.5 text-[10px]">
                score {featured_lead.fit_score} · approved
              </span>
            </div>
            <div className="text-[11px] text-muted mt-1">project: {featured_lead.project}</div>

            {featured_lead.research_dossier && (
              <div className="mt-5">
                <div className="text-[10px] uppercase tracking-widest text-muted mb-1">research dossier (stage 04)</div>
                <div className="text-[12px] space-y-1">
                  <Row k="summary" v={featured_lead.research_dossier.summary} />
                  <Row k="icebreaker_1" v={featured_lead.research_dossier.icebreaker_1} />
                  <Row k="icebreaker_2" v={featured_lead.research_dossier.icebreaker_2} />
                  <Row k="sources" v={
                    <span className="text-[11px] break-all">
                      {featured_lead.research_dossier.sources.split(',').map((s, i) => (
                        <span key={s}>{i > 0 && ' · '}<a href={s.trim()} target="_blank" rel="noreferrer">{s.trim()}</a></span>
                      ))}
                    </span>
                  } />
                </div>
              </div>
            )}

            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-widest text-muted mb-1">drafts (stage 05) — both approved by HITL gate (stage 06)</div>
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {featured_lead.drafts.map((d) => (
                  <div key={d.channel} className="border border-line p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted">{d.channel}</div>
                    {d.subject && <div className="text-[12px] mt-1">{d.subject}</div>}
                    <div className="text-[12px] mt-2 whitespace-pre-wrap leading-relaxed">{d.body}</div>
                    {d.approved_by && (
                      <div className="text-[10px] text-accent mt-3 uppercase tracking-widest">
                        ✓ approved by {d.approved_by}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* TRY THE HITL FORM --------------------------------------------------- */}
      <Section label="try the human approval gate">
        <p className="text-[12px]">
          Stage 06 is a live form. Pick a draft from the table above with status <code>drafted</code> (e.g. lead id 11
          for Kevin Antonelli @ Google, score 81) and decide for yourself.
        </p>
        <a
          href="https://n8n.revops.it.com/form/approve-lead"
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-3 border border-ink px-3 py-2 text-[12px] hover:bg-ink hover:text-paper"
        >
          → open approval form
        </a>
      </Section>

      {/* RUNS LOG ------------------------------------------------------------ */}
      <Section label="observability — recent workflow runs">
        <div className="border border-line bg-white">
          <table className="w-full text-[12px]">
            <thead className="text-muted text-[10px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-3 py-2 w-10">id</th>
                <th className="text-left px-3 py-2">workflow</th>
                <th className="text-left px-3 py-2">finished at</th>
                <th className="text-left px-3 py-2 text-right">items out</th>
              </tr>
            </thead>
            <tbody>
              {recent_runs.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-3 py-2 text-muted">{r.id}</td>
                  <td className="px-3 py-2">{r.workflow}</td>
                  <td className="px-3 py-2 text-muted">{new Date(r.finished_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.items_out}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-muted mt-3">
          every workflow execution writes one row to <code>runs</code> — "what advanced in the last hour" is answerable from
          a single table, no log scraping required.
        </div>
      </Section>

      {/* FOOTER -------------------------------------------------------------- */}
      <footer className="border-t border-line mt-12 pt-6 pb-12 text-[11px] text-muted">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <div className="uppercase tracking-widest text-[10px] mb-1">drill-in</div>
            <div><a href="https://n8n.revops.it.com/" target="_blank" rel="noreferrer">live n8n workflows ↗</a></div>
            <div><a href="https://n8n.revops.it.com/form/approve-lead" target="_blank" rel="noreferrer">approval form ↗</a></div>
          </div>
          <div>
            <div className="uppercase tracking-widest text-[10px] mb-1">code</div>
            <div><a href="https://github.com/zmiievskyi/groundbreaker" target="_blank" rel="noreferrer">github.com/zmiievskyi/groundbreaker ↗</a></div>
            <div><a href="https://github.com/zmiievskyi/groundbreaker/blob/main/README.md" target="_blank" rel="noreferrer">README ↗</a></div>
            <div><a href="https://github.com/zmiievskyi/groundbreaker/blob/main/docs/demo.md" target="_blank" rel="noreferrer">demo doc ↗</a></div>
          </div>
          <div>
            <div className="uppercase tracking-widest text-[10px] mb-1">about</div>
            <div>built by Anton Zmievsky</div>
            <div>proof-of-work for Lumina</div>
            <div>2026</div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3 py-1">
      <div className="text-muted text-[11px] uppercase tracking-widest">{k}</div>
      <div>{v}</div>
    </div>
  );
}
