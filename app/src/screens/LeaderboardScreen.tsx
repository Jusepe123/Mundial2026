import { useState, useEffect, useMemo, useCallback } from "react"
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    StyleSheet,
    ActivityIndicator,
    Modal,
    Dimensions,
} from "react-native"
import Svg, { Circle, G } from "react-native-svg"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import usePlayerStore from "../store/usePlayerStore"
import TeamCrest from "../components/TeamCrest"
import MatchPicksTable from "../components/MatchPicksTable"
import SpecialPicksTable from "../components/SpecialPicksTable"
import { colors } from "../theme/colors"

const { width: SCREEN_WIDTH } = Dimensions.get("window")

interface LeaderboardEntry {
    id: string
    username: string
    total_points: number
    position: number
}

interface LastPick {
    match_id: string
    home_team: string
    away_team: string
    home_score: number | null
    away_score: number | null
    predicted_home: number
    predicted_away: number
    points_earned: number | null
    match_date: string
}

interface PlayerStats {
    total: number
    correctos: number
    exactos: number
    fallos: number
    totalEspeciales: number
    especialesAcertados: number
    lastPick: LastPick | null
}

interface Match {
    id: string
    home_team: string
    away_team: string
    home_flag: string | null
    away_flag: string | null
    home_score: number | null
    away_score: number | null
    home_penalties: number | null
    away_penalties: number | null
    status: string
    stage: string
    match_date: string
    venue: string | null
}

function PositionBadge({ position }: { position: number }) {
    if (position === 1) return <Text style={styles.medal}>🥇</Text>
    if (position === 2) return <Text style={styles.medal}>🥈</Text>
    if (position === 3) return <Text style={styles.medal}>🥉</Text>
    return <Text style={styles.positionNumber}>{position}</Text>
}

function DonutChart({ correct, total, size = 90 }: { correct: number; total: number; size?: number }) {
    const strokeWidth = 14
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const percent = total > 0 ? correct / total : 0
    const filledLength = circumference * percent
    const emptyLength = circumference * (1 - percent)

    return (
        <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
            <Svg width={size} height={size}>
                <G rotation="-90" originX={size / 2} originY={size / 2}>
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#F44336"
                        strokeWidth={strokeWidth}
                        fill="none"
                    />
                    {percent > 0 && (
                        <Circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            stroke="#4CAF50"
                            strokeWidth={strokeWidth}
                            fill="none"
                            strokeDasharray={`${filledLength} ${emptyLength}`}
                        />
                    )}
                </G>
            </Svg>
            <View style={styles.donutCenter}>
                <Text style={styles.donutPercent}>
                    {total > 0 ? Math.round(percent * 100) : 0}%
                </Text>
            </View>
        </View>
    )
}

