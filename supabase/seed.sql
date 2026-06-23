-- Insert initial data for scoring_config
INSERT INTO scoring_config (stage, exact_points, winner_points, participation_points, special_points)
VALUES
    ('group', 15, 7, 1, NULL),
    ('round_of_32', 18, 9, 1, NULL),
    ('round_of_16', 25, 12, 1, NULL),
    ('quarter', 35, 17, 1, NULL),
    ('semi', 50, 25, 1, NULL),
    ('third_place', 30, 15, 1, NULL),
    ('final', 75, 35, 1, NULL),
    ('special_first', NULL, NULL, NULL, 50),
    ('special_second', NULL, NULL, NULL, 30),
    ('special_third', NULL, NULL, NULL, 20),
    ('special_fourth', NULL, NULL, NULL, 15),
    ('special_surprise', NULL, NULL, NULL, 25),
    ('special_scorer', NULL, NULL, NULL, 35)
ON CONFLICT (stage) DO UPDATE SET
    exact_points = EXCLUDED.exact_points,
    winner_points = EXCLUDED.winner_points,
    participation_points = EXCLUDED.participation_points,
    special_points = EXCLUDED.special_points,
    updated_at = now();
