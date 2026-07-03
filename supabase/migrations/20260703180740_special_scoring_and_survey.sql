-- finished_at: records the moment a match transitions to 'finished'. Needed
-- to anchor the "Selección sorpresa" voting window and the automatic
-- special-points trigger to the final match's actual finish time.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS finished_at timestamptz;

-- Enforce at most one 'final'-stage row so "the final match" is never
-- ambiguous — upsert_special_pick and both edge functions all assume this.
CREATE UNIQUE INDEX IF NOT EXISTS matches_one_final_idx
    ON matches ((true)) WHERE stage = 'final';

-- Server-side window check for the 'surprise' category: voting opens at the
-- final match's kickoff and closes 30 minutes after it finishes. Mirrors the
-- picks_closed validation already enforced for upsert_pick (regular picks) —
-- the client-side deadline check alone isn't trustworthy.
CREATE OR REPLACE FUNCTION upsert_special_pick(
    p_player_id uuid,
    p_category text,
    p_prediction text,
    p_device_id text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
    v_final RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND device_id = p_device_id) THEN
        RAISE EXCEPTION 'Unauthorized: este dispositivo no pertenece a este jugador';
    END IF;

    IF p_category = 'surprise' THEN
        SELECT match_date, status, finished_at INTO v_final
        FROM matches WHERE stage = 'final'
        ORDER BY match_date DESC
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'La votación de Selección Sorpresa aún no está abierta';
        END IF;
        IF v_final.match_date > now() THEN
            RAISE EXCEPTION 'La votación de Selección Sorpresa aún no está abierta';
        END IF;
        IF v_final.status = 'finished' AND v_final.finished_at IS NOT NULL
           AND now() > v_final.finished_at + interval '30 minutes' THEN
            RAISE EXCEPTION 'La votación de Selección Sorpresa ya cerró';
        END IF;
    END IF;

    INSERT INTO special_picks (player_id, category, prediction)
    VALUES (p_player_id, p_category, p_prediction)
    ON CONFLICT (player_id, category)
    DO UPDATE SET prediction = p_prediction;
END;
$$;
