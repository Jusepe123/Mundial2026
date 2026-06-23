-- Table: group_standings
CREATE TABLE group_standings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name text NOT NULL,
    team_name text NOT NULL,
    team_flag text,
    played int DEFAULT 0,
    goals_scored int DEFAULT 0,
    points int DEFAULT 0,
    UNIQUE(group_name, team_name)
);

ALTER TABLE group_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group standings are viewable by everyone." ON group_standings FOR SELECT USING (true);

-- Index for ordering
CREATE INDEX idx_group_standings_group ON group_standings (group_name);
CREATE INDEX idx_group_standings_points ON group_standings (group_name, points DESC, goals_scored DESC);

-- Insert initial teams
INSERT INTO group_standings (group_name, team_name) VALUES
    ('A', 'Mexico'), ('A', 'South Korea'), ('A', 'Czech Republic'), ('A', 'South Africa'),
    ('B', 'Canada'), ('B', 'Switzerland'), ('B', 'Qatar'), ('B', 'Bosnia and Herzegovina'),
    ('C', 'Brazil'), ('C', 'Morocco'), ('C', 'Scotland'), ('C', 'Haiti'),
    ('D', 'United States'), ('D', 'Australia'), ('D', 'Turkey'), ('D', 'Paraguay'),
    ('E', 'Germany'), ('E', 'Curaçao'), ('E', 'Ivory Coast'), ('E', 'Ecuador'),
    ('F', 'Netherlands'), ('F', 'Japan'), ('F', 'Tunisia'), ('F', 'Sweden'),
    ('G', 'Belgium'), ('G', 'Egypt'), ('G', 'Iran'), ('G', 'New Zealand'),
    ('H', 'Spain'), ('H', 'Cape Verde'), ('H', 'Saudi Arabia'), ('H', 'Uruguay'),
    ('I', 'France'), ('I', 'Senegal'), ('I', 'Norway'), ('I', 'Iraq'),
    ('J', 'Argentina'), ('J', 'Algeria'), ('J', 'Austria'), ('J', 'Jordan'),
    ('K', 'Portugal'), ('K', 'Uzbekistan'), ('K', 'Colombia'), ('K', 'DR Congo'),
    ('L', 'England'), ('L', 'Croatia'), ('L', 'Ghana'), ('L', 'Panama')
ON CONFLICT (group_name, team_name) DO NOTHING;
