/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Only sync-matches (calling with the service role key) is allowed to trigger
// this, same protection as calculate-points.
function isServiceRoleCaller(req: Request, serviceRoleKey: string): boolean {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    return token === serviceRoleKey;
}

function normalize(s: string): string {
    return s
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
}

// "top_scorer" predictions are free text ("Nombre/País"). Match the name part
// against the real scorer's name tolerating partial entries (e.g. "Messi"
// matching "Lionel Messi") and accent/case differences.
function matchesScorerName(prediction: string, scorerName: string): boolean {
    const namePart = prediction.split("/")[0] ?? prediction;
    const a = normalize(namePart);
    const b = normalize(scorerName);
    if (!a || !b) return false;
    return a === b || a.includes(b) || b.includes(a);
}

interface MatchOutcome {
    winner: string | null;
    loser: string | null;
}

function getOutcome(m: any): MatchOutcome {
    if (m.home_score === null || m.away_score === null) return { winner: null, loser: null };
    if (m.home_penalties != null && m.away_penalties != null) {
        return m.home_penalties > m.away_penalties
            ? { winner: m.home_team, loser: m.away_team }
            : { winner: m.away_team, loser: m.home_team };
    }
    if (m.home_score > m.away_score) return { winner: m.home_team, loser: m.away_team };
    if (m.away_score > m.home_score) return { winner: m.away_team, loser: m.home_team };
    return { winner: null, loser: null };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey' } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

    if (!SUPABASE_URL) throw new Error("SUPABASE_URL is not set.");
    if (!SERVICE_ROLE_KEY) throw new Error("SERVICE_ROLE_KEY is not set.");

    if (!isServiceRoleCaller(req, SERVICE_ROLE_KEY)) {
        return new Response(
            JSON.stringify({ error: "Forbidden: calculate-special-points solo puede ser invocada por sync-matches." }),
            { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    let processed = 0;
    const errors: string[] = [];

    try {
        // 1. The final match gates everything: no special scoring until 30
        // minutes after it's finished (matches the "Selección sorpresa"
        // voting window, even though that category isn't auto-scored here).
        const { data: finalMatch } = await supabase
            .from('matches')
            .select('home_team, away_team, home_score, away_score, home_penalties, away_penalties, status, finished_at')
            .eq('stage', 'final')
            .maybeSingle();

        if (!finalMatch || finalMatch.status !== 'finished' || !finalMatch.finished_at) {
            return new Response(
                JSON.stringify({ processed: 0, skipped: 'final_not_finished', errors: [] }),
                { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const closesAt = new Date(finalMatch.finished_at).getTime() + 30 * 60 * 1000;
        if (Date.now() < closesAt) {
            return new Response(
                JSON.stringify({ processed: 0, skipped: 'voting_window_open', errors: [] }),
                { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
        }

        // 2. Actual outcomes: champion/runner-up from the final, third/fourth
        // from the third-place match (if it's finished yet).
        const { data: thirdPlaceMatch } = await supabase
            .from('matches')
            .select('home_team, away_team, home_score, away_score, home_penalties, away_penalties, status')
            .eq('stage', 'third_place')
            .maybeSingle();

        const finalOutcome = getOutcome(finalMatch);
        const thirdOutcome = thirdPlaceMatch?.status === 'finished'
            ? getOutcome(thirdPlaceMatch)
            : { winner: null, loser: null };

        const actualByCategory: Record<string, string | null> = {
            first: finalOutcome.winner,
            second: finalOutcome.loser,
            third: thirdOutcome.winner,
            fourth: thirdOutcome.loser,
        };

        // 3. Actual top scorer(s) — ties share the points.
        const { data: scorers } = await supabase
            .from('scorers')
            .select('player_name, goals')
            .order('goals', { ascending: false });

        const topGoals = scorers && scorers.length > 0 ? scorers[0].goals : null;
        const topScorers = topGoals !== null ? (scorers ?? []).filter((s: any) => s.goals === topGoals) : [];

        // 4. Points per category (surprise excluded — stays manually graded).
        const { data: config } = await supabase
            .from('scoring_config')
            .select('stage, special_points')
            .in('stage', ['special_first', 'special_second', 'special_third', 'special_fourth', 'special_scorer']);

        const pointsByStage: Record<string, number> = {};
        for (const c of config ?? []) pointsByStage[c.stage] = c.special_points ?? 0;

        const categoryStage: Record<string, string> = {
            first: 'special_first',
            second: 'special_second',
            third: 'special_third',
            fourth: 'special_fourth',
            top_scorer: 'special_scorer',
        };

        // 5. Score every pick in the auto-graded categories.
        const { data: picks, error: picksError } = await supabase
            .from('special_picks')
            .select('id, player_id, category, prediction, points_earned')
            .in('category', ['first', 'second', 'third', 'fourth', 'top_scorer']);

        if (picksError) throw new Error(`Error fetching special_picks: ${picksError.message}`);

        const affectedPlayers = new Set<string>();

        for (const pick of picks ?? []) {
            let earned = 0;
            const points = pointsByStage[categoryStage[pick.category]] ?? 0;

            if (pick.category === 'top_scorer') {
                if (topScorers.some((s: any) => matchesScorerName(pick.prediction, s.player_name))) {
                    earned = points;
                }
            } else {
                const actual = actualByCategory[pick.category];
                if (actual && normalize(pick.prediction) === normalize(actual)) {
                    earned = points;
                }
            }

            // Only write when the value actually changes — this function is
            // invoked every minute after the final ends, so no-op writes
            // would fire a Realtime UPDATE to every client forever.
            if (pick.points_earned !== earned) {
                const { error: updateError } = await supabase
                    .from('special_picks')
                    .update({ points_earned: earned })
                    .eq('id', pick.id);

                if (updateError) {
                    errors.push(`Error updating special_pick ${pick.id}: ${updateError.message}`);
                    continue;
                }

                affectedPlayers.add(pick.player_id);
                processed++;
            }
        }

        // 6. Recalculate total_points only for players whose special points changed.
        for (const playerId of affectedPlayers) {
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
