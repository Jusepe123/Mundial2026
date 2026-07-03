# Mundial 2026 — Documentación del Proyecto
> Última actualización: 03-jul-2026

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
│   │   │   ├── jersey-colors.ts   # Colores de camiseta para los 48 equipos + patrones SVG
│   │   │   └── teams.ts           # Lista de 48 equipos por grupo (compartida por SpecialPicksScreen y SurpriseSurveyModal)
│   │   ├── store/
│   │   │   └── usePlayerStore.ts  # Zustand: player, isLoading, setPlayer, clearPlayer, hydrate
│   │   ├── components/
│   │   │   ├── TeamCrest.tsx      # Círculo con bandera: crest → flagcdn/flagsapi → alt CDN → inicial
│   │   │   ├── MatchPicksTable.tsx # Tabla de pronósticos de todos los jugadores por partido
│   │   │   ├── BracketView.tsx    # Llaves knockout: columnas 16avos→Final con conectores, scroll horizontal
│   │   │   ├── PlayerFigure.tsx   # SVG de jugador con camiseta (color/patrón) + número
│   │   │   └── SurpriseSurveyModal.tsx # Popup "Selección sorpresa": se muestra sola durante la ventana de voto, montada globalmente
│   │   ├── navigation/
│   │   │   └── AppNavigator.tsx   # Navegación + Splash + prefetchFlags tras hydrate + SurpriseSurveyModal montado a nivel de app
│   │   └── screens/
│   │       ├── WelcomeScreen.tsx  # Login/registro con username + device_id
│   │       ├── MatchListScreen.tsx# Partidos con segmentos, Realtime, sync-matches una vez al montar
│   │       ├── PickScreen.tsx     # Pronóstico por partido, invalida userPicks al guardar
│   │       ├── GroupsScreen.tsx   # Segmentos "Llaves" (BracketView, default) / "Grupos" (tabla posiciones)
│   │       ├── SpecialPicksScreen.tsx # 5 categorías especiales (sin "surprise", ver SurpriseSurveyModal)
│   │       ├── TopScorersScreen.tsx   # Goleadores + equipos más goleadores
│   │       ├── MatchDetailScreen.tsx  # Detalle de partido individual
│   │       └── LeaderboardScreen.tsx  # Ranking + estadísticas + partido en vivo + podio final
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
    │   ├── 012_venue_column.sql
    │   ├── 20260614070205_fix_team_name_aliases.sql
    │   ├── 20260701000000_group_standings_gd_tiebreak.sql
    │   └── 20260703180740_special_scoring_and_survey.sql
    └── functions/
        ├── sync-matches/index.ts
        ├── calculate-points/index.ts
        └── calculate-special-points/index.ts
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
- `refetchOnWindowFocus: true` + `focusManager` cableado a `AppState` — al volver la app a foreground se refetchean las queries stale. Crítico: los eventos Realtime perdidos mientras la app está en background NO se re-emiten, así que sin esto la app mostraba scores viejos indefinidamente (bug del 2-2 fantasma en Portugal 2-1 Croatia).

### Per-query overrides
| Query | staleTime | refetchInterval |
|-------|-----------|-----------------|
| matches | 30s (global) | 30s si hay partido live, 60s si hay partido a <2h, si no — (Realtime) |
| userPicks | 30s | — |
| match (single) | 60s | — |
| scoring_config | 300s (5 min) | — |
| group_standings | 15s | 30s |
| leaderboard | 10s | 15s |
| matchStats | 30s | — |
| currentMatch | 15s | — |

