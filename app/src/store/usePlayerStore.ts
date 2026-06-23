import { create } from "zustand"
import * as SecureStore from "expo-secure-store"
import supabase from "../lib/supabase"
import getDeviceId from "../lib/deviceId"

export interface Player {
    id: string
    username: string
    total_points: number
}

interface PlayerStore {
    player: Player | null
    isLoading: boolean
    setPlayer: (player: Player) => void
    updatePoints: (points: number) => void
    clearPlayer: () => void
    hydrate: () => Promise<void>
}

const usePlayerStore = create<PlayerStore>((set, get) => ({
    player: null,
    isLoading: true,

    setPlayer: async (player) => {
        await SecureStore.setItemAsync("player_id", player.id)

        const device_id = await getDeviceId()
        await supabase.rpc("sync_device_id", { p_player_id: player.id, p_device_id: device_id })

        set({ player })
    },

    updatePoints: (points) => {
        const current = get().player
        if (current) {
            set({ player: { ...current, total_points: points } })
        }
    },

    clearPlayer: async () => {
        await SecureStore.deleteItemAsync("player_id")
        set({ player: null })
    },

    hydrate: async () => {
        try {
            const playerId = await SecureStore.getItemAsync("player_id")
            if (!playerId) {
                set({ isLoading: false })
                return
            }

            const { data, error } = await supabase
                .from("players")
                .select("id, username, total_points")
                .eq("id", playerId)
                .single()

            if (error || !data) {
                await SecureStore.deleteItemAsync("player_id")
                set({ isLoading: false })
                return
            }

            const device_id = await getDeviceId()
            await supabase.rpc("sync_device_id", { p_player_id: data.id, p_device_id: device_id })

            set({ player: data, isLoading: false })
        } catch {
            await SecureStore.deleteItemAsync("player_id")
            set({ isLoading: false })
        }
    },
}))

export default usePlayerStore
