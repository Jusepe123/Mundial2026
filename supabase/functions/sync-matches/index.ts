/// <reference lib="deno.ns" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface Match {
    id: string;
    external_id: number;
    home_team: string;
    away_team: string;
    home_flag: string | null;
    away_flag: string | null;
    match_date: string;
    stage: string;
    home_score: number | null;
    away_score: number | null;
    home_penalties: number | null;
    away_penalties: number | null;
    status: string;
    picks_closed: boolean;
}

Deno.serve(async (req) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey' } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
    const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY");

    if (!SUPABASE_URL) {
        throw new Error("SUPABASE_URL is not set.");
    }
    if (!SERVICE_ROLE_KEY) {
        throw new Error("SERVICE_ROLE_KEY is not set.");
    }
    if (!API_FOOTBALL_KEY) {
        throw new Error("API_FOOTBALL_KEY is not set.");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: {
            persistSession: false,
        },
    });

    let syncedMatchesCount = 0;
    let finishedTriggeredCount = 0;
    let syncedScorersCount = 0;
    let syncedShirtNumbers = 0;
    let totalGoals = 0;
    const errors: string[] = [];

    try {
        // 0. Fetch all existing match data in a single query for O(1) lookup
        const { data: existingMatches } = await supabase
            .from('matches')
            .select('external_id, status, home_score, away_score, home_penalties, away_penalties');

        const dbMatchMap = new Map<number, { status: string; home_score: number | null; away_score: number | null; home_penalties: number | null; away_penalties: number | null }>();
        if (existingMatches) {
            for (const m of existingMatches) {
                dbMatchMap.set(m.external_id, { status: m.status, home_score: m.home_score, away_score: m.away_score, home_penalties: m.home_penalties, away_penalties: m.away_penalties });
            }
        }

        // 1. Fetch data from football-data.org
        const footballDataResponse = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
            headers: {
                "X-Auth-Token": API_FOOTBALL_KEY,
            },
        });

        if (!footballDataResponse.ok) {
            throw new Error(`football-data.org fetch failed: ${footballDataResponse.statusText}`);
        }

        const data = await footballDataResponse.json();
        const allMatches = data.matches;

        // 1b. Filter to only process relevant matches (skip already-finished + far-future)
        const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

        const relevantMatches = allMatches.filter((match: any) => {
            const dbData = dbMatchMap.get(match.id);

            // Always process live matches
            if (match.status === 'IN_PLAY' || match.status === 'PAUSED' || match.status === 'LIVE') {
                return true;
            }

            // Process finished matches: include if score changed vs DB
            if (match.status === 'FINISHED') {
                if (!dbData) return true;
                if (dbData.status !== 'finished') return true;
                // Skip only if scores match exactly (penalties included)
                if (dbData.home_score === match.score.fullTime.home &&
                    dbData.away_score === match.score.fullTime.away &&
                    dbData.home_penalties === (match.score.penalties?.home ?? null) &&
                    dbData.away_penalties === (match.score.penalties?.away ?? null)) {
                    return false;
                }
                return true;
            }

            // Process scheduled/timed matches
            if (match.status === 'SCHEDULED' || match.status === 'TIMED') {
                // Always process if not yet in DB (seed missing matches)
                if (!dbData) return true;
                // Process if upcoming within 3 hours
                const matchDate = new Date(match.utcDate).getTime();
                const now = Date.now();
                return (matchDate - now) <= THREE_HOURS_MS;
            }

            return false;
        });

        for (const match of relevantMatches) {
            try {
                // Map stage
                let stage: string;
                switch (match.stage) {
                    case 'GROUP_STAGE':
                        stage = 'group';
                        break;
                    case 'LAST_32':
                        stage = 'round_of_32';
                        break;
                    case 'ROUND_OF_16':
                    case 'LAST_16':
                        stage = 'round_of_16';
                        break;
                    case 'QUARTER_FINALS':
                        stage = 'quarter';
                        break;
                    case 'SEMI_FINALS':
                        stage = 'semi';
                        break;
                    case 'THIRD_PLACE':
                        stage = 'third_place';
                        break;
                    case 'FINAL':
                        stage = 'final';
                        break;
                    default:
                        stage = 'group';
                        break;
                }

                // Map status
                let status: string;
                switch (match.status) {
                    case 'SCHEDULED':
                    case 'TIMED':
                        status = 'scheduled';
                        break;
                    case 'IN_PLAY':
                    case 'PAUSED':
                    case 'LIVE':
                        status = 'live';
                        break;
                    case 'FINISHED':
                        status = 'finished';
                        break;
                    default:
                        status = 'scheduled';
                        break;
                }

                // Determine picks_closed
                const matchDate = new Date(match.utcDate);
                const now = new Date();
                const picksClosed = matchDate <= now || status === 'live' || status === 'finished';

                const TEAM_ALIASES: Record<string, string> = {
                    "Czechia": "Czech Republic",
                    "Czech Republic": "Czech Republic",
                    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
                    "Curaçao": "Curaçao",
                    "Korea Republic": "South Korea",
                    "Côte d'Ivoire": "Ivory Coast",
                    "Turkiye": "Turkey",
                    "Cape Verde Islands": "Cape Verde",
                    "Congo DR": "DR Congo",
                    "United States": "United States",
                    "USA": "United States",
                };

                const rawHome = match.homeTeam.name ?? "Por definir";
                const rawAway = match.awayTeam.name ?? "Por definir";

                const newMatchData: Partial<Match> = {
                    external_id: match.id,
                    home_team: TEAM_ALIASES[rawHome] ?? rawHome,
                    away_team: TEAM_ALIASES[rawAway] ?? rawAway,
                    home_flag: match.homeTeam.crest ?? null,
                    away_flag: match.awayTeam.crest ?? null,
                    match_date: match.utcDate,
                    stage: stage,
                    home_score: match.score.fullTime.home,
                    away_score: match.score.fullTime.away,
                    home_penalties: match.score.penalties?.home ?? null,
                    away_penalties: match.score.penalties?.away ?? null,
                    status: status,
                    picks_closed: picksClosed,
                };

                // Lookup old data from map (O(1), no individual SELECT)
                const oldData = dbMatchMap.get(match.id);

                // 2. Upsert into Supabase
                const { data: upsertedMatch, error: upsertError } = await supabase
                    .from('matches')
                    .upsert(newMatchData, { onConflict: 'external_id' })
                    .select('id, status')
                    .single();

                if (upsertError) {
                    console.error(`Error upserting match ${match.id}:`, upsertError);
                    errors.push(`Error upserting match ${match.id}: ${upsertError.message}`);
                    continue;
                }
                
                syncedMatchesCount++;

                // 3. Trigger calculate-points if status changed to 'finished' or scores changed
                const newStatus = upsertedMatch?.status;
                const statusChanged = oldData?.status !== 'finished' && newStatus === 'finished';
                const scoreChanged = oldData?.status === 'finished' && newStatus === 'finished' && (
                    oldData.home_score !== match.score.fullTime.home ||
                    oldData.away_score !== match.score.fullTime.away ||
                    oldData.home_penalties !== (match.score.penalties?.home ?? null) ||
                    oldData.away_penalties !== (match.score.penalties?.away ?? null)
                );

                if (upsertedMatch && newStatus === 'finished' && (statusChanged || scoreChanged)) {
                    const calculatePointsUrl = `${SUPABASE_URL}/functions/v1/calculate-points`;
                    const calculatePointsResponse = await fetch(calculatePointsUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                        },
                        body: JSON.stringify({ match_id: upsertedMatch.id }),
                    });

                    if (!calculatePointsResponse.ok) {
                        const errorText = await calculatePointsResponse.text();
                        console.error(`Error triggering calculate-points for match ${upsertedMatch.id}:`, errorText);
                        errors.push(`Error triggering calculate-points for match ${upsertedMatch.id}: ${errorText}`);
                    } else {
                        finishedTriggeredCount++;
                    }
                }

            } catch (matchError: any) {
                console.error(`Error processing match ${match.id}:`, matchError);
                errors.push(`Error processing match ${match.id}: ${matchError.message}`);
            }
        }

    } catch (generalError: any) {
        console.error("General error in sync-matches function:", generalError);
        errors.push(`General error: ${generalError.message}`);
    }

    // 4. Sync top scorers from football-data.org
    try {
        const scorersResponse = await fetch("https://api.football-data.org/v4/competitions/WC/scorers", {
            headers: {
                "X-Auth-Token": API_FOOTBALL_KEY,
            },
        });

        if (scorersResponse.ok) {
            const scorersData = await scorersResponse.json();
            const scorers = scorersData.scorers ?? [];

            for (const scorer of scorers) {
                const playerId = scorer.player?.id;
                if (!playerId) continue;

                const playerName = scorer.player?.name ?? "Unknown";
                const nationality = scorer.player?.nationality ?? "";
                const teamName = scorer.team?.name ?? "";
                const goals = scorer.goals ?? 0;

                const { error: upsertError } = await supabase
                    .from('scorers')
                    .upsert({
                        external_player_id: playerId,
                        player_name: playerName,
                        nationality: nationality,
                        team_name: teamName,
                        goals: goals,
                        last_updated: new Date().toISOString(),
                    }, { onConflict: 'external_player_id' });

                if (upsertError) {
                    console.error(`Error upserting scorer ${playerId}:`, upsertError);
                    errors.push(`Error upserting scorer ${playerId}: ${upsertError.message}`);
                } else {
                    syncedScorersCount++;
                    totalGoals += goals;
                }
            }
        } else {
            console.error(`Scorers fetch failed: ${scorersResponse.statusText}`);
            errors.push(`Scorers fetch failed: ${scorersResponse.statusText}`);
        }
    } catch (scorerError: any) {
        console.error("Error syncing scorers:", scorerError);
        errors.push(`Error syncing scorers: ${scorerError.message}`);
    }

    // 5. Fetch shirt numbers for scorers that don't have one yet
    try {
        const { data: missingShirt } = await supabase
            .from("scorers")
            .select("external_player_id")
            .is("shirt_number", null)
            .limit(5)

        for (const s of missingShirt ?? []) {
            try {
                const personRes = await fetch(
                    `https://api.football-data.org/v4/persons/${s.external_player_id}`,
                    { headers: { "X-Auth-Token": API_FOOTBALL_KEY } }
                )
                if (!personRes.ok) continue
                const person = await personRes.json()
                if (typeof person.shirtNumber === "number") {
                    const { error: updateError } = await supabase
                        .from("scorers")
                        .update({ shirt_number: person.shirtNumber })
                        .eq("external_player_id", s.external_player_id)

                    if (!updateError) syncedShirtNumbers++
                }
            } catch (personError: any) {
                console.error(`Error fetching person ${s.external_player_id}:`, personError)
            }
        }
    } catch (shirtError: any) {
        console.error("Error syncing shirt numbers:", shirtError);
        errors.push(`Error syncing shirt numbers: ${shirtError.message}`);
    }

    // 6. Return JSON response
    return new Response(
        JSON.stringify({
            synced: syncedMatchesCount,
            finished_triggered: finishedTriggeredCount,
            synced_scorers: syncedScorersCount,
            synced_shirt_numbers: syncedShirtNumbers,
            errors: errors,
        }),
        {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            status: errors.length > 0 ? 500 : 200,
        }
    );
});