### Data fetching reducido
- **MatchListScreen**: `sync-matches` se invoca una sola vez al montar la pantalla (antes había un timer de 30s/120s por dispositivo, redundante con el pg_cron cada 2 min y con riesgo de agotar el rate limit de football-data.org al escalar N dispositivos). Actualizaciones en vivo llegan por Realtime subscription (AppNavigator), alimentada por el pg_cron. Como red de seguridad (Realtime puede caerse silenciosamente), la query `matches` tiene un `refetchInterval` condicional que pollea **solo la DB de Supabase** (no football-data.org): 30s si hay partido live, 60s si el próximo partido está a <2h, apagado el resto del tiempo.
- **Resiliencia Realtime (AppNavigator)**: el `.subscribe()` del canal `matches-changes` tiene callback de status — en cada `SUBSCRIBED` (join inicial y cada rejoin tras desconexión) invalida `matches` y `currentMatch`, recuperando los eventos perdidos durante la desconexión.
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
- **sync-matches**: `getRegulationScores()` usa el campo `score.regularTime` de la API (presente en cualquier partido que pasó de 90 min) como fuente de verdad del score reglamentario, en vez de restar los penales del `fullTime` — ese cálculo por resta solo se usa como fallback si `regularTime` no viene en la respuesta. `getPenaltyScores()` deriva el score de penales como `fullTime - regularTime` en vez de confiar en el campo `score.penalties` de la API directamente, porque ese campo puede ser internamente inconsistente con `fullTime`/`regularTime` (caso real 03-jul-2026, Australia vs Egipto: la API reportó `penalties: {home:4, away:4}`, un empate imposible en una definición por penales, mientras `fullTime` {3,5} y `regularTime` {1,1} implicaban que el score real de penales era 2-4). Este bug producía scores reglamentarios absurdos (ej. `home_score: -1`) y puntos mal calculados.
- **calculate-points**: si hay penales, el ganador real es quien gana los penales. Exacts se compara contra score reglamentario. Ganador se compara contra el verdadero ganador. `actualDraw` se basa en `home_score === away_score` (score reglamentario), no en los penales.
- **UI**: score reglamentario en verde (`colors.accent`) y penales en gris (`textSecondary`) debajo. En PickScreen el score final también usa `colors.accent`.
- El usuario pronostica solo el score reglamentario (sin cambios en PickScreen).

## Cierre de Torneo
- **`matches.finished_at`** (migración `20260703180740`): timestamp que se setea una sola vez, en `sync-matches`, cuando un partido pasa a `status='finished'` (`becomingFinished = oldData?.status !== 'finished' && status === 'finished'`). Solo importa para el partido `stage='final'`: ancla tanto la ventana de voto de "Selección sorpresa" como el disparador de puntos especiales automáticos. Hay un índice único parcial (`matches_one_final_idx`) que garantiza que solo puede existir una fila con `stage='final'`.
- **Selección sorpresa (encuesta post-final)**:
  - Ya no se vota en `SpecialPicksScreen` (se sacó del array `CATEGORIES`). Se vota exclusivamente vía `SurpriseSurveyModal.tsx`, montado a nivel de app en `AppNavigator` (`MainNavigator`), visible sin importar en qué tab esté el usuario.
  - Ventana de voto: abre en el kickoff del partido `final` (`match_date <= now()`), cierra 30 min después de que el partido termine (`finished_at + 30min`). Mientras el partido no haya terminado, la ventana queda abierta indefinidamente (no tiene límite superior hasta que termine).
  - El popup se muestra solo si el jugador no tiene ya un `special_picks` con `category='surprise'`. Es descartable ("Luego") pero reaparece en la próxima apertura de la app si sigue sin votar y la ventana sigue abierta; una vez que vota, desaparece para siempre (no hay tabla de "ya visto", se infiere de la existencia del pick).
  - Validación server-side en `upsert_special_pick` (RPC, migración `20260703180740`): rechaza la escritura si `category='surprise'` y la ventana está cerrada (el chequeo del cliente no alcanza, mismo motivo que `picks_closed` en `upsert_pick`).
  - **`surprise` NO se puntúa automáticamente** — a diferencia de las otras 5 categorías, no tiene una respuesta objetivamente correcta, se sigue calificando a mano desde el dashboard (mismo patrón que `scoring_config`).
