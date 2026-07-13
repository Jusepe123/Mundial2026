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
    home_full_score: number | null;
    away_full_score: number | null;
    status: string;
    picks_closed: boolean;
    venue: string | null;
    finished_at: string | null;
}

interface BracketSlot {
    nextExtId: number;
    side: 'home' | 'away';
}

interface BracketSlotSemi {
    winNextExtId: number;
    winSide: 'home' | 'away';
    loseNextExtId: number;
    loseSide: 'home' | 'away';
}

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

const VENUE_MAP: Record<number, string> = {
    // Group A
    537327: "Estadio Ciudad de México",
    537328: "Estadio Guadalajara",
    537329: "Estadio Atlanta",
    537330: "Estadio Guadalajara",
    537331: "Estadio Ciudad de México",
    537332: "Estadio Monterrey",
    // Group B
    537333: "Estadio Toronto",
    537334: "Estadio Bahía de San Francisco",
    537335: "Estadio Los Ángeles",
    537336: "Estadio BC Place Vancouver",
    537337: "Estadio BC Place Vancouver",
    537338: "Estadio Seattle",
    // Group C
    537339: "Estadio Nueva York Nueva Jersey",
    537340: "Estadio Boston",
    537341: "Estadio Filadelfia",
    537342: "Estadio Boston",
    537343: "Estadio Miami",
    537344: "Estadio Atlanta",
    // Group D
    537345: "Estadio Los Ángeles",
    537346: "Estadio BC Place Vancouver",
    537347: "Estadio Bahía de San Francisco",
    537348: "Estadio Seattle",
    537349: "Estadio Los Ángeles",
    537350: "Estadio Bahía de San Francisco",
    // Group E
    537351: "Estadio Houston",
    537352: "Estadio Filadelfia",
    537353: "Estadio Toronto",
    537354: "Estadio Kansas City",
    537355: "Estadio Nueva York Nueva Jersey",
    537356: "Estadio Filadelfia",
    // Group F
    537357: "Estadio Dallas",
    537358: "Estadio Monterrey",
    537359: "Estadio Houston",
    537360: "Estadio Monterrey",
    537361: "Estadio Kansas City",
    537362: "Estadio Dallas",
    // Group G
    537363: "Estadio Seattle",
    537364: "Estadio Los Ángeles",
    537365: "Estadio Los Ángeles",
    537366: "Estadio BC Place Vancouver",
    537367: "Estadio BC Place Vancouver",
    537368: "Estadio Seattle",
    // Group H
    537369: "Estadio Atlanta",
    537370: "Estadio Miami",
    537371: "Estadio Atlanta",
    537372: "Estadio Miami",
    537373: "Estadio Guadalajara",
    537374: "Estadio Houston",
    // Group I
    537391: "Estadio Nueva York Nueva Jersey",
    537392: "Estadio Boston",
    537393: "Estadio Filadelfia",
    537394: "Estadio Nueva York Nueva Jersey",
    537395: "Estadio Boston",
    537396: "Estadio Toronto",
    // Group J
    537397: "Estadio Kansas City",
    537398: "Estadio Bahía de San Francisco",
    537399: "Estadio Dallas",
    537400: "Estadio Bahía de San Francisco",
    537401: "Estadio Dallas",
    537402: "Estadio Kansas City",
    // Group K
    537403: "Estadio Houston",
    537404: "Estadio Ciudad de México",
    537405: "Estadio Houston",
    537406: "Estadio Guadalajara",
    537407: "Estadio Miami",
    537408: "Estadio Atlanta",
    // Group L
    537409: "Estadio Dallas",
    537410: "Estadio Toronto",
    537411: "Estadio Boston",
    537412: "Estadio Toronto",
    537413: "Estadio Nueva York Nueva Jersey",
    537414: "Estadio Filadelfia",
    // R32 (Partidos 73-88)
    537415: "Estadio Boston",
    537416: "Estadio Nueva York Nueva Jersey",
    537417: "Estadio Los Ángeles",
    537418: "Estadio Monterrey",
    537419: "Estadio Toronto",
    537420: "Estadio Los Ángeles",
    537421: "Estadio Bahía de San Francisco",
    537422: "Estadio Seattle",
    537423: "Estadio Houston",
    537424: "Estadio Dallas",
    537425: "Estadio Ciudad de México",
    537426: "Estadio Atlanta",
    537427: "Estadio Miami",
    537428: "Estadio Dallas",
    537429: "Estadio BC Place Vancouver",
    537430: "Estadio Kansas City",
    // R16 (Partidos 89-96)
    537375: "Estadio Filadelfia",
    537376: "Estadio Houston",
    537377: "Estadio Nueva York Nueva Jersey",
    537378: "Estadio Ciudad de México",
    537379: "Estadio Dallas",
    537380: "Estadio Seattle",
    537381: "Estadio Atlanta",
    537382: "Estadio BC Place Vancouver",
    // QF (Partidos 97-100)
    537383: "Estadio Boston",
    537384: "Estadio Los Ángeles",
    537385: "Estadio Miami",
    537386: "Estadio Kansas City",
    // SF (Partidos 101-102)
    537387: "Estadio Dallas",
    537388: "Estadio Atlanta",
    // Third place (Partido 103)
    537389: "Estadio Miami",
    // Final (Partido 104)
    537390: "Estadio Nueva York Nueva Jersey",
};

