import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SectionList,
    RefreshControl,
    StyleSheet,
    Animated,
    ActivityIndicator,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigation } from "@react-navigation/native"
import supabase from "../lib/supabase"
import usePlayerStore from "../store/usePlayerStore"
import TeamCrest from "../components/TeamCrest"
import { colors } from "../theme/colors"

interface Match {
    id: string
    external_id: number
    home_team: string
    away_team: string
    home_flag: string | null
    away_flag: string | null
    match_date: string
    stage: string
    home_score: number | null
    away_score: number | null
    home_penalties: number | null
    away_penalties: number | null
    status: string
    picks_closed: boolean
    venue: string | null
}

interface UserPick {
    id: string
    match_id: string
    predicted_home: number
    predicted_away: number
    points_earned: number | null
}

interface MatchSection {
    title: string
    data: Match[]
}

const LIVE_STATUSES = ["live", "scheduled"]
const FINISHED_STATUSES = ["finished"]

const STAGE_LABELS: Record<string, string> = {
    group: "Fase de grupos",
    round_of_32: "16avos de final",
    round_of_16: "Octavos de final",
    quarter: "Cuartos de final",
    semi: "Semifinal",
    third_place: "Tercer puesto",
    final: "Final",
}

const TEAM_GROUP_MAP: Record<string, string> = {
    Mexico: "A", "South Korea": "A", "Czech Republic": "A", "South Africa": "A",
    Canada: "B", Switzerland: "B", Qatar: "B", "Bosnia and Herzegovina": "B",
    Brazil: "C", Morocco: "C", Scotland: "C", Haiti: "C",
    "United States": "D", Australia: "D", Turkey: "D", Paraguay: "D",
    Germany: "E", Curaçao: "E", "Ivory Coast": "E", Ecuador: "E",
    Netherlands: "F", Japan: "F", Tunisia: "F", Sweden: "F",
    Belgium: "G", Egypt: "G", Iran: "G", "New Zealand": "G",
    Spain: "H", "Cape Verde": "H", "Cape Verde Islands": "H", "Saudi Arabia": "H", Uruguay: "H",
    France: "I", Senegal: "I", Norway: "I", Iraq: "I",
    Argentina: "J", Algeria: "J", Austria: "J", Jordan: "J",
    Portugal: "K", Uzbekistan: "K", Colombia: "K", "DR Congo": "K",
    England: "L", Croatia: "L", Ghana: "L", Panama: "L",
}

function getMatchLabel(match: Match): string {
    if (match.stage === "group") {
        const group = TEAM_GROUP_MAP[match.home_team] ?? TEAM_GROUP_MAP[match.away_team]
        return group ? `Grupo ${group}` : "Fase de grupos"
    }
    return STAGE_LABELS[match.stage] ?? match.stage
}

function LiveBadge() {
    const opacity = useRef(new Animated.Value(1)).current

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        )
        animation.start()
        return () => animation.stop()
    }, [])

    return (
        <View style={styles.liveBadge}>
            <Animated.View style={[styles.liveDot, { opacity }]} />
            <Text style={styles.liveBadgeText}>EN VIVO</Text>
        </View>
    )
}

function UpcomingBadge() {
    return (
        <View style={styles.upcomingBadge}>
            <Text style={styles.upcomingBadgeText}>PRÓXIMO</Text>
        </View>
    )
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
    })
}

function formatTime(dateStr: string): string {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return "—"
    const time = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    return time
}

function formatTimeShort(dateStr: string): string {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return "—"
    const time = date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    if (time === "00:00" || time === "0:00" || time === "24:00") return "—"
    return time
}

const COUNTDOWN_WINDOW_MS = 6 * 60 * 60 * 1000

function formatCountdown(ms: number): string {
    const totalMin = Math.max(1, Math.round(ms / 60_000))
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return h > 0 ? `⏱ en ${h}h ${String(m).padStart(2, "0")}m` : `⏱ en ${m} min`
}

