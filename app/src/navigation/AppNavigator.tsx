import { useCallback, useEffect, useRef } from "react"
import { View, Text, StyleSheet } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { Ionicons } from "@expo/vector-icons"
import { useQueryClient } from "@tanstack/react-query"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { colors } from "../theme/colors"
import supabase from "../lib/supabase"
import WelcomeScreen from "../screens/WelcomeScreen"
import MatchListScreen from "../screens/MatchListScreen"
import PickScreen from "../screens/PickScreen"
import MatchDetailScreen from "../screens/MatchDetailScreen"
import SpecialPicksScreen from "../screens/SpecialPicksScreen"
import LeaderboardScreen from "../screens/LeaderboardScreen"
import TopScorersScreen from "../screens/TopScorersScreen"
import GroupsScreen from "../screens/GroupsScreen"
import SurpriseSurveyModal from "../components/SurpriseSurveyModal"
import usePlayerStore from "../store/usePlayerStore"
import { prefetchFlags } from "../lib/flags"

const RootStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const MatchesStack = createNativeStackNavigator()
const SpecialStack = createNativeStackNavigator()
const RankingStack = createNativeStackNavigator()

function HeaderRight() {
    const player = usePlayerStore((s) => s.player)
    return (
        <Text style={styles.headerRightText}>
            {player?.username}  •  {player?.total_points} pts
        </Text>
    )
}

function MatchesNavigator() {
    return (
        <MatchesStack.Navigator>
            <MatchesStack.Screen
                name="MatchList"
                component={MatchListScreen}
                options={{ headerShown: false }}
            />
            <MatchesStack.Screen
                name="Pick"
                component={PickScreen}
                options={{
                    title: "Pronóstico",
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.accent,
                    headerTitleStyle: { fontWeight: "bold" },
                    headerRight: () => <HeaderRight />,
                }}
            />
            <MatchesStack.Screen
                name="MatchDetail"
                component={MatchDetailScreen}
                options={{
                    title: "Detalle del partido",
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.accent,
                    headerTitleStyle: { fontWeight: "bold" },
                }}
            />
        </MatchesStack.Navigator>
    )
}

function SpecialNavigator() {
    return (
        <SpecialStack.Navigator>
            <SpecialStack.Screen
                name="SpecialList"
                component={SpecialPicksScreen}
                options={{
                    title: "Predicciones Especiales",
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.accent,
                    headerTitleStyle: { fontWeight: "bold" },
                    headerRight: () => <HeaderRight />,
                }}
            />
        </SpecialStack.Navigator>
    )
}

function RankingNavigator() {
    return (
        <RankingStack.Navigator>
            <RankingStack.Screen
                name="Leaderboard"
                component={LeaderboardScreen}
                options={{
                    title: "Tabla de Posiciones",
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.accent,
                    headerTitleStyle: { fontWeight: "bold" },
                    headerRight: () => <HeaderRight />,
                }}
            />
        </RankingStack.Navigator>
    )
}

const tabIcons: Record<string, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap }> = {
    Inicio: { focused: "home", unfocused: "home-outline" },
    Partidos: { focused: "football", unfocused: "football-outline" },
    Goleadores: { focused: "flash", unfocused: "flash-outline" },
    Grupos: { focused: "grid", unfocused: "grid-outline" },
    Especiales: { focused: "star", unfocused: "star-outline" },
    Ranking: { focused: "trophy", unfocused: "trophy-outline" },
}

