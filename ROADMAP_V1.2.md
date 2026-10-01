# NexusDay — Roadmap Técnico v1.2.0
## *Analytics & Productivity Hub*

> **Documento estratégico. No aplica cambios en el código.**
> Base: `v1.1.0` · Expo SDK `~57.0.26` · React Native `0.86.3` · React `19.2.3`
> Rol: Lead Mobile Architect · Idioma de producto: español neutro (tono global, sin voseo)

---

## 0. Resumen ejecutivo

| | |
|---|---|
| **Objetivo** | Convertir Inicio en un dashboard modular y configurable, sumar analíticas visuales, reproducción de audio en segundo plano y un sistema real de respaldo. |
| **Pilares** | 1) Dashboard modular · 2) Analíticas de gastos y hábitos · 3) Audio con onda visual · 4) Backup & Restore |
| **Deps nativas nuevas** | 2 (`react-native-svg`, `expo-secure-store`) + 1 JS pura opcional (`react-native-gifted-charts`) |
| **Cambios de config nativa** | 1 (`enableBackgroundPlayback: true` en `app.json`) — **no entregable por OTA update** |
| **Sprints** | 5 |
| **Estrategia de release** | Sprints 1–3 → **OTA update** · Sprints 4–5 → **build de tienda** |

### 0.1 Principio rector

> **Cero regresiones sobre los patrones existentes.** Cada fase replica una decisión
> arquitectónica que ya funciona en `v1.1.0` en lugar de inventar una nueva. El objetivo
> no es "usar la librería más moderna", sino "sumar capacidad sin romper lo que funciona".

---

## 1. Diagnóstico de la base de código (v1.1.0)

### 1.1 Inventario técnico verificado

| Capa | Implementación actual | Archivo |
|---|---|---|
| Lenguaje | **JavaScript puro**. No existe `tsconfig.json`; el proyecto usa JSDoc en español | todo `src/` |
| Estado global | Context + reducers manuales sobre `AsyncStorage` | `src/context/AppDataContext.js` |
| Persistencia | `usePersistentCollection` (hidrata una vez, espeja cada cambio) | `src/hooks/usePersistentCollection.js` |
| Claves | Namespace `@nexusday/v1/*` con fallback read-only a `@appmobile/v1/*` | `src/services/storage.js` |
| Navegación | **React Navigation** `material-top-tabs` + `BottomTabBar` custom | `src/navigation/RootNavigator.js` |
| Tema | `themedStyles()` (registro mutable) + `applyAccent()` con repintado in-place | `src/theme/theme.js` |
| Acentos | 4 temas: `cyan`, `emerald`, `gold`, `oled` | `src/theme/accents.js` |
| Audio | `expo-audio@~57.0.5` — `useRecorder` + `VoiceRecorder`/`VoicePlayback` | `src/hooks/useRecorder.js`, `src/components/ui/media.js` |
| Archivos | `expo-file-system@~57.0.7` (API de clases `File`/`Directory`/`Paths`) | `src/services/files.js` |
| Dashboard | Función pura `buildDashboard()` sobre colecciones hidratadas | `src/services/dashboard.js` |
| Iconos | Dibujados con `View` planos. **Sin `expo-blur`, sin gradientes, sin `@expo/vector-icons`** | `src/navigation/TabGlyphs.js` |

### 1.2 Los tres hallazgos que definen la arquitectura de v1.2.0

#### Hallazgo A — El sistema de pestañas ya resuelve el problema de los widgets

`src/services/tabs.js` implementa **exactamente** el modelo pedido en la Fase 1:
`{ order: [...], hidden: [...] }`, con `normalizeTabConfig`, `moveTab`, `setTabHidden`,
`toggleTabHidden` y `tabSignature`. `SettingsScreen` (líneas 376-401) lo edita con flechas
`↑`/`↓`.

> **Conclusión:** el sistema de widgets se implementa como un **gemelo** de
> `services/tabs.js`. Cero librerías nuevas, misma UX, misma accesibilidad.

#### Hallazgo B — Cada nota de voz crea su propio player nativo

`VoicePlayback` (`src/components/ui/media.js:100`) hace `useAudioPlayer(audio.uri)`.
Ese hook **libera el player en el `unmount`**. Con 50 notas en la lista eso son **50
players nativos simultáneos**, y ninguno sobrevive al cambio de pestaña. Además
`useAudioPlayer` **no puede** usarse para un player persistente — justo lo que exige un
mini-player con reproducción en segundo plano.

> **Conclusión:** la Fase 3 requiere un **contexto de player singleton** basado en
> `createAudioPlayer()` con ciclo de vida manual.

#### Hallazgo C — `expo-crypto` no cifra

Verificado en `node_modules/expo-crypto`: expone `digestStringAsync`, `getRandomBytes` y
`Crypto.getRandomValues`. **No hay AES ni cifrado simétrico.**

> **Conclusión (Opción A, aprobada):** v1.2.0 entrega **integridad** (SHA-256) y difiere
> el **cifrado real** a v1.3.0 con `@noble/ciphers`. Se documenta explícitamente para no
> prometer una garantía que el producto no puede cumplir.

---

## 2. Decisiones de arquitectura (ADR)

### ADR-1 — Se mantiene React Navigation (no se migra a Expo Router)

`AGENTS.md` instruye usar Expo Router. **El proyecto v1.1.0 no lo usa**: usa React
Navigation con pestañas dinámicas. **Decisión: mantener React Navigation en v1.2.0.**

Fundamento — preservar un sistema de pestañas dinámico ya maduro y probado:

1. **Las 9 pestañas se registran siempre en el navigator**, incluidas las ocultas,
   porque el buscador global navega por nombre de ruta (`RootNavigator.js:51-64` itera
   `config.order`). Desregistrar una ruta haría fallar `navigation.navigate()`.
2. **`lazy` + `lazyPreloadDistance: 1`** sobre `react-native-pager-view` da swipe
   horizontal real con precarga de la sección vecina. Un stack de Expo Router no replica
   esto sin reconstruir la navegación completa.
3. **Un cambio de acento o de layout remonta el navigator** vía
   `` key={`${revision}|${tabSignature(tabConfig)}` } `` (`App.js:67`), devolviendo al
   usuario a la sección que estaba usando (`lastRoute`). Ese comportamiento está
   interwoven con `BottomTabBar`, los glyphs dibujados a mano y los badges.
4. La migración implicaría reescribir `RootNavigator`, `BottomTabBar`, `TabGlyphs`,
   `tabs.js` y los 9 screens, con alto riesgo de regresión en navegación y onboarding.

**Mitigación:** documentar la desviación en `AGENTS.md` y proponer la migración como
proyecto standalone de **v1.4.0** (fuera de v1.2.0).

**Impacto en las Fases 1–4: ninguno.** El dashboard se modulariza *dentro* de
`HomeScreen`; no requiere tocar el navigator.

### ADR-2 — `react-native-gifted-charts` sobre `victory-native`

| Criterio | `victory-native@42.0.1` | **`react-native-gifted-charts@1.4.78`** | Ganador |
|---|---|---|---|
| Peer deps obligatorias | `react-native-reanimated`, **`@shopify/react-native-skia >=2.6.0 <3.0.0`**, `react-native-gesture-handler` | `react-native-svg` (gradientes opcionales) | 🎯 gifted |
| Versionado SDK 57 | Skia `2.6.2`, Reanimated `4.5.1` — ambos ausentes hoy | `react-native-svg` `15.15.4` pineado por el SDK | 🎯 gifted |
| Tamaño del binario | +10–15 MB (Skia) | +0 (SVG es lib nativa ligera) | 🎯 gifted |
| Expo Go | ❌ requiere dev build | ✅ funciona en Expo Go | 🎯 gifted |
| Bundle de métricas | `d3-scale`, `d3-shape`, `d3-zoom` | `gifted-charts-core` | 🎯 gifted |
| Curva de API | declarativa (tipo Victory) | imperativa, verbosa | victory |
| Accesibilidad de datos | limitada | props directas | ≈ empate |

