<div align="center">

# NexusDay

**Your entire day, in one local-first pocket companion.**

[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020.svg?style=flat&logo=expo&logoColor=white)](https://docs.expo.dev/versions/v57.0.0/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-20232A.svg?style=flat&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![License](https://img.shields.io/badge/license-see%20LICENSE-4fd1c5.svg?style=flat)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-4fd1c5.svg?style=flat&logo=apple&logoColor=white)]()
[![Offline](https://img.shields.io/badge/data-100%25%20on--device-4fd1c5.svg?style=flat&logo=lock&logoColor=white)]()

</div>

---

## 📱 What is NexusDay?

**NexusDay** is a personal daily-organizer that lives entirely on your phone. It brings
your class schedule, agenda, birthdays, notes, habits and expenses into a single interface
— with **no account, no server, and no network calls**.

It is built with **Expo SDK 57 / React Native 0.86**, ships for **iOS and Android**, and is
fully usable offline.

<div align="center">

| | |
|---|---|
| 🗂️ **Six collections, one app** | Schedule, events, birthdays, notes, habits, expenses |
| 🔍 **Search everything** | One query across notes, events, habits and expenses |
| 🧭 **Nine swipeable sections** | A custom tab bar you can reorder and hide |
| 🎙️ **Voice notes** | Record, attach and play audio memos inside a note |
| 🔐 **Biometric lock** | Face ID / fingerprint / PIN on private notes and expenses |
| 🧠 **Nexus AI** | Offline Q&A **and commands** — writes notes, events and expenses without an API key or network |
| 🎨 **4 neon themes** | Switch the accent of the entire UI instantly |

</div>

---

## 🎨 Design Philosophy

### Dark-first, not dark-only

NexusDay renders on a **true-black canvas** (`#0a0a0a`) chosen for OLED displays, where
black pixels are physically switched off and save real battery. The interface is built from
a strict ladder of elevated surfaces (`#101012` → `#151518` → `#1d1d21` → `#27272d`), each
separated by a 1px hairline border rather than a drop shadow. Depth comes from **layering
and luminance**, not from blur.

> **A note on "glassmorphism":** NexusDay deliberately **does not** use `expo-blur`,
> `BlurView` or gradient overlays. Translucent blur over a solid black background costs a
> native view and a per-frame offscreen pass on both platforms while being visually
> indistinguishable from a well-layered flat surface on a dark theme. The depth is achieved
> with surface elevation + hairline borders + accent glow instead.

### Neon accents with runtime re-theming

A single accent token propagates through the entire application — active tab underline,
primary buttons, chips, calendar highlights, the selected-day ring, chart bars, and the
habit heatmap.

Four themes ship in the box:

| Theme | Accent | Character |
|---|---|---|
| **Cyan / Violet** *(default)* | `#4fd1c5` | The original: cold turquoise with a violet detail |
| **Emerald Cyberpunk** | `#00f5a0` | Acid terminal green, maximum contrast on black |
| **Sunset Gold** | `#ffb020` | Warm amber for buttons and text |
| **OLED Monochrome** | `#f5f5f7` | White on pure black — no colour, maximum legibility |

**The interesting engineering problem** is *how* a theme change repaints a running app.
React Native's `StyleSheet.create()` freezes every object in `__DEV__`, so a frozen style
would throw on mutation. NexusDay instead maintains its own style registry:

```js
// src/theme/theme.js
const styleRegistry = new Set();

export function themedStyles(styles) {
  styleRegistry.add(styles);
  return styles;            // mutable plain object, NOT StyleSheet.create()
}

export function applyAccent(accentId) {
  const theme = getAccentTheme(accentId);
  const mapping = { [colors.accent]: theme.accent, /* ... */ };

  Object.assign(colors, { accent: theme.accent, accentSoft: ..., accentInk: ... });
  styleRegistry.forEach((styles) => repaint(styles, mapping));   // recursive string replace
  return theme;
}
```

The registry holds every `themedStyles(...)` sheet plus the navigation and calendar themes.
`repaint()` walks each object up to depth 5 and swaps any string that matches an old accent
token. **Result:** switching the theme repaints ~20 screens with zero re-renders, zero
re-mounts and zero jank, and the same object identity keeps every `React.memo` comparison
stable.

### Zero-dependency iconography

The app ships **no icon font** (`@expo/vector-icons` is deliberately absent). All nine tab
glyphs are composed from plain `View`s with border tricks (`TabGlyphs.js`). They tint
cleanly for the active state, scale to any density, and cost ~0 KB of binary size.

---

## 🏗️ Architecture

### Stack

| Layer | Technology |
|---|---|
| Framework | **Expo SDK 57.0.26** (Continuous Native Generation) |
| Runtime | **React Native 0.86.3** · **React 19.2.3** |
| Language | **JavaScript (ESM)** — documented with JSDoc; no TypeScript build step |
| Navigation | **React Navigation 7** — `material-top-tabs` + a custom bottom bar |
| Persistence | **AsyncStorage 2.2.0** (`@react-native-async-storage/async-storage`) |
| Audio | `expo-audio` — recording **and** playback |
| Files | `expo-file-system` (SDK 57 class API) · `expo-sharing` · `expo-document-picker` |
| Security | `expo-local-authentication` (Face ID / fingerprint / PIN) |
| Haptics | `expo-haptics` — wrapped in a never-throwing, no-op-on-failure service |
| Calendar | `react-native-calendars` — the app never writes to the device calendar |
| Notifications | `expo-notifications` (with inline completion actions) |
| Delivery | **EAS Build** (Cloud Native Generation) |

> **On navigation:** this project uses **React Navigation**, not Expo Router. That is a
> deliberate, documented decision — the tab bar supports *runtime reordering and hiding* of
> nine routes, and the global search navigates by route name to tabs that may be hidden.
> Every route therefore stays registered in the navigator at all times. See
> [`ROADMAP_V1.2.md`](ROADMAP_V1.2.md) § ADR-1 for the full rationale.

### Data flow

```mermaid
flowchart TD
    A[Screen] -->|useAppData| B[AppDataContext]
    B --> C[6 x usePersistentCollection]
    C -->|loadJSON / saveJSON| D[(AsyncStorage<br/>@nexusday/v1/*)]
    B --> E[settings · userName · tabConfig · permission]
    E --> D
    F[AppState] -.re-check.-> B

    A --> G[buildDashboard / searchEverything / habitStreak]
    G -.pure functions.-> B

    H[Media] --> I[(Documents/recordings)]
    J[Notes] -->|describeFile| B
    I -.File object.-> J
```

### Six collections, one persistence contract

Every collection goes through the same hook, `usePersistentCollection(key, initial)`:

```js
// src/hooks/usePersistentCollection.js
export function usePersistentCollection(key, initialValue = []) {
  // 1. Hydrates once on mount, then mirrors every change back to storage.
  // 2. Writes are blocked until hydration finishes, so the seed value can never
  //    overwrite data already on the device.
  // 3. A `wipedRef` guard ensures a wipe that races the initial read wins —
  //    otherwise the sample data the read is still returning would be written back.
  return { items, setItems, create, update, remove, replaceAll, hydrated };
}
```

That third point is the subtle one: on first run the app seeds sample data, then the
tutorial wipes it. Without the guard, the in-flight `loadJSON` would resolve *after* the
wipe and resurrect the seed records.

### Namespacing and backward compatibility

All keys live under `@nexusday/v1/`. The app was previously branded differently, so
`storage.js` keeps a read-only fallback to the legacy namespace and migrates on write:

```js
async function readItem(key) {
  const raw = await AsyncStorage.getItem(key);
  if (raw != null) return raw;
  return AsyncStorage.getItem(legacyKey(key));   // '@appmobile/v1/...'
}
```

`removeKey()` clears **both** namespaces, so "Erase all data" never leaves a copy behind.

### Graceful degradation

Native modules are probed before use rather than assumed. `isAvailable()` in
`services/audio.js` and `services/files.js` does a `require` inside a `try/catch` and
returns a boolean, so the UI can collapse an unavailable control into a notice instead of
crashing on a hook whose native module is missing (Expo Go without a dev build, a test
runner, a headless environment).

---

## ✨ Key Features

| Feature | What it does | Where |
|---|---|---|
| **Interactive onboarding** | 5-step swipeable tutorial; on first run it **wipes the sample data** so you never inherit someone else's schedule. Replayable from Settings without touching your data. | `OnboardingScreen.js` |
| **Dynamically customizable navigation** | Reorder the 9 tabs and hide the ones you don't use. Home is always pinned first. Hidden tabs stay reachable via global search and can be restored with one tap from a "pin" slot. | `services/tabs.js`, `RootNavigator.js` |
| **Global search** | One field ranks matches across notes, events, habits and expenses by prefix-match, field weight and recency. Tapping a result navigates **and highlights** the exact item. | `services/search.js`, `useFocusId.js` |
| **Private notes & expenses** | Per-item biometric lock. Private content is also **excluded from search results and from any summary text** — the lock protects the content, not just the record. | `services/privacy.js` |
| **Neon accent modes** | 4 themes, instant runtime repaint via the mutable style registry (see above). Also retints the calendar and navigation themes. | `theme/accents.js`, `theme.js` |
| **Haptic feedback** | Native tactile response wired through `expo-haptics`: a light impact on primary actions, a selection tick when flipping a switch, a success pulse when a habit is ticked, and a medium impact when a swipe action fires. | `services/haptics.js` |
| **Voice notes** | Record in-app (mono, 64 kbps, metered level bar), replayed inline with a progress bar. The finished take is moved out of the cache into permanent storage only when accepted. | `hooks/useRecorder.js`, `ui/media.js` |
| **Swipe gestures** | Swipe a row left/right to pin, lock, share or delete, with an `expo-local-authentication` prompt for destructive actions. | `ui/SwipeRow.js` |
| **Offline assistant (Nexus AI)** | An intent matcher that answers "¿Qué tengo hoy?" / "¿Cuánto gasté este mes?" from data already on the device, plus a command layer that *writes*: "crea una nota de la reunión", "agenda el médico el martes a las 8:30", "gasté 1.250 en comida" create a note, an event or an expense. **No API key, no network call** — and the UI says so explicitly. When a sentence is ambiguous nothing is written. | `services/assistant.js`, `services/assistantCommands.js` |
| **Smart notifications** | Reminders re-arm automatically after reboots or app updates, and a "✓ Complete" button in the shade applies the habit tick to the live collection. | `services/reminders.js`, `notifications.js` |
| **Calendar bridge** | Copies events to the native calendar and exports to `.ics` through the system share sheet. | `services/calendar.js` |
| **Multi-format money** | Parses `1.234,56` and `1234.56` alike; formats as es-AR (`$ 1.850,50`) while writing machine-readable decimals to exports. | `utils/money.js` |

> **On haptics:** feedback is **subtle and semantic**, not decorative. Marking a habit done
> buzzes, *un*-marking stays silent; the vibration means "done", so an accidental un-tick
> never adds noise. Every call is wrapped by `services/haptics.js`, which probes the module
> once and degrades to a no-op on a device without a vibrator or in a simulator.

---

## 📁 Project structure

```
nexusday/
├── App.js                     # Providers + AppShell (onboarding gate, accent remount)
├── app.json                   # Expo config + permission copy + config plugins
├── eas.json                   # development / preview / production build profiles
├── assets/                    # Icon set, adaptive Android icons, hero background
└── src/
    ├── components/
    │   ├── dashboard/         # (v1.2) modular dashboard widgets
    │   └── ui/                # Design-system primitives: Screen, Card, Sheet, SwipeRow…
    ├── context/
    │   ├── AppDataContext.js  # Single source of truth for all collections
    │   └── ThemeContext.js    # Accent theme + revision counter
    ├── data/seeds.js          # First-run sample data (wiped after onboarding)
    ├── hooks/
    │   ├── usePersistentCollection.js  # The persistence contract
    │   ├── useRecorder.js
    │   └── useFocusId.js
    ├── navigation/
    │   ├── tabs.js            # Catalogue of the 9 sections
    │   ├── RootNavigator.js
    │   ├── BottomTabBar.js
    │   └── TabGlyphs.js       # View-drawn icons (no icon font)
    ├── screens/               # One file per section
    ├── services/              # All business logic as pure, testable functions
    │   ├── audio.js           # expo-audio: permissions, sessions, file juggling
    │   ├── calendar.js        # expo-calendar + .ics export
    │   ├── dashboard.js       # buildDashboard(), habitStreak(), pendingHabits()
    │   ├── files.js           # expo-file-system SDK 57 class API
    │   ├── notifications.js
    │   ├── privacy.js         # expo-local-authentication
    │   ├── reminders.js
    │   ├── search.js
    │   ├── storage.js         # AsyncStorage + legacy namespace fallback
    │   └── tabs.js            # Tab order/visibility model
    ├── theme/                 # colors, spacing, typography, accents, themedStyles
    └── utils/                 # dates, money, text — pure helpers
```

**Convention:** `src/services/` holds **pure functions over hydrated collections**; screens
subscribe to context and stay declarative. Dashboard logic lives in a single `useMemo`
calling `buildDashboard()` — which is why the dashboard can be tested without rendering a
single component.

---

## 🚀 Getting started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or newer | `node --version` |
| npm | 10+ | Ships with Node |
| **Expo Go** *(optional)* | latest | UI only — see the warning below |
| **EAS CLI** | 23.2+ | Only needed to build or publish |
| Xcode 16+ / Android Studio | latest | Only for local native builds |

> ⚠️ **NexusDay needs a development build for some features.**
> Voice recording, the calendar bridge, notifications, biometrics and haptics are **native
> modules**. In Expo Go those controls degrade into an explanatory notice instead of
> crashing, but to use them you must build the app:
>
> ```bash
> npx expo run:ios        # or
> npx expo run:android
> ```

### 1. Clone and install

```bash
git clone https://github.com/Matixvc/NexusDay.git
cd NexusDay
npm install
```

> Using **Bun**? `bun install` works and `bun.lock` is respected.

### 2. Run in development

```bash
npx expo start
```

Scan the QR code with Expo Go, or press `a` / `i` for the local emulators.

### 3. (Optional) Build a development client

```bash
npx expo run:ios
npx expo run:android
```

### 4. Quality checks

```bash
npx expo lint             # ESLint (eslint-config-expo)
npx expo-doctor           # dependency and config health
npx expo install --check  # confirm versions match the SDK
```

> **Note:** `npx tsc --noEmit` does **not** apply to this project — it is plain JavaScript
> and ships no `tsconfig.json`. TypeScript adoption is tracked for a future version.

---

## ☁️ Building with EAS

NexusDay uses **Continuous Native Generation**: there is no `ios/` or `android/` folder in
the repository. EAS generates the native projects from `app.json` on every build, so config
plugins are the single source of truth for native behaviour.

### One-time setup

```bash
npm install -g eas-cli      # or: npx eas-cli@latest
eas login
eas build:configure         # already done — eas.json and app.json are committed
```

### Build profiles

| Profile | Distribution | Purpose |
|---|---|---|
| `development` | Internal | Development client with hot reload |
| `preview` | Internal | Ad-hoc install for QA, no store polish |
| `production` | Store | `autoIncrement: true` — the build number is bumped on every submit |

### Commands

```bash
# Internal build for QA
eas build --profile preview --platform all

# Production store build
eas build --profile production --platform all

# Submit to the stores
eas submit --profile production --platform all
```

### Over-the-air updates

Pure-JS changes ship without a store review:

```bash
eas update --branch production --message "fix: dashboard empty state"
```

> ⚠️ **OTA only applies to JavaScript.** Any change to `app.json` plugins, native
> permissions or the dependency list requires a **new store build**. This constraint is
> tracked explicitly in [`ROADMAP_V1.2.md`](ROADMAP_V1.2.md) § 5.4, which is why the
> v1.2.0 work is split into two release tracks.

### Android release signing

```bash
eas credentials          # interactive: generate and store the upload keystore
```

Credentials are stored in EAS servers — **no keystore is ever committed**.

---

## 🗺️ Roadmap

| Version | Scope |
|---|---|
| **v1.1.0** *(current)* | Interactive onboarding, customizable tabs, biometric lock, swipe gestures |
| **v1.2.0** | Modular dashboard widgets, smart daily summary, spending & habit analytics, background audio player with waveform, JSON/CSV backup & restore |
| **v1.3.0** | Encrypted backups with passphrase, scheduled exports |
| **v1.4.0** | Migration to Expo Router |

The full technical plan — architecture decisions, sprint breakdown, dependency matrix and
risk register — lives in **[`ROADMAP_V1.2.md`](ROADMAP_V1.2.md)**.

---

## 🔒 Privacy

- **No account. No server. No analytics SDK. No network calls.**
- Everything is stored in the app sandbox (`AsyncStorage` + `Documents/`).
- Private notes and expenses require device authentication, and their content is excluded
  from search results, dashboard aggregates and any summary text.
- The assistant is a local intent matcher — there is no API key in the repository and no
  request leaves the device.
- Uninstalling the app deletes everything it owns.

---

## 📄 License

See [`LICENSE`](LICENSE).

---

<div align="center">

**Built with Expo, React Native and a lot of care for the details.**

`NexusDay v1.1.0` · Expo SDK 57 · React Native 0.86

</div>



