-- Add round_of_32 to matches stage constraint
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_stage_check;
ALTER TABLE matches ADD CONSTRAINT matches_stage_check
  CHECK (stage IN ('group', 'round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final'));

-- Upsert scoring_config with new points values including round_of_32
INSERT INTO scoring_config (stage, exact_points, winner_points, participation_points, special_points)
VALUES
    ('group', 15, 7, 1, NULL),
    ('round_of_32', 18, 9, 1, NULL),
    ('round_of_16', 25, 12, 1, NULL),
    ('quarter', 35, 17, 1, NULL),
    ('semi', 50, 25, 1, NULL),
    ('third_place', 30, 15, 1, NULL),
    ('final', 75, 35, 1, NULL)
ON CONFLICT (stage) DO UPDATE SET
    exact_points = EXCLUDED.exact_points,
    winner_points = EXCLUDED.winner_points,
    participation_points = EXCLUDED.participation_points,
    updated_at = now();
