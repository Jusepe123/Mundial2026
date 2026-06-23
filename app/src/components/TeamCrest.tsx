import { useState, useCallback, useMemo } from "react"
import { View, Text, Image, StyleSheet } from "react-native"
import { colors } from "../theme/colors"
import { getFlagUrl, getAltFlagUrl, resolvedUrlCache, globalFailedUrls } from "../lib/flags"

interface Props {
    crest: string | null
    name: string
    size?: number
}

const SKIP_CREST_TEAMS = new Set(["England", "Scotland"])

export default function TeamCrest({ crest, name, size = 32 }: Props) {
    const [crestFailed, setCrestFailed] = useState(SKIP_CREST_TEAMS.has(name))
    const [flagFailed, setFlagFailed] = useState(false)
    const [altFlagFailed, setAltFlagFailed] = useState(false)
    const fontSize = Math.round(size * 0.44)

    const cachedUrl = resolvedUrlCache.get(name)

    const isUsingCrest = !!crest && !crestFailed

    const flagUrl = useMemo(() => {
        if (globalFailedUrls.has(name)) return null
        return !altFlagFailed ? getFlagUrl(name) : getAltFlagUrl(name)
    }, [name, altFlagFailed])

    const sourceUrl = cachedUrl !== undefined
        ? cachedUrl
        : (isUsingCrest ? crest : (!flagFailed ? flagUrl : null))

    const onError = useCallback(() => {
        if (cachedUrl !== undefined) {
            resolvedUrlCache.set(name, null)
            return
        }
        if (isUsingCrest) {
            setCrestFailed(true)
        } else if (!flagFailed) {
            setFlagFailed(true)
        } else if (!altFlagFailed) {
            setAltFlagFailed(true)
        } else {
            globalFailedUrls.add(name)
            resolvedUrlCache.set(name, null)
        }
    }, [cachedUrl, isUsingCrest, flagFailed, altFlagFailed, name])

    const onLoad = useCallback(() => {
        if (sourceUrl && cachedUrl === undefined) {
            resolvedUrlCache.set(name, sourceUrl)
        }
    }, [sourceUrl, cachedUrl, name])

    if (!sourceUrl) {
        const initial = name.charAt(0).toUpperCase()
        return (
            <View
                style={[
                    styles.circle,
                    {
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: colors.accent,
                    },
                ]}
            >
                <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
            </View>
        )
    }

    return (
        <View
            style={[
                styles.circle,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    overflow: "hidden",
                    backgroundColor: colors.surface,
                },
            ]}
        >
            <Image
                source={{ uri: sourceUrl }}
                style={{ width: size, height: size }}
                resizeMode="cover"
                onError={onError}
                onLoad={onLoad}
            />
        </View>
    )
}

const styles = StyleSheet.create({
    circle: {
        justifyContent: "center",
        alignItems: "center",
    },
    initial: {
        color: "#000",
        fontWeight: "bold",
    },
})
