CREATE TABLE IF NOT EXISTS trip_hidden_transport_needs (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  need_key text NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, need_key)
);

CREATE INDEX IF NOT EXISTS trip_hidden_transport_needs_trip_idx ON trip_hidden_transport_needs (trip_id);
