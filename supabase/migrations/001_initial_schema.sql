
-- Enable the "uuid-ossp" extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: players
CREATE TABLE IF NOT EXISTS players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text UNIQUE NOT NULL,
    device_id text UNIQUE NOT NULL,
    total_points int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- RLS for players
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow individual player inserts" ON players;
CREATE POLICY "Allow individual player inserts" ON players FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow individual player access" ON players;
CREATE POLICY "Allow individual player access" ON players FOR SELECT USING (device_id = current_setting('app.device_id', true));
DROP POLICY IF EXISTS "Allow individual player updates" ON players;
CREATE POLICY "Allow individual player updates" ON players FOR UPDATE USING (device_id = current_setting('app.device_id', true));

-- Table: matches
CREATE TABLE IF NOT EXISTS matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id int UNIQUE NOT NULL,
    home_team text NOT NULL,
    away_team text NOT NULL,
    home_flag text,
    away_flag text,
    match_date timestamptz NOT NULL,
    stage text NOT NULL CHECK (stage IN ('group', 'round_of_16', 'quarter', 'semi', 'third_place', 'final')),
    home_score int,
    away_score int,
    status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
    picks_closed bool DEFAULT false
);

-- Index for matches
CREATE INDEX IF NOT EXISTS idx_matches_match_date ON matches (match_date);
CREATE INDEX IF NOT EXISTS idx_matches_stage ON matches (stage);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches (status);

-- RLS for matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Matches are viewable by everyone." ON matches;
CREATE POLICY "Matches are viewable by everyone." ON matches FOR SELECT USING (true);


-- Table: picks
CREATE TABLE IF NOT EXISTS picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    predicted_home int NOT NULL,
    predicted_away int NOT NULL,
    points_earned int,
    created_at timestamptz DEFAULT now(),
    UNIQUE(player_id, match_id)
);

-- Index for picks
CREATE INDEX IF NOT EXISTS idx_picks_player_id ON picks (player_id);
CREATE INDEX IF NOT EXISTS idx_picks_match_id ON picks (match_id);

-- RLS for picks
ALTER TABLE picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can create their own picks" ON picks;
CREATE POLICY "Players can create their own picks" ON picks FOR INSERT WITH CHECK (player_id = (SELECT id FROM players WHERE device_id = current_setting('app.device_id', true)));
DROP POLICY IF EXISTS "Players can view all picks" ON picks;
CREATE POLICY "Players can view all picks" ON picks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Players can update their own picks" ON picks;
CREATE POLICY "Players can update their own picks" ON picks FOR UPDATE USING (player_id = (SELECT id FROM players WHERE device_id = current_setting('app.device_id', true)));


-- Table: special_picks
CREATE TABLE IF NOT EXISTS special_picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('first', 'second', 'third', 'fourth', 'surprise', 'top_scorer')),
    prediction text NOT NULL,
    points_earned int,
    created_at timestamptz DEFAULT now(),
    UNIQUE(player_id, category)
);

-- Index for special_picks
CREATE INDEX IF NOT EXISTS idx_special_picks_player_id ON special_picks (player_id);
CREATE INDEX IF NOT EXISTS idx_special_picks_category ON special_picks (category);

-- RLS for special_picks
ALTER TABLE special_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Players can create their own special picks" ON special_picks;
CREATE POLICY "Players can create their own special picks" ON special_picks FOR INSERT WITH CHECK (player_id = (SELECT id FROM players WHERE device_id = current_setting('app.device_id', true)));
DROP POLICY IF EXISTS "Players can view all special picks" ON special_picks;
CREATE POLICY "Players can view all special picks" ON special_picks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Players can update their own special picks" ON special_picks;
CREATE POLICY "Players can update their own special picks" ON special_picks FOR UPDATE USING (player_id = (SELECT id FROM players WHERE device_id = current_setting('app.device_id', true)));


-- Table: scoring_config
CREATE TABLE IF NOT EXISTS scoring_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stage text UNIQUE NOT NULL,
    exact_points int,
    winner_points int,
    participation_points int,
    special_points int,
    deadline timestamptz,
    updated_at timestamptz DEFAULT now()
);

-- RLS for scoring_config
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Scoring config is viewable by everyone." ON scoring_config;
CREATE POLICY "Scoring config is viewable by everyone." ON scoring_config FOR SELECT USING (true);


-- View: leaderboard
DROP VIEW IF EXISTS leaderboard CASCADE;
CREATE VIEW leaderboard WITH (security_invoker = true) AS
SELECT
    id,
    username,
    total_points,
    RANK() OVER (ORDER BY total_points DESC) as position
FROM players
ORDER BY total_points DESC;