**Decisión: `react-native-gifted-charts` + `react-native-svg@15.15.4`.**
`victory-native` queda **descartado** por peso y por romper el requisito de "la librería
más liviana" y la compatibilidad con Expo Go.

**Matiz arquitectónico crítico:** el **streak heatmap NO se hace con ninguna librería.**
Se construye con `View`s planos, por tres razones:

1. **Precedente en el propio código:** `ExpensesScreen.js:188-200` ya dibuja barras de
   categoría con `View` + `width: '%'`. El patrón es idiomático de este proyecto.
2. Un heatmap estilo GitHub-contributions es una grilla de celdas coloreadas por nivel
   (`0-4`): no requiere ejes, escalas ni paths. `gifted-charts` no aporta nada ahí.
3. Cero costo de bundle y control total del acento dinámico vía `applyAccent`.

> **Regla general de la Fase 2:** *usar librería para lo que sí es un gráfico (donut de
> categorías, barras de tendencia) y `View`s planos para lo que es grilla o indicador
> (heatmaps, sparklines, barras de progreso).*

### ADR-3 — El player de audio es un singleton de ciclo de vida manual

`useAudioPlayer` libera el player al desmontar → imposible para un player persistente.
Se usa `createAudioPlayer()` + `AudioPlayerContext` con `release()` explícito.
*(Verificación pendiente de la firma exacta de `release()` en `expo-audio@57.0.5` — S4-T0.)*

### ADR-4 — Cifrado diferido (Opción A)

Se entrega **integridad** SHA-256 + HMAC vía `expo-crypto`. El **cifrado de contenido** se
difiere a v1.3.0 con `@noble/ciphers` (JS puro, auditado, sin dependencia nativa).

**Riesgo aceptado y comunicado:** un `.nexusday` exportado es legible como texto plano.
El producto **debe** declarar esto en la UI de exportación, y el roadmap lo deja
registrado como pendiente con dueño y versión.

### ADR-5 — El dashboard se modulariza por registro, no por condicionales

`HomeScreen` deja de tener secciones hardcodeadas y pasa a iterar un **registro
declarativo** de widgets. Agregar un widget en v1.3 es añadir *una entrada* al registro,
no tocar la pantalla.

---

## 3. FASE 1 — Dashboard modular y widgets reorganizables

### 3.1 Modelo de configuración

Copia estructural de `services/tabs.js`, con un id por sección:

```js
// src/services/widgets.js
export const DEFAULT_WIDGET_CONFIG = {
  order: ['dailyBriefing', 'expenseSummary', 'habitsToday', 'upcoming', 'pinnedNotes'],
  hidden: [],
};

export function normalizeWidgetConfig(stored)  // repara: desconocidos, duplicados, faltantes
export function moveWidget(config, id, dir)     // -1 / +1
export function setWidgetHidden(config, id, hiddenFlag)
export function toggleWidgetHidden(config, id)
export function widgetSignature(config)         // `${order.join('>')}|${hidden.join('>')}`
```

**Invariantes:**

- Orden **estable y total**: siempre los 5 ids presentes, aunque el storage venga corrupto.
- **Al menos 2 widgets visibles** siempre. `setWidgetHidden` es *no-op* si al ocultarla
  quedarían menos de 2 — evita una pantalla de Inicio vacía.
- Widgets desconocidos venidos de un backup futuro se **descartan** silenciosamente por
  `normalizeWidgetConfig` (mismo criterio que `normalizeTabConfig`).

### 3.2 Registro de widgets (ADR-5)

```js
// src/components/dashboard/widgetRegistry.js
export const WIDGETS = {
  dailyBriefing: {
    id: 'dailyBriefing', label: 'Resumen diario', emoji: '✨',
    locked: true, component: DailyBriefingWidget,
  },
  expenseSummary: {
    id: 'expenseSummary', label: 'Resumen de Gastos', emoji: '💰',
    locked: true, component: ExpenseSummaryWidget,
  },
  habitsToday: {
    id: 'habitsToday', label: 'Hábitos del día', emoji: '💪',
    component: HabitsTodayWidget,
  },
  upcoming: {
    id: 'upcoming', label: 'Próximos eventos', emoji: '📅',
    component: UpcomingWidget,
  },
  pinnedNotes: {
    id: 'pinnedNotes', label: 'Notas fijadas', emoji: '📝',
    component: PinnedNotesWidget,
  },
};
```

`HomeScreen` itera `config.order.filter((id) => !config.hidden.includes(id))` y renderiza
`<Registry[id].component {...props} />`. Los props salen de **un único `useMemo`** con
`buildDashboard()` — que ya existe y **no se toca**.

Cada widget es un componente puro que recibe `{ data, navigation }` y no vuelve a leer
`useAppData()`. Esto mantiene un único punto de suscripción de estado por pantalla.

### 3.3 UX de configuración (Ajustes › Personalizar Inicio)

Réplica exacta de la sección "Personalizar Navegación" existente (flechas `↑`/`↓` +
estado visible/oculta + slot fantasma), reutilizando los estilos `tabRow`/`tabIndex`/
`tabArrows` que **ya están definidos** en `SettingsScreen.js:538-547`.

Decisión explícita: **no se usa drag-and-drop.** Justificación:
- cero dependencias nuevas (sin `react-native-draggable-flatlist`, sin Reanimated);
- consistente con la UX ya aprendida por el usuario en Ajustes;
- accesible por TalkBack sin trabajo extra (botones con `accessibilityLabel` explícito);
- `↑`/`↓` ya está probado en producción desde v1.1.0.

### 3.4 "Resumen Diario Inteligente" (cabecera)

Motor de reglas **determinista, local y sin red**, coherente con la filosofía local-first
del producto y con `assistant.js` (que ya es un matcher de intents local, sin API key).

```js
// src/services/briefing.js
export function buildDailyBriefing({
  events, activities, habits, notes, birthdays, expenses, now = new Date(),
}) => {
  headline:   string,     // "Tienes 3 cosas por delante y 1 hábito pendiente"
  highlights: [{ tone, label, value, route, focusId }],
  priority:   'high' | 'medium' | 'low' | 'calm',
  score:      number,     // 0..100, uso interno para ordenar las reglas
}
```

**Reglas priorizadas (score descendente):**

| # | Regla | Condición | Tono | Ruta |
|---|---|---|---|---|
| 1 | `overdue` | Evento `dateKey+time` ya pasado sin resolver | `danger` | `Agenda` |
| 2 | `imminent` | Evento en menos de 2 h | `warning` | `Agenda` |
| 3 | `streak-at-risk` | Hábito con racha ≥ 3 sin marcar hoy | `warning` | `Hábitos` |
| 4 | `habits-pending` | `pendingHabits.length > 0` | `accent` | `Hábitos` |
| 5 | `spend-spike` | Gasto del día > media diaria de los últimos 30 d × 1.5 | `warning` | `Gastos` |
| 6 | `over-budget` | Acumulado del mes > media mensual previa (si hay ≥ 2 meses de historia) | `danger` | `Gastos` |
| 7 | `birthday-soon` | Cumpleaños en ≤ 7 días | `accent` | `Cumpleaños` |
| 8 | `stale-pinned` | Notas fijadas sin tocar en > 7 días | `neutral` | `Notas` |
| 9 | `all-clear` | Ninguna regla dispara | `accent` | — |

