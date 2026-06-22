CREATE TABLE IF NOT EXISTS trip_finance_dismissals (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('accommodation_stay', 'transport_leg', 'itinerary_item')),
  entity_id uuid NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS trip_finance_dismissals_trip_idx ON trip_finance_dismissals (trip_id);
