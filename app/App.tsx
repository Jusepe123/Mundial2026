import "react-native-url-polyfill/auto"
import { StatusBar } from "expo-status-bar"
import { NavigationContainer } from "@react-navigation/native"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { useEffect } from "react"
import * as Updates from "expo-updates"
import AppNavigator from "./src/navigation/AppNavigator"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
        },
    },
})

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