**Restricciones de implementación:**

- Máximo **3 `highlights`** visibles; el `headline` se limita con `numberOfLines={2}`.
- `useMemo` con dependencia en la **identidad de las colecciones** (no en `new Date()`),
  para no recalcular 60 veces por minuto.
- Cada highlight incluye `route` + `focusId`, y navega con el mismo patrón que la
  búsqueda global (`navigation.navigate(route, { focusId })`) para que el item quede
  resaltado en destino vía `useFocusId`.
- Los gastos y notas **privados** quedan excluidos del texto del resumen, igual que
  `search.js:48,113` ya hace con la búsqueda global — coherencia de privacidad.

---

## 4. FASE 2 — Sistema de analíticas visuales

### 4.1 Dependencias

```bash
npx expo install react-native-svg            # 15.15.4 (versionado por el SDK 57)
npx expo install react-native-gifted-charts  # 1.4.78
```

`react-native-svg` es **nativo** → requiere dev build. `react-native-gifted-charts` es JS
pura sobre `Svg`, y **funciona en Expo Go**.

### 4.2 Estructuras de datos

Todas las funciones son **puras y sin estado**, siguiendo el estilo de
`services/dashboard.js`. Reciben colecciones ya hidratadas y devuelven datos listos para
renderizar. Ninguna toca `useAppData()`.

```js
// src/services/analytics.js

/** Gastos agrupados por categoría para un período. `share` es 0..1. */
export function spendByCategory(expenses, { monthKey }) => [{
  id,            // 'Comida' | 'Transporte' | ... (EXPENSE_CATEGORIES)
  label, emoji, color,   // desde categoryOf()
  total,         // number
  count,         // number
  share,         // number 0..1
  avgPerEntry,   // number
  previousTotal, // mismo mes anterior, para la delta
  deltaPct,      // number | null
}]

/** Serie temporal de gasto. `bucket`: 'day' | 'week' | 'month'. */
export function spendSeries(expenses, { from, to, bucket = 'day' }) => [{
  key,        // 'YYYY-MM-DD' | 'YYYY-Www' | 'YYYY-MM'
  label,      // '12 ene' | 'sem 3' | 'ene'
  total, count,
  isCurrent,  // boolean — para resaltar el bucket en curso
}]

/** Heatmap de hábito, estilo GitHub contributions. */
export function habitHeatmap(habits, { weeks = 18, today = todayKey() }) => {
  weeks: [                      // semana más antigua primero
    { weekIndex, startKey,
      days: [{ dateKey, count,      // cuántos hábitos se marcaron ese día
               level,               // 0..4, cuantizado según `count`
               isFuture, isToday }],
    },
  ],
  totals: { activeDays, bestStreak, currentStreak, completionRate },
}

/** Racha extendida de un hábito. Complementa `habitStreak()` sin romperla. */
export function habitStreakStats(habit, today = todayKey()) => {
  current, best, last30,   // 0..1 cumplimiento 30 días
  lastMarkedKey, daysSinceLast,
}

/** Comparativa mes actual vs. media de meses previos. Alimenta la regla `over-budget`. */
export function monthlySpendStats(expenses, { monthKey, months = 6 }) => {
  current, previous, average,       // average excluye el mes en curso
  projected,                        // current / díaTranscurrido × díasDelMes
  trendPct,                         // (previous - average) / average
  hasEnoughHistory,                 // ≥ 2 meses previos
}
```

### 4.3 Cuantización del heatmap (niveles 0-4)

El nivel se calcula sobre el **máximo observado en la ventana**, no sobre un valor fijo,
para que se vea igual con 1 hábito o con 20:

```js
function levelFor(count, max) {
  if (count <= 0) return 0;
  if (max <= 1) return 4;             // un solo hábito: lleno o vacío
  return Math.min(4, 1 + Math.floor(((count - 1) / (max - 1)) * 3.999));
}
```

Escala de color derivada del acento: `{accent}18` → `{accent}44` → `{accent}88` →
`{accent}` → `colors.accent` con la fuente en `colors.accentInk` para el nivel 4.
Se registra en `themedStyles()` para que `applyAccent()` lo repinte.

### 4.4 Componentes

| Componente | Librería | Notas |
|---|---|---|
| `src/components/charts/CategoryDonut.js` | `gifted-charts` (`PieChart`) | Reemplaza las barras `View` de `ExpensesScreen.js:188-200`; mantiene el listado textual debajo por accesibilidad |
| `src/components/charts/SpendBarChart.js` | `gifted-charts` (`BarChart`) | Serie diaria/semanal con `spacing`, `noOfSections`, `yAxisThickness={0}` (la escala la pone la grilla del `Card`) |
| `src/components/charts/SpendSparkline.js` | **`View` planos** | Indicador inline de 28 días en el widget de gastos |
| `src/components/charts/HabitHeatmap.js` | **`View` planos** | Grilla 7 filas × N columnas, celda 10×10 con `gap` 2. `FlatList` horizontal con `getItemLayout` de ancho fijo |
| `src/components/charts/TrendBadge.js` | **`View` planos** | Delta % con flecha; verde/rojo calculados desde `colors` |

### 4.5 Rendimiento (requisito de no-regresión)

- **El heatmap no re-renderiza al arrastrar:** `FlatList` horizontal con
  `getItemLayout={(d, i) => ({ length: CELL + GAP, offset: CELL * i, index: i })}` y
  `initialNumToRender` acotado.
- **`React.memo`** en todos los componentes de chart; props primitivas o referencias
  estables de `useMemo`.
- **Cuantización pre-calculada** en `analytics.js`, nunca dentro del componente.
- **Presupuesto:** ≤ 6 gráficos visibles simultáneos. Más allá, la pantalla de analítica
  usa `Chip` para cambiar de pestañas, no un scroll infinito de gráficos.
- **Cero animación en el heatmap:** pintarlo es determinista; animar 126 celdas por re-render
  es elfailure mode clásico. Las barras del `BarChart` sí animan, pero con `animationOnDataChange={false}`.

### 4.6 Ubicación en la UI

- **Inicio:** `ExpenseSummaryWidget` gana un `SpendSparkline` de 28 días (sin donut —
  el dashboard es una vista rápida, no un informe).
- **Gastos:** nuevo `Sheet`/sección "Análisis" con `CategoryDonut` + `SpendBarChart`,
  con `Chip` de período (7 días / 30 días / mes / todo).
- **Hábitos:** `HabitHeatmap` de 18 semanas debajo de cada hábito, en `collapsable`.

---

## 5. FASE 3 — Reproductor de audio y onda visual

### 5.1 Deuda técnica que se corrige

`VoicePlayback` instancia un `useAudioPlayer()` por nota. Con la lista completa eso son N
players nativos vivos a la vez, cada uno con su propia sesión de audio. Además, al cambiar
de pestaña el componente se desmonta y **la reproducción se corta**.

### 5.2 Arquitectura: `AudioPlayerContext` (singleton)

```js
// src/context/AudioPlayerContext.js
export function AudioPlayerProvider({ children }) { /* ... */ }
export function useNotePlayer() { /* ... */ }

// API
{
  current,   // { id, title, uri, durationMs, noteId, color } | null
  status,    // 'idle' | 'loading' | 'playing' | 'paused' | 'ended'
  position,  // segundos (float)
  duration,  // segundos
  isReady,

  play(note), pause(), resume(),
  seek(seconds),
  skip(seconds),         // ±10 s
  next(), previous(),    // avanza en `queue`
  stop(),                // libera y vuelve a idle
  enqueue(notes),        // cola desde la lista de Notas
}
```

