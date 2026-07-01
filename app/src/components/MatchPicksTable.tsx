import { useMemo } from "react"
import { View, Text, StyleSheet } from "react-native"
import TeamCrest from "./TeamCrest"
import { colors } from "../theme/colors"

function formatScore(match: Match): string {
    const score = `${match.home_score} - ${match.away_score}`
    if (match.home_penalties != null && match.away_penalties != null) {
        return `${score} (${match.home_penalties}-${match.away_penalties} pen.)`
    }
    return score
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
    venue: string | null
}

interface PickData {
    player_id: string
    predicted_home: number
    predicted_away: number
    points_earned: number | null
}

interface PlayerEntry {
    id: string
    username: string
}

interface MatchPicksTableProps {
    match: Match
    picks: PickData[]
    players: PlayerEntry[]
    currentPlayerId?: string
    title?: string
}

const STAGE_LABELS: Record<string, string> = {
    group: "Fase de grupos",
    round_of_32: "16avos de final",
    round_of_16: "Octavos de final",
    quarter: "Cuartos de final",
    semi: "Semifinal",
    third_place: "Tercer puesto",
    final: "Final",
}

export default function MatchPicksTable({ match, picks, players, currentPlayerId, title }: MatchPicksTableProps) {
    const picksMap = useMemo(() => {
        const map: Record<string, PickData> = {}
        for (const p of picks) {
            map[p.player_id] = p
        }
        return map
    }, [picks])

    const stageLabel = match.stage === "group"
        ? "Fase de grupos"
        : STAGE_LABELS[match.stage] ?? match.stage

    return (
        <View style={styles.section}>
            {title && <Text style={styles.title}>{title}</Text>}
            <View style={styles.card}>
                <View style={styles.cardContent}>
                    <View style={styles.teamCol}>
                        <TeamCrest crest={match.home_flag} name={match.home_team} size={28} />
                        <Text style={styles.teamName} numberOfLines={1}>{match.home_team}</Text>
                    </View>
                    <View style={styles.center}>
                        {match.home_score != null ? (
                            <>
                                <Text style={styles.score}>
                                    {match.home_score} - {match.away_score}
                                </Text>
                                {match.home_penalties != null && match.away_penalties != null && (
                                    <Text style={styles.penaltyText}>
                                        ({match.home_penalties}-{match.away_penalties} pen.)
                                    </Text>
                                )}
                            </>
                        ) : (
                            <Text style={styles.vs}>VS</Text>
                        )}
                    </View>
                    <View style={styles.teamCol}>
                        <TeamCrest crest={match.away_flag} name={match.away_team} size={28} />
                        <Text style={styles.teamName} numberOfLines={1}>{match.away_team}</Text>
                    </View>
                </View>
                <Text style={styles.stage}>{stageLabel}</Text>
                {match.venue && (
                    <View style={styles.venueRow}>
                        <Text style={styles.venueText}>{match.venue}</Text>
                    </View>
                )}
                {match.status === "live" && (
                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>EN VIVO</Text>
                    </View>
                )}
                <View style={styles.divider} />
                {players.map((entry, idx) => {
                    const pick = picksMap[entry.id]
                    const isMe = entry.id === currentPlayerId
                    return (
                        <View key={entry.id} style={[
                            styles.pickRow,
                            isMe && styles.pickRowMe,
                            idx < players.length - 1 && styles.pickRowBorder,
                        ]}>
                            <Text style={[styles.pickPlayer, isMe && styles.pickPlayerMe]} numberOfLines={1}>
                                {entry.username}
                            </Text>
                            <View style={styles.pickCrests}>
                                <TeamCrest crest={match.home_flag} name={match.home_team} size={14} />
                                <Text style={[styles.pickScore, isMe && styles.pickScoreMe]}>
                                    {pick ? `${pick.predicted_home} - ${pick.predicted_away}` : "—"}
                                </Text>
                                <TeamCrest crest={match.away_flag} name={match.away_team} size={14} />
                            </View>
                            <Text style={[styles.pickPts, pick?.points_earned != null && pick.points_earned > 0 && styles.pickPtsPos]}>
                                {pick?.points_earned != null ? `${pick.points_earned} pts` : "—"}
                            </Text>
                        </View>
                    )
                })}
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    section: {
        marginHorizontal: 16,
        marginBottom: 20,
    },
    title: {
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
    cardContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    teamCol: {
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
    center: {
        alignItems: "center",
        paddingHorizontal: 12,
    },
    vs: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "bold",
    },
    score: {
        color: colors.accent,
        fontSize: 18,
        fontWeight: "bold",
    },
    penaltyText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        marginTop: 2,
    },
    stage: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "600",
        textAlign: "center",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginTop: 10,
    },
    venueRow: {
        alignItems: "center",
        marginTop: 4,
    },
    venueText: {
        color: colors.textSecondary,
        fontSize: 10,
        textAlign: "center",
    },
    liveBadge: {
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
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.text,
    },
    liveText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "bold",
    },
    divider: {
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
})
