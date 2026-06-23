import * as SecureStore from "expo-secure-store"

function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
    })
}

export default async function getDeviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync("device_id")
    if (existing) return existing

    const newId = generateUUID()
    await SecureStore.setItemAsync("device_id", newId)
    return newId
}