// Mirrors the calculate-points edge function: exact compares the on-pitch
// final score (90' + extra time, excluding shootout goals — what home_score
// holds); winner uses penalties when the match had a shootout; a predicted
// draw counts as "winner" when the match ended level after 120' (even if
// penalties followed).
function getPickOutcome(m: Match, pick: UserPick): "exact" | "winner" | "miss" {
    if (m.home_score === null || m.away_score === null) return "miss"
    if (pick.predicted_home === m.home_score && pick.predicted_away === m.away_score) return "exact"
    const hasPens = m.home_penalties != null && m.away_penalties != null
    const homeWins = hasPens ? m.home_penalties! > m.away_penalties! : m.home_score > m.away_score
    const awayWins = hasPens ? m.away_penalties! > m.home_penalties! : m.away_score > m.home_score
    const draw = m.home_score === m.away_score
    if (
        (pick.predicted_home > pick.predicted_away && homeWins) ||
        (pick.predicted_home < pick.predicted_away && awayWins) ||
        (pick.predicted_home === pick.predicted_away && draw)
    ) {
        return "winner"
    }
    return "miss"
}

const OUTCOME_LABELS = {
    exact: "🎯 Exacto",
    winner: "✓ Ganador",
    miss: "✗ Fallaste",
} as const

