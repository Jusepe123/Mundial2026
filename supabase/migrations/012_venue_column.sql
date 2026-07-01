ALTER TABLE matches ADD COLUMN IF NOT EXISTS venue text;

CREATE INDEX IF NOT EXISTS idx_matches_venue ON matches (venue);
