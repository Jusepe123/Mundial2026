import { useMemo } from "react"
import { View, Text, StyleSheet } from "react-native"
import { useQuery } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import TeamCrest from "./TeamCrest"
import { colors } from "../theme/colors"

interface SpecialPickRow {
    player_id: string
    category: string
    prediction: string
    points_earned: number | null
}

interface PlayerEntry {
    id: string
    username: string
}

interface ScoringConfig {
    stage: string
    deadline: string | null
}

interface SpecialPicksTableProps {
    players: PlayerEntry[]
    currentPlayerId?: string
    showSurprise: boolean
}

const PODIUM_COLUMNS = [
    { category: "first", label: "🥇", configKey: "special_first" },
    { category: "second", label: "🥈", configKey: "special_second" },
    { category: "third", label: "🥉", configKey: "special_third" },
    { category: "fourth", label: "4°", configKey: "special_fourth" },
]

function isPastDeadline(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false
    return new Date(dateStr) <= new Date()
}

function abbrev(team: string): string {
    return team.slice(0, 3).toUpperCase()
}

export default function SpecialPicksTable({ players, currentPlayerId, showSurprise }: SpecialPicksTableProps) {
    const { data: configs } = useQuery({
        queryKey: ["scoring_special"],
        queryFn: async () => {
            const { data } = await supabase
                .from("scoring_config")
                .select("stage, special_points, deadline")
                .like("stage", "special_%")
            return (data ?? []) as ScoringConfig[]
        },
    })

    const { data: allPicks } = useQuery({
        queryKey: ["allSpecialPicks"],
        queryFn: async () => {
            const { data } = await supabase
                .from("special_picks")
                .select("player_id, category, prediction, points_earned")
            return (data ?? []) as SpecialPickRow[]
        },
        staleTime: 60_000,
    })

    const deadlineMap = useMemo(() => {
        const map: Record<string, string | null> = {}
        for (const c of configs ?? []) {
            map[c.stage] = c.deadline
        }
        return map
    }, [configs])

    // player_id -> category -> pick
    const picksMap = useMemo(() => {
        const map: Record<string, Record<string, SpecialPickRow>> = {}
        for (const p of allPicks ?? []) {
            if (!map[p.player_id]) map[p.player_id] = {}
            map[p.player_id][p.category] = p
        }
        return map
    }, [allPicks])

    // Only reveal a category once its deadline passed — before that players
    // could still edit their pick and shouldn't see the others'.
    const podiumColumns = PODIUM_COLUMNS.filter((c) => isPastDeadline(deadlineMap[c.configKey]))
    const showScorer = isPastDeadline(deadlineMap["special_scorer"])

    // Once calculate-special-points ran (any pick has non-null points) the
    // grid also shows what each pick earned plus a per-player total.
    // "surprise" never gets points — it's an easter egg (majority vote).
    const anyScored = (allPicks ?? []).some((p) => p.points_earned != null)

    const surpriseMajority = useMemo(() => {
        const votes = (allPicks ?? []).filter((p) => p.category === "surprise")
        if (votes.length === 0) return null
        const counts: Record<string, number> = {}
        for (const v of votes) counts[v.prediction] = (counts[v.prediction] ?? 0) + 1
        const max = Math.max(...Object.values(counts))
        return Object.keys(counts).filter((t) => counts[t] === max)
    }, [allPicks])

    if (!allPicks || (podiumColumns.length === 0 && !showScorer && !showSurprise)) {
        return null
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔮 Pronósticos especiales</Text>
            <View style={styles.card}>
                {podiumColumns.length > 0 && (
                    <>
                        <View style={styles.headerRow}>
                            <Text style={styles.headerPlayer}>Jugador</Text>
                            {podiumColumns.map((col) => (
                                <Text key={col.category} style={styles.headerCell}>
                                    {col.label}
                                </Text>
                            ))}
                            {anyScored && <Text style={styles.headerTotal}>Σ</Text>}
                        </View>
                        {players.map((entry, idx) => {
                            const isMe = entry.id === currentPlayerId
                            return (
                                <View
                                    key={entry.id}
                                    style={[
                                        styles.row,
                                        isMe && styles.rowMe,
                                        idx < players.length - 1 && styles.rowBorder,
                                    ]}
                                >
                                    <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
                                        {entry.username}
                                    </Text>
                                    {podiumColumns.map((col) => {
                                        const pick = picksMap[entry.id]?.[col.category]
                                        const correct = pick?.points_earned != null && pick.points_earned > 0
                                        return (
                                            <View
                                                key={col.category}
                                                style={[styles.cell, correct && styles.cellCorrect]}
                                            >
                                                {pick ? (
                                                    <>
                                                        <TeamCrest crest={null} name={pick.prediction} size={22} />
                                                        <Text style={[styles.cellAbbrev, correct && styles.cellAbbrevCorrect]}>
                                                            {abbrev(pick.prediction)}
                                                        </Text>
                                                        {pick.points_earned != null && (
                                                            <Text style={correct ? styles.cellPtsWon : styles.cellPtsZero}>
                                                                {correct ? `+${pick.points_earned}` : "0"}
                                                            </Text>
                                                        )}
                                                    </>
                                                ) : (
                                                    <Text style={styles.cellEmpty}>—</Text>
                                                )}
                                            </View>
                                        )
                                    })}
                                    {anyScored && (
                                        <Text style={styles.totalCell}>
                                            {Object.values(picksMap[entry.id] ?? {}).reduce(
                                                (acc, p) => acc + (p.points_earned ?? 0),
                                                0
                                            )}
                                        </Text>
                                    )}
                                </View>
                            )
                        })}
                    </>
                )}

                {showScorer && (
                    <TextPicksSection
                        title="⚽ Goleador"
                        category="top_scorer"
                        players={players}
                        picksMap={picksMap}
                        currentPlayerId={currentPlayerId}
                        withDividerAbove={podiumColumns.length > 0}
                    />
                )}

                {showSurprise && (
                    <TextPicksSection
                        title="🎁 Selección sorpresa"
                        category="surprise"
                        players={players}
                        picksMap={picksMap}
                        currentPlayerId={currentPlayerId}
                        showCrest
                        withDividerAbove={podiumColumns.length > 0 || showScorer}
                        note={
                            surpriseMajority
                                ? `Por mayoría de votos, la selección sorpresa es... ${surpriseMajority.join(" y ")} (sin puntos, solo por diversión)`
                                : undefined
                        }
                    />
                )}
            </View>
        </View>
    )
}

