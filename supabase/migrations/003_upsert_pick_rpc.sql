-- RPC function to upsert a pick with device-level authorization
-- Bypasses RLS (SECURITY DEFINER) and verifies the player belongs to the device
-- Also checks that the match has not closed for picks
CREATE OR REPLACE FUNCTION upsert_pick(
    p_player_id uuid,
    p_match_id uuid,
    p_predicted_home int,
    p_predicted_away int,
    p_device_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_picks_closed boolean;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND device_id = p_device_id) THEN
        RAISE EXCEPTION 'Unauthorized: este dispositivo no pertenece a este jugador';
    END IF;

    SELECT picks_closed INTO v_picks_closed FROM matches WHERE id = p_match_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'match_not_found' USING ERRCODE = 'P0001';
    END IF;

    IF v_picks_closed THEN
        RAISE EXCEPTION 'picks_closed' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO picks (player_id, match_id, predicted_home, predicted_away)
    VALUES (p_player_id, p_match_id, p_predicted_home, p_predicted_away)
    ON CONFLICT (player_id, match_id)
    DO UPDATE SET predicted_home = p_predicted_home, predicted_away = p_predicted_away;
END;
$$;