**Implementación del singleton:**

```js
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

let player = null;   // scope de módulo: sobrevive a todos los unmounts

function ensurePlayer() {
  if (!player) player = createAudioPlayer(null, { updateInterval: 250 });
  return player;
}
```

`updateInterval: 250` (por debajo del default de 500) para que la barra de progreso se mueva
fluidamente sin repintar 4 veces por segundo de más.

**Ciclo de vida:** `AppState.addEventListener('change', ...)` pausa al pasar a `background`
y **retoma al volver a `active`** solo si el usuario no la pausó manualmente (flag
`pausedByUser`). Al desmontar el provider se llama `player.release()`.

### 5.3 Configuración de sesión de audio

`src/services/audio.js` se extiende con un tercer modo:

```js
export async function ensureBackgroundPlaybackMode() {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    // 'doNotMix' es OBLIGATORIO: sin él el SO no asocia los controles de bloqueo
    // al player y Android corta la reproducción a los ~3 min (ver docs SDK 57).
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
  });
}
```

### 5.4 `app.json` — cambio nativo bloqueante

```jsonc
["expo-audio", {
  "microphonePermission": "NexusDay usa el micrófono solo para grabar las notas de voz que se guardan en este dispositivo.",
  "enableBackgroundPlayback": true,   // ← era false en v1.1.0 (línea 39)
  "enableBackgroundRecording": false
}]
```

**Consecuencias verificadas del config plugin** (leyendo
`node_modules/expo-audio/plugin/build/withAudio.js`):

| Plataforma | Efecto |
|---|---|
| iOS | Agrega `UIBackgroundModes: ['audio']` al `Info.plist` |
| Android | Agrega `FOREGROUND_SERVICE` y `FOREGROUND_SERVICE_MEDIA_PLAYBACK` |
| Android | Registra `expo.modules.audio.service.AudioControlsService` (`foregroundServiceType: mediaPlayback`, `MediaSessionService`) |

> ⚠️ **Este cambio NO se puede entregar por `eas update`.** Requiere un build nuevo de
> tienda. Es la razón por la que los sprints 1–3 se liberan por OTA y 4–5 por build.

**Permiso de notificaciones en Android:** los controles de reproducción en el panel de
notificaciones exigen `requestNotificationPermissionsAsync()` (`expo-audio`). La app ya
solicita ese permiso para los recordatorios (`services/notifications.js`), así que no hay
un permiso nuevo que pedir, pero **sí hay que reutilizar la respuesta existente** y no
volver a disparar el diálogo.

### 5.5 Controles de bloqueo de pantalla

```js
player.setActiveForLockScreen(
  true,
  { title: note.title || 'Nota de voz', artist: 'NexusDay' },
  { showSeekBackward: true, showSeekForward: true, isLiveStream: false },
);
```

Se invoca al empezar a reproducir y se limpia con `removeFromLockScreen()` al parar.
**Requisito de la doc oficial:** `interruptionMode` debe ser `doNotMix` o el SO puede no
asociar los controles al player.

### 5.6 Onda visual (waveform)

Dos mecanismos, con recomendación clara:

| Opción | Mecanismo | Veredicto |
|---|---|---|
| **A — Metering en vivo** | `recordingOptions.isMeteringEnabled` ya está en `true` (`services/audio.js:43`). `recorder.getStatus().metering` entrega el nivel actual. Se acumulan **picos por bucket** durante la grabación y se guardan como `note.waveform: number[]` (≈64 buckets normalizados 0-1) | ✅ **Elegida** |
| B — Sampling del player | `useAudioSampleListener(player, cb)` + `setAudioSamplingEnabled(true)` | ⚠️ Requiere `RECORD_AUDIO` en Android y no está soportado en todas las plataformas |

**Por qué A:** ya está activado, no requiere permisos extra, funciona igual en iOS y Android,
y el dato queda **persistido con la nota** (se puede volver a dibujar sin volver a
reproducir). La opción B solo sirve para una visualización en vivo, que no es el caso de uso.

**Esquema de datos** — campo opcional en la nota, **retrocompatible**:

```js
note.waveform = [0.12, 0.44, 0.81, ...]   // number[] normalizado 0..1, opcional
```

**Renderizado:** `src/components/audio/Waveform.js` con `View` planos — N barras de 2 px de
ancho con `height: ${v * MAX}px`, coloreadas con `note.color`, y las barras anteriores a
`position` en `colors.accent` para mostrar el progreso. Cero dependencias, coherente con ADR-2.

**Fallback:** si `note.waveform` no existe (grabaciones de v1.0/v1.1), se dibuja la barra de
progreso simple actual. **Sin migración de datos** — es la diferencia entre un campo
opcional y uno obligatorio.

### 5.7 Barra de progreso interactiva

Hoy la barra es un `View` decorativo (`media.js:139-141`). Se convierte en `Pressable`:

```js
<Pressable
  onPress={(e) => seekToRatio(e.nativeEvent.locationX / trackWidth)}
  onPressIn={(e) => scrubTo(e.nativeEvent.locationX / trackWidth)}  // arrastrar
  accessibilityRole="adjustable"
  accessibilityValue={{ min: 0, max: duration, now: position }}
/>
```

El ancho se mide con `onLayout`, **no** con `useWindowDimensions`, porque el ancho real
cambia con gutter, padding y las barras del sistema.

### 5.8 Mini-player persistente

Nuevo componente `src/components/audio/MiniPlayer.js`, montado en `App.js` **por debajo de
`RootNavigator`** para que sobreviva a los cambios de pestaña:

- Muestra `title`, waveform-mini, `position / duration`, ▶/⏸, ×15, ×30 y cerrar.
- Se ancla sobre `BottomTabBar` con `position: 'absolute'` + `insets.bottom` de
  `react-native-safe-area-context` (el mismo cálculo que `BottomTabBar.js:57`).
- Se oculta con `Animated` cuando `status === 'idle'`, **sin desmontar el player**.

### 5.9 Interacción con la pantalla de Notas

`NotesScreen` deja de montar `VoicePlayback` por fila (que creaba N players) y delega en
`useNotePlayer()`. Tocar ▶ en una fila llama a `play(note)` del contexto singleton.

`VoicePlayback` **se conserva** para el sheet de edición (una sola instancia, montada solo
con `sheet.values.audio?.uri`), reutilizando el mismo player del contexto para que el
usuario pueda escuchar la toma antes de guardarla sin cortar la que ya está sonando.

---

## 6. FASE 4 — Exportación y respaldo de datos (Backup & Restore)

### 6.1 Dependencias

```bash
npx expo install expo-crypto        # ~57.0.3  — SHA-256 + HMAC
npx expo install expo-secure-store  # ~57.0.4  — custodia del secreto de integridad
```

Ambas están en el SDK 57 (`bundledNativeModules.json`) y ambas son **nativas** → dev build.
`expo-document-picker` y `expo-sharing` **ya están instaladas** y se reutilizan tal cual.

### 6.2 Esquema del archivo de respaldo

