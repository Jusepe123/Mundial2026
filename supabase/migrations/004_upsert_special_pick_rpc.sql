CREATE OR REPLACE FUNCTION upsert_special_pick(
    p_player_id uuid,
    p_category text,
    p_prediction text,
    p_device_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND device_id = p_device_id) THEN
        RAISE EXCEPTION 'Unauthorized: este dispositivo no pertenece a este jugador';
    END IF;

    INSERT INTO special_picks (player_id, category, prediction)
    VALUES (p_player_id, p_category, p_prediction)
    ON CONFLICT (player_id, category)
    DO UPDATE SET prediction = p_prediction;
END;
$$;