function MainNavigator() {
    const insets = useSafeAreaInsets()
    const player = usePlayerStore((s) => s.player)
    const updatePoints = usePlayerStore((s) => s.updatePoints)
    const queryClient = useQueryClient()
    const lastTabPress = useRef<Record<string, number>>({})

    // Double tap on a tab (<300ms between presses) refreshes the whole app.
    const makeDoubleTapListeners = useCallback(
        ({ route }: { route: { name: string } }) => ({
            tabPress: () => {
                const now = Date.now()
                const last = lastTabPress.current[route.name] ?? 0
                if (now - last < 300) {
                    queryClient.invalidateQueries()
                }
                lastTabPress.current[route.name] = now
            },
        }),
        [queryClient]
    )

    useEffect(() => {
        const channel = supabase
            .channel("matches-changes")
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "matches" },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["matches"] })
                    queryClient.invalidateQueries({ queryKey: ["currentMatch"] })
                    queryClient.invalidateQueries({ queryKey: ["scorers"] })
                    queryClient.invalidateQueries({ queryKey: ["finalMatchWindow"] })
                }
            )
            // SUBSCRIBED fires on the initial join and on every rejoin after a
            // disconnect. Events emitted while disconnected are never replayed,
            // so refetch on each (re)join to recover anything missed.
            .subscribe((status) => {
                if (status === "SUBSCRIBED") {
                    queryClient.invalidateQueries({ queryKey: ["matches"] })
                    queryClient.invalidateQueries({ queryKey: ["currentMatch"] })
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    useEffect(() => {
        if (!player?.id) return

        const channel = supabase
            .channel("player-points")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "players",
                    filter: `id=eq.${player.id}`,
                },
                (payload) => {
                    const newPoints = payload.new?.total_points
                    if (typeof newPoints === "number") {
                        updatePoints(newPoints)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [player?.id])

    return (
        <>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    tabBarIcon: ({ focused, color, size }) => {
                        const icons = tabIcons[route.name]
                        const iconName = focused ? icons.focused : icons.unfocused
                        return <Ionicons name={iconName} size={size} color={color} />
                    },
                    tabBarStyle: {
                        backgroundColor: colors.background,
                        borderTopColor: colors.border,
                        borderTopWidth: 1,
                        height: 60 + insets.bottom,
                        paddingBottom: 8 + insets.bottom,
                        paddingTop: 4,
                        elevation: 0,
                        shadowOpacity: 0,
                    },
                    tabBarActiveTintColor: colors.accent,
                    tabBarInactiveTintColor: colors.textSecondary,
                    headerShown: false,
                    tabBarLabelStyle: {
                        fontSize: 11,
                        fontWeight: "600",
                    },
                })}
            >
                <Tab.Screen
                    name="Partidos"
                    component={MatchesNavigator}
                    options={{ tabBarLabel: "Partidos" }}
                    listeners={makeDoubleTapListeners}
                />
                <Tab.Screen
                    name="Goleadores"
                    component={TopScorersScreen}
                    options={{ tabBarLabel: "Goleadores" }}
                    listeners={makeDoubleTapListeners}
                />
                <Tab.Screen
                    name="Grupos"
                    component={GroupsScreen}
                    options={{ tabBarLabel: "Grupos" }}
                    listeners={makeDoubleTapListeners}
                />
                <Tab.Screen
                    name="Especiales"
                    component={SpecialNavigator}
                    options={{ tabBarLabel: "Especiales" }}
                    listeners={makeDoubleTapListeners}
                />
                <Tab.Screen
                    name="Ranking"
                    component={RankingNavigator}
                    options={{ tabBarLabel: "Ranking" }}
                    listeners={makeDoubleTapListeners}
                />
            </Tab.Navigator>
            <SurpriseSurveyModal />
        </>
    )
}

function SplashScreen() {
    return (
        <View style={styles.splash}>
            <LinearGradient
                colors={["transparent", colors.background]}
                style={styles.splashOverlay}
                locations={[0.5, 1]}
            />
            <View style={styles.splashContent}>
                <Text style={styles.splashTitle}>MUNDIAL</Text>
                <Text style={styles.splashYear}>2026</Text>
            </View>
        </View>
    )
}

export default function AppNavigator() {
    const isLoading = usePlayerStore((s) => s.isLoading)
    const player = usePlayerStore((s) => s.player)
    const hydrate = usePlayerStore((s) => s.hydrate)

    useEffect(() => {
        hydrate()
    }, [])

    useEffect(() => {
        if (!isLoading) {
            prefetchFlags()
        }
    }, [isLoading])

    if (isLoading) {
        return <SplashScreen />
    }

    return (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {player ? (
                <RootStack.Screen name="Home" component={MainNavigator} />
            ) : (
                <RootStack.Screen name="Welcome" component={WelcomeScreen} />
            )}
        </RootStack.Navigator>
    )
}

const styles = StyleSheet.create({
    splash: {
        flex: 1,
        backgroundColor: colors.background,
    },
    splashOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    splashContent: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
    },
    splashTitle: {
        fontSize: 48,
        fontWeight: "900",
        color: colors.accent,
        letterSpacing: 8,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
    },
    splashYear: {
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
        letterSpacing: 12,
        marginTop: 4,
    },
    headerRightText: {
        color: colors.accent,
        fontSize: 13,
        fontWeight: "600",
    },
})
