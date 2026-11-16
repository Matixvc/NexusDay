# NexusDay development rules

Expo SDK 58, React Native 0.88 and React 19.3 mobile app. The codebase is primarily
JavaScript and uses React Navigation 7. Keep the product offline-first and cross-platform.

## Architecture

- Screens live in `src/screens`, reusable UI in `src/components`, state in `src/context`,
  and business/platform logic in `src/services`.
- Keep React Navigation and current route names unless a phase explicitly authorizes a migration.
- Preserve the six persisted domains: activities, events, birthdays, notes, habits and expenses.
- Storage changes must remain backward compatible with existing `@nexusday/v1/*` data.
- Treat `android/` and `ios/` as generated CNG output. Do not edit them manually without approval.

## Expo and dependencies

- Read the installed Expo major, then use its versioned docs and
  `https://docs.expo.dev/llms.txt` before changing Expo or React Native APIs.
- Install Expo packages only with `npx expo install`; justify every dependency change.
- Do not update Expo, React Native or dependencies unless the current phase authorizes it.

## Safety and Git

- Never expose personal data, backup contents, credentials, tokens or signing material.
- Do not read or mutate real app data during development; use isolated fixtures.
- Work only on feature/development branches, never directly on `main` or `backup/*`.
- Do not rewrite history or run destructive Git/file operations without explicit approval.
- Keep changes limited to the active phase; do not commit or push unless requested.

## Validation

Use npm (`package-lock.json` is authoritative):

```bash
npm run lint
npx expo install --check
npx expo-doctor
npx expo export --platform android
```

Run relevant tests when present. Distinguish static checks, JS export, native build and
real-device testing in reports. A task is not complete while required checks fail.
