import { useState, useEffect, useMemo, useCallback } from "react"
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Modal,
    FlatList,
} from "react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import getDeviceId from "../lib/deviceId"
import usePlayerStore from "../store/usePlayerStore"
import TeamCrest from "../components/TeamCrest"
import { TEAMS } from "../lib/teams"
import { colors } from "../theme/colors"

interface ScoringConfig {
    stage: string
    special_points: number | null
    deadline: string | null
}

interface SpecialPick {
    category: string
    prediction: string
    points_earned: number | null
}

interface OutcomeMatch {
    stage: string
    home_team: string
    away_team: string
    home_score: number | null
    away_score: number | null
    home_penalties: number | null
    away_penalties: number | null
    status: string
}

// Same winner/loser logic as calculate-special-points (penalties decide draws).
function getOutcome(m: OutcomeMatch): { winner: string | null; loser: string | null } {
    if (m.home_score == null || m.away_score == null) return { winner: null, loser: null }
    if (m.home_penalties != null && m.away_penalties != null) {
        return m.home_penalties > m.away_penalties
            ? { winner: m.home_team, loser: m.away_team }
            : { winner: m.away_team, loser: m.home_team }
    }
    if (m.home_score > m.away_score) return { winner: m.home_team, loser: m.away_team }
    if (m.away_score > m.home_score) return { winner: m.away_team, loser: m.home_team }
    return { winner: null, loser: null }
}

// "surprise" (Selección sorpresa) isn't listed here — it's voted through
// SurpriseSurveyModal, a one-question popup that opens dynamically around
// the final match instead of this screen's static pre-tournament deadline.
const CATEGORIES = [
    { category: "first", label: "Campeón", pointsKey: "special_first" },
    { category: "second", label: "Subcampeón", pointsKey: "special_second" },
    { category: "third", label: "Tercer lugar", pointsKey: "special_third" },
    { category: "fourth", label: "Cuarto lugar", pointsKey: "special_fourth" },
    { category: "top_scorer", label: "Goleador", pointsKey: "special_scorer" },
]

// Once the tournament ends the screen flips to a read-only summary.
// "surprise" is deliberately NOT here: it awards no points — it's an easter
// egg revealed as the group's majority vote (see the card below the list).
const SUMMARY_CATEGORIES = [
    { category: "first", label: "🥇 Campeón", pointsKey: "special_first" },
    { category: "second", label: "🥈 Subcampeón", pointsKey: "special_second" },
    { category: "third", label: "🥉 Tercer lugar", pointsKey: "special_third" },
    { category: "fourth", label: "4° lugar", pointsKey: "special_fourth" },
    { category: "top_scorer", label: "⚽ Goleador", pointsKey: "special_scorer" },
]

