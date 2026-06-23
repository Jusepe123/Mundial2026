import { useState, useEffect, useMemo } from "react"
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
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
import { colors } from "../theme/colors"

interface ScoringConfig {
    stage: string
    special_points: number | null
    deadline: string | null
}

interface SpecialPick {
    category: string
    prediction: string
}

const TEAMS = [
    { group: "A", teams: ["Mexico", "South Korea", "Czech Republic", "South Africa"] },
    { group: "B", teams: ["Canada", "Switzerland", "Qatar", "Bosnia and Herzegovina"] },
    { group: "C", teams: ["Brazil", "Morocco", "Scotland", "Haiti"] },
    { group: "D", teams: ["United States", "Australia", "Turkey", "Paraguay"] },
    { group: "E", teams: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"] },
    { group: "F", teams: ["Netherlands", "Japan", "Tunisia", "Sweden"] },
    { group: "G", teams: ["Belgium", "Egypt", "Iran", "New Zealand"] },
    { group: "H", teams: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"] },
    { group: "I", teams: ["France", "Senegal", "Norway", "Iraq"] },
    { group: "J", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
    { group: "K", teams: ["Portugal", "Uzbekistan", "Colombia", "DR Congo"] },
    { group: "L", teams: ["England", "Croatia", "Ghana", "Panama"] },
]

const CATEGORIES = [
    { category: "first", label: "Campeón", pointsKey: "special_first" },
    { category: "second", label: "Subcampeón", pointsKey: "special_second" },
    { category: "third", label: "Tercer lugar", pointsKey: "special_third" },
    { category: "fourth", label: "Cuarto lugar", pointsKey: "special_fourth" },
    { category: "surprise", label: "Selección sorpresa", pointsKey: "special_surprise" },
    { category: "top_scorer", label: "Goleador", pointsKey: "special_scorer" },
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
                .select("category, prediction")
                .eq("player_id", player.id)
            return (data ?? []) as SpecialPick[]
        },
        enabled: !!player?.id,
    })

    const existingMap = useMemo(() => {
        const map: Record<string, string> = {}
        for (const p of existingPicks ?? []) {
            map[p.category] = p.prediction
        }
        return map
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

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
