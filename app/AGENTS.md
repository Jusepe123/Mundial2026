# Mundial 2026 — Documentación del Proyecto
> Última actualización: 28-jun-2026

## Stack Tecnológico

- **Frontend:** React Native + Expo SDK 52, TypeScript
- **Backend:** Supabase (PostgreSQL, Edge Functions, Realtime, RLS)
- **Estado:** Zustand
- **Data fetching:** TanStack React Query v5
- **Navegación:** React Navigation 7 (native-stack + bottom-tabs)
- **OTA Updates:** EAS Update (expo-updates + `useUpdates()` hook en App.tsx, canal `production` activo)

## Estructura del Proyecto

```
mundial-2026/
├── opencode.json                  # Configuración opencode + MCP Supabase
├── copa.jpg                       # Imagen original para el ícono de la app
├── app/                           # App React Native (Expo)
│   ├── App.tsx                    # Entry point: SafeArea → QueryClient (staleTime global 30s) → Navigation
│   ├── .env                       # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
│   ├── eas.json                   # Configuración EAS Build + Update
│   ├── assets/
│   │   ├── portada.jpg            # WelcomeScreen (gitignored, añadir localmente)
│   │   └── icon.png               # Ícono app (1024x1024)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── supabase.ts        # Cliente Supabase con SecureStore adapter
│   │   │   ├── deviceId.ts        # Genera/persiste UUID único del dispositivo
│   │   │   ├── flags.ts           # Mapa de 66 códigos de país, getFlagUrl/getAltFlagUrl, prefetchFlags con concurrencia 4
│   │   │   └── jersey-colors.ts   # Colores de camiseta para los 48 equipos + patrones SVG
│   │   ├── store/
│   │   │   └── usePlayerStore.ts  # Zustand: player, isLoading, setPlayer, clearPlayer, hydrate
│   │   ├── components/
│   │   │   ├── TeamCrest.tsx      # Círculo con bandera: crest → flagcdn/flagsapi → alt CDN → inicial
│   │   │   ├── MatchPicksTable.tsx # Tabla de pronósticos de todos los jugadores por partido
│   │   │   └── PlayerFigure.tsx   # SVG de jugador con camiseta (color/patrón) + número
│   │   ├── navigation/
│   │   │   └── AppNavigator.tsx   # Navegación + Splash + prefetchFlags tras hydrate
│   │   └── screens/
│   │       ├── WelcomeScreen.tsx  # Login/registro con username + device_id
│   │       ├── MatchListScreen.tsx# Partidos con segmentos, Realtime, sync adaptativo 30s/120s
│   │       ├── PickScreen.tsx     # Pronóstico por partido, invalida userPicks al guardar
│   │       ├── GroupsScreen.tsx   # Tabla de posiciones con DG/GC/GD + banderas
│   │       ├── SpecialPicksScreen.tsx # 6 categorías especiales
│   │       ├── TopScorersScreen.tsx   # Goleadores + equipos más goleadores
│   │       ├── MatchDetailScreen.tsx  # Detalle de partido individual
│   │       └── LeaderboardScreen.tsx  # Ranking + estadísticas + partido en vivo
│   └── package.json
└── supabase/
    ├── seed.sql
    ├── migrations/
    │   ├── 001_initial_schema.sql
    │   ├── 003_upsert_pick_rpc.sql
    │   ├── 004_upsert_special_pick_rpc.sql
    │   ├── 005_group_standings.sql
    │   ├── 006_group_standings_view.sql
    │   ├── 007_sync_device_id_rpc.sql
    │   ├── 008_scorers_table.sql
    │   ├── 009_scorers_shirt_number.sql
    │   ├── 010_round_of_32_and_new_scoring.sql
    │   ├── 011_penalty_columns.sql
    │   └── 20260614070205_fix_team_name_aliases.sql
    └── functions/
        ├── sync-matches/index.ts
        └── calculate-points/index.ts
```