function TextPicksSection({
    title,
    category,
    players,
    picksMap,
    currentPlayerId,
    showCrest,
    withDividerAbove,
    note,
}: {
    title: string
    category: string
    players: PlayerEntry[]
    picksMap: Record<string, Record<string, SpecialPickRow>>
    currentPlayerId?: string
    showCrest?: boolean
    withDividerAbove: boolean
    note?: string
}) {
    return (
        <>
            {withDividerAbove && <View style={styles.divider} />}
            <Text style={styles.subsectionTitle}>{title}</Text>
            {note && <Text style={styles.sectionNote}>{note}</Text>}
            {players.map((entry, idx) => {
                const pick = picksMap[entry.id]?.[category]
                const isMe = entry.id === currentPlayerId
                const correct = pick?.points_earned != null && pick.points_earned > 0
                return (
                    <View
                        key={entry.id}
                        style={[
                            styles.row,
                            isMe && styles.rowMe,
                            idx < players.length - 1 && styles.rowBorder,
                        ]}
                    >
                        <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
                            {entry.username}
                        </Text>
                        <View style={styles.textPickRight}>
                            {pick && showCrest && (
                                <TeamCrest crest={null} name={pick.prediction} size={18} />
                            )}
                            <Text
                                style={[styles.textPick, correct && styles.textPickCorrect]}
                                numberOfLines={1}
                            >
                                {pick ? pick.prediction : "—"}
                            </Text>
                            {pick?.points_earned != null && (
                                <Text style={[styles.pts, pick.points_earned > 0 && styles.ptsPos]}>
                                    {pick.points_earned} pts
                                </Text>
                            )}
                        </View>
                    </View>
                )
            })}
        </>
    )
}

const styles = StyleSheet.create({
    section: {
        marginHorizontal: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "bold",
        marginBottom: 10,
    },
    card: {
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
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerPlayer: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    headerCell: {
        width: 44,
        textAlign: "center",
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "bold",
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    rowMe: {
        backgroundColor: "rgba(200, 255, 0, 0.08)",
        marginHorizontal: -16,
        paddingHorizontal: 16,
    },
    playerName: {
        flex: 1,
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
    },
    playerNameMe: {
        color: colors.accent,
        fontWeight: "bold",
    },
    cell: {
        width: 44,
        alignItems: "center",
        gap: 2,
        paddingVertical: 4,
        borderRadius: 8,
    },
    cellCorrect: {
        backgroundColor: "rgba(200, 255, 0, 0.15)",
    },
    cellAbbrev: {
        color: colors.textSecondary,
        fontSize: 9,
        fontWeight: "600",
    },
    cellAbbrevCorrect: {
        color: colors.accent,
    },
    cellEmpty: {
        color: colors.textSecondary,
        fontSize: 13,
    },
    cellPtsWon: {
        color: colors.accent,
        fontSize: 9,
        fontWeight: "bold",
    },
    cellPtsZero: {
        color: colors.textSecondary,
        fontSize: 9,
        fontWeight: "600",
        opacity: 0.6,
    },
    headerTotal: {
        width: 36,
        textAlign: "center",
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: "bold",
    },
    totalCell: {
        width: 36,
        textAlign: "center",
        color: colors.accent,
        fontSize: 14,
        fontWeight: "bold",
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 12,
    },
    subsectionTitle: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "bold",
        marginBottom: 6,
    },
    sectionNote: {
        color: colors.accent,
        fontSize: 12,
        fontStyle: "italic",
        marginBottom: 8,
    },
    textPickRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 1,
    },
    textPick: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: "600",
        flexShrink: 1,
    },
    textPickCorrect: {
        color: colors.accent,
    },
    pts: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "600",
        marginLeft: 4,
    },
    ptsPos: {
        color: colors.accent,
    },
})
