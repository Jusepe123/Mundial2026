import { useState, useEffect } from "react"
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    Dimensions,
    Alert,
} from "react-native"
import * as SecureStore from "expo-secure-store"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import supabase from "../lib/supabase"
import getDeviceId from "../lib/deviceId"
import usePlayerStore from "../store/usePlayerStore"

const { width } = Dimensions.get("window")

const COVER_FALLBACK = require("../../assets/portada.jpg")

export default function WelcomeScreen() {
    const [username, setUsername] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [imageError, setImageError] = useState(false)
    const setPlayer = usePlayerStore((s) => s.setPlayer)

    useEffect(() => {
        SecureStore.getItemAsync("last_username").then((saved) => {
            if (saved) setUsername(saved)
        })
    }, [])

    const createAccount = async (trimmed: string) => {
        try {
            const device_id = await getDeviceId()

            const { data: newPlayer, error: insertError } = await supabase
                .from("players")
                .insert({ username: trimmed, device_id, total_points: 0 })
                .select("id, username, total_points")
                .single()

            if (insertError || !newPlayer) {
                throw new Error(insertError?.message ?? "Error al crear jugador")
            }

            await SecureStore.setItemAsync("last_username", trimmed)
            setPlayer({
                id: newPlayer.id,
                username: newPlayer.username,
                total_points: newPlayer.total_points,
            })
        } catch (err: any) {
            setError(err.message || "Ocurrió un error")
            setLoading(false)
        }
    }

    const reclaimAccount = async (player: { id: string; username: string; total_points: number }) => {
        try {
            await SecureStore.setItemAsync("last_username", player.username)
            setPlayer({
                id: player.id,
                username: player.username,
                total_points: player.total_points,
            })
        } catch (err: any) {
            setError(err.message || "Error al recuperar la cuenta")
            setLoading(false)
        }
    }

    const handleEnter = async () => {
        setError("")

        const trimmed = username.trim()
        if (!trimmed || trimmed.length < 2) {
            setError("El nombre debe tener al menos 2 caracteres")
            return
        }

        setLoading(true)

        try {
            const device_id = await getDeviceId()

            const { data: existingPlayer, error: fetchError } = await supabase
                .from("players")
                .select("id, username, device_id, total_points")
                .eq("username", trimmed)
                .single()

            if (fetchError && fetchError.code !== "PGRST116") {
                throw new Error(fetchError.message)
            }

            if (!existingPlayer) {
                Alert.alert(
                    "Registrar usuario",
                    `No encontramos a "${trimmed}". ¿Querés crear una cuenta nueva?`,
                    [
                        {
                            text: "Cancelar",
                            style: "cancel",
                            onPress: () => setLoading(false),
                        },
                        {
                            text: "Crear cuenta",
                            onPress: () => createAccount(trimmed),
                        },
                    ]
                )
                return
            }

            if (existingPlayer.device_id === device_id) {
                await SecureStore.setItemAsync("last_username", trimmed)
                setPlayer({
                    id: existingPlayer.id,
                    username: existingPlayer.username,
                    total_points: existingPlayer.total_points,
                })
            } else {
                Alert.alert(
                    "Recuperar cuenta",
                    `"${trimmed}" ya existe en otro dispositivo. ¿Querés usar esta cuenta en este dispositivo?`,
                    [
                        {
                            text: "Cancelar",
                            style: "cancel",
                            onPress: () => setLoading(false),
                        },
                        {
                            text: "Sí, soy yo",
                            onPress: () => reclaimAccount(existingPlayer),
                        },
                    ]
                )
            }
        } catch (err: any) {
            setError(err.message || "Ocurrió un error")
            setLoading(false)
        }
    }

     return (
        <View style={styles.container}>
            <View style={styles.heroContainer}>
                {imageError ? (
                    <View style={[styles.heroImage, styles.heroFallback]} />
                ) : (
                    <Image
                        source={COVER_FALLBACK}
                        style={styles.heroImage}
                        resizeMode="cover"
                        onError={() => setImageError(true)}
                    />
                )}
                <LinearGradient
                    colors={["transparent", "#0D0D0D"]}
                    style={styles.heroOverlay}
                    locations={[0.6, 1]}
                />
                <View style={styles.heroTextContainer}>
                    <Text style={styles.heroTitle}>Mundial 2026</Text>
                    <Text style={styles.heroSubtitle}>Predicciones familiares</Text>
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.cardWrapper}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <View style={styles.card}>
                    <View style={styles.trophyIconContainer}>
                        <Ionicons name="trophy" size={36} color="#C8FF00" />
                    </View>
                    <Text style={styles.cardTitle}>¿Quién eres?</Text>
                    <Text style={styles.cardSubtitle}>
                        Ingresa tu nombre para unirte al torneo
                    </Text>

                    <View style={styles.inputContainer}>
                        <Ionicons
                            name="person-outline"
                            size={20}
                            color="#9A9A9A"
                            style={styles.inputIcon}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Tu nombre"
                            placeholderTextColor="#9A9A9A"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="words"
                            maxLength={30}
                        />
                    </View>

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {loading ? (
                        <ActivityIndicator size="large" color="#C8FF00" />
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleEnter}>
                            <Text style={styles.buttonText}>Entrar al torneo</Text>
                            <Ionicons
                                name="arrow-forward"
                                size={20}
                                color="#0D0D0D"
                                style={styles.buttonIcon}
                            />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.footerText}>
                    ⚽ 104 partidos • 48 selecciones • 1 campeón
                </Text>
            </KeyboardAvoidingView>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0D0D0D",
    },
    heroContainer: {
        width: width,
        height: Dimensions.get("window").height * 0.45,
    },
    heroImage: {
        width: "100%",
        height: "100%",
    },
    heroFallback: {
        backgroundColor: "#2A2A2A", // A darker fallback
        opacity: 0.8,
    },
    heroOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    heroTextContainer: {
        position: "absolute",
        bottom: 20,
        left: 28,
    },
    heroTitle: {
        fontSize: 32,
        fontWeight: "bold",
        color: "white",
        textShadowColor: "rgba(0, 0, 0, 0.75)",
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    heroSubtitle: {
        fontSize: 14,
        color: "#9A9A9A",
        marginTop: 4,
    },
    cardWrapper: {
        flex: 1,
        marginTop: -Dimensions.get("window").height * 0.05,
        zIndex: 1,
    },
    card: {
        backgroundColor: "#1A1A1A",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 28,
        flex: 1,
    },
    trophyIconContainer: {
        alignSelf: "center",
        backgroundColor: "#2A2A2A",
        borderRadius: 32, // half of 64px diameter
        width: 64,
        height: 64,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "white",
        textAlign: "center",
        marginTop: 16,
    },
    cardSubtitle: {
        fontSize: 13,
        color: "#9A9A9A",
        textAlign: "center",
        marginTop: 4,
        marginBottom: 24,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#242424",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#2A2A2A",
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginTop: 24,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "white",
        paddingVertical: 0, // Reset default vertical padding
    },
    error: {
        color: "red", // Keeping red for error for now, can be changed to a custom danger color
        textAlign: "center",
        marginTop: 12,
    },
    button: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#C8FF00",
        borderRadius: 14,
        paddingVertical: 16,
        marginTop: 12,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#0D0D0D",
        marginRight: 8,
    },
    buttonIcon: {
        marginLeft: 8,
    },
    footerText: {
        color: "#9A9A9A",
        fontSize: 12,
        textAlign: "center",
        marginTop: 20,
        marginBottom: 20,
    },
})