## Arquitectura de Navegación

```
RootStack (sin header)
  ├── [isLoading=true] → SplashScreen
  ├── [player=null] → WelcomeScreen
└── [player≠null] → Home → BottomTabNavigator
        ├── "Partidos" ⚽ → MatchesStack
        │     ├── MatchList (segmentos "En vivo" / "Finalizados")
        │     ├── Pick (header "Pronóstico")
        │     └── MatchDetail
        ├── "Goleadores" ⚡ → TopScorersScreen
        ├── "Grupos" 🏆 → GroupsScreen
        ├── "Especiales" ⭐ → SpecialStack
        │     └── SpecialList
        └── "Ranking" 🏆 → RankingStack
              └── Leaderboard
```

## Optimizaciones de Performance

### staleTime global (App.tsx)
- `staleTime: 30_000` — React Query no refetch si datos tienen < 30s
- `gcTime: 600_000` (10 min) — datos persisten en cache al cambiar de tab
- `refetchOnWindowFocus: false` — no refetch al volver a la app

### Per-query overrides
| Query | staleTime | refetchInterval |
|-------|-----------|-----------------|
| matches | 30s (global) | — (solo Realtime + sync) |
| userPicks | 30s | — |
| match (single) | 60s | — |
| scoring_config | 300s (5 min) | — |
| group_standings | 15s | 30s |
| leaderboard | 10s | 15s |
| matchStats | 30s | — |
| currentMatch | 15s | — |

### Data fetching reducido
- **MatchListScreen**: eliminado `refetchInterval: 30s` en matches. Sync adaptativo: 30s si hay live, 120s si no (derivado de `liveMatchExists` del cache). Realtime subscription movida a AppNavigator.
- **LeaderboardScreen**: 3 queries de count reemplazadas por 1 query que trae solo `status`
- **PickScreen**: scoring_config se cachea 5 min (casi nunca cambia)

## Pull-to-Refresh y Doble Tap
- **Doble tap en tab** (AppNavigator.tsx): al presionar dos veces cualquier tab en menos de 300ms, invalida TODAS las queries (refresca toda la app).
- **Pull-to-refresh** en las 5 pantallas principales: cada una tiene `RefreshControl` que invalida las queries específicas de esa pantalla.

## Buscador en MatchListScreen
- `searchText` state + `TextInput` debajo del control segmentado.
- Filtra partidos por `home_team` o `away_team` (case-insensitive) dentro del segmento activo.
- Si no hay resultados, muestra "No se encontraron partidos para '[texto]'".
- Botón X para limpiar. El texto persiste al cambiar de segmento.

## Manejo de Penales
- **DB**: `home_penalties INT`, `away_penalties INT` en matches (migración 011).
- **sync-matches**: lee `score.penalties` de la API y los persiste.
- **calculate-points**: si hay penales, el ganador real es quien gana los penales. Exacts se compara contra score reglamentario. Ganador se compara contra el verdadero ganador.
- **UI**: se muestra como `1-1 (4-2 pen.)` en MatchListScreen, MatchPicksTable y PickScreen.
- El usuario pronostica solo el score reglamentario (sin cambios en PickScreen).

### Banderas (TeamCrest + flags.ts)
- `prefetchFlags()` se llama tras hydrate, con concurrencia limitada a 4 conexiones
- 3 niveles de fallback: crest → flag CDN → alt CDN → inicial dorada
- CDNs: `flagsapi.com` (ISO 2-letter) + `flagcdn.com` (todas, incluye subdivisiones)
- `onError` corrige atribución: crest vs flag vs altFlag sin reintentar URL rota
- **Module-level cache**: `resolvedUrlCache` (Map<string, string|null>) y `globalFailedUrls` (Set<string>) en flags.ts, compartidos entre todas las instancias de TeamCrest
- **Cache persiste entre tabs**: al volver a un tab, TeamCrest lee del cache y evita la cascada de fallbacks
- **England/Scotland**: usan `FLAG_OVERRIDES` con URLs explícitas de flagcdn + wikimedia. TeamCrest salta el crest (no funciona) y empieza desde flag CDN.
- **Prefetch populate**: `prefetchFlags()` mapea URLs → team names y pobla `resolvedUrlCache` solo para prefetches exitosos (`Image.prefetch()` retorna true)
- `resolvedUrlCache` y `globalFailedUrls` están declarados en `flags.ts` (module-level, exportados).
- `TeamCrest.tsx` los importa desde `flags.ts`. No redeclararlos en TeamCrest.


