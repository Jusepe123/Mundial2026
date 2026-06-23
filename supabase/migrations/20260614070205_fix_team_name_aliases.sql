-- Fix: normalize team name aliases from football-data.org in group_standings_view
-- so "Czechia" ⟶ "Czech Republic", "Bosnia-Herzegovina" ⟶ "Bosnia and Herzegovina", etc.
-- The sync-matches function now normalizes on write; this view normalizes on read as safety net.

CREATE OR REPLACE VIEW group_standings_view WITH (security_invoker = true) AS
WITH norm AS (
    SELECT
        CASE home_team
            WHEN 'Czechia' THEN 'Czech Republic'
            WHEN 'Bosnia-Herzegovina' THEN 'Bosnia and Herzegovina'
            WHEN 'Korea Republic' THEN 'South Korea'
            WHEN 'Côte d''Ivoire' THEN 'Ivory Coast'
            WHEN 'Turkiye' THEN 'Turkey'
            WHEN 'Cape Verde Islands' THEN 'Cape Verde'
            WHEN 'Congo DR' THEN 'DR Congo'
            ELSE home_team
        END AS home_team,
        CASE away_team
            WHEN 'Czechia' THEN 'Czech Republic'
            WHEN 'Bosnia-Herzegovina' THEN 'Bosnia and Herzegovina'
            WHEN 'Korea Republic' THEN 'South Korea'
            WHEN 'Côte d''Ivoire' THEN 'Ivory Coast'
            WHEN 'Turkiye' THEN 'Turkey'
            WHEN 'Cape Verde Islands' THEN 'Cape Verde'
            WHEN 'Congo DR' THEN 'DR Congo'
            ELSE away_team
        END AS away_team,
        home_score, away_score, status, stage
    FROM matches
),
team_groups AS (
    SELECT * FROM (VALUES
        ('Mexico'::text, 'A'::text), ('South Korea', 'A'), ('Czech Republic', 'A'), ('South Africa', 'A'),
        ('Canada', 'B'), ('Switzerland', 'B'), ('Qatar', 'B'), ('Bosnia and Herzegovina', 'B'),
        ('Brazil', 'C'), ('Morocco', 'C'), ('Scotland', 'C'), ('Haiti', 'C'),
        ('United States', 'D'), ('Australia', 'D'), ('Turkey', 'D'), ('Paraguay', 'D'),
        ('Germany', 'E'), ('Curaçao', 'E'), ('Ivory Coast', 'E'), ('Ecuador', 'E'),
        ('Netherlands', 'F'), ('Japan', 'F'), ('Tunisia', 'F'), ('Sweden', 'F'),
        ('Belgium', 'G'), ('Egypt', 'G'), ('Iran', 'G'), ('New Zealand', 'G'),
        ('Spain', 'H'), ('Cape Verde', 'H'), ('Saudi Arabia', 'H'), ('Uruguay', 'H'),
        ('France', 'I'), ('Senegal', 'I'), ('Norway', 'I'), ('Iraq', 'I'),
        ('Argentina', 'J'), ('Algeria', 'J'), ('Austria', 'J'), ('Jordan', 'J'),
        ('Portugal', 'K'), ('Uzbekistan', 'K'), ('Colombia', 'K'), ('DR Congo', 'K'),
        ('England', 'L'), ('Croatia', 'L'), ('Ghana', 'L'), ('Panama', 'L')
    ) AS t(team_name, group_name)
),
team_results AS (
    SELECT
        home_team AS team_name,
        home_score AS goals_for,
        away_score AS goals_against,
        CASE
            WHEN home_score > away_score THEN 3
            WHEN home_score = away_score THEN 1
            ELSE 0
        END AS points,
        1 AS played,
        CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS losses
    FROM norm
    WHERE stage = 'group' AND status = 'finished'

    UNION ALL

    SELECT
        away_team AS team_name,
        away_score AS goals_for,
        home_score AS goals_against,
        CASE
            WHEN away_score > home_score THEN 3
            WHEN away_score = home_score THEN 1
            ELSE 0
        END AS points,
        1 AS played,
        CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS wins,
        CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS draws,
        CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS losses
    FROM norm
    WHERE stage = 'group' AND status = 'finished'
)
SELECT
    tg.group_name,
    tg.team_name,
    COALESCE(SUM(tr.played), 0) AS played,
    COALESCE(SUM(tr.goals_for), 0) AS goals_scored,
    COALESCE(SUM(tr.goals_against), 0) AS goals_against,
    COALESCE(SUM(tr.points), 0) AS points,
    COALESCE(SUM(tr.wins), 0) AS wins,
    COALESCE(SUM(tr.draws), 0) AS draws,
    COALESCE(SUM(tr.losses), 0) AS losses
FROM team_groups tg
LEFT JOIN team_results tr ON tr.team_name = tg.team_name
GROUP BY tg.group_name, tg.team_name
ORDER BY tg.group_name, points DESC, goals_scored DESC;