- **Puntos especiales automáticos** (`calculate-special-points`, nueva edge function): puntúa `first`/`second`/`third`/`fourth`/`top_scorer` automáticamente. Se dispara desde `sync-matches` en cada corrida del cron, pero solo actúa 30 min después de que el `final` termina (mismo cierre que la ventana de sorpresa) — antes de eso responde `{processed:0, skipped:...}` sin hacer nada. Idempotente: solo escribe `points_earned` cuando el valor calculado cambia respecto al guardado (evita UPDATEs no-op cada minuto para siempre, mismo criterio que `advanceTeam` en el bracket).
  - `first`/`second`: ganador/perdedor del partido `final` (penales si corresponde, si no score reglamentario).
  - `third`/`fourth`: ganador/perdedor del partido `third_place`.
  - `top_scorer`: se compara contra el/los goleador(es) con más goles en `scorers` (empates comparten los puntos). El pronóstico es texto libre (`Nombre/País`) — se hace *fuzzy match* del nombre contra `scorers.player_name` normalizando acentos/mayúsculas y tolerando coincidencia parcial (`"Messi"` matchea `"Lionel Messi"`).
  - Protegida con el mismo chequeo de `Authorization: Bearer <SERVICE_ROLE_KEY>` que `calculate-points` — solo `sync-matches` puede invocarla.
- **LeaderboardScreen**: el podio final (`showFinalPodium`) ya no se muestra apenas todos los partidos terminan — espera a que pase la ventana de 30 min post-final (`specialScoringDone`), para no mostrar un podio incompleto que después cambie al sumarse los puntos especiales. Mientras tanto muestra "🏆 Torneo finalizado — Calculando puntos especiales...". Un ticker de 30s fuerza el re-render para que la pantalla cambie sola al pasar el tiempo, sin depender de nueva data del server.
- **No se agregaron dependencias npm**: la encuesta de sorpresa es un modal in-app (no hay push notifications reales — eso hubiera requerido `expo-notifications` + infraestructura de push tokens + rebuild nativo completo en vez de OTA, decisión confirmada con el usuario).

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
| `matches` | id, external_id, home_team, away_team, home_flag, away_flag, match_date, stage, home_score, away_score, home_penalties, away_penalties, status, picks_closed, venue | UNIQUE(external_id) |
| `picks` | id, player_id, match_id, predicted_home, predicted_away, points_earned, created_at | FK players/matches, UNIQUE(player_id, match_id) |
| `special_picks` | id, player_id, category, prediction, points_earned, created_at | FK players, UNIQUE(player_id, category) |
| `scoring_config` | id, stage, exact_points, winner_points, participation_points, special_points, deadline, updated_at | UNIQUE(stage) |

### Vistas
- **leaderboard**: `SELECT id, username, total_points, RANK() OVER (ORDER BY total_points DESC) FROM players`
- **group_standings_view**: calcula posiciones desde matches finalizados con normalización de alias. Devuelve `goal_difference` (goals_scored - goals_against). ORDER BY: `points DESC, goal_difference DESC, goals_scored DESC` (antes solo ordenaba por goles a favor, sin diferencia de gol — podía rankear mal a dos equipos empatados en puntos).

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
| special_first | — | — | — | 50 | 2026-07-04T22:27Z |
| special_second | — | — | — | 30 | 2026-07-04T22:27Z |
| special_third | — | — | — | 20 | 2026-07-04T22:27Z |
| special_fourth | — | — | — | 15 | 2026-07-04T22:27Z |
| special_surprise | — | — | — | 25 | 2026-06-28T18:59Z (campo sin uso — ver "Cierre de Torneo" para la ventana real) |
| special_scorer | — | — | — | 35 | 2026-07-04T22:27Z |

### RPC Functions (SECURITY DEFINER)
- **upsert_pick**: verifica device_id + picks_closed (excepción si match cerrado o no existe), INSERT ON CONFLICT DO UPDATE
- **upsert_special_pick**: verifica device_id, INSERT ON CONFLICT DO UPDATE. Para `category='surprise'` además verifica la ventana dinámica de voto (kickoff del `final` hasta `finished_at + 30min`), leyendo el partido `stage='final'` (hay como máximo una fila gracias a `matches_one_final_idx`).

## Edge Functions