## LeaderboardScreen — Estructura

```
ListHeaderComponent:
  - Título "Ranking"
  - Podium (si torneo terminado)
  - Stats: "Jugados / Total"
  - Tarjeta del jugador actual
FlatList:
  - Lista de jugadores (posición, username, pts)
ListFooterComponent:
  - 🔴 Partido en vivo / 📋 Partido anterior (con tabla de pronósticos de todos)
  - 📊 Mis estadísticas (donut + aciertos/fallos + último partido)
```

### Partido en vivo / anterior
- Si hay partido **live** → tabla visible como "🔴 Partido en vivo" (puntos en "—")
- Si no hay live, pero el **próximo partido aún no empieza** → muestra último finalizado como "📋 Partido anterior" (con puntos)
- Si el próximo partido **ya empezó** → tabla oculta
- Si **no hay más partidos** → tabla oculta

### Estadísticas de jugador
- **Acierto**: resultado exacto O ganador/empate correcto (basado en scores reales, no en points_earned)
- **Fallo**: no acertó nada (participación sola no cuenta como acierto)
- **Último partido**: muestra equipos, pronóstico, resultado real y puntos (o "Sin pronóstico" si no participó)

## Esquema de Base de Datos (Supabase)

### Tablas

| Tabla | Columnas clave | Constraints |
|-------|---------------|-------------|
| `group_standings` | id, group_name, team_name, position | UNIQUE(group_name, team_name) |
| `players` | id, username, device_id, total_points, created_at | UNIQUE(username), UNIQUE(device_id) |
| `matches` | id, external_id, home_team, away_team, home_flag, away_flag, match_date, stage, home_score, away_score, home_penalties, away_penalties, status, picks_closed | UNIQUE(external_id) |
| `picks` | id, player_id, match_id, predicted_home, predicted_away, points_earned, created_at | FK players/matches, UNIQUE(player_id, match_id) |
| `special_picks` | id, player_id, category, prediction, points_earned, created_at | FK players, UNIQUE(player_id, category) |
| `scoring_config` | id, stage, exact_points, winner_points, participation_points, special_points, deadline, updated_at | UNIQUE(stage) |

### Vistas
- **leaderboard**: `SELECT id, username, total_points, RANK() OVER (ORDER BY total_points DESC) FROM players`
- **group_standings_view**: calcula posiciones desde matches finalizados con normalización de alias

### Scoring Config

| stage | exact | winner | participation | special | deadline |
|-------|-------|--------|---------------|---------|----------|
| group | 15 | 7 | 1 | — | — |
| round_of_32 | 18 | 9 | 1 | — | — |
| round_of_16 | 25 | 12 | 1 | — | — |
| quarter | 35 | 17 | 1 | — | — |
| semi | 50 | 25 | 1 | — | — |
| third_place | 30 | 15 | 1 | — | — |
| final | 75 | 35 | 1 | — | — |
| special_first | — | — | — | 50 | 2026-06-28T18:59Z |
| special_second | — | — | — | 30 | 2026-06-28T18:59Z |
| special_third | — | — | — | 20 | 2026-06-28T18:59Z |
| special_fourth | — | — | — | 15 | 2026-06-28T18:59Z |
| special_surprise | — | — | — | 25 | 2026-06-28T18:59Z |
| special_scorer | — | — | — | 35 | 2026-06-28T18:59Z |

