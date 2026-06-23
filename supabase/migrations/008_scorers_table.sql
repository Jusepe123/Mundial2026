CREATE TABLE IF NOT EXISTS scorers (
    id SERIAL PRIMARY KEY,
    external_player_id INT UNIQUE NOT NULL,
    player_name TEXT NOT NULL,
    nationality TEXT NOT NULL,
    team_name TEXT NOT NULL,
    goals INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE scorers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scorers_select_policy" ON scorers
    FOR SELECT USING (true);