const KNOCKOUT_BRACKET: Record<number, BracketSlot | BracketSlotSemi> = {
    // R32 → R16
    537417: { nextExtId: 537376, side: 'home' },
    537418: { nextExtId: 537376, side: 'away' },
    537415: { nextExtId: 537375, side: 'home' },
    537416: { nextExtId: 537375, side: 'away' },
    537423: { nextExtId: 537377, side: 'home' },
    537424: { nextExtId: 537377, side: 'away' },
    537425: { nextExtId: 537378, side: 'home' },
    537426: { nextExtId: 537378, side: 'away' },
    537419: { nextExtId: 537379, side: 'home' },
    537420: { nextExtId: 537379, side: 'away' },
    537421: { nextExtId: 537380, side: 'home' },
    537422: { nextExtId: 537380, side: 'away' },
    537427: { nextExtId: 537381, side: 'home' },
    537428: { nextExtId: 537381, side: 'away' },
    537429: { nextExtId: 537382, side: 'home' },
    537430: { nextExtId: 537382, side: 'away' },
    // R16 → QF
    537375: { nextExtId: 537383, side: 'home' },
    537376: { nextExtId: 537383, side: 'away' },
    537379: { nextExtId: 537384, side: 'home' },
    537380: { nextExtId: 537384, side: 'away' },
    537377: { nextExtId: 537385, side: 'home' },
    537378: { nextExtId: 537385, side: 'away' },
    537381: { nextExtId: 537386, side: 'home' },
    537382: { nextExtId: 537386, side: 'away' },
    // QF → SF
    537383: { nextExtId: 537387, side: 'home' },
    537384: { nextExtId: 537387, side: 'away' },
    537385: { nextExtId: 537388, side: 'home' },
    537386: { nextExtId: 537388, side: 'away' },
    // SF → Final & 3rd
    537387: { winNextExtId: 537390, winSide: 'home', loseNextExtId: 537389, loseSide: 'home' },
    537388: { winNextExtId: 537390, winSide: 'away', loseNextExtId: 537389, loseSide: 'away' },
};

interface MatchResult {
    winner: string | null;
    loser: string | null;
}

// Regulation (90') score. football-data.org exposes this directly as
// `score.regularTime` for any match that went past 90 minutes (extra time
// and/or penalties); that field is absent for regular matches. Only used
// as an ingredient for getPitchScores/getPenaltyScores below.
function getRegulationScores(match: any): { home: number | null; away: number | null } {
    const reg = match.score.regularTime;
    if (reg && reg.home !== null && reg.away !== null) {
        return { home: reg.home, away: reg.away };
    }
    return { home: match.score.fullTime.home, away: match.score.fullTime.away };
}