```jsonc
{
  "format": "nexusday.backup",
  "version": 1,                 // versionado de esquema; ver 6.6
  "app": { "name": "NexusDay", "version": "1.2.0", "platform": "ios" },
  "createdAt": 1789000000000,
  "integrity": {                // ← Opción A: integridad, NO confidencialidad
    "algorithm": "SHA-256",
    "hmac": "base64...",
    "signature": "base64..."    // HMAC sobre el payload canónico
  },
  "data": {
    "activities": [ /* ... */ ],
    "events": [ /* ... */ ],
    "birthdays": [ /* ... */ ],
    "notes": [ /* ... */ ],
    "habits": [ /* ... */ ],
    "expenses": [ /* ... */ ]
  },
  "settings": { "displayName": "...", "preferredCalendarId": "...", "privacyEnabled": true },
  "preferences": {
    "accentId": "cyan",
    "tabConfig": { "order": [], "hidden": [] },
    "widgetConfig": { "order": [], "hidden": [] }
  },
  "media": {                     // ← opcional, ver 6.4
    "included": true,
    "totalBytes": 4821000,
    "files": [ { "kind": "recording|attachment", "ownerId": "note-1",
                 "name": "voz-173.m4a", "size": 48213, "base64": "..." } ]
  }
}
```

**Decisión clave:** el esquema incluye **preferencias** (`accentId`, `tabConfig`,
`widgetConfig`) y no solo colecciones. Un respaldo que restaura los datos pero pierde la
personalización del usuario es un respaldo a medias.

### 6.3 Integridad (Opción A)

```js
// src/services/backupIntegrity.js
import * as Crypto from 'expo-crypto';

export const INTEGRITY_ALGORITHM = 'SHA-256';

// Clave de 32 bytes, creada una vez y guardada en SecureStore (keychain / keystore).
export async function getOrCreateIntegrityKey() { /* ... */ }

export function canonicalize(payload) {
  // JSON.stringify con claves ordenadas recursivamente → mismo contenido, mismo string.
  // Sin esto, dos exportaciones idénticas producirían firmas distintas.
}

export async function signBackup(payload) {
  const key = await getOrCreateIntegrityKey();
  const text = canonicalize(payload);
  const signature = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${toHex(key)}|${text}`,
  );
  const checksum = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, text,
  );
  return { algorithm: 'SHA-256', hmac: signature, signature: checksum };
}

export async function verifyBackup(payload, integrity) {
  // Recalcula y compara en tiempo constante-ish; devuelve { ok, reason }.
}
```

> ⚠️ **Límite honesto de la Opción A.** El secreto HMAC vive en el **keychain/keystore del
> mismo dispositivo**. Esto detecta corrupción y edición casual del archivo, y evita que un
> `.nexusday` editado a mano pase inadvertido — **pero no protege contra un atacante con
> acceso físico al dispositivo ya desbloqueado.** El cifrado de contenido con passphrase
> (AES-GCM vía `@noble/ciphers`) queda para **v1.3.0**. La UI de exportación debe decirlo
> explícitamente: *"El archivo se valida, no se cifra"*.

### 6.4 Binarios: dos modos de exportación

Se ofrecen dos modos explícitos, sin un tercer modo "automático":

| Modos | Contenido | Tamaño típico | Cuándo usarlo |
|---|---|---|---|
| **Ligero** (default) | Solo colecciones + preferencias, **sin** `media` | 20–200 KB | Copia rápida, migrar a otro dispositivo |
| **Completo** | + recordings y attachments en base64 | ×1.37 del tamaño de los binarios | Respaldo total / archivado |

**Decisión técnica:** los binarios van **embebidos en base64 dentro del mismo JSON**, no en
un ZIP. Motivo: `expo-file-system` no expone un lector ZIP y agregar `expo-zip` sería una
dependencia nativa extra por una ganancia marginal.

**Advertencia de memoria:** base64 infla ~37 % (×1.37). Con 50 grabaciones de 1 min a
64 kbps (~480 KB cada una) el archivo ronda **33 MB**. Por eso:
- la escritura es **por chunks** (`file.write()` con `append: true`), no un
  `JSON.stringify` de 33 MB en una sola cadena en memoria;
- el import también **fluye por chunks**;
- la UI muestra el tamaño estimado antes de exportar y advierte por encima de ~50 MB.

**Rehidratación de rutas — detalle crítico:** los `uri` guardados en las notas son
absolutos del sandbox (`file:///.../Documents/recordings/voz-173.m4a`) y **cambian entre
instalaciones**. En el import hay que **reescribir los descriptores** con las rutas nuevas
generadas al volcar los archivos, igual que ya hace `pickAndImport()` (`files.js:220-249`).

### 6.5 Exportación CSV

Cada colección tiene su propio CSV, pensado para abrir en Excel / Google Sheets.

```js
// src/services/csv.js
export function toCSV(rows, columns, { delimiter = ',', eol = '\r\n' } = {}) {
  // RFC 4180: comillas dobles, duplicadas internamente, saltos escapados.
  // Delimiter configurable (',' para Sheets, ';' para Excel es-AR).
}

export const CSV_COLUMNS = {
  expenses: [
    { key: 'dateKey',  header: 'Fecha' },
    { key: 'amount',   header: 'Monto' },
    { key: 'category', header: 'Categoría' },
    { key: 'note',     header: 'Detalle' },
    { key: 'private',  header: 'Privado', map: (v) => (v ? 'Sí' : 'No') },
  ],
  habits:   [ /* Nombre, Emoji, Racha, Total de marcas, Último marcado */ ],
  notes:    [ /* Título, Contenido, Fijada, Creada, Actualizada */ ],
  events:   [ /* Fecha, Hora, Título, Aviso, Color */ ],
  activities: [ /* Día, Título, Inicio, Fin, Lugar */ ],
  birthdays:  [ /* Nombre, Cumpleaños, Emoji, Días de aviso */ ],
};
```

**Reglas de la exportación CSV:**

- **Se excluye `private: true`** de gastos y notas por defecto (mismo criterio de privacidad
  que `search.js:48,113`). Se agrega un toggle "incluir privados" que **requiere
  autenticación biométrica** antes de activarse.
- **No se exportan los `uri` absolutos** de audio ni adjuntos: no sirven en otro
  dispositivo. Se exporta solo el nombre del archivo como metadato.
- `amount` se escribe con **punto decimal** (`1850.5`) aunque la app muestre `$ 1.850,50`:
  CSV es para máquinas, la localización va en el formateo de la app.
- Se usa `\r\n` como fin de línea (RFC 4180) para que Excel en Windows no abra el archivo
  como una sola columna.
- Se escribe un **BOM UTF-8** (`\uFEFF`) al inicio para que Excel reconozca los acentos
  (`á`, `é`, `ñ`) en columnas como "Categoría" y "Detalle".

### 6.6 Importación y validación

**El import SIEMPRE es un dry-run primero.** No se escribe nada sin confirmación.

```js
// Flujo de importación
1. pickAndImport({ type: 'application/json' })     // reutiliza files.js:220
2. readText(file)                                  // ya existe en files.js:100
3. JSON.parse()  →  try/catch, mensaje "El archivo no es un respaldo válido"
4. validateSchema(parsed)                          // 6.7
5. verifyBackup(parsed.data, parsed.integrity)     // 6.3
6. buildPreview(parsed, currentState)              // diff contra el estado local
7. ConfirmSheet → el usuario elige la estrategia de merge
8. applyRestore(parsed, strategy)                  // 6.8
```

**`buildPreview` devuelve un diff legible, no un simple "se reemplazarán los datos":**

```js
{
  counts: { activities: [actual, nuevo], events: [...], /* ... */ },
  conflicts: [ { collection: 'notes', id: 'n-1', action: 'replace|keep' } ],
  media: { files: 12, bytes: 4_800_000, missingOnDevice: 2 },
  valid: true,
  warnings: ['3 notas tienen audio que no está en este dispositivo'],
}
```

