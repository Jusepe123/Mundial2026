export interface JerseyConfig {
    primary: string
    secondary: string
    numberColor: string
    pattern?: "stripes" | "checkered"
}

export const JERSEY_COLORS: Record<string, JerseyConfig> = {
    Argentina:        { primary: "#75AADB", secondary: "#FFFFFF", numberColor: "#0D0D0D", pattern: "stripes" },
    Australia:        { primary: "#FCD116", secondary: "#006633", numberColor: "#006633" },
    Austria:          { primary: "#ED2939", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Belgium:          { primary: "#DA291C", secondary: "#FFC400", numberColor: "#FFFFFF" },
    "Bosnia and Herzegovina": { primary: "#003399", secondary: "#FFCC00", numberColor: "#FFFFFF" },
    Brazil:           { primary: "#FEDF00", secondary: "#009739", numberColor: "#009739" },
    Canada:           { primary: "#DA291C", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    "Cape Verde":     { primary: "#003399", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Colombia:         { primary: "#FCD116", secondary: "#003893", numberColor: "#003893" },
    Croatia:          { primary: "#DA291C", secondary: "#FFFFFF", numberColor: "#FFFFFF", pattern: "checkered" },
    Curaçao:          { primary: "#003399", secondary: "#FFCC00", numberColor: "#FFFFFF" },
    "Czech Republic": { primary: "#DA291C", secondary: "#11457E", numberColor: "#FFFFFF" },
    "DR Congo":       { primary: "#003399", secondary: "#DA291C", numberColor: "#FFFFFF" },
    Ecuador:          { primary: "#FCD116", secondary: "#003893", numberColor: "#003893" },
    Egypt:            { primary: "#DA291C", secondary: "#FFFFFF", numberColor: "#000000" },
    England:          { primary: "#FFFFFF", secondary: "#DA291C", numberColor: "#DA291C" },
    France:           { primary: "#002395", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Germany:          { primary: "#FFFFFF", secondary: "#000000", numberColor: "#000000" },
    Ghana:            { primary: "#CA2128", secondary: "#006B3F", numberColor: "#FFFFFF" },
    Haiti:            { primary: "#003399", secondary: "#DA291C", numberColor: "#FFFFFF" },
    Iran:             { primary: "#FFFFFF", secondary: "#239F40", numberColor: "#239F40" },
    Iraq:             { primary: "#FFFFFF", secondary: "#DA291C", numberColor: "#DA291C" },
    "Ivory Coast":    { primary: "#F77F00", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Japan:            { primary: "#003399", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Jordan:           { primary: "#FFFFFF", secondary: "#DA291C", numberColor: "#DA291C" },
    Mexico:           { primary: "#006847", secondary: "#DA291C", numberColor: "#FFFFFF" },
    Morocco:          { primary: "#DA291C", secondary: "#006847", numberColor: "#FFFFFF" },
    Netherlands:      { primary: "#FF6600", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    "New Zealand":    { primary: "#FFFFFF", secondary: "#000000", numberColor: "#000000" },
    Norway:           { primary: "#DA291C", secondary: "#003399", numberColor: "#FFFFFF" },
    Panama:           { primary: "#DA291C", secondary: "#003399", numberColor: "#FFFFFF" },
    Paraguay:         { primary: "#FFFFFF", secondary: "#DA291C", numberColor: "#DA291C" },
    Portugal:         { primary: "#DA291C", secondary: "#006633", numberColor: "#FFFFFF" },
    Qatar:            { primary: "#7A1A2E", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    "Saudi Arabia":   { primary: "#006847", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Scotland:         { primary: "#003366", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Senegal:          { primary: "#00853E", secondary: "#FCD116", numberColor: "#FFFFFF" },
    "South Africa":   { primary: "#FCD116", secondary: "#006847", numberColor: "#006847" },
    "South Korea":    { primary: "#DA291C", secondary: "#003399", numberColor: "#FFFFFF" },
    Spain:            { primary: "#C60B1E", secondary: "#FFC400", numberColor: "#FFFFFF" },
    Sweden:           { primary: "#FCD116", secondary: "#003399", numberColor: "#003399" },
    Switzerland:      { primary: "#DA291C", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    Tunisia:          { primary: "#FFFFFF", secondary: "#DA291C", numberColor: "#DA291C" },
    Turkey:           { primary: "#DA291C", secondary: "#FFFFFF", numberColor: "#FFFFFF" },
    "United States":  { primary: "#FFFFFF", secondary: "#003399", numberColor: "#003399" },
    Uruguay:          { primary: "#87CEEB", secondary: "#FFFFFF", numberColor: "#000000" },
    Uzbekistan:       { primary: "#FFFFFF", secondary: "#003399", numberColor: "#003399" },
}

export function getJerseyConfig(teamName: string): JerseyConfig | null {
    return JERSEY_COLORS[teamName] ?? null
}
