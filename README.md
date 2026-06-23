# Mundial 2026 — App de Pronósticos

Aplicación móvil de pronósticos deportivos para el **Mundial FIFA 2026** (48 selecciones, 104 partidos). Desarrollada con **React Native (Expo)** + **Supabase**.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React Native, Expo SDK 52, TypeScript |
| Estado | Zustand |
| Data fetching | TanStack React Query v5 |
| Navegación | React Navigation 7 (native-stack + bottom-tabs) |
| Backend | Supabase (PostgreSQL, Edge Functions, Realtime, RLS) |
| OTA Updates | EAS Update (expo-updates) |

## Funcionalidades

- **Pronósticos por partido:** predicción de resultado exacto por cada partido del mundial
- **Pronósticos especiales:** 6 categorías (campeón, subcampeón, goleador, equipo sorpresa, etc.)
- **Tabla de posiciones:** grupos con puntos, DG, GC
- **Top goleadores:** ranking de goleadores con figura SVG del jugador y colores de camiseta
- **Ranking en vivo:** clasificación general de jugadores con estadísticas detalladas
- **Sincronización automática:** datos actualizados desde football-data.org cada 2 minutos vía cron

## Puntajes por etapa

| Etapa | Resultado exacto | Ganador correcto | Participación |
|-------|-----------------|-----------------|--------------|
| Fase de grupos | 15 pts | 7 pts | 1 pt |
| 16avos de final | 18 pts | 9 pts | 1 pt |
| Octavos de final | 25 pts | 12 pts | 1 pt |
| Cuartos de final | 35 pts | 17 pts | 1 pt |
| Semifinal | 50 pts | 25 pts | 1 pt |
| Tercer puesto | 30 pts | 15 pts | 1 pt |
| Final | 75 pts | 35 pts | 1 pt |

## Setup local

### Requisitos

- Node.js 18+
- npm
- Expo CLI (`npm install -g expo-cli`)
- Una cuenta en [Supabase](https://supabase.com)

### Instalación

```sh
git clone https://github.com/Jusepe123/Mundial2026.git
cd Mundial2026/app
npm install
```

### Variables de entorno

Crear `app/.env` en la raíz del proyecto app/:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

> La anon key es pública por diseño (segura para usar en cliente). Consíguela en Supabase Dashboard → **Settings → API → Project API keys**.

### Assets locales

El archivo `app/assets/portada.jpg` es una imagen personal (portada de la app) que no se incluye en el repositorio. Añade tu propia imagen con ese nombre y ruta.

### Iniciar

```sh
npx expo start
```

Escanea el código QR con Expo Go en tu dispositivo o presiona `a` para emulador Android.

## Base de datos

Las migraciones están en `supabase/migrations/`. Aplicarlas:

```sh
cd supabase
supabase link --project-ref tu-project-ref
supabase db push
```

## Edge Functions

- **sync-matches:** sincroniza partidos, goleadores y números de camiseta desde football-data.org
- **calculate-points:** recalcula puntos de todos los jugadores cuando un partido finaliza

### Deploy de funciones

```sh
cd supabase
supabase functions deploy sync-matches
supabase functions deploy calculate-points
```

## Building & Updates

```sh
# Build APK
cd app && eas build --platform android --profile preview

# Publicar OTA update (sin rebuild)
cd app && eas update --branch production --message "descripción"
```

## Estructura del proyecto

```
mundial-2026/
├── app/                          # App React Native
│   ├── App.tsx                   # Entry point
│   ├── app.json                  # Configuración Expo
│   ├── eas.json                  # EAS Build + Update
│   ├── assets/                   # Imágenes (portada.jpg se añade localmente)
│   └── src/
│       ├── components/           # Componentes reutilizables
│       ├── lib/                  # Utilidades (Supabase, flags, deviceId)
│       ├── navigation/           # Navegación (tabs + stacks)
│       ├── screens/              # Pantallas de la app
│       ├── store/                # Estado global (Zustand)
│       └── theme/                # Colores y estilos
├── supabase/
│   ├── migrations/               # Migraciones SQL
│   ├── functions/                # Edge Functions
│   └── seed.sql                  # Datos iniciales (scoring_config)
└── README.md
```

## Licencia

Uso privado — no redistribuir.