### sync-matches
- Fetch football-data.org API, upsert en `matches`
- Normaliza alias de equipos (Czechia → Czech Republic, etc.)
- Lee `score.penalties.home/away` de la API y los guarda en `home_penalties`/`away_penalties`
- Trigger `calculate-points` si match cambió a finished o si el score cambió en un match ya finished
- **Selective sync**: filtra matches antes del upsert loop. Skip: already-finished (cualquier fase, grupos y knockout) cuyo score reglamentario + penales + nombres de equipo sean idénticos a la DB; far-future (>3h) si ya están en DB. Procesa: live, transitioning, score changes en finished, upcoming (<3h), matches no existentes en DB y partidos donde DB tenga "Por definir" como equipo. El bracket propagation de knockouts finished ya no requiere re-upsertearlos cada run: lo garantiza el post-processing (lee desde DB). La comparación de scores usa `getRegulationScores()` (helper que resta penales del fullTime), la misma lógica del upsert — si no, los partidos con penales se re-procesarían eternamente. Usa `SELECT external_id, status, home_score, away_score, home_penalties, away_penalties, home_team, away_team` inicial + `Map<external_id, MatchData>` para lookup O(1).
- **Bracket propagation**: Mapeo completo del torneo (ext_ids de API). Cuando un partido de knockout termina, avanza automáticamente el ganador al siguiente partido del bracket (y el perdedor de semifinal al 3er puesto). Usa `|| "Por definir"` (no `??`) para manejar strings vacíos de la API. **Además del propagation en el loop principal, hay un post-processing** que lee los partidos finished desde la DB y propaga ganadores usando `home_team`/`away_team` y `home_penalties`/`away_penalties` como datos fuente. El post-processing **compara contra el valor actual del slot destino antes de escribir** (`advanceTeam()`): antes escribía incondicionalmente en cada run, generando UPDATEs no-op cada 2 min que disparaban eventos Realtime a todos los clientes. `getMatchResult`/`getMatchResultFromDb` devuelven `{winner, loser}` en una sola función.
- **Scorers gating**: el sync de goleadores + shirt numbers solo corre si hay algún partido live o finished hace <6h (los goles solo cambian en esas ventanas). Fuera de ellas se ahorran hasta 6 llamadas a football-data.org por run.
- **Venue**: extrae `match.venue` de la API. Si es null, usa `VENUE_MAP` (diccionario hardcodeado con los 104 partidos según calendario oficial FIFA).
- **`finished_at`**: se setea (una sola vez) cuando un partido pasa a `status='finished'` en este run. Ver "Cierre de Torneo".
- **Trigger de `calculate-special-points`**: después del post-processing de bracket, chequea el partido `stage='final'`; si está finished y ya pasaron 30 min desde `finished_at`, invoca la función. Se puede llamar en cada corrida del cron sin problema (ver "Cierre de Torneo" — es idempotente).
- **Cron job** (`pg_cron` + `pg_net`): `net.http_post` cada 2 min a sync-matches para sync incluso sin frontend abierto. Es la única fuente de sync periódico — el frontend ya no hace polling propio (ver Data fetching reducido), solo invoca sync-matches una vez al abrir MatchListScreen y en pull-to-refresh.

### calculate-points
- Para cada pick: exacto → exact_points, ganador correcto → winner_points, participación → participation_points
- **Penales**: si `home_penalties` y `away_penalties` no son null, el ganador real es quien ganó los penales (no el score reglamentario). Exacto se compara contra score reglamentario; ganador se compara contra el verdadero ganador (penales si existen, reglamentario si no).
- Recalcula `players.total_points` como suma de `picks.points_earned` + `special_picks.points_earned` (Promise.all paralelo)
- **Autorización**: solo acepta invocaciones con `Authorization: Bearer <SERVICE_ROLE_KEY>` (rechaza con 403 cualquier otro caller, incluido el anon key). Antes cualquiera con el anon key podía forzar un recálculo de puntos para cualquier `match_id`.