### 6.7 `validateSchema` — validación estricta, sin dependencias

Se implementa a mano, sin `zod` ni similar, para no agregar una dependencia a un proyecto
que hoy tiene **cero** librerías de validación. Devuelve `{ valid, errors, warnings, value }`.

- `format === 'nexusday.backup'` — si no, **rechazar**.
- `version > SUPPORTED_BACKUP_VERSION` → **rechazar con mensaje explícito**
  ("Creado por una versión más nueva de NexusDay. Actualiza la app para restaurarlo").
  Esto evita que un restore parcial destruya datos.
- Cada colección debe ser un array; cada item debe tener `id` string.
- Tipos numéricos saneados: `amount` → `Number(x) || 0` (usa `parseAmount` de
  `utils/money.js` para tolerar `"1.234,56"` si alguien editó el archivo).
- `dateKey` con regex `^\d{4}-\d{2}-\d{2}$`; si falla, se descarta el item con un
  `warning` en vez de abortar todo el restore.

### 6.8 `applyRestore` y estrategias de merge

Dos estrategias, elegidas explícitamente por el usuario en el `ConfirmSheet`:

| Estrategia | Comportamiento | Cuándo |
|---|---|---|
| **Reemplazar** | `clearAllData()` y luego carga el backup completo | Cambiar de dispositivo, restaurar a fábrica |
| **Combinar** | Merge por `id`; si el `id` ya existe, gana el de `updatedAt` más reciente | No perder notas nuevas |

**⚠️ Trampa de `usePersistentCollection` que hay que respetar.** El hook tiene una guarda
`wipedRef` (líneas 19-36): un `replaceAll()` que ocurre **antes** de que termine la
hidratación debe ganar, o los datos de ejemplo que la lectura todavía está devolviendo se
volverían a escribir encima. El restore **debe** ejecutarse solo cuando
`hydrated === true` en las 6 colecciones, y pasar por `clearAllData()` (que ya llama a
`replaceAll([])` en las seis, `AppDataContext.js:188-195`) antes de insertar.

**Rehidratación de medios** (solo en modo "Completo"):

```
Por cada archivo en media.files:
  1. base64 → Uint8Array  (Crypto/base64 decode)
  2. file.write(bytes) en Documents/recordings/  (o attachments/)
  3. nuevo descriptor { uri, name, size }
  4. patch del owner (note.audio | note.attachment) con el descriptor NUEVO
```

Las notas sin archivo restaurado quedan con `audio: null` + un `warning` en el preview.
**Nunca** se deja un `uri` que apunte a un archivo inexistente: `VoicePlayback` ya lo
verifica con `audio?.uri` y el player fallaría en silencio.

### 6.9 Pantalla de datos

Nueva pestaña **Ajustes › Datos y respaldos** (no una pestaña nueva del navigator — el
catálogo de 9 pestañas ya está lleno y `normalizeTabConfig` lo valida).

- **Exportar**: `OptionSheet` con Ligero / Completo / CSV por colección.
- **Restaurar**: botón que dispara el picker + dry-run + `ConfirmSheet` con el diff.
- **Estado**: reutiliza el `Stat` de tamaño que ya existe (líneas 336-351) agregando
  "último respaldo: <fecha>".
- Se actualiza el bloque `Almacenamiento` para distinguir `exports` (temporales) de
  `backups` (persistentes), con su propio botón de limpieza.

### 6.10 Versionado del esquema

```js
export const SUPPORTED_BACKUP_VERSION = 1;

const MIGRATIONS = {
  // 1 -> 2: agregar note.waveform
  // 2 -> 3: renombrar expense.note -> expense.detail
};

export function migrate(payload) {
  let data = payload;
  while (data.version < SUPPORTED_BACKUP_VERSION) {
    const step = MIGRATIONS[data.version];
    if (!step) throw new Error(`No hay migración desde v${data.version}`);
    data = step(data);
  }
  return data;
}
```

Toda exportación nueva escribe con `version: SUPPORTED_BACKUP_VERSION`, de modo que un
dispositivo viejo que lea un backup nuevo rechaza limpiamente en vez de corromper datos.

---

## 7. Plan de sprints

**Leyenda:** 🆕 crear · ✏️ modificar
Cada sprint cierra con su propia lista de verificación. **No se avanza al siguiente sprint
con verificaciones en rojo.**

---

### 🏁 SPRINT 1 — Dashboard modular (sin dependencias nuevas)

**Objetivo:** `HomeScreen` deja de tener secciones hardcodeadas. Cero dependencias.

| Acción | Archivo | Detalle |
|---|---|---|
| ✏️ | `src/services/storage.js` | Agregar `KEYS.widgetConfig = '@nexusday/v1/widget_config'` |
| 🆕 | `src/services/widgets.js` | `DEFAULT_WIDGET_CONFIG`, `normalizeWidgetConfig`, `moveWidget`, `setWidgetHidden`, `toggleWidgetHidden`, `widgetSignature` — **clon de `services/tabs.js`** |
| ✏️ | `src/context/AppDataContext.js` | Estado `widgetConfig` + `setWidgetConfig`; hidratar en el `Promise.all` de la línea 69-74; exponer en el `value` de la línea 239 |
| 🆕 | `src/components/dashboard/widgetRegistry.js` | Registro declarativo (ADR-5) |
| 🆕 | `src/components/dashboard/widgets/ExpenseSummaryWidget.js` | Extraer de `HomeScreen.js:152-157` |
| 🆕 | `src/components/dashboard/widgets/HabitsTodayWidget.js` | Nuevo: `Stat` + tira de 7 días (reutiliza `lastDays()`) |
| 🆕 | `src/components/dashboard/widgets/UpcomingWidget.js` | Extraer de `HomeScreen.js:175-210` (`data.nextUp`) |
| 🆕 | `src/components/dashboard/widgets/PinnedNotesWidget.js` | Nuevo: notas con `pinned: true` |
| ✏️ | `src/screens/HomeScreen.js` | **Reemplazar** los bloques hardcodeados por el `map` sobre el registro. Conservar hero, búsqueda global, tarjeta de permisos y accesos rápidos |
| ✏️ | `src/screens/SettingsScreen.js` | Nueva sección "Personalizar Inicio" reutilizando `styles.tabRow`/`tabArrows` |

**Riesgos:** el `Stat` de "Gastado hoy" y la fila de accesos rápidos **no son widgets** y no
deben moverse. El orden por defecto debe reproducir exactamente la pantalla de v1.1.0
(requisito de no-regresión visual).

**Verificación:** `npx expo lint` + `npx expo start`

- [ ] Con config nueva, Inicio renderiza idéntico a v1.1.0
- [ ] Mover un widget ↑/↓ lo persiste tras **cerrar y reabrir la app**
- [ ] Ocultar hasta dejar 2 visibles: el 3er `Switch` queda deshabilitado
- [ ] Un `widgetConfig` corrupto en AsyncStorage no rompe el arranque

---

### 🏁 SPRINT 2 — Resumen Diario Inteligente (sin dependencias nuevas)

| Acción | Archivo | Detalle |
|---|---|---|
| 🆕 | `src/services/briefing.js` | `buildDailyBriefing()` + las 9 reglas puras + scoring |
| 🆕 | `src/components/dashboard/widgets/DailyBriefingWidget.js` | Render del headline + hasta 3 `Pill` con `route`/`focusId` |
| ✏️ | `src/components/dashboard/widgetRegistry.js` | Registrar `dailyBriefing` como `locked: true` |
| ✏️ | `src/screens/HomeScreen.js` | El `headline` reemplaza el texto estático de las líneas 122-126 |

