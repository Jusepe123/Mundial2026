import { Fragment, useEffect, useMemo, useRef } from "react"
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { useQuery } from "@tanstack/react-query"
import { useNavigation } from "@react-navigation/native"
import supabase from "../lib/supabase"
import TeamCrest from "./TeamCrest"
import { colors } from "../theme/colors"

interface Match {
    id: string
    external_id: number
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
    venue: string | null
}

// Column order is bracket-adjacent: match j of a round is fed by matches 2j and
// 2j+1 of the previous round (mirrors KNOCKOUT_BRACKET in sync-matches).
const ROUNDS: { title: string; extIds: number[] }[] = [
    {
        title: "16avos",
        extIds: [
            537417, 537418, 537415, 537416, 537419, 537420, 537421, 537422,
            537423, 537424, 537425, 537426, 537427, 537428, 537429, 537430,
        ],
    },
    { title: "Octavos", extIds: [537376, 537375, 537379, 537380, 537377, 537378, 537381, 537382] },
    { title: "Cuartos", extIds: [537383, 537384, 537385, 537386] },
    { title: "Semis", extIds: [537387, 537388] },
    { title: "Final", extIds: [537390] },
]

const THIRD_PLACE_EXT_ID = 537389

const CARD_W = 152
const CARD_H = 64
const GAP = 14
const SLOT0 = CARD_H + GAP
const CONN_W = 18
const TITLE_H = 30

function winnerSide(m: Match): "home" | "away" | null {
    if (m.status !== "finished" || m.home_score === null || m.away_score === null) return null
    if (m.home_penalties != null && m.away_penalties != null) {
        return m.home_penalties > m.away_penalties ? "home" : "away"
    }
    if (m.home_score > m.away_score) return "home"
    if (m.away_score > m.home_score) return "away"
    return null
}

function TeamRow({ match, side }: { match: Match; side: "home" | "away" }) {
    const name = side === "home" ? match.home_team : match.away_team
    const crest = side === "home" ? match.home_flag : match.away_flag
    const score = side === "home" ? match.home_score : match.away_score
    const pens = side === "home" ? match.home_penalties : match.away_penalties
    const isPlaceholder = name === "Por definir"
    const winner = winnerSide(match)
    const isWinner = winner === side
    const isLoser = winner !== null && winner !== side
    const showScore = (match.status === "finished" || match.status === "live") && score !== null

    return (
        <View style={styles.teamRow}>
            {isPlaceholder ? (
                <View style={styles.placeholderCrest} />
            ) : (
                <TeamCrest crest={crest} name={name} size={16} />
            )}
            <Text
                style={[
                    styles.teamName,
                    isPlaceholder && styles.placeholderText,
                    isWinner && styles.winnerText,
                    isLoser && styles.loserText,
                ]}
                numberOfLines={1}
            >
                {isPlaceholder ? "Por definir" : name}
            </Text>
            {showScore && (
                <Text style={[styles.scoreText, isWinner && styles.winnerText, isLoser && styles.loserText]}>
                    {score}
                    {pens != null ? ` (${pens})` : ""}
                </Text>
            )}
        </View>
    )
}

function BracketCard({ match, onPress }: { match: Match | undefined; onPress?: () => void }) {
    if (!match) {
        return <View style={[styles.card, styles.emptyCard]} />
    }
    const isLive = match.status === "live"
    return (
        <TouchableOpacity
            style={[styles.card, isLive && styles.liveCard]}
            activeOpacity={onPress ? 0.7 : 1}
            onPress={onPress}
            disabled={!onPress}
        >
            {isLive && <View style={styles.liveDot} />}
            <TeamRow match={match} side="home" />
            <View style={styles.rowDivider} />
            <TeamRow match={match} side="away" />
        </TouchableOpacity>
    )
}

// Elbow connectors joining each feeder pair of the previous round to its match
// in the next one, drawn with plain borders.
function ConnectorColumn({ count, prevSlotH }: { count: number; prevSlotH: number }) {
    return (
        <View style={{ width: CONN_W, paddingTop: TITLE_H }}>
            {Array.from({ length: count }).map((_, i) => (
                <View key={i} style={{ height: prevSlotH * 2, justifyContent: "center" }}>
                    <View style={[styles.elbow, { height: prevSlotH }]} />
                    <View style={styles.stub} />
                </View>
            ))}
        </View>
    )
}