### calculate-special-points
- Puntúa automáticamente `first`/`second`/`third`/`fourth`/`top_scorer` de `special_picks` cuando el torneo termina. Ver "Cierre de Torneo" para el detalle completo de la lógica y el gating temporal.
- Misma protección de autorización que `calculate-points` (solo `SERVICE_ROLE_KEY`).

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
| API football-data.org incluye goles de penales en score.fullTime | Bug de la API externa | sync-matches resta penales del fullTime cuando duration=PENALTY_SHOOTOUT |
| actualDraw incorrecto con penales | actualDraw se derivaba de penales (siempre false) | actualDraw ahora usa `match.home_score === match.away_score` (reglamentario) |
| App muestra score viejo tras gol anulado (Portugal 2-1 Croatia se veía 2-2) | Eventos Realtime perdidos con app en background no se re-emiten; sin refetch al volver a foreground; la DB sí se auto-corrigió | 3 capas: `focusManager` + `refetchOnWindowFocus: true` (App.tsx), invalidate en cada `SUBSCRIBED` del canal Realtime (AppNavigator), polling condicional de la DB durante partidos live (MatchListScreen) |

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
| 30-jun | — | 🚀 OTA + Edge Function + DB | Fix actualDraw en calculate-points (basado en score reglamentario). Fix sync-matches: resta goles de penales del fullTime. UI: PickScreen score en verde. Scores corregidos Netherlands 1-1 Morocco y Germany 1-1 Paraguay. Recálculo de puntos con actualDraw corregido. |
| 30-jun | — | 🚀 OTA + Edge Function + DB | **Venue**: nueva migración 012_venue_column.sql, columna `venue` en matches. Sync-matches extrae `match.venue` de la API. Frontend muestra venue en MatchListScreen, PickScreen y MatchPicksTable. **Fix bracket propagation**: se movió la propagación fuera del condicional `statusChanged || scoreChanged` y se agregó post-processing desde DB. Corrige el caso de Paraguay vs Francia (R16) donde Francia no se propagaba. |
| 30-jun | — | ✅ Edge Function + DB | **VENUE_MAP hardcodeado**: la API de football-data.org no provee datos de sede para este torneo (campo `venue` siempre null). Se agregó diccionario `VENUE_MAP` con los 104 partidos mapeados a sus estadios según el calendario oficial FIFA. Backfill de todas las venues vía REST API. Cleanup de todo código debug. |
| 02-jul | — | ✅ DB | **Cron a 1 min**: `sync-matches-every-1min` reemplaza al de 2 min (goles más rápidos; el gating de scorers dejó margen de rate limit). Ejecutado vía Management API con el token del CLI. |
| 02-jul | — | 🚀 OTA | **UI: Llaves + polish de MatchList**. (1) `BracketView.tsx`: bracket knockout completo (16avos→Final + 3er puesto) con scroll horizontal, conectores tipo llave, ganador en accent, punto rojo live, tap→MatchDetail/Pick, auto-scroll a la ronda activa; los ext_ids por ronda están ordenados bracket-adjacent (match j alimentado por 2j y 2j+1). GroupsScreen ganó segmentos "Llaves" (default) / "Grupos". (2) MatchListScreen: countdown "⏱ en Xh Ym" (partidos a <6h, tick 30s) y badge de resultado del pronóstico en Finalizados (🎯 Exacto / ✓ Ganador / ✗ Fallaste, replica la lógica de calculate-points incluyendo penales). |
| 02-jul | — | 🚀 OTA + Edge Function + DB | **Fix "score fantasma"** (app mostraba 2-2 en Portugal 2-1 Croatia tras gol anulado por offside): la DB se auto-corregía pero la app nunca refetcheaba — eventos Realtime perdidos en background se pierden para siempre. App: `focusManager`+`refetchOnWindowFocus:true`, invalidate en cada `SUBSCRIBED` del canal, polling condicional de matches (30s live / 60s a <2h). Edge function: skip de knockouts finished sin cambios (usando `getRegulationScores()` compartido), `advanceTeam()` compara antes de escribir (elimina UPDATEs no-op cada 2 min), scorers sync gateado a ventanas de partido (<6h). |
| 01-jul | — | ✅ OTA + Edge Function + DB | **Fixes de revisión de código** (excepto auth device_id, fuera de alcance por ahora — 10 jugadores, riesgo bajo): (1) `group_standings_view` ahora ordena por goal_difference antes que goals_scored (tiebreak FIFA correcto), migración `20260701000000_group_standings_gd_tiebreak.sql`. (2) LeaderboardScreen ordena `leaderboard` explícitamente por `total_points` (antes dependía del ORDER BY interno de la vista, no garantizado). (3) `calculate-points` ahora rechaza cualquier caller que no sea el service role key. (4) sync-matches: colapsadas las 4 funciones getWinner/getLoser/getWinnerFromDb/getLoserFromDb en `getMatchResult`/`getMatchResultFromDb`. (5) MatchListScreen: eliminado el polling de `sync-matches` cada 30s/120s por dispositivo (redundante con el pg_cron cada 2 min, riesgo de rate limit en football-data.org con varios dispositivos abiertos a la vez); ahora solo sincroniza una vez al montar. (6) AppNavigator: los 5 listeners de doble-tap idénticos se unificaron en `makeDoubleTapListeners`. |
| 03-jul | — | ✅ Edge Function | **Fix penales fantasma** (Australia 1-1 Egipto → penales, la app calculaba `home_score: -1`): `getRegulationScores()` ahora prioriza `score.regularTime` de la API en vez de restar penales del `fullTime`; `getPenaltyScores()` deriva el score de penales como `fullTime - regularTime` en vez de confiar en el campo `score.penalties` (que venía inconsistente para ese partido: reportaba 4-4, un empate imposible). Verificado contra la API real y recalculado en producción: 1-1 / penales 2-4, puntos de los jugadores corregidos. |
| 03-jul | — | 🚀 OTA + Edge Function + DB | **Cierre de Torneo**: puntos especiales automáticos + podio final + encuesta "Selección sorpresa" post-final. Ver sección "Cierre de Torneo" para el detalle completo. Nueva migración `20260703180740` (`matches.finished_at`, índice único de "final", ventana de voto server-side en `upsert_special_pick`), nueva edge function `calculate-special-points`, `SurpriseSurveyModal.tsx` nuevo (montado en AppNavigator), `SpecialPicksScreen` pierde la categoría "surprise", `LeaderboardScreen` gatea el podio final a 30 min post-final. Sin dependencias npm nuevas (notificación in-app, no push nativo — decisión confirmada con el usuario para evitar rebuild nativo). |
| 03-jul | — | ✅ DB | **Extensión de deadline de especiales**: `scoring_config.deadline` de `special_first`/`second`/`third`/`fourth`/`scorer` extendido 24h desde el momento de la corrida (nueva fecha: 04-jul ~22:27Z), migración `20260703182701_extend_special_picks_deadline.sql`. `special_surprise` no se tocó (ya no usa este campo, ver "Cierre de Torneo"). |

