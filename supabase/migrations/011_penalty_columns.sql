-- Add penalty shootout columns to matches table
-- home_penalties / away_penalties store the penalty kick scores (non-null => match went to pens)
-- The winner is determined by comparing these penalty scores, not the regulation score

ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_penalties INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_penalties INT;