function formatDeadline(dateStr: string | null): string {
    if (!dateStr) return "Sin fecha límite"
    const d = new Date(dateStr)
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

function isPastDeadline(dateStr: string | null): boolean {
    if (!dateStr) return false
    return new Date(dateStr) <= new Date()
}

export default function SpecialPicksScreen() {
    const queryClient = useQueryClient()
    const player = usePlayerStore((s) => s.player)

    const [pickerOpen, setPickerOpen] = useState<string | null>(null)
    const [draftSelections, setDraftSelections] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState<Record<string, boolean>>({})
    const [saved, setSaved] = useState<Record<string, boolean>>({})
    const [refreshing, setRefreshing] = useState(false)
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30_000)
        return () => clearInterval(id)
    }, [])

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

    // Same gate as the Ranking podium: the summary appears 30 minutes after
    // the final ends, when calculate-special-points starts assigning points.
    const tournamentOver = useMemo(() => {
        if (!finalMatch || finalMatch.status !== "finished" || !finalMatch.finished_at) return false
        return now >= new Date(finalMatch.finished_at).getTime() + 30 * 60 * 1000
    }, [finalMatch, now])

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

    const { data: existingPicks } = useQuery({
        queryKey: ["special_picks", player?.id],
        queryFn: async () => {
            if (!player?.id) return []
            const { data } = await supabase
                .from("special_picks")
                .select("category, prediction, points_earned")
                .eq("player_id", player.id)
            return (data ?? []) as SpecialPick[]
        },
        enabled: !!player?.id,
        // Keep polling so points_earned appears on its own once
        // calculate-special-points runs (30 min after the final).
        refetchInterval: 60_000,
    })

    const { data: actualPodium } = useQuery({
        queryKey: ["podiumOutcomes"],
        queryFn: async () => {
            const { data } = await supabase
                .from("matches")
                .select("stage, home_team, away_team, home_score, away_score, home_penalties, away_penalties, status")
                .in("stage", ["final", "third_place"])
            const rows = (data ?? []) as OutcomeMatch[]
            const finalRow = rows.find((m) => m.stage === "final")
            const thirdRow = rows.find((m) => m.stage === "third_place")
            const finalOutcome = finalRow?.status === "finished" ? getOutcome(finalRow) : { winner: null, loser: null }
            const thirdOutcome = thirdRow?.status === "finished" ? getOutcome(thirdRow) : { winner: null, loser: null }
            return {
                first: finalOutcome.winner,
                second: finalOutcome.loser,
                third: thirdOutcome.winner,
                fourth: thirdOutcome.loser,
            } as Record<string, string | null>
        },
        enabled: tournamentOver,
        staleTime: 60_000,
    })

    const { data: actualScorers } = useQuery({
        queryKey: ["topScorersActual"],
        queryFn: async () => {
            const { data } = await supabase
                .from("scorers")
                .select("player_name, goals")
                .order("goals", { ascending: false })
                .limit(10)
            const rows = (data ?? []) as { player_name: string; goals: number }[]
            if (rows.length === 0) return null
            const topGoals = rows[0].goals
            return { names: rows.filter((s) => s.goals === topGoals).map((s) => s.player_name), goals: topGoals }
        },
        enabled: tournamentOver,
        staleTime: 60_000,
    })

    // Same key/fn as SpecialPicksTable in the Ranking tab so both share cache.
    const { data: allSpecials } = useQuery({
        queryKey: ["allSpecialPicks"],
        queryFn: async () => {
            const { data } = await supabase
                .from("special_picks")
                .select("player_id, category, prediction, points_earned")
            return (data ?? []) as { player_id: string; category: string; prediction: string; points_earned: number | null }[]
        },
        enabled: tournamentOver,
        staleTime: 60_000,
    })

    // Easter egg: the most-voted "surprise" team(s). No points involved.
    const surpriseMajority = useMemo(() => {
        const votes = (allSpecials ?? []).filter((p) => p.category === "surprise")
        if (votes.length === 0) return null
        const counts: Record<string, number> = {}
        for (const v of votes) counts[v.prediction] = (counts[v.prediction] ?? 0) + 1
        const max = Math.max(...Object.values(counts))
        return {
            teams: Object.keys(counts).filter((t) => counts[t] === max),
            votes: max,
        }
    }, [allSpecials])

    const existingMap = useMemo(() => {
        const map: Record<string, string> = {}
        for (const p of existingPicks ?? []) {
            map[p.category] = p.prediction
        }
        return map
    }, [existingPicks])

    const pickByCategory = useMemo(() => {
        const map: Record<string, SpecialPick> = {}
        for (const p of existingPicks ?? []) {
            map[p.category] = p
        }
        return map
    }, [existingPicks])

    const totalSpecialPoints = useMemo(() => {
        return (existingPicks ?? []).reduce((acc, p) => acc + (p.points_earned ?? 0), 0)
    }, [existingPicks])

    const pointsMap = useMemo(() => {
        const map: Record<string, number | null> = {}
        for (const c of configs ?? []) {
            map[c.stage] = c.special_points
        }
        return map
    }, [configs])

    const deadlineMap = useMemo(() => {
        const map: Record<string, string | null> = {}
        for (const c of configs ?? []) {
            map[c.stage] = c.deadline
        }
        return map
    }, [configs])

    useEffect(() => {
        const initial: Record<string, string> = {}
        for (const cat of CATEGORIES) {
            if (existingMap[cat.category]) {
                initial[cat.category] = existingMap[cat.category]
            }
        }
        setDraftSelections(initial)
    }, [existingMap])

    const handleSelectTeam = (category: string, team: string) => {
        setDraftSelections((prev) => ({ ...prev, [category]: team }))
        setPickerOpen(null)
    }

    const handleSave = async (category: string) => {
        if (!player?.id) return
        const prediction = draftSelections[category]?.trim()
        if (!prediction) {
            Alert.alert("Error", "Seleccioná una opción antes de guardar")
            return
        }

        if (category === "top_scorer" && !prediction.includes("/")) {
            Alert.alert("Formato inválido", "Debe ser: Nombre/País (ej: Pedro Miguel/ Qatar)")
            return
        }

        const PODIUM = ["first", "second", "third", "fourth"]
        if (PODIUM.includes(category)) {
            const otherPodium = PODIUM
                .filter((c) => c !== category)
                .map((c) => draftSelections[c])
                .filter(Boolean)

            if (otherPodium.includes(prediction)) {
                Alert.alert("Equipo duplicado", "Ya seleccionaste este equipo en otra posición del podio. Elegí uno distinto.")
                return
            }
        }

        setSaving((prev) => ({ ...prev, [category]: true }))

        const device_id = await getDeviceId()
        const { error } = await supabase.rpc("upsert_special_pick", {
            p_player_id: player.id,
            p_category: category,
            p_prediction: prediction,
            p_device_id: device_id,
        })

        setSaving((prev) => ({ ...prev, [category]: false }))

        if (error) {
            Alert.alert("Error", error.message)
            return
        }

        setSaved((prev) => ({ ...prev, [category]: true }))
        setTimeout(() => setSaved((prev) => ({ ...prev, [category]: false })), 2000)
        queryClient.invalidateQueries({ queryKey: ["special_picks"] })
    }

    const onRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            await queryClient.invalidateQueries({ queryKey: ["special_picks"] })
            await queryClient.invalidateQueries({ queryKey: ["scoring_special"] })
            await queryClient.invalidateQueries({ queryKey: ["finalMatchWindow"] })
            await queryClient.invalidateQueries({ queryKey: ["podiumOutcomes"] })
            await queryClient.invalidateQueries({ queryKey: ["topScorersActual"] })
        } finally {
            setRefreshing(false)
        }
    }, [])

    if (tournamentOver) {
        return (
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
                }
            >
                <Text style={styles.title}>Pronósticos especiales</Text>
                <Text style={styles.subtitle}>🏆 Torneo finalizado — así te fue</Text>

                {SUMMARY_CATEGORIES.map((cat) => {
                    const pts = pointsMap[cat.pointsKey]
                    const pick = pickByCategory[cat.category]
                    const isTeamCategory = cat.category !== "top_scorer"

                    let actual: string | null = null
                    let actualIsTeam = false
                    if (cat.category === "top_scorer") {
                        actual = actualScorers
                            ? `${actualScorers.names.join(", ")} (${actualScorers.goals} goles)`
                            : null
                    } else {
                        actual = actualPodium?.[cat.category] ?? null
                        actualIsTeam = true
                    }

                    const earned = pick?.points_earned
                    const correct = earned != null && earned > 0

                    return (
                        <View key={cat.category} style={[styles.card, correct && styles.cardCorrect]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardLabel}>{cat.label}</Text>
                                <Text style={styles.cardPoints}>{pts ?? "—"} pts</Text>
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryRowLabel}>Resultado</Text>
                                {actual ? (
                                    <View style={styles.summaryRowValue}>
                                        {actualIsTeam && <TeamCrest crest={null} name={actual} size={20} />}
                                        <Text style={styles.summaryValueText} numberOfLines={1}>
                                            {actual}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={styles.summaryPending}>Pendiente</Text>
                                )}
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryRowLabel}>Tu elección</Text>
                                {pick ? (
                                    <View style={styles.summaryRowValue}>
                                        {isTeamCategory && <TeamCrest crest={null} name={pick.prediction} size={20} />}
                                        <Text style={styles.summaryValueText} numberOfLines={1}>
                                            {pick.prediction}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={styles.summaryPending}>Sin pronóstico</Text>
                                )}
                            </View>

                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryRowLabel}>Puntos</Text>
                                {!pick ? (
                                    <Text style={styles.summaryPointsZero}>0 pts</Text>
                                ) : earned == null ? (
                                    <Text style={styles.summaryPending}>Pendiente</Text>
                                ) : (
                                    <Text style={correct ? styles.summaryPointsWon : styles.summaryPointsZero}>
                                        {correct ? `+${earned}` : "0"} pts
                                    </Text>
                                )}
                            </View>
                        </View>
                    )
                })}

                {surpriseMajority && (
                    <View style={[styles.card, styles.easterEggCard]}>
                        <Text style={styles.cardLabel}>🎁 Selección sorpresa</Text>
                        <Text style={styles.easterEggText}>
                            Por mayoría de votos, la selección sorpresa es...
                        </Text>
                        <View style={styles.easterEggReveal}>
                            {surpriseMajority.teams.map((team) => (
                                <View key={team} style={styles.easterEggTeam}>
                                    <TeamCrest crest={null} name={team} size={36} />
                                    <Text style={styles.easterEggTeamName}>{team}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={styles.easterEggHint}>
                            Solo por diversión — no otorga puntos
                        </Text>
                    </View>
                )}

                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Total especiales</Text>
                    <Text style={styles.totalValue}>{totalSpecialPoints} pts</Text>
                </View>
            </ScrollView>
        )
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
            }
        >
            <Text style={styles.title}>Pronósticos especiales</Text>
            <Text style={styles.subtitle}>
                Predecí los resultados generales del torneo
            </Text>

            {CATEGORIES.map((cat) => {
                const pts = pointsMap[cat.pointsKey]
                const deadline = deadlineMap[cat.pointsKey]
                const closed = isPastDeadline(deadline)
                const selection = draftSelections[cat.category] ?? ""
                const isTopScorer = cat.category === "top_scorer"

                return (
                    <View key={cat.category} style={[styles.card, closed && styles.cardClosed]}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardLabel}>{cat.label}</Text>
                            <Text style={styles.cardPoints}>{pts ?? "—"} pts</Text>
                        </View>

                        <Text style={styles.deadline}>
                            Cierra: {formatDeadline(deadline)}
                        </Text>

                        {closed && (
                            <View style={styles.closedBadge}>
                                <Text style={styles.closedBadgeText}>Cerrado</Text>
                            </View>
                        )}

                        {isTopScorer ? (
                            <>
                                <TextInput
                                    style={[styles.textInput, closed && styles.inputDisabled]}
                                    placeholder="Ej: Pedro Miguel/ Qatar"
                                    placeholderTextColor={colors.textSecondary}
                                    value={selection}
                                    onChangeText={(t) =>
                                        setDraftSelections((prev) => ({ ...prev, [cat.category]: t }))
                                    }
                                    editable={!closed}
                                />
                                <Text style={styles.scorerHint}>Formato: Nombre/País</Text>
                            </>
                        ) : (
                            <TouchableOpacity
                                style={[styles.pickerButton, closed && styles.inputDisabled]}
                                onPress={() => !closed && setPickerOpen(cat.category)}
                                disabled={closed}
                            >
                                <View style={styles.pickerValueRow}>
                                    {selection ? (
                                        <>
                                            <TeamCrest crest={null} name={selection} size={22} />
                                            <Text style={styles.pickerText}>{selection}</Text>
                                        </>
                                    ) : (
                                        <Text style={[styles.pickerText, styles.pickerPlaceholder]}>
                                            Seleccionar equipo...
                                        </Text>
                                    )}
                                </View>
                                {!closed && <Text style={styles.pickerArrow}>▼</Text>}
                            </TouchableOpacity>
                        )}

                        {!closed && (
                            <TouchableOpacity
                                style={[styles.saveButton, saving[cat.category] && styles.saveButtonDisabled]}
                                onPress={() => handleSave(cat.category)}
                                disabled={saving[cat.category]}
                            >
                                {saving[cat.category] ? (
                                    <ActivityIndicator size="small" color="#0D0D0D" />
                                ) : (
                                    <Text style={styles.saveButtonText}>
                                        {saved[cat.category] ? "✓ Guardado" : existingMap[cat.category] ? "Actualizar" : "Guardar"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}

                        {closed && selection && (
                            <View style={styles.readOnlyRow}>
                                <Text style={styles.readOnlyLabel}>Tu elección:</Text>
                                {!isTopScorer && <TeamCrest crest={null} name={selection} size={22} />}
                                <Text style={styles.readOnlyPick}>{selection}</Text>
                            </View>
                        )}
                    </View>
                )
            })}

            <Modal
                visible={pickerOpen !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setPickerOpen(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar equipo</Text>
                            <TouchableOpacity onPress={() => setPickerOpen(null)}>
                                <Text style={styles.modalClose}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={TEAMS}
                            keyExtractor={(g) => g.group}
                            renderItem={({ item: group }) => (
                                <View style={styles.groupSection}>
                                    <Text style={styles.groupLabel}>Grupo {group.group}</Text>
                                    {group.teams.map((team) => {
                                        const selected = pickerOpen && draftSelections[pickerOpen] === team
                                        return (
                                            <TouchableOpacity
                                                key={team}
                                                style={[styles.teamRow, selected && styles.teamRowSelected]}
                                                onPress={() => pickerOpen && handleSelectTeam(pickerOpen, team)}
                                            >
                                                <View style={styles.teamRowLeft}>
                                                    <TeamCrest crest={null} name={team} size={22} />
                                                    <Text
                                                        style={[
                                                            styles.teamRowText,
                                                            selected && styles.teamRowTextSelected,
                                                        ]}
                                                    >
                                                        {team}
                                                    </Text>
                                                </View>
                                                {selected && <Text style={styles.checkmark}>✓</Text>}
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 48,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: colors.text,
        textAlign: "center",
        marginTop: 16,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        marginBottom: 24,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        marginBottom: 14,
    },
    cardClosed: {
        opacity: 0.7,
    },
    cardCorrect: {
        borderColor: colors.accent + "60",
    },
    summaryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 6,
    },
    summaryRowLabel: {
        color: colors.textSecondary,
        fontSize: 13,
    },
    summaryRowValue: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 1,
        marginLeft: 12,
    },
    summaryValueText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: "600",
        flexShrink: 1,
    },
    summaryPending: {
        color: colors.textSecondary,
        fontSize: 13,
        fontStyle: "italic",
    },
    summaryPointsWon: {
        color: colors.accent,
        fontSize: 15,
        fontWeight: "bold",
    },
    summaryPointsZero: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: "bold",
    },
    easterEggCard: {
        alignItems: "center",
    },
    easterEggText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontStyle: "italic",
        textAlign: "center",
        marginTop: 8,
        marginBottom: 14,
    },
    easterEggReveal: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 20,
        marginBottom: 12,
    },
    easterEggTeam: {
        alignItems: "center",
        gap: 6,
    },
    easterEggTeamName: {
        color: colors.accent,
        fontSize: 16,
        fontWeight: "bold",
    },
    easterEggHint: {
        color: colors.textSecondary,
        fontSize: 11,
        fontStyle: "italic",
    },
    totalCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.accent,
        paddingVertical: 20,
        alignItems: "center",
        marginTop: 8,
    },
    totalLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 2,
        marginBottom: 6,
    },
    totalValue: {
        color: colors.accent,
        fontSize: 36,
        fontWeight: "bold",
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    cardLabel: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "bold",
    },
    cardPoints: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: "bold",
    },
    deadline: {
        color: colors.textSecondary,
        fontSize: 12,
        marginBottom: 12,
    },
    closedBadge: {
        alignSelf: "flex-start",
        backgroundColor: colors.danger,
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginBottom: 10,
    },
    closedBadgeText: {
        color: colors.text,
        fontSize: 11,
        fontWeight: "600",
    },
    textInput: {
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: colors.text,
        marginBottom: 12,
    },
    inputDisabled: {
        opacity: 0.5,
    },
    scorerHint: {
        color: colors.textSecondary,
        fontSize: 12,
        marginBottom: 12,
        marginTop: -8,
    },
    pickerButton: {
        backgroundColor: colors.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    pickerText: {
        color: colors.text,
        fontSize: 15,
    },
    pickerPlaceholder: {
        color: colors.textSecondary,
    },
    pickerArrow: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    saveButton: {
        backgroundColor: colors.accent,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: "#0D0D0D",
        fontSize: 15,
        fontWeight: "bold",
    },
    readOnlyPick: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: "80%",
        paddingBottom: 32,
    },
    modalHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "bold",
    },
    modalClose: {
        color: colors.accent,
        fontSize: 16,
        fontWeight: "600",
    },
    groupSection: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    groupLabel: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
        marginBottom: 6,
    },
    teamRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 2,
    },
    teamRowSelected: {
        backgroundColor: colors.accent + "20",
    },
    teamRowText: {
        color: colors.text,
        fontSize: 15,
    },
    teamRowTextSelected: {
        color: colors.accent,
        fontWeight: "bold",
    },
    checkmark: {
        color: colors.accent,
        fontSize: 16,
        fontWeight: "bold",
    },
    pickerValueRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    teamRowLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
    },
    readOnlyRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        marginTop: 4,
    },
    readOnlyLabel: {
        color: colors.textSecondary,
        fontSize: 14,
    },
})