## Reglas para el Agente

- Antes de modificar cualquier archivo, leerlo completo.
- No cambiar interfaces TypeScript existentes sin avisar.
- Toda modificación a Edge Functions debe deployarse via Supabase MCP, no solo editarse localmente.
- Para publicar cambios de código: `cd app && eas update --branch production --message "..."`.
- No agregar dependencias npm sin confirmar con el usuario.
- Los alias de equipos (Czechia, Korea Republic, etc.) están en sync-matches y en la migración 20260614070205. Si se agrega un alias, actualizarlo en ambos lugares.
- El scoring_config nunca se edita desde código, solo desde Supabase dashboard o MCP.

**pg_cron job:** nombre `'sync-matches-every-1min'`, schedule `'* * * * *'` (bajado de 2 min a 1 min el 02-jul; el gating de scorers dejó margen de rate limit)  
Para verificar: `SELECT * FROM cron.job WHERE jobname = 'sync-matches-every-1min';`  
Para eliminar: `SELECT cron.unschedule('sync-matches-every-1min');`  
**Ejecutar SQL sin MCP:** el token del CLI (Windows Credential Manager, target `Supabase CLI:supabase`) sirve para `POST https://api.supabase.com/v1/projects/yskphlvaurqgkqgxmxzi/database/query` con body `{"query": "..."}`.


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
