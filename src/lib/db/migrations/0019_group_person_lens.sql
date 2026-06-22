ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS inherit_mode text CHECK (inherit_mode IN ('overlay', 'independent')),
  ADD COLUMN IF NOT EXISTS personal_for_participant_id uuid REFERENCES participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS groups_personal_participant_idx ON groups (personal_for_participant_id)
  WHERE personal_for_participant_id IS NOT NULL;