**Verificación:** `npx expo lint`

- [ ] Con cero datos → `all-clear`, tono `accent`, sin crash
- [ ] Un evento pasado hoy → `overdue` con tono `danger`
- [ ] Tocar un highlight navega a la sección y resalta el item (`useFocusId`)
- [ ] Gastos privados **no** aparecen en ningún texto del resumen
- [ ] El `headline` nunca supera 2 líneas en un iPhone SE

---

### 🏁 SPRINT 3 — Analíticas visuales (primera dependencia nativa)

| Acción | Archivo | Detalle |
|---|---|---|
| 📦 | `package.json` | `npx expo install react-native-svg react-native-gifted-charts` |
| 🆕 | `src/services/analytics.js` | `spendByCategory`, `spendSeries`, `habitHeatmap`, `habitStreakStats`, `monthlySpendStats`, `levelFor` |
| 🆕 | `src/components/charts/CategoryDonut.js` | `PieChart` de gifted-charts |
| 🆕 | `src/components/charts/SpendBarChart.js` | `BarChart` con `animationOnDataChange={false}` |
| 🆕 | `src/components/charts/SpendSparkline.js` | `View` planos (ADR-2) |
| 🆕 | `src/components/charts/HabitHeatmap.js` | `View` planos + `FlatList` con `getItemLayout` |
| 🆕 | `src/components/charts/TrendBadge.js` | `View` planos |
| ✏️ | `src/screens/ExpensesScreen.js` | Sección "Análisis" con `Chip` de período (7d/30d/mes/todo) |
| ✏️ | `src/screens/HabitsScreen.js` | `HabitHeatmap` colapsable por hábito |
| ✏️ | `src/components/dashboard/widgets/ExpenseSummaryWidget.js` | `SpendSparkline` de 28 días |

**Verificación:** `npx expo install --check` · `npx expo lint` · `npx expo run:android` · `npx expo-doctor`

- [ ] `expo-doctor` no reporta conflictos de versión
- [ ] El heatmap se ve bien con 1 hábito y con 12 hábitos
- [ ] Cambiar el acento repinta el heatmap (vía `applyAccent` + `themedStyles`)
- [ ] Con 365 días de gastos simulados, scrollear Gastos no baja de ~55 fps
- [ ] Las 6 colecciones y la búsqueda global siguen intactas

### 🏁 SPRINT 4 — Reproductor y onda visual (build de tienda)

> ⚠️ **Requiere build nuevo.** No se puede publicar por `eas update`.

| Acción | Archivo | Detalle |
|---|---|---|
| 🆕 | `src/context/AudioPlayerContext.js` | Singleton con `createAudioPlayer` + `useNotePlayer()` |
| 🆕 | `src/components/audio/Waveform.js` | Barras con `View`, progreso por índice |
| 🆕 | `src/components/audio/MiniPlayer.js` | Reproductor persistente |
| 🆕 | `src/components/audio/PlayerBar.js` | Scrubber interactivo con `onLayout` |
| ✏️ | `src/services/audio.js` | `ensureBackgroundPlaybackMode()`, `setActiveForLockScreen`, captura de waveform |
| ✏️ | `src/hooks/useRecorder.js` | Acumular picos de `metering` → `note.waveform` |
| ✏️ | `src/components/ui/media.js` | `VoicePlayback` delega en el contexto; `VoiceRecorder` guarda el waveform |
| ✏️ | `src/screens/NotesScreen.js` | Filas con audio delegan en `play(note)` |
| ✏️ | `App.js` | Montar `AudioPlayerProvider` + `<MiniPlayer />` bajo `RootNavigator` |
| ✏️ | `app.json` | `enableBackgroundPlayback: true` (línea 39) |

**Verificación:** `npx expo prebuild --clean` · `npx expo run:ios` · `npx expo run:android` · `npx expo lint`

