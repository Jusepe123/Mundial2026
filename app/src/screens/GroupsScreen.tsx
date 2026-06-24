import { useCallback, useMemo, useState } from "react"
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from "react-native"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import supabase from "../lib/supabase"
import TeamCrest from "../components/TeamCrest"
import { colors } from "../theme/colors"

interface Standing {
  group_name: string
  team_name: string
  played: number
  goals_scored: number
  goals_against: number
  points: number
  wins: number
  draws: number
  losses: number
}

const GROUP_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]

const LOCAL_GROUPS: Standing[] = [
  { group_name: "A", team_name: "Mexico", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "A", team_name: "South Korea", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "A", team_name: "Czech Republic", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "A", team_name: "South Africa", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "B", team_name: "Canada", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "B", team_name: "Switzerland", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "B", team_name: "Qatar", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "B", team_name: "Bosnia and Herzegovina", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "C", team_name: "Brazil", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "C", team_name: "Morocco", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "C", team_name: "Scotland", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "C", team_name: "Haiti", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "D", team_name: "United States", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "D", team_name: "Australia", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "D", team_name: "Turkey", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "D", team_name: "Paraguay", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "E", team_name: "Germany", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "E", team_name: "Curaçao", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "E", team_name: "Ivory Coast", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "E", team_name: "Ecuador", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "F", team_name: "Netherlands", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "F", team_name: "Japan", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "F", team_name: "Tunisia", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "F", team_name: "Sweden", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "G", team_name: "Belgium", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "G", team_name: "Egypt", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "G", team_name: "Iran", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "G", team_name: "New Zealand", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "H", team_name: "Spain", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "H", team_name: "Cape Verde", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "H", team_name: "Saudi Arabia", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "H", team_name: "Uruguay", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "I", team_name: "France", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "I", team_name: "Senegal", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "I", team_name: "Norway", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "I", team_name: "Iraq", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "J", team_name: "Argentina", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "J", team_name: "Algeria", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "J", team_name: "Austria", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "J", team_name: "Jordan", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "K", team_name: "Portugal", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "K", team_name: "Uzbekistan", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "K", team_name: "Colombia", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "K", team_name: "DR Congo", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "L", team_name: "England", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "L", team_name: "Croatia", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "L", team_name: "Ghana", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
  { group_name: "L", team_name: "Panama", played: 0, goals_scored: 0, goals_against: 0, points: 0, wins: 0, draws: 0, losses: 0 },
]

export default function GroupsScreen() {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: standings, isLoading } = useQuery({
    queryKey: ["group_standings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_standings_view")
        .select("*")
        .order("group_name", { ascending: true })
        .order("points", { ascending: false })
        .order("goals_scored", { ascending: false })
      return (data ?? []) as Standing[]
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  const grouped = useMemo(() => {
    const source = standings && standings.length > 0 ? standings : LOCAL_GROUPS
    const map: Record<string, Standing[]> = {}
    for (const s of source) {
      if (!map[s.group_name]) map[s.group_name] = []
      map[s.group_name].push(s)
    }
    return GROUP_ORDER.filter((g) => map[g]).map((g) => ({ group: g, teams: map[g] }))
  }, [standings])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries({ queryKey: ["group_standings"] })
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      {grouped.map(({ group, teams }) => {
        const leaderPoints = teams.length > 0 ? Math.max(...teams.map((t) => t.points)) : -1
        return (
          <View key={group} style={styles.card}>
            <Text style={styles.groupTitle}>Grupo {group}</Text>
            <View style={styles.separator} />
            <View style={styles.tableHeader}>
              <Text style={[styles.colNum, styles.headerText]}>#</Text>
              <Text style={[styles.colTeam, styles.headerText]}>Equipo</Text>
              <Text style={[styles.colSmall, styles.headerText]}>PJ</Text>
              <Text style={[styles.colSmall, styles.headerText]}>G</Text>
              <Text style={[styles.colSmall, styles.headerText]}>GC</Text>
              <Text style={[styles.colSmall, styles.headerText]}>DG</Text>
              <Text style={[styles.colPts, styles.headerText]}>PTS</Text>
            </View>
            {teams.map((team, idx) => {
              const isLeader = team.points === leaderPoints && leaderPoints > 0
              const gd = team.goals_scored - team.goals_against
              return (
                <View
                  key={team.team_name}
                  style={[styles.teamRow, isLeader && styles.leaderRow]}
                >
                  <Text style={[styles.colNum, styles.positionText]}>{idx + 1}</Text>
                  <View style={styles.colTeam}>
                    <TeamCrest crest={null} name={team.team_name} size={22} />
                    <Text style={styles.teamName} numberOfLines={1}>
                      {team.team_name}
                    </Text>
                  </View>
                  <Text style={[styles.colSmall, styles.valueText]}>{team.played}</Text>
                  <Text style={[styles.colSmall, styles.valueText]}>{team.goals_scored}</Text>
                  <Text style={[styles.colSmall, styles.valueText]}>{team.goals_against}</Text>
                  <Text style={[styles.colSmall, styles.valueText, gd > 0 && styles.gdPositive, gd < 0 && styles.gdNegative]}>{gd > 0 ? `+${gd}` : gd}</Text>
                  <Text style={[styles.colPts, styles.pointsText]}>{team.points}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
    </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerText: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },
  colNum: {
    width: 24,
    textAlign: "center",
  },
  colTeam: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 8,
  },
  colSmall: {
    width: 28,
    textAlign: "center",
  },
  colPts: {
    width: 40,
    textAlign: "center",
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leaderRow: {
    backgroundColor: "#1F2A0E",
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  positionText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  teamName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  valueText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  pointsText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "bold",
  },
  gdPositive: {
    color: "#4CAF50",
  },
  gdNegative: {
    color: colors.danger,
  },
})
