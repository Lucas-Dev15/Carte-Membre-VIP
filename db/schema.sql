-- Carte membre & wallet — Les RDV IA (PostgreSQL)

CREATE TABLE member_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id     uuid NOT NULL REFERENCES members(id),
  code          text NOT NULL UNIQUE CHECK (code ~ '^RVIA-[A-Z]{3}-[0-9]{4}$'), -- jamais réutilisé
  qr_url        text NOT NULL,
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,
  revoked_by    uuid REFERENCES users(id),
  revoke_reason text
);
-- Une seule carte active par membre.
CREATE UNIQUE INDEX member_cards_one_active ON member_cards (member_id) WHERE status = 'active';

CREATE TABLE wallet_passes (
  card_id            uuid PRIMARY KEY REFERENCES member_cards(id),
  ps_pass_id         text NOT NULL,
  ps_instance_id     text UNIQUE,
  barcode_content    text,
  add_to_wallet_url  text,
  apple_wallet_url   text,
  google_wallet_url  text,
  platform           text CHECK (platform IN ('apple', 'google')),
  installed          boolean NOT NULL DEFAULT false,
  last_fields_hash   text,
  last_pushed_at     timestamptz,
  last_push_status   text,
  last_error         text
);

CREATE TABLE wallet_sync_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       uuid NOT NULL REFERENCES member_cards(id),
  reason        text NOT NULL,
  message       text,
  run_after     timestamptz NOT NULL,
  attempts      int NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'running', 'done', 'waiting_credits', 'failed')),
  external_ref  text NOT NULL
);
-- Un seul job en attente par carte (regroupement des changements).
CREATE UNIQUE INDEX wallet_sync_jobs_one_queued ON wallet_sync_jobs (card_id) WHERE status = 'queued';
CREATE INDEX wallet_sync_jobs_due ON wallet_sync_jobs (run_after) WHERE status = 'queued';

-- Dédoublonnage des webhooks The Pass Studio.
CREATE TABLE passstudio_webhook_deliveries (
  delivery_id  text PRIMARY KEY,
  received_at  timestamptz NOT NULL DEFAULT now()
);

-- Journal des actions sensibles (révocation / régénération).
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  actor_id   uuid NOT NULL,
  action     text NOT NULL,
  target_id  uuid NOT NULL,
  details    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
