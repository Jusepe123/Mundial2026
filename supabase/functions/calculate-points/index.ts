/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Only sync-matches (calling with the service role key) is allowed to trigger
// point recalculation. Without this check, any anon-key holder could force
// recalculation for an arbitrary match_id.
function isServiceRoleCaller(req: Request, serviceRoleKey: string): boolean {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    return token === serviceRoleKey;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey' } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

    if (!SUPABASE_URL) {
        throw new Error("SUPABASE_URL is not set.");
    }
    if (!SERVICE_ROLE_KEY) {
        throw new Error("SERVICE_ROLE_KEY is not set.");
    }

    if (!isServiceRoleCaller(req, SERVICE_ROLE_KEY)) {
        return new Response(
            JSON.stringify({ error: "Forbidden: calculate-points solo puede ser invocada por sync-matches." }),
            { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    let processed = 0;
    const errors: string[] = [];

    try {
        const { match_id } = await req.json();

        if (!match_id) {
            throw new Error("match_id is required.");
        }

        // 1. Fetch the match
        const { data: match, error: matchError } = await supabase
            .from('matches')
            .select('home_score, away_score, home_penalties, away_penalties, stage, home_full_score, away_full_score')
            .eq('id', match_id)
            .single();

        if (matchError || !match) {
            throw new Error(`Match not found: ${matchError?.message ?? "unknown error"}`);
        }

        if (match.home_score === null || match.away_score === null) {
            throw new Error("Match home_score or away_score is null.");
        }

        // home_score/away_score hold the on-pitch final score: 90 minutes plus
        // extra time (15+15), excluding penalty-shootout goals (see sync-matches
        // getPitchScores). Determine the actual winner:
        // 1. If penalties exist (both non-null), winner is who won the shootout.
        // 2. If fullTime scores exist (extra time), use them for winner/draw
        //    (equal to home_score/away_score for those matches).
        // 3. Otherwise, winner is determined by the on-pitch score.
        const decidedByPenalties = match.home_penalties !== null && match.away_penalties !== null;
        const hasFullTime = match.home_full_score !== null && match.away_full_score !== null;
        const actualHomeWins = decidedByPenalties
            ? (match.home_penalties! > match.away_penalties!)
            : hasFullTime
                ? (match.home_full_score! > match.away_full_score!)
                : (match.home_score > match.away_score);
        const actualAwayWins = decidedByPenalties
            ? (match.away_penalties! > match.home_penalties!)
            : hasFullTime
                ? (match.away_full_score! > match.home_full_score!)
                : (match.away_score > match.home_score);
        // actualDraw: for extra time (fullTime exists), use fullTime result.
        // For penalties and regular matches, use the on-pitch score (penalty
        // matches ended level after 120 minutes, so draw predictions are correct).
        const actualDraw = hasFullTime
            ? match.home_full_score === match.away_full_score
            : match.home_score === match.away_score;

        // 2. Fetch scoring config for this stage
        const { data: config, error: configError } = await supabase
            .from('scoring_config')
            .select('exact_points, winner_points, participation_points')
            .eq('stage', match.stage)
            .single();

        if (configError || !config) {
            throw new Error(`Scoring config not found for stage ${match.stage}: ${configError?.message ?? "unknown error"}`);
        }

        const { exact_points, winner_points, participation_points } = config;

        // 3. Fetch all picks for this match
        const { data: picks, error: picksError } = await supabase
            .from('picks')
            .select('id, player_id, predicted_home, predicted_away')
            .eq('match_id', match_id);

        if (picksError) {
            throw new Error(`Error fetching picks: ${picksError.message}`);
        }

        if (!picks || picks.length === 0) {
            return new Response(
                JSON.stringify({ processed: 0, errors: [] }),
                { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const playerIds = new Set<string>();

        for (const pick of picks) {
            try {
                let points_earned: number;

                // 4. Calculate points
                // Exact match compares against the on-pitch final score
                // (90' + extra time, excluding shootout goals)
                if (pick.predicted_home === match.home_score && pick.predicted_away === match.away_score) {
                    points_earned = exact_points;
                } else if (
                    (pick.predicted_home > pick.predicted_away && actualHomeWins) ||
                    (pick.predicted_home < pick.predicted_away && actualAwayWins) ||
                    (pick.predicted_home === pick.predicted_away && actualDraw)
                ) {
                    points_earned = winner_points;
                } else {
                    points_earned = participation_points;
                }

                // 5. Update the pick
                const { error: updateError } = await supabase
                    .from('picks')
                    .update({ points_earned })
                    .eq('id', pick.id);

                if (updateError) {
                    errors.push(`Error updating pick ${pick.id}: ${updateError.message}`);
                    continue;
                }

                playerIds.add(pick.player_id);
                processed++;

            } catch (pickError: any) {
                errors.push(`Error processing pick ${pick.id}: ${pickError.message}`);
            }
        }

        // 6. Recalculate total_points for each affected player
        for (const playerId of playerIds) {
            try {
                const [picksResult, specialsResult] = await Promise.all([
                    supabase
                        .from('picks')
                        .select('points_earned')
                        .eq('player_id', playerId)
                        .not('points_earned', 'is', null),
                    supabase
                        .from('special_picks')
                        .select('points_earned')
                        .eq('player_id', playerId)
                        .not('points_earned', 'is', null),
                ]);

                if (picksResult.error) {
                    errors.push(`Error fetching picks for player ${playerId}: ${picksResult.error.message}`);
                    continue;
                }
                if (specialsResult.error) {
                    errors.push(`Error fetching special_picks for player ${playerId}: ${specialsResult.error.message}`);
                    continue;
                }

                const picksSum = (picksResult.data ?? []).reduce((acc, p) => acc + (p.points_earned ?? 0), 0);
                const specialsSum = (specialsResult.data ?? []).reduce((acc, s) => acc + (s.points_earned ?? 0), 0);
                const total = picksSum + specialsSum;

                const { error: updatePlayerError } = await supabase
                    .from('players')
                    .update({ total_points: total })
                    .eq('id', playerId);

                if (updatePlayerError) {
                    errors.push(`Error updating player ${playerId} total_points: ${updatePlayerError.message}`);
                }

            } catch (playerError: any) {
                errors.push(`Error recalculating player ${playerId}: ${playerError.message}`);
            }
        }

    } catch (generalError: any) {
        errors.push(`General error: ${generalError.message}`);
    }

    return new Response(
        JSON.stringify({ processed, errors }),
        {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            status: errors.length > 0 ? 500 : 200,
        }
    );
});
