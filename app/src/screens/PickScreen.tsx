import { useEffect, useState } from "react"
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import getDeviceId from "../lib/deviceId"
import usePlayerStore from "../store/usePlayerStore"
import TeamCrest from "../components/TeamCrest"
import { colors } from "../theme/colors"

interface Match {
    id: string
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
}

interface UserPick {
    id: string
    predicted_home: number
    predicted_away: number
}

interface ScoringConfig {
    exact_points: number | null
    winner_points: number | null
    participation_points: number | null
}

function formatDateTime(dateStr: string): string {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function PickScreen({ route, navigation }: any) {
    const { match_id } = route.params
    const player = usePlayerStore((s) => s.player)
    const queryClient = useQueryClient()

    const [homeScore, setHomeScore] = useState("")
    const [awayScore, setAwayScore] = useState("")
    const [saving, setSaving] = useState(false)

    const { data: match, isLoading: matchLoading } = useQuery({
        queryKey: ["match", match_id],
        queryFn: async () => {
            const { data } = await supabase
                .from("matches")
                .select("*")
                .eq("id", match_id)
                .single()
            return data as Match
        },
        staleTime: 60_000,
    })

    const { data: existingPick } = useQuery({
        queryKey: ["pick", match_id, player?.id],
        queryFn: async () => {
            if (!player?.id) return null
            const { data } = await supabase
                .from("picks")
                .select("id, predicted_home, predicted_away")
                .eq("match_id", match_id)
                .eq("player_id", player.id)
                .single()
            return data as UserPick | null
        },
        enabled: !!player?.id,
        staleTime: 60_000,
    })

    const { data: scoring } = useQuery({
        queryKey: ["scoring", match?.stage],
        queryFn: async () => {
            if (!match?.stage) return null
            const { data } = await supabase
                .from("scoring_config")
                .select("exact_points, winner_points, participation_points")
                .eq("stage", match.stage)
                .single()
            return data as ScoringConfig | null
        },
        enabled: !!match?.stage,
        staleTime: 300_000,
    })

    useEffect(() => {
        if (existingPick) {
            setHomeScore(String(existingPick.predicted_home))
            setAwayScore(String(existingPick.predicted_away))
        }
    }, [existingPick])

    const isClosed = match?.picks_closed === true
    const isFinished = match?.status === "finished"

    const handleSave = async () => {
        if (!player?.id || !match) return

        const h = parseInt(homeScore, 10)
        const a = parseInt(awayScore, 10)

        if (isNaN(h) || isNaN(a)) {
            Alert.alert("Error", "Ingresa el marcador para ambos equipos")
            return
        }

        setSaving(true)

        const device_id = await getDeviceId()
        const { error } = await supabase.rpc("upsert_pick", {
            p_player_id: player.id,
            p_match_id: match.id,
            p_predicted_home: h,
            p_predicted_away: a,
            p_device_id: device_id,
        })

        setSaving(false)

        if (error) {
            if (error.message?.includes("picks_closed")) {
                queryClient.invalidateQueries({ queryKey: ["match", match.id] })
                Alert.alert("Pronóstico cerrado", "Este partido ya cerró para pronósticos")
                return
            }
            Alert.alert("Error", error.message)
            return
        }

        queryClient.invalidateQueries({ queryKey: ["userPicks"] })
        queryClient.invalidateQueries({ queryKey: ["pick", match_id, player?.id] })

        Alert.alert("¡Pronóstico guardado!", "", [
            { text: "OK", onPress: () => navigation.goBack() },
        ])
    }

    if (matchLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        )
    }

    if (!match) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Partido no encontrado</Text>
            </View>
        )
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <View style={styles.teamCol}>
                        <TeamCrest crest={match.home_flag} name={match.home_team} size={64} />
                        <Text style={styles.teamNameHeader}>{match.home_team}</Text>
                    </View>
                    <Text style={styles.vsLarge}>VS</Text>
                    <View style={styles.teamCol}>
                        <TeamCrest crest={match.away_flag} name={match.away_team} size={64} />
                        <Text style={styles.teamNameHeader}>{match.away_team}</Text>
                    </View>
                </View>
                <Text style={styles.dateText}>{formatDateTime(match.match_date)}</Text>

                {isClosed && (
                    <View style={styles.closedBanner}>
                        <Text style={styles.closedBannerText}>
                            {isFinished
                                ? "El partido ya finalizó"
                                : "Este partido ya cerró para pronósticos"}
                        </Text>
                    </View>
                )}

                {isFinished && match.home_score !== null && match.away_score !== null && (
                    <View style={styles.finalScoreRow}>
                        <Text style={styles.finalScoreText}>
                            {match.home_score} - {match.away_score}
                        </Text>
                        {match.home_penalties != null && match.away_penalties != null && (
                            <Text style={styles.finalPenaltyText}>
                                ({match.home_penalties}-{match.away_penalties} pen.)
                            </Text>
                        )}
                        <Text style={styles.finalScoreLabel}>Resultado final</Text>
                    </View>
                )}

                {!isClosed && !isFinished && (
                    <>
                        <Text style={styles.sectionTitle}>Tu pronóstico</Text>
                        <View style={styles.inputRow}>
                            <View style={styles.inputCol}>
                                <TextInput
                                    style={styles.scoreInput}
                                    value={homeScore}
                                    onChangeText={(t) => setHomeScore(t.replace(/[^0-9]/g, "").slice(0, 1))}
                                    keyboardType="numeric"
                                    maxLength={1}
                                    selectTextOnFocus
                                />
                            </View>
                            <Text style={styles.dash}>-</Text>
                            <View style={styles.inputCol}>
                                <TextInput
                                    style={styles.scoreInput}
                                    value={awayScore}
                                    onChangeText={(t) => setAwayScore(t.replace(/[^0-9]/g, "").slice(0, 1))}
                                    keyboardType="numeric"
                                    maxLength={1}
                                    selectTextOnFocus
                                />
                            </View>
                        </View>

                        {existingPick && (
                            <Text style={styles.savedNotice}>Pronóstico guardado ✓</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#0D0D0D" />
                            ) : (
                                <Text style={styles.saveButtonText}>
                                    {existingPick ? "Actualizar pronóstico" : "Confirmar pronóstico"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                {isClosed && existingPick && (
                    <View style={styles.readOnlyPick}>
                        <Text style={styles.sectionTitle}>Tu pronóstico</Text>
                        <Text style={styles.readOnlyScore}>
                            {existingPick.predicted_home} - {existingPick.predicted_away}
                        </Text>
                    </View>
                )}

                <View style={styles.scoringCard}>
                    <Text style={styles.scoringTitle}>Puntos posibles</Text>
                    <View style={styles.scoringRow}>
                        <Text style={styles.scoringIcon}>🥇</Text>
                        <Text style={styles.scoringLabel}>Resultado exacto</Text>
                        <Text style={styles.scoringValue}>{scoring?.exact_points ?? "—"} pts</Text>
                    </View>
                    <View style={styles.scoringRow}>
                        <Text style={styles.scoringIcon}>✅</Text>
                        <Text style={styles.scoringLabel}>Ganador correcto</Text>
                        <Text style={styles.scoringValue}>{scoring?.winner_points ?? "—"} pts</Text>
                    </View>
                    <View style={styles.scoringRow}>
                        <Text style={styles.scoringIcon}>📝</Text>
                        <Text style={styles.scoringLabel}>Participación</Text>
                        <Text style={styles.scoringValue}>{scoring?.participation_points ?? "—"} pts</Text>
                    </View>
                    <View style={styles.scoringRow}>
                        <Text style={styles.scoringIcon}>❌</Text>
                        <Text style={styles.scoringLabel}>Sin pronóstico</Text>
                        <Text style={styles.scoringValue}>0 pts</Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 48,
    },
    errorText: {
        color: colors.text,
        fontSize: 16,
        textAlign: "center",
        marginTop: 40,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 20,
    },
    teamCol: {
        flex: 1,
        alignItems: "center",
        gap: 8,
    },
    teamNameHeader: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
    },
    vsLarge: {
        color: colors.textSecondary,
        fontSize: 20,
        fontWeight: "bold",
        marginHorizontal: 16,
    },
    dateText: {
        color: colors.textSecondary,
        fontSize: 13,
        textAlign: "center",
        marginTop: 12,
        textTransform: "capitalize",
    },
    closedBanner: {
        backgroundColor: colors.border,
        borderRadius: 10,
        padding: 12,
        marginTop: 20,
        alignItems: "center",
    },
    closedBannerText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "600",
    },
    finalScoreRow: {
        alignItems: "center",
        marginTop: 24,
    },
    finalScoreText: {
        color: colors.text,
        fontSize: 36,
        fontWeight: "bold",
    },
    finalScoreLabel: {
        color: colors.textSecondary,
        fontSize: 13,
        marginTop: 4,
    },
    finalPenaltyText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "600",
        marginTop: 2,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "bold",
        textAlign: "center",
        marginTop: 28,
        marginBottom: 16,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    inputCol: {
        alignItems: "center",
    },
    scoreInput: {
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.accent,
        borderRadius: 16,
        width: 80,
        height: 80,
        fontSize: 32,
        fontWeight: "bold",
        color: colors.text,
        textAlign: "center",
    },
    dash: {
        color: colors.accent,
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 20,
    },
    savedNotice: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
        marginTop: 12,
    },
    saveButton: {
        backgroundColor: colors.accent,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: "center",
        marginTop: 20,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: "#0D0D0D",
        fontSize: 18,
        fontWeight: "bold",
    },
    readOnlyPick: {
        alignItems: "center",
        marginTop: 12,
    },
    readOnlyScore: {
        color: colors.accent,
        fontSize: 40,
        fontWeight: "bold",
    },
    scoringCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 20,
        marginTop: 32,
    },
    scoringTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 16,
    },
    scoringRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    scoringIcon: {
        fontSize: 16,
        marginRight: 10,
    },
    scoringLabel: {
        color: colors.textSecondary,
        fontSize: 14,
        flex: 1,
    },
    scoringValue: {
        color: colors.accent,
        fontSize: 14,
        fontWeight: "bold",
    },
})
