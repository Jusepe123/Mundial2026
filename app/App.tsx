import "react-native-url-polyfill/auto"
import { StatusBar } from "expo-status-bar"
import { NavigationContainer } from "@react-navigation/native"
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { useEffect } from "react"
import { AppState, AppStateStatus, Platform } from "react-native"
import * as Updates from "expo-updates"
import AppNavigator from "./src/navigation/AppNavigator"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            // Refetch stale queries when the app returns to foreground. Realtime
            // events missed while backgrounded (websocket dead) are lost forever,
            // so without this the app can show stale scores indefinitely.
            refetchOnWindowFocus: true,
        },
    },
})

// React Native has no "window focus" — wire it to AppState so foregrounding
// the app counts as focus for React Query.
function onAppStateChange(status: AppStateStatus) {
    if (Platform.OS !== "web") {
        focusManager.setFocused(status === "active")
    }
}

function UpdatesHandler() {
    const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates()

    useEffect(() => {
        if (isUpdatePending) {
            Updates.reloadAsync()
        }
    }, [isUpdatePending])

    useEffect(() => {
        if (isUpdateAvailable) {
            Updates.fetchUpdateAsync()
        }
    }, [isUpdateAvailable])

    return null
}

export default function App() {
    useEffect(() => {
        const subscription = AppState.addEventListener("change", onAppStateChange)
        return () => subscription.remove()
    }, [])

    return (
        <SafeAreaProvider>
            <QueryClientProvider client={queryClient}>
                <NavigationContainer>
                    <UpdatesHandler />
                    <AppNavigator />
                    <StatusBar style="light" />
                </NavigationContainer>
            </QueryClientProvider>
        </SafeAreaProvider>
    )
}