export default function BracketView() {
    const navigation = useNavigation<any>()
    const scrollRef = useRef<ScrollView>(null)
    const didAutoScroll = useRef(false)

    const { data: matches, isLoading } = useQuery({
        queryKey: ["matches"],
        queryFn: async () => {
            const { data } = await supabase
                .from("matches")
                .select("*")
                .order("match_date", { ascending: true })
            return (data ?? []) as Match[]
        },
    })

    const byExtId = useMemo(() => {
        const map = new Map<number, Match>()
        for (const m of matches ?? []) map.set(m.external_id, m)
        return map
    }, [matches])

    // Open on the current round: the first one that still has unfinished matches.
    useEffect(() => {
        if (!matches || didAutoScroll.current) return
        didAutoScroll.current = true
        const activeIdx = ROUNDS.findIndex((r) =>
            r.extIds.some((id) => byExtId.get(id)?.status !== "finished")
        )
        if (activeIdx > 0) {
            scrollRef.current?.scrollTo({ x: activeIdx * (CARD_W + CONN_W + 8), animated: false })
        }
    }, [matches, byExtId])

    const openMatch = (m: Match | undefined) => {
        if (!m || m.home_team === "Por definir" || m.away_team === "Por definir") return undefined
        if (m.status === "finished") {
            return () => navigation.navigate("Partidos", { screen: "MatchDetail", params: { match_id: m.id } })
        }
        if (m.status === "scheduled" && !m.picks_closed) {
            return () => navigation.navigate("Partidos", { screen: "Pick", params: { match_id: m.id } })
        }
        return undefined
    }

    if (isLoading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        )
    }

    const thirdPlace = byExtId.get(THIRD_PLACE_EXT_ID)

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bracketContent}
        >
            {ROUNDS.map((round, r) => {
                const slotH = SLOT0 * 2 ** r
                const isFinal = r === ROUNDS.length - 1
                return (
                    <Fragment key={round.title}>
                        {r > 0 && (
                            <ConnectorColumn count={round.extIds.length} prevSlotH={SLOT0 * 2 ** (r - 1)} />
                        )}
                        <View style={styles.column}>
                            <Text style={styles.roundTitle}>{round.title}</Text>
                            {round.extIds.map((extId) => {
                                const match = byExtId.get(extId)
                                return (
                                    <View key={extId} style={{ height: slotH, justifyContent: "center" }}>
                                        <BracketCard match={match} onPress={openMatch(match)} />
                                        {isFinal && (
                                            <View style={styles.thirdPlaceBlock}>
                                                <Text style={styles.thirdPlaceTitle}>3er puesto</Text>
                                                <BracketCard match={thirdPlace} onPress={openMatch(thirdPlace)} />
                                            </View>
                                        )}
                                    </View>
                                )
                            })}
                        </View>
                    </Fragment>
                )
            })}
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    loading: {
        paddingVertical: 60,
        alignItems: "center",
    },
    bracketContent: {
        paddingHorizontal: 4,
        paddingBottom: 16,
    },
    column: {
        width: CARD_W,
    },
    roundTitle: {
        height: TITLE_H,
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        textAlign: "center",
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 6,
        paddingHorizontal: 8,
        height: CARD_H,
        justifyContent: "center",
    },
    emptyCard: {
        opacity: 0.4,
    },
    liveCard: {
        borderColor: colors.danger,
    },
    liveDot: {
        position: "absolute",
        top: 5,
        right: 5,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.danger,
    },
    rowDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: 4,
    },
    teamRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    placeholderCrest: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: "dashed",
    },
    teamName: {
        flex: 1,
        color: colors.text,
        fontSize: 11,
        fontWeight: "600",
    },
    placeholderText: {
        color: colors.textSecondary,
        fontStyle: "italic",
        fontWeight: "400",
    },
    winnerText: {
        color: colors.accent,
        fontWeight: "bold",
    },
    loserText: {
        color: colors.textSecondary,
    },
    scoreText: {
        color: colors.text,
        fontSize: 12,
        fontWeight: "bold",
    },
    elbow: {
        width: CONN_W / 2,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderRightWidth: 1,
        borderColor: "#3A3A3A",
    },
    stub: {
        position: "absolute",
        right: 0,
        top: "50%",
        width: CONN_W / 2,
        height: 1,
        backgroundColor: "#3A3A3A",
    },
    thirdPlaceBlock: {
        marginTop: 28,
    },
    thirdPlaceTitle: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        textAlign: "center",
        marginBottom: 8,
    },
})