// On-pitch final score: goals scored during the 90 minutes PLUS the two
// 15-minute extra-time periods, EXCLUDING penalty-shootout goals. This is
// what the app displays and what picks are graded against (home_score/away_score).
// - Regular and EXTRA_TIME matches: fullTime already is the on-pitch total.
// - PENALTY_SHOOTOUT matches: fullTime includes the shootout goals (seen
//   2026-07-12, Germany vs Paraguay: regularTime 1-1, extraTime 0-0,
//   penalties 3-4, fullTime 4-5), so use regularTime + extraTime instead.
function getPitchScores(match: any): { home: number | null; away: number | null } {
    const full = match.score.fullTime;
    const penHome = match.score.penalties?.home ?? null;
    const penAway = match.score.penalties?.away ?? null;
    if (penHome === null || penAway === null) {
        return { home: full.home, away: full.away };
    }
    const reg = match.score.regularTime;
    if (reg && reg.home !== null && reg.away !== null) {
        const et = match.score.extraTime;
        return { home: reg.home + (et?.home ?? 0), away: reg.away + (et?.away ?? 0) };
    }
    // regularTime missing on a shootout match: strip the shootout goals.
    if (full.home !== null && full.away !== null) {
        return { home: full.home - penHome, away: full.away - penAway };
    }
    return { home: full.home, away: full.away };
}

// Penalty shootout score. football-data.org's `score.penalties` field can be
// internally inconsistent with fullTime/regularTime — seen 2026-07-03,
// Australia vs Egypt: API reported `penalties: {home:4, away:4}` (a tie,
// which a shootout can never end on) while fullTime {3,5}, regularTime {1,1}
// and extraTime {0,0} implied the real shootout score was 2-4. Derive from
// fullTime - regularTime - extraTime instead, which is self-consistent by
// construction.
function getPenaltyScores(match: any): { home: number | null; away: number | null } {
    const rawHome = match.score.penalties?.home ?? null;
    const rawAway = match.score.penalties?.away ?? null;
    if (rawHome === null || rawAway === null) return { home: null, away: null };

    const reg = match.score.regularTime;
    const et = match.score.extraTime;
    const fullHome = match.score.fullTime.home;
    const fullAway = match.score.fullTime.away;
    if (reg && reg.home !== null && reg.away !== null && fullHome !== null && fullAway !== null) {
        return {
            home: fullHome - reg.home - (et?.home ?? 0),
            away: fullAway - reg.away - (et?.away ?? 0),
        };
    }
    return { home: rawHome, away: rawAway };
}