### RPC Functions (SECURITY DEFINER)
- **upsert_pick**: verifica device_id + picks_closed (excepción si match cerrado o no existe), INSERT ON CONFLICT DO UPDATE
- **upsert_special_pick**: verifica device_id, INSERT ON CONFLICT DO UPDATE

## Edge Functions

### sync-matches
- Fetch football-data.org API, upsert en `matches`
- Normaliza alias de equipos (Czechia → Czech Republic, etc.)
- Lee `score.penalties.home/away` de la API y los guarda en `home_penalties`/`away_penalties`
- Trigger `calculate-points` si match cambió a finished o si el score cambió en un match ya finished
- **Selective sync**: filtra matches antes del upsert loop. Skip: already-finished con scores idénticos (incluyendo penales), far-future (>3h) si ya están en DB. Procesa: live, transitioning, score changes en finished, upcoming (<3h), matches no existentes en DB, y partidos donde DB tenga "Por definir" como equipo. Usa `SELECT external_id, status, home_score, away_score, home_penalties, away_penalties, home_team, away_team` inicial + `Map<external_id, MatchData>` para lookup O(1).
- **Bracket propagation**: Mapeo completo del torneo (ext_ids de API). Cuando un partido de knockout termina, avanza automáticamente el ganador al siguiente partido del bracket (y el perdedor de semifinal al 3er puesto). Usa `|| "Por definir"` (no `??`) para manejar strings vacíos de la API.
- **Cron job** (`pg_cron` + `pg_net`): `net.http_post` cada 2 min a sync-matches para sync incluso sin frontend abierto. Corre en paralelo al sync del frontend (idempotente, upsert onConflict).

### calculate-points
- Para cada pick: exacto → exact_points, ganador correcto → winner_points, participación → participation_points
- **Penales**: si `home_penalties` y `away_penalties` no son null, el ganador real es quien ganó los penales (no el score reglamentario). Exacto se compara contra score reglamentario; ganador se compara contra el verdadero ganador (penales si existen, reglamentario si no).
- Recalcula `players.total_points` como suma de `picks.points_earned` + `special_picks.points_earned` (Promise.all paralelo)

## Flujo de Autenticación

1. SplashScreen → `hydrate()`: lee `player_id` de SecureStore → fetch player
2. WelcomeScreen: username + device_id → busca/crea player
3. Home: Realtime subscription a `players` para puntos en vivo

## Problemas Conocidos

| Problema | Causa | Solución |
|----------|-------|----------|
| "0:00" en hora | `new Date("invalid").toLocaleTimeString()` | `formatTimeShort` valida con `!isNaN()` |
| Sync lento (~35s) | 104 matches, anon key | Selective sync salta matches ya terminados y lejanos |
| Pronóstico tapado | `lockedOverlay` tapa pickText | Pendiente: reemplazar overlay por badge |
| Sin validación server-side de picks_closed | RPC upsert_pick no chequea | Corregido: upsert_pick verifica picks_closed y lanza excepción |
| El header de la app no se actualiza con Leaderboard al cambiar de tab | Zustand no se resincroniza | Corregido: useEffect en Leaderboard sincroniza updatePoints |
| Score incorrecto de un partido ya finished por cambio en API externa | selective sync saltaba matches finished sin comparar scores | selective sync compara scores completos + penales; trigger `calculate-points` si cambia |

## Historial de Builds & Updates