function PodiumCard({
    entry,
    place,
    onPress,
}: {
    entry: LeaderboardEntry | undefined
    place: 1 | 2 | 3
    onPress: (id: string) => void
}) {
    if (!entry) return <View style={[styles.podiumCard, styles.podiumCardEmpty]} />

    const isCenter = place === 1

    return (
        <TouchableOpacity
            style={[
                styles.podiumCard,
                isCenter ? styles.podiumCardCenter : styles.podiumCardSide,
            ]}
            onPress={() => onPress(entry.id)}
            activeOpacity={0.7}
        >
            <Text style={[styles.podiumMedal, isCenter && styles.podiumMedalCenter]}>
                {place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"}
            </Text>
            <Text
                style={[styles.podiumName, isCenter && styles.podiumNameCenter]}
                numberOfLines={1}
            >
                {entry.username}
            </Text>
            <Text style={[styles.podiumPoints, isCenter && styles.podiumPointsCenter]}>
                {entry.total_points} pts
            </Text>
        </TouchableOpacity>
    )
}

function StatsView({ stats, label }: { stats: PlayerStats; label: string }) {
    const accuracy = stats.total > 0 ? Math.round((stats.correctos / stats.total) * 100) : 0

    return (
        <View style={styles.statsDetail}>
            <Text style={styles.statsName}>{label}</Text>
            <View style={styles.statsRow}>
                <DonutChart correct={stats.correctos} total={stats.total} />
                <View style={styles.statsList}>
                    <StatRow
                        label="Pronósticos"
                        value={`${stats.correctos}/${stats.total}`}
                        sub={stats.total > 0 ? `${accuracy}%` : undefined}
                    />
                    <StatRow label="Exactos" value={`${stats.exactos}/${stats.total}`} />
                    <StatRow
                        label="Especiales"
                        value={`${stats.especialesAcertados}/${stats.totalEspeciales}`}
                    />
                </View>
            </View>
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#4CAF50" }]} />
                    <Text style={styles.legendText}>Acertados {stats.correctos}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: "#F44336" }]} />
                    <Text style={styles.legendText}>Fallados {stats.fallos}</Text>
                </View>
            </View>

            <View style={styles.lastMatchSection}>
                <Text style={styles.lastMatchTitle}>Último partido finalizado</Text>
                {stats.lastPick ? (
                    <View style={styles.lastMatchCard}>
                        <View style={styles.lastMatchTeams}>
                            <Text style={styles.lastMatchTeam} numberOfLines={1}>
                                {stats.lastPick.home_team}
                            </Text>
                            <Text style={styles.lastMatchVS}>vs</Text>
                            <Text style={styles.lastMatchTeam} numberOfLines={1}>
                                {stats.lastPick.away_team}
                            </Text>
                        </View>
                        <View style={styles.lastMatchRow}>
                            <View style={styles.lastMatchCol}>
                                <Text style={styles.lastMatchLabel}>Pronóstico</Text>
                                <Text style={styles.lastMatchValue}>
                                    {stats.lastPick.predicted_home} - {stats.lastPick.predicted_away}
                                </Text>
                            </View>
                            <View style={styles.lastMatchCol}>
                                <Text style={styles.lastMatchLabel}>Resultado</Text>
                                <Text style={styles.lastMatchValue}>
                                    {stats.lastPick.home_score} - {stats.lastPick.away_score}
                                </Text>
                            </View>
                            <View style={styles.lastMatchCol}>
                                <Text style={styles.lastMatchLabel}>Puntos</Text>
                                <Text style={[styles.lastMatchValue, { color: colors.accent }]}>
                                    {stats.lastPick.points_earned ?? 0}
                                </Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <Text style={styles.noLastMatchText}>Sin pronóstico en este partido</Text>
                )}
            </View>
        </View>
    )
}