- [ ] `Info.plist` contiene `UIBackgroundModes: [audio]`
- [ ] `AndroidManifest.xml` contiene `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y `AudioControlsService`
- [ ] Con la app en background, la nota sigue sonando **> 3 min** en Android
- [ ] Bloquear el phone muestra los controles con título y ±15 s
- [ ] Desbloquear y tocar la app reanuda en el mismo segundo
- [ ] Una nota de v1.1.0 (sin `waveform`) sigue reproduciéndose y muestra la barra simple
- [ ] Abrir 50 notas con audio **no** crea 50 players (verificar en el log nativo)
- [ ] `adb shell dumpsys media_session` muestra una sola sesión activa

---

### 🏁 SPRINT 5 — Backup & Restore (build de tienda)

| Acción | Archivo | Detalle |
|---|---|---|
| 📦 | `package.json` | `npx expo install expo-crypto expo-secure-store` |
| 🆕 | `src/services/backupIntegrity.js` | `signBackup`, `verifyBackup`, `canonicalize`, clave en SecureStore |
| 🆕 | `src/services/backup.js` | `buildBackup`, `validateSchema`, `migrate`, `buildPreview`, `applyRestore` |
| 🆕 | `src/services/csv.js` | `toCSV` (RFC 4180) + `CSV_COLUMNS` |
| 🆕 | `src/components/settings/BackupSheet.js` | Opciones de exportación + progreso |
| 🆕 | `src/components/settings/RestorePreview.js` | Diff antes de confirmar |
| ✏️ | `src/services/files.js` | `FOLDERS.backups`; `writeChunks()`; `readAsBase64()` |
| ✏️ | `src/services/storage.js` | `KEYS.lastBackupAt` |
| ✏️ | `src/context/AppDataContext.js` | `restoreAll(data)` que orquesta `clearAllData()` + carga |
| ✏️ | `src/screens/SettingsScreen.js` | Sección "Datos y respaldos" + `Stat` de tamaño |

**Verificación:** `npx expo install --check` · `npx expo lint` · `npx expo-doctor` · `npx expo run:android`

- [ ] Exportar Ligero → archivo < 200 KB, `shareAsync` abre la hoja del sistema
- [ ] Exportar Completo → el tamaño es ≈ ×1.37 de los binarios
- [ ] Editar a mano un byte del `.nexusday` → el import **falla** con mensaje de integridad
- [ ] Exportar → borrar todo → restaurar en **otro dispositivo**: datos + acento + widgets OK
- [ ] Un backup de `version: 99` se rechaza sin tocar los datos actuales
- [ ] "Combinar" no pisa una nota más nueva
- [ ] El CSV abre en Excel es-AR con acentos correctos y en una sola fila por gasto
- [ ] "Incluir privados" pide biometría antes de activarse
- [ ] El restore no deja ningún `uri` apuntando a un archivo inexistente
- [ ] `clearAllData()` + restore no dispara el bug de `wipedRef`

---

## 8. Matriz de dependencias

### 8.1 Paquetes a instalar

| Comando | Paquete | Versión SDK 57 | Tipo | ¿Expo Go? | ¿Dev build? |
|---|---|---|---|---|---|
| `npx expo install` | `react-native-svg` | `15.15.4` | Nativa | ✅ | **Sí** |
| `npx expo install` | `react-native-gifted-charts` | `1.4.78` | JS pura | ✅ | No |
| `npx expo install` | `expo-crypto` | `~57.0.3` | Nativa | ✅ | **Sí** |
| `npx expo install` | `expo-secure-store` | `~57.0.4` | Nativa | ✅ | **Sí** |

**Ya instaladas y reutilizadas, sin cambios:** `expo-audio`, `expo-file-system`,
`expo-sharing`, `expo-document-picker`, `expo-local-authentication`, `expo-notifications`,
`expo-calendar`, `@react-native-async-storage/async-storage`.

**Descartadas con justificación:** `victory-native` (arrastra Skia, ADR-2),
`@shopify/react-native-skia` (+10–15 MB, rompe Expo Go), `react-native-draggable-flatlist`
(los flechas ↑/↓ ya resuelven el reordenamiento, §3.3), `expo-zip` (los binarios van
embebidos en base64, §6.4), `zod` (el proyecto tiene cero librerías de validación y la
validación del schema es pequeña, §6.7), `@noble/ciphers` (diferido a v1.3.0, ADR-4).

### 8.2 Cambios de configuración

| Archivo | Cambio | ¿Bloquea OTA? |
|---|---|---|
| `app.json` | `expo-audio` → `enableBackgroundPlayback: true` | **Sí** — build de tienda |
| `package.json` | +4 dependencias | **Sí** — build de tienda |
| `AGENTS.md` | Documentar ADR-1 (React Navigation) | No |

### 8.3 Compatibilidad verificada

| Verificación | Resultado |
|---|---|
| `expo` `~57.0.26` → `bundledNativeModules.json` | `react-native-svg 15.15.4`, `expo-crypto ~57.0.3`, `expo-secure-store ~57.0.4` ✅ |
| `react-native-gifted-charts@1.4.78` peer deps | `react-native-svg` ✅ · `expo-linear-gradient` opcional (no usada) ✅ · `react-native-linear-gradient` opcional ✅ |
| `victory-native@42.0.1` peer deps | Exige `@shopify/react-native-skia >=2.6.0 <3.0.0` y `react-native-gesture-handler` — **no instalados** ❌ |
| `expo-audio@57.0.5` API de background | `AudioMode.shouldPlayInBackground` ✅ · `AudioPlayer.setActiveForLockScreen(active, metadata, options)` ✅ · `createAudioPlayer(source, options)` ✅ |
| `expo-audio` config plugin | `enableBackgroundPlayback` (default `true` en el plugin; explícito `false` en `app.json:39`) → agrega `UIBackgroundModes` + `FOREGROUND_SERVICE_MEDIA_PLAYBACK` + `AudioControlsService` ✅ |
| `expo-file-system@57.0.7` para base64 | `File.base64()` / `base64Sync()` / `bytes()` / `bytesSync()` ✅ · `File.write(content, { encoding: 'base64' })` con `EncodingType.Base64 = "base64"` ✅ |
| Estado actual de `node_modules` | `react-native-svg`, `expo-crypto`, `expo-secure-store`, `react-native-gifted-charts` **aún no instalados** → correr `npx expo install` |

> **Nota sobre `AGENTS.md`:** el archivo instruye `npx tsc --noEmit`, pero **el proyecto no
> tiene `tsconfig.json` ni un solo archivo `.ts`**. Ese comando no aplica hoy. Si en v1.3 se
> decide adoptar TypeScript, hay que agregar `typescript` y `tsconfig.json` como tarea
> propia, no asumir que ya funciona.

---

## 9. Matriz de riesgos

| # | Riesgo | Prob. | Impacto | Mitigación | Sprint |
|---|---|---|---|---|---|
| R1 | Regresión visual en Inicio al modularizar | Alta | Medio | El orden por defecto replica v1.1.0 exactamente; checklist S1 | 1 |
| R2 | `interruptionMode: 'doNotMix'` pausa la música del usuario | Media | Medio | Documentar en el changelog; `duckOthers` como alternativa de menor fricción | 4 |
| R3 | Android corta el audio en background a los ~3 min | Media | **Alto** | `setActiveForLockScreen` + `enableBackgroundPlayback: true`; probar > 5 min reales | 4 |
| R4 | Fuga de memoria por N players si el singleton falla | Media | **Alto** | Verificar `release()` en S4-T0 y con `dumpsys media_session` | 4 |
| R5 | Un restore mal aplicado **borra** datos irrecuperables | Baja | **Crítico** | Dry-run obligatorio + `ConfirmSheet` + esperar `hydrated` + rechazar schema no soportado | 5 |
| R6 | Archivo de 33 MB causa Out-Of-Memory en gama baja | Media | Alto | Escritura/lectura por chunks; advertir > 50 MB; modo Ligero por defecto | 5 |
| R7 | `expo-crypto` no cifra y el usuario espera cifrado | **Alta** | Alto | Declararlo en la UI y en el changelog; cifrado real en v1.3.0 (ADR-4) | 5 |
| R8 | Heatmap de 126 celdas con re-render en cada toggle de hábito | Media | Medio | `React.memo` + `getItemLayout` + cuantización pre-calculada | 3 |
| R9 | `widgetConfig`/`tabConfig` desincronizados tras un restore | Baja | Bajo | `normalizeWidgetConfig` y `normalizeTabConfig` se aplican siempre al hidratar | 1 |
| R10 | Los `.ics` quedan junto a los `.nexusday` y no se limpian | Media | Bajo | Carpetas separadas `exports/` vs `backups/`; botón de limpieza propio | 5 |

---

## 10. Definición de "Hecho" (Definition of Done)

Una funcionalidad de v1.2.0 está terminada cuando:

- [ ] `npx expo lint` pasa **sin warnings nuevos**.
- [ ] `npx expo-doctor` no reporta conflictos.
- [ ] `npx expo install --check` confirma que las versiones coinciden con el SDK.
- [ ] Se probó en **al menos un iOS real y un Android real** si toca un módulo nativo.
- [ ] Toda función nueva de `src/services/` es ** pura, sin efectos y testeable de forma aislada.
- [ ] Todo componente nuevo registra sus estilos con `themedStyles()` para que `applyAccent()` los repinte.
- [ ] Todo elemento interactivo nuevo tiene `accessibilityRole` y `accessibilityLabel` en español.
- [ ] La UI está **en español neutro** (sin voseo ni localismos), con `formatMoney` para importes y `relativeDayLabel` para fechas.
- [ ] Ningún dato `private: true` aparece en texto compartido, exportación ni resumen.
- [ ] Los errores de I/O degradan con un `Notice` explicativo, nunca con una pantalla en blanco.

---

## 11. Hoja de ruta posterior

| Versión | Alcance |
|---|---|
| **v1.2.0** | Este documento: dashboard modular + resumen diario + analíticas + audio en background + backup |
| **v1.3.0** | Cifrado real de respaldos con passphrase (`@noble/ciphers` + PBKDF2 + AES-GCM); exportación programada; `expo-haptics` |
| **v1.4.0** | Migración a **Expo Router** (ADR-1), con la navegación dinámica como requisito de aceptación |
| **v2.0.0** | Opcional: sincronización cifrada extremo a extremo. Requiere revisar toda la postura de privacidad |

---

## 12. Resumen de entregables

| Sprint | Entregable | Deps | Release |
|---|---|---|---|
| 1 | Dashboard modular con widgets ordenables y ocultables | — | OTA |
| 2 | Resumen Diario Inteligente en la cabecera | — | OTA |
| 3 | Analíticas de gastos y hábitos | `svg` + `gifted-charts` | Build |
| 4 | Reproductor persistente con onda visual y background | `app.json` nativo | Build |
| 5 | Backup & Restore en JSON/CSV con integridad | `expo-crypto` + `expo-secure-store` | Build |

---

*Documento generado como parte de la planificación de v1.2.0. Ningún cambio de código fue
aplicado sobre `v1.1.0` al escribir este documento.*












