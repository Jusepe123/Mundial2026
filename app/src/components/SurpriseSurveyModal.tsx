import { useState, useMemo, useEffect } from "react"
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    FlatList,
    ActivityIndicator,
    StyleSheet,
} from "react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import getDeviceId from "../lib/deviceId"
import usePlayerStore from "../store/usePlayerStore"
import TeamCrest from "./TeamCrest"
import { TEAMS } from "../lib/teams"
import { colors } from "../theme/colors"

interface FinalMatchWindow {
    match_date: string
    status: string
    finished_at: string | null
}

// Voting window for "Selección sorpresa": opens at the final match's kickoff,
// closes 30 minutes after it finishes (open-ended while still in progress).
function isWindowOpen(finalMatch: FinalMatchWindow | null | undefined, now: number): boolean {
    if (!finalMatch) return false
    const kickoff = new Date(finalMatch.match_date).getTime()
    if (now < kickoff) return false
    if (finalMatch.status === "finished" && finalMatch.finished_at) {
        const closesAt = new Date(finalMatch.finished_at).getTime() + 30 * 60 * 1000
        return now <= closesAt
    }
    return true
}

export default function SurpriseSurveyModal() {
    const queryClient = useQueryClient()
    const player = usePlayerStore((s) => s.player)
    const [selected, setSelected] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [dismissed, setDismissed] = useState(false)
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
                .select("match_date, status, finished_at")
                .eq("stage", "final")
                .maybeSingle()
            return data as FinalMatchWindow | null
        },
        staleTime: 30_000,
        refetchInterval: 60_000,
    })

    const { data: existingSurprise, isLoading: loadingExisting } = useQuery({
        queryKey: ["special_picks_surprise", player?.id],
        queryFn: async () => {
            if (!player?.id) return null
            const { data } = await supabase
                .from("special_picks")
                .select("prediction")
                .eq("player_id", player.id)
                .eq("category", "surprise")
                .maybeSingle()
            return data
        },
        enabled: !!player?.id,
        staleTime: 30_000,
    })

    const windowOpen = useMemo(() => isWindowOpen(finalMatch, now), [finalMatch, now])

    const visible = !!player && windowOpen && !loadingExisting && !existingSurprise && !dismissed

    const handleSave = async () => {
        if (!player?.id || !selected) return
        setSaving(true)
        const device_id = await getDeviceId()
        const { error } = await supabase.rpc("upsert_special_pick", {
            p_player_id: player.id,
            p_category: "surprise",
            p_prediction: selected,
            p_device_id: device_id,
        })
        setSaving(false)
        if (!error) {
            queryClient.invalidateQueries({ queryKey: ["special_picks_surprise"] })
            queryClient.invalidateQueries({ queryKey: ["special_picks"] })
        }
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={() => setDismissed(true)}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>⭐ Selección Sorpresa</Text>
                        <TouchableOpacity onPress={() => setDismissed(true)}>
                            <Text style={styles.close}>Luego</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.subtitle}>
                        ¿Cuál fue la selección sorpresa del Mundial 2026?
                    </Text>
                    <FlatList
                        data={TEAMS}
                        keyExtractor={(g) => g.group}
                        style={styles.list}
                        renderItem={({ item: group }) => (
                            <View style={styles.groupSection}>
                                <Text style={styles.groupLabel}>Grupo {group.group}</Text>
                                {group.teams.map((team) => {
                                    const isSelected = selected === team
                                    return (
                                        <TouchableOpacity
                                            key={team}
                                            style={[styles.teamRow, isSelected && styles.teamRowSelected]}
                                            onPress={() => setSelected(team)}
                                        >
                                            <View style={styles.teamRowLeft}>
                                                <TeamCrest crest={null} name={team} size={22} />
                                                <Text
                                                    style={[
                                                        styles.teamRowText,
                                                        isSelected && styles.teamRowTextSelected,
                                                    ]}
                                                >
                                                    {team}
                                                </Text>
                                            </View>
                                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        )}
                    />
                    <TouchableOpacity
                        style={[styles.saveButton, (!selected || saving) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!selected || saving}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#0D0D0D" />
                        ) : (
                            <Text style={styles.saveButtonText}>Votar</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "flex-end",
    },
    container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: "85%",
        paddingBottom: 24,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: "bold",
    },
    close: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: "600",
    },
    subtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        textAlign: "center",
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    list: {
        maxHeight: 380,
    },
    groupSection: {
        paddingHorizontal: 16,
        paddingTop: 8,
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
    teamRowLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flex: 1,
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
    saveButton: {
        backgroundColor: colors.accent,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: "center",
        marginHorizontal: 16,
        marginTop: 16,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: "#0D0D0D",
        fontSize: 15,
        fontWeight: "bold",
    },
})