| Fecha | Commit | Tipo | Notas |
|-------|--------|------|-------|
| 14-jun | `16012a5` | ✅ APK | Fix expo-asset version |
| 14-jun | `843385a` | ✅ APK | Icono copa.jpg, OTA channel production |
| 14-jun | `03c29db` | OTA | Safe area inset Samsung nav bar |
| 15-jun | `acaac58` | 🚀 OTA | staleTime global, prefetch flags, ranking reordenado, partido en vivo, fix banderas, stats corregidas |
| 15-jun | — | ✅ OTA (no publicado) | Sync adaptativo (30s/120s), selective sync en edge function, Realtime con event:UPDATE + currentMatch |
| 15-jun | — | ✅ OTA (no publicado) | Module-level URL cache (resolvedUrlCache), England/Scotland overrides, prefetch populate cache, skip crest fallback para ENG/SCO |
| 15-jun | — | ✅ OTA (no publicado) | calculate-points incluye special_picks en total; Zustand sync safety net en LeaderboardScreen |
| 15-jun | — | ✅ OTA (no publicado) | Server-side picks_closed validation en upsert_pick RPC; error handling en PickScreen |
| 15-jun | — | ✅ OTA (no publicado) | Server-side picks_closed validation en upsert_pick RPC; error handling en PickScreen |
| 15-jun | — | ✅ DB+SQL | pg_cron + pg_net cron job cada 2 min para sync-matches (funciona sin frontend) |
| 23-jun | — | ✅ DB, Edge Function, Código | round_of_32, nuevos puntajes, PlayerFigure, TopScorersScreen, splash negro, cleanup GitHub |
| 24-jun | — | 🚀 OTA + DB + Edge Function | Pull-to-refresh, doble tap en tab para refrescar, buscador de países en Partidos, deadline especiales → 28-jun 14:59, penales Opción A (home_penalties/away_penalties, scoring justo) |
| 27-jun | — | ✅ Edge Function + DB | Fix score Egypt 1-1 Iran (API devolvió 1-2 temporalmente); selective sync ahora detecta cambios de score en matches finished y re-triggera calculate-points |
| 28-jun | — | ✅ Edge Function + DB | Fix sync-matches: filter procesa partidos con "Por definir", bracket propagation automático (R32→R16→QF→SF→Final/3rd). Deadline especiales extendido a 18:59Z |

## Reglas para el Agente

- Antes de modificar cualquier archivo, leerlo completo.
- No cambiar interfaces TypeScript existentes sin avisar.
- Toda modificación a Edge Functions debe deployarse via Supabase MCP, no solo editarse localmente.
- Para publicar cambios de código: `cd app && eas update --branch production --message "..."`.
- No agregar dependencias npm sin confirmar con el usuario.
- Los alias de equipos (Czechia, Korea Republic, etc.) están en sync-matches y en la migración 20260614070205. Si se agrega un alias, actualizarlo en ambos lugares.
- El scoring_config nunca se edita desde código, solo desde Supabase dashboard o MCP.

**pg_cron job:** nombre `'sync-matches-every-2min'`, schedule `'*/2 * * * *'`  
Para verificar: `SELECT * FROM cron.job WHERE jobname = 'sync-matches-every-2min';`  
Para eliminar: `SELECT cron.unschedule('sync-matches-every-2min');`


## EAS Build & Update

```sh
# Build APK
cd app && eas build --platform android --profile preview

# Publicar OTA (sin rebuild)
cd app && eas update --branch production --message "descripción"
```

## Variables de Entorno

| Archivo | Variable |
|---------|----------|
| app/.env | EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY |
| secrets.env | API_FOOTBALL_KEY, SERVICE_ROLE_KEY |
| Edge Functions (dashboard) | SUPABASE_URL, SERVICE_ROLE_KEY, API_FOOTBALL_KEY |
| DB setting | app.service_role_key (para pg_cron → pg_net) |


APK anterior: `https://expo.dev/artifacts/eas/zLpiVmMT9Y-z40Puxg9MXwe_YTNqYwMefTsf7AlGOzo.apk`


## Cierre de sesion
Cada vez que se te inidique que cierres sesion deberas hacer lo siguiente, en el siguiente orden:
- Actualiza AGENTS.md con todos los cambios implementados
- Haz el commit a main al repositorio en git hub
- Haz el update de la aplicacion en expo