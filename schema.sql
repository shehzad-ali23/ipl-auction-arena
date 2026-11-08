-- Room state is stored as a JSON document; the server is authoritative and
-- writes the full room after every change. Run automatically on boot.
CREATE TABLE IF NOT EXISTS rooms (
  code        TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_updated_idx ON rooms (updated_at);
