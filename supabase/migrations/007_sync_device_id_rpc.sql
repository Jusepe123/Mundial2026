-- RPC function to sync device_id for a player
-- Bypasses RLS (SECURITY DEFINER) so the anon key can update their own device_id
CREATE OR REPLACE FUNCTION sync_device_id(
    p_player_id uuid,
    p_device_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE players SET device_id = p_device_id WHERE id = p_player_id;
END;
$$;