export default function MatchListScreen() {
    const navigation = useNavigation<any>()
    const queryClient = useQueryClient()
    const player = usePlayerStore((s) => s.player)
    const [segment, setSegment] = useState<"live" | "finished">("live")
    const [refreshing, setRefreshing] = useState(false)
    const [searchText, setSearchText] = useState("")
    const [now, setNow] = useState(Date.now())

    // Keeps the "empieza en Xh Ym" countdowns ticking.
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(timer)
    }, [])

    const { data: matches, isLoading } = useQuery({
        queryKey: ["matches"],
        queryFn: async () => {
            const { data } = await supabase
                .from("matches")
                .select("*")
                .order("match_date", { ascending: true })
            return (data ?? []) as Match[]
        },
        // Safety net for when Realtime silently drops: poll the Supabase DB
        // (cheap, no football-data.org call) while a match is live or imminent.
        refetchInterval: (query) => {
            const data = query.state.data as Match[] | undefined
            if (!data) return false
            if (data.some((m) => m.status === "live")) return 30_000
            const TWO_HOURS = 2 * 60 * 60 * 1000
            const now = Date.now()
            const imminent = data.some(
                (m) => m.status === "scheduled" && new Date(m.match_date).getTime() - now <= TWO_HOURS
            )
            return imminent ? 60_000 : false
        },
    })

    // One-time sync on mount for freshness when opening the app. Live updates after
    // that come from the "matches-changes" Realtime subscription (AppNavigator) fed
    // by the server-side pg_cron job (every 2min) — no need to poll sync-matches here.
    useEffect(() => {
        supabase.functions.invoke("sync-matches", {}).then(() => {
            queryClient.invalidateQueries({ queryKey: ["matches"] })
            queryClient.invalidateQueries({ queryKey: ["currentMatch"] })
            queryClient.invalidateQueries({ queryKey: ["userPicks"] })
        }).catch(() => {})
    }, [])

    const { data: userPicks } = useQuery({
        queryKey: ["userPicks", player?.id],
        queryFn: async () => {
            if (!player?.id) return []
            const { data } = await supabase
                .from("picks")
                .select("id, match_id, predicted_home, predicted_away, points_earned")
                .eq("player_id", player.id)
            return (data ?? []) as UserPick[]
        },
        enabled: !!player?.id,
        staleTime: 30_000,
    })

    const picksMap = useMemo(() => {
        const map: Record<string, UserPick> = {}
        for (const pick of userPicks ?? []) {
            map[pick.match_id] = pick
        }
        return map
    }, [userPicks])

    const filteredMatches = useMemo(() => {
        if (!matches) return []
        if (segment === "live") {
            return matches.filter((m) => LIVE_STATUSES.includes(m.status))
        }
        return matches
            .filter((m) => FINISHED_STATUSES.includes(m.status))
            .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
    }, [matches, segment])

    const searchedMatches = useMemo(() => {
        const query = searchText.toLowerCase().trim()
        if (!query) return filteredMatches
        return filteredMatches.filter(
            (m) =>
                m.home_team.toLowerCase().includes(query) ||
                m.away_team.toLowerCase().includes(query)
        )
    }, [filteredMatches, searchText])

    const sections = useMemo(() => {
        const groups: Record<string, Match[]> = {}
        for (const match of searchedMatches) {
            const title = formatDate(match.match_date)
            if (!groups[title]) groups[title] = []
            groups[title].push(match)
        }
        return Object.entries(groups).map(([title, data]) => ({ title, data }))
    }, [searchedMatches])

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            await supabase.functions.invoke("sync-matches", {}).catch(() => {})
            await queryClient.invalidateQueries({ queryKey: ["matches"] })
            await queryClient.invalidateQueries({ queryKey: ["currentMatch"] })
            await queryClient.invalidateQueries({ queryKey: ["userPicks"] })
        } finally {
            setRefreshing(false)
        }
    }, [])

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        )
    }

    const hasSearch = searchText.trim().length > 0
    const showEmptySearch = hasSearch && searchedMatches.length === 0

    return (
        <View style={styles.container}>
            <View style={styles.segmentedContainer}>
                <TouchableOpacity
                    style={[styles.segmentButton, segment === "live" && styles.segmentActive]}
                    onPress={() => setSegment("live")}
                >
                    <Text style={[styles.segmentText, segment === "live" && styles.segmentTextActive]}>
                        En vivo & Próximos
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.segmentButton, segment === "finished" && styles.segmentActive]}
                    onPress={() => setSegment("finished")}
                >
                    <Text style={[styles.segmentText, segment === "finished" && styles.segmentTextActive]}>
                        Finalizados
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={16} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar país..."
                    placeholderTextColor={colors.textSecondary}
                    value={searchText}
                    onChangeText={setSearchText}
                />
                {hasSearch && (
                    <TouchableOpacity onPress={() => setSearchText("")} style={styles.searchClear}>
                        <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {showEmptySearch ? (
                <View style={styles.emptySearchContainer}>
                    <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.emptySearchText}>
                        No se encontraron partidos para "{searchText.trim()}"
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                    }
                    renderSectionHeader={({ section }) => (
                        <Text style={styles.sectionHeader}>{section.title}</Text>
                    )}
                    renderItem={({ item }) => {
                        const pick = picksMap[item.id]
                        const isLive = item.status === "live"
                        const isFinished = FINISHED_STATUSES.includes(item.status)
                        const startsIn = new Date(item.match_date).getTime() - now
                        const showCountdown =
                            item.status === "scheduled" && startsIn > 0 && startsIn <= COUNTDOWN_WINDOW_MS
                        const outcome = isFinished && pick ? getPickOutcome(item, pick) : null

                        return (
                            <TouchableOpacity
                                style={styles.card}
                                activeOpacity={isFinished || (!item.picks_closed && !isLive) ? 0.7 : 1}
                                onPress={
                                    isFinished
                                        ? () => navigation.navigate("MatchDetail", { match_id: item.id })
                                        : item.picks_closed || isLive
                                            ? undefined
                                            : () => navigation.navigate("Pick", { match_id: item.id })
                                }
                            >
                                <View style={styles.cardContent}>
                                    <View style={styles.teamContainer}>
                                        <TeamCrest crest={item.home_flag} name={item.home_team} />
                                        <Text style={styles.teamName} numberOfLines={1}>
                                            {item.home_team}
                                        </Text>
                                    </View>

                                    <View style={styles.centerCol}>
                                        {(isFinished || isLive) && item.home_score !== null ? (
                                            <>
                                                <Text style={styles.scoreText}>
                                                    {item.home_score} - {item.away_score}
                                                </Text>
                                                {item.home_penalties != null && item.away_penalties != null && (
                                                    <Text style={styles.penaltyLabel}>
                                                        ({item.home_penalties}-{item.away_penalties} pen.)
                                                    </Text>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Text style={styles.vsText}>VS</Text>
                                                <Text style={styles.timeText}>
                                                    {formatTimeShort(item.match_date)}
                                                </Text>
                                                {showCountdown && (
                                                    <Text style={styles.countdownText}>
                                                        {formatCountdown(startsIn)}
                                                    </Text>
                                                )}
                                            </>
                                        )}
                                    </View>

                                    <View style={styles.teamContainer}>
                                        <TeamCrest crest={item.away_flag} name={item.away_team} />
                                        <Text style={styles.teamName} numberOfLines={1}>
                                            {item.away_team}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.stageLabel}>{getMatchLabel(item)}</Text>

                                {item.venue && (
                                    <View style={styles.venueRow}>
                                        <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                                        <Text style={styles.venueText}>{item.venue}</Text>
                                    </View>
                                )}

                                <View style={styles.badgeRow}>
                                    {isLive && <LiveBadge />}
                                    {segment === "live" && !isLive && <UpcomingBadge />}
                                    {segment === "finished" && outcome && (
                                        <View style={[styles.outcomeBadge, styles[`${outcome}Badge`]]}>
                                            <Text style={[styles.outcomeBadgeText, styles[`${outcome}BadgeText`]]}>
                                                {OUTCOME_LABELS[outcome]}
                                            </Text>
                                        </View>
                                    )}
                                    {item.status === "scheduled" && !item.picks_closed && pick && (
                                        <View style={styles.savedBadge}>
                                            <Text style={styles.savedBadgeText}>Guardado</Text>
                                        </View>
                                    )}
                                    {item.status === "scheduled" && item.picks_closed && (
                                        <View style={styles.closedBadge}>
                                            <Text style={styles.closedBadgeText}>Cerrado</Text>
                                        </View>
                                    )}
                                </View>

                                {pick && (
                                    <Text style={styles.pickText}>
                                        Tu pronóstico: {pick.predicted_home} - {pick.predicted_away}
                                        {segment === "finished" && pick.points_earned !== null && (
                                            <Text style={styles.pointsEarned}>  ({pick.points_earned} pts)</Text>
                                        )}
                                    </Text>
                                )}

                                {segment === "finished" && isFinished && !pick && (
                                    <Text style={styles.noPickText}>Sin pronóstico — 0 pts</Text>
                                )}

                                {(item.picks_closed || isLive) && !isFinished && (
                                    <View style={styles.lockedOverlay} />
                                )}
                            </TouchableOpacity>
                        )
                    }}
                />
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    segmentedContainer: {
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 4,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: "center",
    },
    segmentActive: {
        backgroundColor: colors.accent,
    },
    segmentText: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textSecondary,
    },
    segmentTextActive: {
        color: "#0D0D0D",
        fontWeight: "bold",
    },
    listContent: {
        padding: 16,
        paddingTop: 20,
        paddingBottom: 32,
    },
    sectionHeader: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginTop: 28,
        marginBottom: 12,
        textTransform: "capitalize",
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        position: "relative",
        overflow: "hidden",
        shadowColor: colors.accent,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    cardContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    teamContainer: {
        flex: 1,
        alignItems: "center",
        gap: 8,
    },
    teamName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "bold",
        textAlign: "center",
    },
    centerCol: {
        alignItems: "center",
        paddingHorizontal: 12,
    },
    vsText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "bold",
    },
    timeText: {
        color: colors.textSecondary,
        fontSize: 11,
        marginTop: 4,
    },
    countdownText: {
        color: colors.accent,
        fontSize: 10,
        fontWeight: "700",
        marginTop: 3,
    },
    outcomeBadge: {
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    outcomeBadgeText: {
        fontSize: 12,
        fontWeight: "bold",
    },
    exactBadge: {
        backgroundColor: colors.accent,
    },
    exactBadgeText: {
        color: "#0D0D0D",
    },
    winnerBadge: {
        backgroundColor: "#1F2A0E",
    },
    winnerBadgeText: {
        color: "#4CAF50",
    },
    missBadge: {
        backgroundColor: "#2A1414",
    },
    missBadgeText: {
        color: "#FF6B60",
    },
    badgeRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
        gap: 8,
    },
    savedBadge: {
        backgroundColor: "#1F2A0E",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    savedBadgeText: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: "600",
    },
    closedBadge: {
        backgroundColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    closedBadgeText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "600",
    },
    liveBadge: {
        backgroundColor: colors.danger,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text,
    },
    liveBadgeText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "bold",
    },
    upcomingBadge: {
        backgroundColor: colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    upcomingBadgeText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "600",
    },
    scoreText: {
        color: colors.accent,
        fontSize: 18,
        fontWeight: "bold",
    },
    penaltyLabel: {
        color: colors.textSecondary,
        fontSize: 10,
        fontWeight: "600",
        marginTop: 1,
    },
    pickText: {
        color: colors.textSecondary,
        fontSize: 12,
        marginTop: 8,
        textAlign: "center",
    },
    pointsEarned: {
        color: colors.accent,
        fontWeight: "bold",
    },
    noPickText: {
        color: colors.danger,
        fontSize: 12,
        marginTop: 8,
        textAlign: "center",
    },
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.3)",
        borderRadius: 16,
    },
    stageLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 10,
    },
    venueRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 6,
        gap: 4,
    },
    venueText: {
        color: colors.textSecondary,
        fontSize: 10,
    },
    dateDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
    },
    searchContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        borderRadius: 10,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        height: 40,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        paddingVertical: 0,
    },
    searchClear: {
        marginLeft: 8,
        padding: 2,
    },
    emptySearchContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
        gap: 16,
    },
    emptySearchText: {
        color: colors.textSecondary,
        fontSize: 15,
        textAlign: "center",
    },
})
