-- groundbreaker lead pipeline schema
-- auto-loaded by postgres on first boot (docker-entrypoint-initdb.d)

CREATE TYPE company_role AS ENUM ('owner', 'gc', 'earthworks_sub', 'developer');
CREATE TYPE lead_status AS ENUM (
    'new', 'enriched', 'scored', 'researched',
    'drafted', 'approved', 'rejected', 'sent', 'followup'
);

-- a discovered construction project (e.g. a data center build)
CREATE TABLE projects (
    id                   BIGSERIAL PRIMARY KEY,
    source               TEXT NOT NULL,            -- serp.dev | ceqanet | datacenterdynamics | ...
    source_url           TEXT,
    dedup_hash           TEXT UNIQUE NOT NULL,     -- idempotency key
    name                 TEXT,
    project_type         TEXT,                     -- datacenter | solar | highway | ...
    description_raw      TEXT,
    location_raw         TEXT,
    lat                  DOUBLE PRECISION,
    lng                  DOUBLE PRECISION,
    region               TEXT,                     -- us-west | uk | ... (config-driven)
    state                TEXT,
    county               TEXT,
    owner_company        TEXT,
    gc_company           TEXT,
    earthworks_sub       TEXT,
    est_earthworks_cu_yd BIGINT,                   -- from CEQA cut/fill or LLM estimate
    site_acres           NUMERIC,
    timeline_stage       TEXT,                     -- announced | permitting | breaking_ground | under_construction
    groundbreak_date_est DATE,
    capex_est            NUMERIC,
    discovered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    status               TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE companies (
    id           BIGSERIAL PRIMARY KEY,
    name         TEXT NOT NULL,
    role         company_role,
    domain       TEXT,
    hq_location  TEXT,
    size         TEXT,
    linkedin_url TEXT,
    UNIQUE (name, role)
);

CREATE TABLE contacts (
    id               BIGSERIAL PRIMARY KEY,
    company_id       BIGINT REFERENCES companies(id),
    name             TEXT,
    title            TEXT,
    persona          TEXT,         -- gc_project_exec | earthworks_sub | site_dev_mgr | owners_rep
    email            TEXT,
    email_confidence NUMERIC,      -- 0..1
    linkedin_url     TEXT,
    source           TEXT
);

CREATE TABLE leads (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id),
    company_id      BIGINT REFERENCES companies(id),
    contact_id      BIGINT REFERENCES contacts(id),
    fit_score       INTEGER,            -- 0..100
    score_breakdown JSONB,              -- per-dimension points
    score_reason    TEXT,               -- one-line LLM rationale
    status          lead_status NOT NULL DEFAULT 'new',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (project_id, company_id, contact_id)
);

CREATE TABLE outreach (
    id                    BIGSERIAL PRIMARY KEY,
    lead_id               BIGINT NOT NULL REFERENCES leads(id),
    channel               TEXT,                 -- email | linkedin
    subject               TEXT,
    body                  TEXT,
    personalization_hooks JSONB,
    sequence_step         INTEGER NOT NULL DEFAULT 0,
    approved_by           TEXT,
    approved_at           TIMESTAMPTZ,
    send_status           TEXT,                 -- pending | sent | skipped
    scheduled_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- observability: one row per workflow run
CREATE TABLE runs (
    id          BIGSERIAL PRIMARY KEY,
    workflow    TEXT NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    items_in    INTEGER,
    items_out   INTEGER,
    errors      INTEGER DEFAULT 0,
    notes       TEXT
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_score  ON leads(fit_score DESC);
CREATE INDEX idx_projects_region ON projects(region);
CREATE INDEX idx_projects_status ON projects(status);