function StatRow({
    label,
    value,
    sub,
}: {
    label: string
    value: string
    sub?: string
}) {
    return (
        <View style={styles.statRow}>
            <Text style={styles.statLabel}>{label}</Text>
            <View style={styles.statValueRow}>
                <Text style={styles.statValue}>{value}</Text>
                {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
            </View>
        </View>
    )
}

async function fetchPlayerStats(playerId: string): Promise<PlayerStats> {
    const { data: picks } = await supabase
        .from("picks")
        .select("id, predicted_home, predicted_away, points_earned, match:match_id!inner(id, home_score, away_score, status, home_team, away_team, match_date)")
        .eq("player_id", playerId)

    // "surprise" is excluded: it's a no-points easter egg, counting it would
    // inflate the "Especiales" denominator with a category nobody can hit.
    const { data: specials } = await supabase
        .from("special_picks")
        .select("points_earned")
        .eq("player_id", playerId)
        .neq("category", "surprise")

    const allPicks = (picks ?? []) as any[]
    const finishedPicks = allPicks
        .filter((p) => p.match?.status === "finished")
        .sort((a, b) => new Date(b.match?.match_date ?? 0).getTime() - new Date(a.match?.match_date ?? 0).getTime())
    const total = finishedPicks.length

    let exactos = 0
    let correctos = 0
    for (const p of finishedPicks) {
        const m = p.match
        if (!m || m.home_score == null || m.away_score == null) continue
        const exact = p.predicted_home === m.home_score && p.predicted_away === m.away_score
        if (exact) {
            exactos++
            correctos++
            continue
        }
        const winnerCorrect =
            (m.home_score > m.away_score && p.predicted_home > p.predicted_away) ||
            (m.away_score > m.home_score && p.predicted_away > p.predicted_home) ||
            (m.home_score === m.away_score && p.predicted_home === p.predicted_away)
        if (winnerCorrect) correctos++
    }
    const fallos = total - correctos

    const lastPickData = finishedPicks.length > 0 ? finishedPicks[0] : null
    let lastPick: LastPick | null = null
    if (lastPickData) {
        const m = lastPickData.match
        lastPick = {
            match_id: m?.id ?? "",
            home_team: m?.home_team ?? "",
            away_team: m?.away_team ?? "",
            home_score: m?.home_score ?? null,
            away_score: m?.away_score ?? null,
            predicted_home: lastPickData.predicted_home,
            predicted_away: lastPickData.predicted_away,
            points_earned: lastPickData.points_earned,
            match_date: m?.match_date ?? "",
        }
    }

    const totalEspeciales = specials?.length ?? 0
    const especialesAcertados = specials?.filter((s: any) => s.points_earned > 0).length ?? 0

    return { total, correctos, exactos, fallos, totalEspeciales, especialesAcertados, lastPick }
}

export default function LeaderboardScreen() {
    const queryClient = useQueryClient()
    const player = usePlayerStore((s) => s.player)
    const updatePoints = usePlayerStore((s) => s.updatePoints)

    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
    const [modalStats, setModalStats] = useState<PlayerStats | null>(null)
    const [modalUsername, setModalUsername] = useState("")
    const [modalPosition, setModalPosition] = useState(0)
    const [modalPoints, setModalPoints] = useState(0)
    const [modalLoading, setModalLoading] = useState(false)
    const [ownStats, setOwnStats] = useState<PlayerStats | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(id)
    }, [])

    const { data: leaderboard, isLoading } = useQuery({
        queryKey: ["leaderboard"],
        queryFn: async () => {
            const { data } = await supabase
                .from("leaderboard")
                .select("*")
                .order("total_points", { ascending: false })
            return (data ?? []) as LeaderboardEntry[]
        },
        refetchInterval: 15_000,
        staleTime: 10_000,
    })

    useEffect(() => {
        if (!leaderboard || !player) return
        const myEntry = leaderboard.find((e) => e.id === player.id)
        if (myEntry && myEntry.total_points !== player.total_points) {
            updatePoints(myEntry.total_points)
        }
    }, [leaderboard])

    const { data: matchStats } = useQuery({
        queryKey: ["matchStats"],
        queryFn: async () => {
            const { data: statuses } = await supabase
                .from("matches")
                .select("status")

            const matches = statuses ?? []
            const total = matches.length
            const finished = matches.filter((m) => m.status === "finished").length
            const pending = total - finished

            return { total, finished, pending }
        },
        staleTime: 30_000,
    })

    const { data: finalMatch } = useQuery({
        queryKey: ["finalMatchWindow"],
        queryFn: async () => {
            const { data } = await supabase
                .from("matches")
                .select("status, finished_at")
                .eq("stage", "final")
                .maybeSingle()
            return data as { status: string; finished_at: string | null } | null
        },
        staleTime: 30_000,
        refetchInterval: 60_000,
    })

    const { data: currentMatches } = useQuery({
        queryKey: ["currentMatch"],
        queryFn: async () => {
            const { data: live } = await supabase
                .from("matches")
                .select("*")
                .eq("status", "live")
                .order("match_date", { ascending: true })
            if (live && live.length > 0) return live as Match[]

            const { data: upcoming } = await supabase
                .from("matches")
                .select("status, match_date")
                .neq("status", "finished")
                .order("match_date", { ascending: true })
                .limit(1)

            const next = upcoming && upcoming.length > 0 ? upcoming[0] : null

            if (next) {
                if (next.status === "scheduled") {
                    const now = new Date()
                    const nextDate = new Date(next.match_date)
                    if (nextDate > now) {
                        const { data: lastKickoff } = await supabase
                            .from("matches")
                            .select("match_date")
                            .eq("status", "finished")
                            .order("match_date", { ascending: false })
                            .limit(1)
                            .single()

                        if (!lastKickoff) return null

                        const { data: batch } = await supabase
                            .from("matches")
                            .select("*")
                            .eq("status", "finished")
                            .eq("match_date", lastKickoff.match_date)

                        if (batch && batch.length > 0) return batch as Match[]
                    }
                }
                return null
            }

            return null
        },
        staleTime: 15_000,
    })

    const currentMatchIds = useMemo(() => {
        return currentMatches?.map((m) => m.id) ?? []
    }, [currentMatches])

    const { data: currentPicksMap } = useQuery({
        queryKey: ["currentPicks", currentMatchIds],
        queryFn: async () => {
            if (currentMatchIds.length === 0) return {}
            const { data } = await supabase
                .from("picks")
                .select("player_id, match_id, predicted_home, predicted_away, points_earned")
                .in("match_id", currentMatchIds)

            const map: Record<string, any[]> = {}
            for (const pick of data ?? []) {
                if (!map[pick.match_id]) map[pick.match_id] = []
                map[pick.match_id].push(pick)
            }
            return map
        },
        enabled: currentMatchIds.length > 0,
        staleTime: 15_000,
    })

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            await queryClient.invalidateQueries({ queryKey: ["leaderboard"] })
            await queryClient.invalidateQueries({ queryKey: ["currentMatch"] })
            await queryClient.invalidateQueries({ queryKey: ["matchStats"] })
            await queryClient.invalidateQueries({ queryKey: ["currentPicks"] })
            await queryClient.invalidateQueries({ queryKey: ["finalMatchWindow"] })
            await queryClient.invalidateQueries({ queryKey: ["allSpecialPicks"] })
            if (player?.id) {
                const stats = await fetchPlayerStats(player.id)
                setOwnStats(stats)
            }
        } finally {
            setRefreshing(false)
        }
    }, [player?.id])

    const isTournamentOver = matchStats?.pending === 0 && matchStats?.total > 0

    // Special points (podium + top scorer) only land 30 minutes after the
    // final match ends — that's also the "Selección sorpresa" voting
    // deadline. Don't reveal the final podium before then, or it'd be
    // missing points and could flip once they're added.
    const specialScoringDone = useMemo(() => {
        if (!finalMatch || finalMatch.status !== "finished" || !finalMatch.finished_at) return false
        return now >= new Date(finalMatch.finished_at).getTime() + 30 * 60 * 1000
    }, [finalMatch, now])

    const showFinalPodium = isTournamentOver && specialScoringDone

    const podium = useMemo(() => {
        if (!leaderboard || leaderboard.length === 0) return null
        return {
            first: leaderboard[0],
            second: leaderboard[1],
            third: leaderboard[2],
        }
    }, [leaderboard])

    const currentPlayerEntry = useMemo(() => {
        if (!leaderboard || !player) return null
        return leaderboard.find((e) => e.id === player.id) ?? null
    }, [leaderboard, player])

    useEffect(() => {
        const channel = supabase
            .channel("leaderboard-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "players" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["leaderboard"] })
                    queryClient.invalidateQueries({ queryKey: ["currentMatch"] })
                    queryClient.invalidateQueries({ queryKey: ["allSpecialPicks"] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    useEffect(() => {
        if (!player?.id) return
        fetchPlayerStats(player.id).then(setOwnStats)
    }, [player?.id])

    const openModal = useCallback(
        async (targetPlayerId: string) => {
            setSelectedPlayerId(targetPlayerId)
            setModalLoading(true)
            setModalStats(null)

            const entry = leaderboard?.find((e) => e.id === targetPlayerId)
            if (entry) {
                setModalUsername(entry.username)
                setModalPosition(entry.position)
                setModalPoints(entry.total_points)
            }

            const stats = await fetchPlayerStats(targetPlayerId)
            setModalStats(stats)
            setModalLoading(false)
        },
        [leaderboard]
    )

    const renderRow = useCallback(
        ({ item }: { item: LeaderboardEntry }) => {
            const isMe = item.id === player?.id
            return (
                <TouchableOpacity
                    style={[styles.row, isMe && styles.rowHighlighted]}
                    onPress={() => openModal(item.id)}
                    activeOpacity={0.6}
                >
                    <View style={styles.positionCol}>
                        <PositionBadge position={item.position} />
                    </View>
                    <Text style={[styles.rowName, isMe && styles.rowNameMe]} numberOfLines={1}>
                        {item.username}
                    </Text>
                    <Text style={styles.rowPoints}>{item.total_points} pts</Text>
                </TouchableOpacity>
            )
        },
        [player?.id, openModal]
    )

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        )
    }

    return (
        <>
            <FlatList
                style={styles.container}
                contentContainerStyle={styles.listContent}
                data={leaderboard}
                keyExtractor={(item) => item.id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
                ListHeaderComponent={
                    <>
                        <Text style={styles.title}>Ranking</Text>

                        {isTournamentOver && !specialScoringDone && (
                            <View style={styles.podiumSection}>
                                <Text style={styles.podiumTitle}>🏆 Torneo finalizado</Text>
                                <Text style={styles.podiumPending}>
                                    Calculando puntos especiales...
                                </Text>
                            </View>
                        )}

                        {showFinalPodium && podium && (
                            <View style={styles.podiumSection}>
                                <Text style={styles.podiumTitle}>🏆 Torneo finalizado</Text>
                                <View style={styles.podiumRow}>
                                    <PodiumCard
                                        entry={podium.second}
                                        place={2}
                                        onPress={openModal}
                                    />
                                    <PodiumCard
                                        entry={podium.first}
                                        place={1}
                                        onPress={openModal}
                                    />
                                    <PodiumCard
                                        entry={podium.third}
                                        place={3}
                                        onPress={openModal}
                                    />
                                </View>
                            </View>
                        )}

                        {isTournamentOver && <View style={styles.sectionDivider} />}

                        <View style={styles.headerStatsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.headerStatValue}>{matchStats?.finished ?? 0}</Text>
                                <Text style={styles.headerStatLabel}>Jugados</Text>
                            </View>
                            <Text style={styles.statDivider}>/</Text>
                            <View style={styles.statCard}>
                                <Text style={styles.headerStatValue}>{matchStats?.total ?? 0}</Text>
                                <Text style={styles.headerStatLabel}>Total</Text>
                            </View>
                        </View>

                        {currentPlayerEntry && (
                            <>
                                <View style={styles.sectionDivider} />
                                <TouchableOpacity
                                    style={styles.myCard}
                                    onPress={() => openModal(currentPlayerEntry.id)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.myCardTop}>
                                        <Text style={styles.myCardPosition}>
                                            <PositionBadge position={currentPlayerEntry.position} />
                                        </Text>
                                        <Text style={styles.myCardName}>
                                            {currentPlayerEntry.username}
                                        </Text>
                                    </View>
                                    <Text style={styles.myCardPoints}>
                                        {currentPlayerEntry.total_points} pts
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <View style={styles.sectionDivider} />
                    </>
                }
                renderItem={renderRow}
                ListFooterComponent={
                    <>
                        {currentMatches && currentMatches.length > 0 && leaderboard && (
                            <>
                                <View style={styles.sectionDivider} />
                                {currentMatches.length > 1 && (
                                    <View style={styles.multiMatchHeader}>
                                        <Text style={styles.multiMatchTitle}>
                                            {currentMatches[0].status === "live" ? "🔴 Partidos en vivo" : "📋 Partidos anteriores"}
                                        </Text>
                                    </View>
                                )}
                                {currentMatches.map((match) => (
                                    <MatchPicksTable
                                        key={match.id}
                                        match={match}
                                        picks={currentPicksMap?.[match.id] ?? []}
                                        players={leaderboard}
                                        currentPlayerId={player?.id}
                                        title={currentMatches.length === 1 ? (match.status === "live" ? "🔴 Partido en vivo" : "📋 Partido anterior") : undefined}
                                    />
                                ))}
                            </>
                        )}
                        {leaderboard && leaderboard.length > 0 && (
                            <>
                                <View style={styles.sectionDivider} />
                                <SpecialPicksTable
                                    players={leaderboard}
                                    currentPlayerId={player?.id}
                                    showSurprise={specialScoringDone}
                                />
                            </>
                        )}
                        {ownStats && player ? (
                            <>
                                <View style={styles.sectionDivider} />
                                <View style={styles.ownStatsSection}>
                                    <Text style={styles.sectionTitle}>📊 Mis estadísticas</Text>
                                    <StatsView stats={ownStats} label={player.username} />
                                </View>
                            </>
                        ) : null}
                    </>
                }
            />

            <Modal
                visible={selectedPlayerId !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setSelectedPlayerId(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <Text style={styles.modalMedal}>
                                    <PositionBadge position={modalPosition} />
                                </Text>
                                <View>
                                    <Text style={styles.modalTitle}>{modalUsername}</Text>
                                    <Text style={styles.modalPoints}>{modalPoints} pts</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setSelectedPlayerId(null)}>
                                <Text style={styles.modalClose}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>

                        {modalLoading ? (
                            <ActivityIndicator
                                size="large"
                                color={colors.accent}
                                style={{ marginTop: 40 }}
                            />
                        ) : modalStats ? (
                            <StatsView stats={modalStats} label={modalUsername} />
                        ) : null}
                    </View>
                </View>
            </Modal>
        </>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    listContent: {
        paddingBottom: 48,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        color: colors.text,
        textAlign: "center",
        marginTop: 24,
        marginBottom: 20,
    },
    headerStatsRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    statCard: {
        alignItems: "center",
    },
    headerStatValue: {
        fontSize: 28,
        fontWeight: "bold",
        color: colors.text,
    },
    headerStatLabel: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    statDivider: {
        fontSize: 28,
        color: colors.textSecondary,
        fontWeight: "bold",
        marginBottom: 16,
    },
    myCard: {
        backgroundColor: "rgba(200, 255, 0, 0.1)",
        borderWidth: 1,
        borderColor: colors.accent + "50",
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 16,
        marginBottom: 24,
        alignItems: "center",
    },
    myCardTop: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    myCardPosition: {
        fontSize: 24,
    },
    myCardName: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "bold",
    },
    myCardPoints: {
        color: colors.accent,
        fontSize: 36,
        fontWeight: "bold",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.surface,
    },
    rowHighlighted: {
        backgroundColor: colors.surfaceSecondary,
    },
    positionCol: {
        width: 40,
        alignItems: "center",
    },
    medal: {
        fontSize: 22,
    },
    positionNumber: {
        color: colors.textSecondary,
        fontSize: 16,
        fontWeight: "bold",
    },
    rowName: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        marginLeft: 12,
    },
    rowNameMe: {
        color: colors.accent,
        fontWeight: "bold",
    },
    rowPoints: {
        color: colors.accent,
        fontSize: 15,
        fontWeight: "bold",
    },

    // Podium
    podiumSection: {
        alignItems: "center",
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    podiumTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.accent,
        marginBottom: 16,
    },
    podiumPending: {
        fontSize: 14,
        color: colors.textSecondary,
        fontStyle: "italic",
    },
    podiumRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
    },
    podiumCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: "center",
        padding: 12,
    },
    podiumCardCenter: {
        width: (SCREEN_WIDTH - 56) * 0.38,
        borderColor: colors.accent + "60",
        paddingVertical: 20,
    },
    podiumCardSide: {
        width: (SCREEN_WIDTH - 56) * 0.28,
        borderColor: colors.border,
    },
    podiumCardEmpty: {
        opacity: 0.3,
    },
    podiumMedal: {
        fontSize: 28,
        marginBottom: 4,
    },
    podiumMedalCenter: {
        fontSize: 36,
    },
    podiumName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
        textAlign: "center",
    },
    podiumNameCenter: {
        fontSize: 15,
        fontWeight: "bold",
    },
    podiumPoints: {
        color: colors.accent,
        fontSize: 13,
        fontWeight: "bold",
        marginTop: 2,
    },
    podiumPointsCenter: {
        fontSize: 16,
    },

    // Stats shared (own + modal)
    statsDetail: {
        padding: 16,
    },
    statsName: {
        fontSize: 18,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 16,
        textAlign: "center",
    },
    statsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
    },
    statsList: {
        flex: 1,
        gap: 8,
    },
    statRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    statLabel: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    statValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    statValue: {
        color: colors.text,
        fontSize: 15,
        fontWeight: "bold",
    },
    statSub: {
        color: colors.accent,
        fontSize: 12,
        fontWeight: "bold",
    },
    legendRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        marginTop: 16,
    },
    legendItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    donutCenter: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
    },
    donutPercent: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "bold",
    },

    // Own stats footer
    ownStatsSection: {
        marginTop: 24,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: colors.text,
        marginBottom: 12,
        textAlign: "center",
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "flex-end",
    },
    modalContainer: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        maxHeight: "80%",
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalHeaderLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    modalMedal: {
        fontSize: 28,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "bold",
    },
    modalPoints: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: "bold",
    },
    modalClose: {
        color: colors.accent,
        fontSize: 16,
        fontWeight: "600",
    },

    // Last match
    lastMatchSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    lastMatchTitle: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 10,
        textAlign: "center",
    },
    lastMatchCard: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    lastMatchTeams: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        marginBottom: 12,
    },
    lastMatchTeam: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "bold",
        flex: 1,
        textAlign: "center",
    },
    lastMatchVS: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "600",
    },
    lastMatchRow: {
        flexDirection: "row",
        justifyContent: "space-around",
    },
    lastMatchCol: {
        alignItems: "center",
        gap: 4,
    },
    lastMatchLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        textTransform: "uppercase",
    },
    lastMatchValue: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "bold",
    },
    noLastMatchText: {
        color: colors.textSecondary,
        fontSize: 13,
        textAlign: "center",
        fontStyle: "italic",
    },

    // Current match section
    currentMatchSection: {
        marginHorizontal: 16,
        marginBottom: 20,
    },
    currentMatchTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 10,
    },
    matchCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.accent,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8,
        elevation: 2,
    },
    matchCardContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    matchTeamCol: {
        flex: 1,
        alignItems: "center",
        gap: 8,
    },
    matchTeamName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "bold",
        textAlign: "center",
    },
    matchCenter: {
        alignItems: "center",
        paddingHorizontal: 12,
    },
    matchVS: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "bold",
    },
    matchScore: {
        color: colors.accent,
        fontSize: 18,
        fontWeight: "bold",
    },
    matchStage: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 10,
    },
    matchLiveBadge: {
        alignSelf: "center",
        backgroundColor: colors.danger,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
    },
    matchLiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text,
    },
    matchLiveText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "bold",
    },
    picksDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 12,
    },
    pickRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
    },
    pickRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    pickRowMe: {
        backgroundColor: "rgba(200, 255, 0, 0.08)",
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },
    pickPlayer: {
        flex: 1,
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
    },
    pickPlayerMe: {
        color: colors.accent,
        fontWeight: "bold",
    },
    pickCrests: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    pickScore: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "bold",
        minWidth: 48,
        textAlign: "center",
    },
    pickScoreMe: {
        color: colors.text,
    },
    pickPts: {
        width: 52,
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "600",
        textAlign: "right",
    },
    pickPtsPos: {
        color: colors.accent,
    },
    multiMatchHeader: {
        marginHorizontal: 16,
        marginBottom: 12,
    },
    multiMatchTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "bold",
    },
    sectionDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 8,
        marginHorizontal: 16,
    },
})
