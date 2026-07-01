import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from "react-native"
import { useQuery } from "@tanstack/react-query"
import { useRoute } from "@react-navigation/native"
import supabase from "../lib/supabase"
import usePlayerStore from "../store/usePlayerStore"
import MatchPicksTable from "../components/MatchPicksTable"
import { colors } from "../theme/colors"

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

export default function MatchDetailScreen() {
    const route = useRoute<any>()
    const { match_id } = route.params
    const player = usePlayerStore((s) => s.player)

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

    const { data: picks = [] } = useQuery({
        queryKey: ["currentPicks", match_id],
        queryFn: async () => {
            const { data } = await supabase
                .from("picks")
                .select("player_id, predicted_home, predicted_away, points_earned")
                .eq("match_id", match_id)
            return (data ?? []) as PickData[]
        },
        enabled: !!match_id,
        staleTime: 15_000,
    })

    const { data: players = [] } = useQuery({
        queryKey: ["leaderboard"],
        queryFn: async () => {
            const { data } = await supabase.from("leaderboard").select("id, username")
            return (data ?? []) as PlayerEntry[]
        },
        staleTime: 15_000,
    })

    if (matchLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        )
    }

    if (!match) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>Partido no encontrado</Text>
            </View>
        )
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <MatchPicksTable
                match={match}
                picks={picks}
                players={players}
                currentPlayerId={player?.id}
                title={match.status === "live" ? "🔴 Partido en vivo" : "📋 Partido finalizado"}
            />
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingTop: 16,
        paddingBottom: 32,
    },
    center: {
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
    },
    errorText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
})
