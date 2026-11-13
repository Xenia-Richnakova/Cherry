-- api/db/schema.sql
CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(trim(name)) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL,
  PRIMARY KEY (workspace_id, member_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payer_id     TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  description  TEXT,
  category     TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note         TEXT,
  source_notification_id TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (workspace_id, payer_id)
    REFERENCES workspace_members(workspace_id, member_id)
);

CREATE TABLE IF NOT EXISTS expense_participants (
  expense_id   TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  PRIMARY KEY (expense_id, member_id),
  FOREIGN KEY (workspace_id, member_id)
    REFERENCES workspace_members(workspace_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_expenses_workspace ON expenses(workspace_id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_notification_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_notification
  ON expenses (workspace_id, source_notification_id) WHERE source_notification_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS workspace_categories (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_key TEXT NOT NULL,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, category_key)
);

-- Authentication
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a SHA-256 hash of each token is stored, never the token itself.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which registered user can act as which member of which workspace.
CREATE TABLE IF NOT EXISTS workspace_access (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id    TEXT NOT NULL,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id, member_id)
    REFERENCES workspace_members(workspace_id, member_id)
);