// Winner/loser are decided by penalties when present, otherwise by fullTime score.
function getMatchResult(match: any): MatchResult {
    if (match.score.fullTime.home === null || match.score.fullTime.away === null) {
        return { winner: null, loser: null };
    }

    const alias = (name: string) => TEAM_ALIASES[name] ?? name;
    const homeName = alias(match.homeTeam.name);
    const awayName = alias(match.awayTeam.name);

    const pen = getPenaltyScores(match);
    if (pen.home != null && pen.away != null) {
        return pen.home > pen.away
            ? { winner: homeName, loser: awayName }
            : { winner: awayName, loser: homeName };
    }

    if (match.score.fullTime.home > match.score.fullTime.away) return { winner: homeName, loser: awayName };
    if (match.score.fullTime.away > match.score.fullTime.home) return { winner: awayName, loser: homeName };
    return { winner: null, loser: null };
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
    let advancedCount = 0;
    let syncedScorersCount = 0;
    let syncedShirtNumbers = 0;
    let totalGoals = 0;
    let scorersRelevant = false;
    const errors: string[] = [];
    // Sides (home/away) for which the API already names a real team. Once the
    // API names a slot, it is the source of truth: bracket propagation (4b)
    // must never overwrite it — a wrong KNOCKOUT_BRACKET entry would otherwise
    // win the write race against the upsert on every run (seen 2026-07-09,
    // France vs Morocco QF displayed with teams swapped).
    const apiNamedSides = new Map<number, { home: boolean; away: boolean }>();

    try {
        // 0. Fetch all existing match data in a single query for O(1) lookup
        const { data: existingMatches } = await supabase
            .from('matches')
            .select('external_id, status, home_score, away_score, home_penalties, away_penalties, home_team, away_team, home_full_score, away_full_score');

        const dbMatchMap = new Map<number, { status: string; home_score: number | null; away_score: number | null; home_penalties: number | null; away_penalties: number | null; home_team: string; away_team: string; home_full_score: number | null; away_full_score: number | null }>();
        if (existingMatches) {
            for (const m of existingMatches) {
                dbMatchMap.set(m.external_id, { status: m.status, home_score: m.home_score, away_score: m.away_score, home_penalties: m.home_penalties, away_penalties: m.away_penalties, home_team: m.home_team, away_team: m.away_team, home_full_score: m.home_full_score, away_full_score: m.away_full_score });
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

        for (const m of allMatches) {
            apiNamedSides.set(m.id, { home: !!m.homeTeam?.name, away: !!m.awayTeam?.name });
        }

        // Scorer goals only change while matches are being played or just ended.
        // Outside those windows, skip the scorers API calls (rate-limit headroom).
        const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
        scorersRelevant = allMatches.some((m: any) =>
            m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'LIVE' ||
            (m.status === 'FINISHED' && Date.now() - new Date(m.utcDate).getTime() < SIX_HOURS_MS)
        );

        // 1b. Filter to only process relevant matches (skip already-finished + far-future)
        const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

        const relevantMatches = allMatches.filter((match: any) => {
            const dbData = dbMatchMap.get(match.id);

            // Always process live matches
            if (match.status === 'IN_PLAY' || match.status === 'PAUSED' || match.status === 'LIVE') {
                return true;
            }

            // Process finished matches
            if (match.status === 'FINISHED') {
                if (!dbData) return true;
                if (dbData.status !== 'finished') return true;
                // Skip only if on-pitch scores, penalties, fullTime scores and team names all match.
                // (Knockout bracket propagation is guaranteed by the post-processing
                // step that reads finished matches from the DB, so unchanged finished
                // knockout matches don't need to be re-upserted every run.)
                const pitch = getPitchScores(match);
                const pen = getPenaltyScores(match);
                const isExtraTime = match.score.duration === 'EXTRA_TIME';
                const apiFullHome = isExtraTime ? match.score.fullTime.home : null;
                const apiFullAway = isExtraTime ? match.score.fullTime.away : null;
                const homeName = TEAM_ALIASES[match.homeTeam.name] ?? (match.homeTeam.name || "Por definir");
                const awayName = TEAM_ALIASES[match.awayTeam.name] ?? (match.awayTeam.name || "Por definir");
                if (dbData.home_score === pitch.home &&
                    dbData.away_score === pitch.away &&
                    dbData.home_penalties === pen.home &&
                    dbData.away_penalties === pen.away &&
                    dbData.home_team === homeName &&
                    dbData.away_team === awayName &&
                    dbData.home_full_score === apiFullHome &&
                    dbData.away_full_score === apiFullAway) {
                    return false;
                }
                return true;
            }

            // Process scheduled/timed matches
            if (match.status === 'SCHEDULED' || match.status === 'TIMED') {
                if (!dbData) return true;
                // Always process if DB still has placeholder team names
                if (dbData.home_team === "Por definir" || dbData.away_team === "Por definir") return true;
                // Process if API team names disagree with DB (e.g., bracket
                // propagation placed a team in the wrong slot) so the API
                // ordering is restored as soon as the API publishes names.
                if (match.homeTeam.name && (TEAM_ALIASES[match.homeTeam.name] ?? match.homeTeam.name) !== dbData.home_team) return true;
                if (match.awayTeam.name && (TEAM_ALIASES[match.awayTeam.name] ?? match.awayTeam.name) !== dbData.away_team) return true;
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

                // When the API hasn't named a slot yet, keep the team already
                // in the DB (bracket propagation may have filled it) instead
                // of clobbering it back to the placeholder.
                const oldData = dbMatchMap.get(match.id);
                const rawHome = match.homeTeam.name || oldData?.home_team || "Por definir";
                const rawAway = match.awayTeam.name || oldData?.away_team || "Por definir";

                const { home: homeScore, away: awayScore } = getPitchScores(match);
                const { home: rawHomePenalties, away: rawAwayPenalties } = getPenaltyScores(match);
                const isExtraTime = match.score.duration === 'EXTRA_TIME';

                // The "Selección sorpresa" voting window and the automatic
                // special-points trigger are both anchored to the final
                // match's finish time, so it must be recorded once, the
                // first time this match is observed as finished.
                const becomingFinished = oldData?.status !== 'finished' && status === 'finished';

                const newMatchData: Partial<Match> = {
                    external_id: match.id,
                    home_team: TEAM_ALIASES[rawHome] ?? rawHome,
                    away_team: TEAM_ALIASES[rawAway] ?? rawAway,
                    home_flag: match.homeTeam.crest ?? null,
                    away_flag: match.awayTeam.crest ?? null,
                    match_date: match.utcDate,
                    stage: stage,
                    home_score: homeScore,
                    away_score: awayScore,
                    home_penalties: rawHomePenalties,
                    away_penalties: rawAwayPenalties,
                    home_full_score: isExtraTime ? match.score.fullTime.home : null,
                    away_full_score: isExtraTime ? match.score.fullTime.away : null,
                    status: status,
                    picks_closed: picksClosed,
                    venue: match.venue ?? VENUE_MAP[match.id] ?? null,
                    ...(becomingFinished ? { finished_at: new Date().toISOString() } : {}),
                };

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
                const newFullHome = isExtraTime ? match.score.fullTime.home : null;
                const newFullAway = isExtraTime ? match.score.fullTime.away : null;
                const scoreChanged = oldData?.status === 'finished' && newStatus === 'finished' && (
                    oldData.home_score !== homeScore ||
                    oldData.away_score !== awayScore ||
                    oldData.home_penalties !== rawHomePenalties ||
                    oldData.away_penalties !== rawAwayPenalties ||
                    oldData.home_full_score !== newFullHome ||
                    oldData.away_full_score !== newFullAway
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

                // 4. Advance winner in knockout bracket (also inside per-match loop for newly finished)
                if (upsertedMatch && newStatus === 'finished' && stage !== 'group') {
                    const bracketSlot = KNOCKOUT_BRACKET[match.id];
                    if (bracketSlot) {
                        const isSemi = 'winNextExtId' in bracketSlot;
                        if (isSemi) {
                            const semi = bracketSlot as BracketSlotSemi;
                            const { winner: winTeam, loser: loseTeam } = getMatchResult(match);
                            if (winTeam && !apiNamedSides.get(semi.winNextExtId)?.[semi.winSide]) {
                                const teamCol = semi.winSide === 'home' ? 'home_team' : 'away_team';
                                const flagCol = semi.winSide === 'home' ? 'home_flag' : 'away_flag';
                                const { error: advanceError } = await supabase.from('matches').update({ [teamCol]: winTeam, [flagCol]: null }).eq('external_id', semi.winNextExtId);
                                if (advanceError) errors.push(`Error advancing winner to match ${semi.winNextExtId}: ${advanceError.message}`);
                            }
                            if (loseTeam && !apiNamedSides.get(semi.loseNextExtId)?.[semi.loseSide]) {
                                const teamCol = semi.loseSide === 'home' ? 'home_team' : 'away_team';
                                const flagCol = semi.loseSide === 'home' ? 'home_flag' : 'away_flag';
                                const { error: relegateError } = await supabase.from('matches').update({ [teamCol]: loseTeam, [flagCol]: null }).eq('external_id', semi.loseNextExtId);
                                if (relegateError) errors.push(`Error advancing loser to match ${semi.loseNextExtId}: ${relegateError.message}`);
                            }
                            advancedCount++;
                        } else {
                            const slot = bracketSlot as BracketSlot;
                            const { winner: winTeam } = getMatchResult(match);
                            if (winTeam && !apiNamedSides.get(slot.nextExtId)?.[slot.side]) {
                                const teamCol = slot.side === 'home' ? 'home_team' : 'away_team';
                                const flagCol = slot.side === 'home' ? 'home_flag' : 'away_flag';
                                const { error: advanceError } = await supabase.from('matches').update({ [teamCol]: winTeam, [flagCol]: null }).eq('external_id', slot.nextExtId);
                                if (advanceError) errors.push(`Error advancing winner to match ${slot.nextExtId}: ${advanceError.message}`);
                            }
                            advancedCount++;
                        }
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

    // 4b. Post-processing bracket propagation from DB data
    try {
        const bracketExtIds = Object.keys(KNOCKOUT_BRACKET).map(Number);
        const targetExtIds = new Set<number>();
        for (const slot of Object.values(KNOCKOUT_BRACKET)) {
            if ('winNextExtId' in slot) {
                targetExtIds.add(slot.winNextExtId);
                targetExtIds.add(slot.loseNextExtId);
            } else {
                targetExtIds.add(slot.nextExtId);
            }
        }

        const [{ data: bracketMatches }, { data: targetMatches }] = await Promise.all([
            supabase
                .from('matches')
                .select('external_id, home_team, away_team, home_score, away_score, home_penalties, away_penalties, status')
                .in('external_id', bracketExtIds)
                .eq('status', 'finished'),
            supabase
                .from('matches')
                .select('external_id, home_team, away_team')
                .in('external_id', [...targetExtIds]),
        ]);

        const targetMap = new Map<number, { home_team: string; away_team: string }>();
        for (const t of targetMatches ?? []) {
            targetMap.set(t.external_id, { home_team: t.home_team, away_team: t.away_team });
        }

        function getMatchResultFromDb(m: any): MatchResult {
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

        // Writes only when the slot doesn't already hold the team, so repeated
        // cron runs don't fire no-op UPDATEs (each one reaches every Realtime client).
        async function advanceTeam(extId: number, side: 'home' | 'away', team: string, label: string): Promise<boolean> {
            // Once the API names this side, the upsert path owns it; the
            // hardcoded bracket must not fight the API's ordering.
            if (apiNamedSides.get(extId)?.[side]) return false;
            const teamCol = side === 'home' ? 'home_team' : 'away_team';
            const current = targetMap.get(extId);
            if (current && current[teamCol] === team) return false;
            const flagCol = side === 'home' ? 'home_flag' : 'away_flag';
            const { error } = await supabase.from('matches').update({ [teamCol]: team, [flagCol]: null }).eq('external_id', extId);
            if (error) {
                errors.push(`Error advancing ${label} (post) to match ${extId}: ${error.message}`);
                return false;
            }
            if (current) current[teamCol] = team;
            return true;
        }

        if (bracketMatches) {
            for (const dbMatch of bracketMatches) {
                const bracketSlot = KNOCKOUT_BRACKET[dbMatch.external_id];
                if (!bracketSlot) continue;

                const isSemi = 'winNextExtId' in bracketSlot;
                if (isSemi) {
                    const semi = bracketSlot as BracketSlotSemi;
                    const { winner: winTeam, loser: loseTeam } = getMatchResultFromDb(dbMatch);
                    let advanced = false;
                    if (winTeam) advanced = (await advanceTeam(semi.winNextExtId, semi.winSide, winTeam, 'winner')) || advanced;
                    if (loseTeam) advanced = (await advanceTeam(semi.loseNextExtId, semi.loseSide, loseTeam, 'loser')) || advanced;
                    if (advanced) advancedCount++;
                } else {
                    const slot = bracketSlot as BracketSlot;
                    const { winner: winTeam } = getMatchResultFromDb(dbMatch);
                    if (winTeam && await advanceTeam(slot.nextExtId, slot.side, winTeam, 'winner')) advancedCount++;
                }
            }
        }
    } catch (bracketError: any) {
        console.error("Error in post-processing bracket propagation:", bracketError);
        errors.push(`Post-bracket propagation error: ${bracketError.message}`);
    }

    // 4c. Trigger calculate-special-points once the final match's 30-minute
    // "Selección sorpresa" grace period has elapsed. Safe to call every run:
    // the function itself checks the window and no-ops (200) if it's not
    // time yet, and only writes rows whose points actually changed.
    let specialPointsProcessed = 0;
    try {
        const { data: finalMatch } = await supabase
            .from('matches')
            .select('status, finished_at')
            .eq('stage', 'final')
            .maybeSingle();

        if (finalMatch?.status === 'finished' && finalMatch.finished_at) {
            const closesAt = new Date(finalMatch.finished_at).getTime() + 30 * 60 * 1000;
            if (Date.now() >= closesAt) {
                const specialPointsUrl = `${SUPABASE_URL}/functions/v1/calculate-special-points`;
                const specialPointsResponse = await fetch(specialPointsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                    },
                });

                if (!specialPointsResponse.ok) {
                    const errorText = await specialPointsResponse.text();
                    console.error(`Error triggering calculate-special-points:`, errorText);
                    errors.push(`Error triggering calculate-special-points: ${errorText}`);
                } else {
                    const result = await specialPointsResponse.json();
                    specialPointsProcessed = result.processed ?? 0;
                }
            }
        }
    } catch (specialError: any) {
        console.error("Error triggering calculate-special-points:", specialError);
        errors.push(`Error triggering calculate-special-points: ${specialError.message}`);
    }

    // 5. Sync top scorers from football-data.org (only around match windows)
    if (scorersRelevant) try {
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

    // 5b. Fetch shirt numbers for scorers that don't have one yet
    if (scorersRelevant) try {
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
            advanced: advancedCount,
            special_points_processed: specialPointsProcessed,
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
