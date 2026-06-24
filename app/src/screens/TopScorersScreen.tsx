import { useCallback, useState } from "react"
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import PlayerFigure from "../components/PlayerFigure"
import TeamCrest from "../components/TeamCrest"
import { getFlagUrl } from "../lib/flags"
import { getJerseyConfig } from "../lib/jersey-colors"
import { colors } from "../theme/colors"

interface ScorerRow {
    id: number
    external_player_id: number
    player_name: string
    nationality: string
    team_name: string
    goals: number
    shirt_number: number | null
}

interface TeamGoals {
    name: string
    goals: number
    flag: string | null
}

const FALLBACK_JERSEY = { primary: colors.surfaceSecondary, secondary: colors.border, numberColor: colors.textSecondary }

function SectionDivider() {
    return <View style={styles.divider} />
}

export default function TopScorersScreen() {
    const queryClient = useQueryClient()
    const [refreshing, setRefreshing] = useState(false)

    const { data: scorers } = useQuery({
        queryKey: ["scorers"],
        queryFn: async () => {
            const { data } = await supabase
                .from("scorers")
                .select("*")
                .order("goals", { ascending: false })
                .limit(5)
            return (data ?? []) as ScorerRow[]
        },
        staleTime: 30_000,
    })

    const { data: teamGoals } = useQuery({
        queryKey: ["teamGoals"],
        queryFn: async () => {
            const { data: finished } = await supabase
                .from("matches")
                .select("home_team, away_team, home_score, away_score")
                .eq("status", "finished")

            const goalMap: Record<string, number> = {}
            for (const m of finished ?? []) {
                if (m.home_score != null) {
                    goalMap[m.home_team] = (goalMap[m.home_team] ?? 0) + m.home_score
                }
                if (m.away_score != null) {
                    goalMap[m.away_team] = (goalMap[m.away_team] ?? 0) + m.away_score
                }
            }

            const entries = Object.entries(goalMap)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([name, goals]) => ({
                    name,
                    goals,
                    flag: getFlagUrl(name) ?? null,
                })) as TeamGoals[]

            return { teams: entries, total: Object.values(goalMap).reduce((s, g) => s + g, 0) }
        },
        staleTime: 30_000,
    })

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            await queryClient.invalidateQueries({ queryKey: ["scorers"] })
            await queryClient.invalidateQueries({ queryKey: ["teamGoals"] })
        } finally {
            setRefreshing(false)
        }
    }, [])

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
        >
            <View style={styles.topSpacer} />

            <Text style={styles.sectionTitle}>⚽ Top 5 Goleadores</Text>
            <View style={styles.card}>
                {scorers && scorers.length > 0 ? (
                    scorers.map((scorer, idx) => (
                        <View key={scorer.id} style={[styles.row, idx < scorers.length - 1 && styles.rowBorder]}>
                            <View style={styles.rankBadge}>
                                <Text style={styles.rankText}>{idx + 1}</Text>
                            </View>
                            <PlayerFigure
                                config={getJerseyConfig(scorer.team_name) ?? FALLBACK_JERSEY}
                                number={scorer.shirt_number}
                                size={38}
                            />
                            <View style={styles.playerInfo}>
                                <Text style={styles.playerName} numberOfLines={1}>{scorer.player_name}</Text>
                                <View style={styles.flagRow}>
                                    <TeamCrest
                                        crest={getFlagUrl(scorer.nationality)}
                                        name={scorer.nationality}
                                        size={14}
                                    />
                                    <Text style={styles.teamNameText}>{scorer.team_name}</Text>
                                </View>
                            </View>
                            <View style={styles.goalCol}>
                                <Text style={styles.goalCount}>{scorer.goals}</Text>
                                <Text style={styles.goalLabel}>
                                    {scorer.goals === 1 ? "gol" : "goles"}
                                </Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <Text style={styles.emptyText}>Aún no hay datos de goleadores</Text>
                )}
            </View>

            <SectionDivider />

            {teamGoals && teamGoals.teams.length > 0 && (
                <>
                    <Text style={styles.sectionTitle}>🏆 Top 5 Equipos más goleadores</Text>
                    <View style={styles.card}>
                        {teamGoals.teams.map((team, idx) => (
                            <View key={team.name} style={[styles.row, idx < teamGoals.teams.length - 1 && styles.rowBorder]}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{idx + 1}</Text>
                                </View>
                                <TeamCrest crest={team.flag} name={team.name} size={32} />
                                <Text style={styles.teamNameLabel} numberOfLines={1}>{team.name}</Text>
                                <View style={styles.goalCol}>
                                    <Text style={styles.goalCount}>{team.goals}</Text>
                                    <Text style={styles.goalLabel}>
                                        {team.goals === 1 ? "gol" : "goles"}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    <SectionDivider />
                </>
            )}

            {teamGoals && (
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total del torneo</Text>
                    <Text style={styles.totalCount}>{teamGoals.total} ⚽</Text>
                </View>
            )}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingBottom: 48,
        paddingHorizontal: 16,
    },
    topSpacer: {
        height: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: colors.text,
        textAlign: "center",
        marginBottom: 16,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 16,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 4,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        gap: 10,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    rankBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.surfaceSecondary,
        alignItems: "center",
        justifyContent: "center",
    },
    rankText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "bold",
    },
    playerInfo: {
        flex: 1,
        gap: 4,
    },
    playerName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "bold",
    },
    flagRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    teamNameText: {
        color: colors.textSecondary,
        fontSize: 11,
    },
    teamNameLabel: {
        flex: 1,
        color: colors.text,
        fontSize: 14,
        fontWeight: "bold",
    },
    goalCol: {
        alignItems: "center",
        minWidth: 48,
    },
    goalCount: {
        color: colors.accent,
        fontSize: 20,
        fontWeight: "bold",
    },
    goalLabel: {
        color: colors.textSecondary,
        fontSize: 10,
        textTransform: "uppercase",
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: "center",
        paddingVertical: 20,
    },
    totalCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.accent,
        paddingVertical: 24,
        paddingHorizontal: 16,
        alignItems: "center",
        marginTop: 8,
        marginBottom: 20,
    },
    totalLabel: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 8,
        textTransform: "uppercase",
        letterSpacing: 2,
    },
    totalCount: {
        color: colors.accent,
        fontSize: 42,
        fontWeight: "bold",
    },
})
