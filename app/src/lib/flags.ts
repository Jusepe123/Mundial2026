import { Image } from "react-native"

const COUNTRY_CODES: Record<string, string> = {
    Mexico: "mx",
    "South Korea": "kr",
    "Czech Republic": "cz",
    "South Africa": "za",
    Canada: "ca",
    Switzerland: "ch",
    Qatar: "qa",
    "Bosnia and Herzegovina": "ba",
    Brazil: "br",
    Morocco: "ma",
    Scotland: "gb-sct",
    Haiti: "ht",
    "United States": "us",
    USA: "us",
    Australia: "au",
    Turkey: "tr",
    Turkiye: "tr",
    Paraguay: "py",
    Germany: "de",
    Curaçao: "cw",
    Curacao: "cw",
    "Ivory Coast": "ci",
    "Côte d'Ivoire": "ci",
    Ecuador: "ec",
    Netherlands: "nl",
    Japan: "jp",
    Tunisia: "tn",
    Sweden: "se",
    Belgium: "be",
    Egypt: "eg",
    Iran: "ir",
    "New Zealand": "nz",
    Spain: "es",
    "Cape Verde": "cv",
    "Cape Verde Islands": "cv",
    "Saudi Arabia": "sa",
    Uruguay: "uy",
    France: "fr",
    Senegal: "sn",
    Norway: "no",
    Iraq: "iq",
    Argentina: "ar",
    Algeria: "dz",
    "DR Congo": "cd",
    Austria: "at",
    Jordan: "jo",
    Portugal: "pt",
    Uzbekistan: "uz",
    Colombia: "co",
    England: "gb-eng",
    Croatia: "hr",
    Ghana: "gh",
    Panama: "pa",
    "Korea Republic": "kr",
    "Korea, Republic of": "kr",
    Czechia: "cz",
    "Bosnia-Herzegovina": "ba",
    "Congo DR": "cd",
    Sénégal: "sn",
    "Cabo Verde": "cv",
}

function getCode(name: string): string | null {
    return COUNTRY_CODES[name] ?? COUNTRY_CODES[name.trim()] ?? null
}

export const resolvedUrlCache = new Map<string, string | null>()
export const globalFailedUrls = new Set<string>()

const FLAG_OVERRIDES: Record<string, { flag: string; altFlag: string }> = {
    England: {
        flag: "https://flagcdn.com/w80/gb-eng.png",
        altFlag: "https://upload.wikimedia.org/wikipedia/en/thumb/b/be/Flag_of_England.svg/800px-Flag_of_England.svg.png",
    },
    Scotland: {
        flag: "https://flagcdn.com/w80/gb-sct.png",
        altFlag: "https://upload.wikimedia.org/wikipedia/commons/1/10/Flag_of_Scotland.svg",
    },
}

export function getFlagUrl(name: string): string | null {
    const override = FLAG_OVERRIDES[name]
    if (override) return override.flag
    const code = getCode(name)
    if (!code) return null
    if (code.includes("-")) {
        return `https://flagcdn.com/w80/${code.toLowerCase()}.png`
    }
    return `https://flagsapi.com/${code.toUpperCase()}/flat/64.png`
}

export function getAltFlagUrl(name: string): string | null {
    const override = FLAG_OVERRIDES[name]
    if (override) return override.altFlag
    const code = getCode(name)
    if (!code) return null
    if (code.includes("-")) {
        const parent = code.split("-")[0]
        return `https://flagsapi.com/${parent.toUpperCase()}/flat/64.png`
    }
    return `https://flagcdn.com/w80/${code.toLowerCase()}.png`
}

export function getAllFlagUrls(): string[] {
    const urls: string[] = []
    const seen = new Set<string>()

    for (const override of Object.values(FLAG_OVERRIDES)) {
        if (!seen.has(override.flag)) {
            seen.add(override.flag)
            urls.push(override.flag)
        }
        if (!seen.has(override.altFlag)) {
            seen.add(override.altFlag)
            urls.push(override.altFlag)
        }
    }

    for (const code of Object.values(COUNTRY_CODES)) {
        if (seen.has(code)) continue
        seen.add(code)
        if (code.includes("-")) {
            urls.push(`https://flagcdn.com/w80/${code.toLowerCase()}.png`)
        } else {
            urls.push(`https://flagsapi.com/${code.toUpperCase()}/flat/64.png`)
            urls.push(`https://flagcdn.com/w80/${code.toLowerCase()}.png`)
        }
    }
    return urls
}

export async function prefetchFlags() {
    const urls = getAllFlagUrls()
    const concurrency = 4

    const urlToTeam = new Map<string, string>()
    for (const name of Object.keys(COUNTRY_CODES)) {
        const url = getFlagUrl(name)
        if (url) urlToTeam.set(url, name)
    }
    for (const name of Object.keys(FLAG_OVERRIDES)) {
        urlToTeam.set(FLAG_OVERRIDES[name].flag, name)
    }

    const results: boolean[] = []
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency)
        const batchResults = await Promise.all(batch.map((u) => Image.prefetch(u)))
        results.push(...batchResults)
    }

    for (let i = 0; i < urls.length; i++) {
        if (results[i]) {
            const teamName = urlToTeam.get(urls[i])
            if (teamName && !resolvedUrlCache.has(teamName)) {
                resolvedUrlCache.set(teamName, urls[i])
            }
        }
    }
}
