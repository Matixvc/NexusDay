# NEX-P1 Día a Día Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar Inicio en una portada diaria premium, accionable y accesible con zonas Ahora, Después y En cualquier momento.

**Architecture:** `dashboard.js` clasifica todos los datos diarios sin duplicar reglas en React. Un servicio pequeño coordina acciones de rutina y bloquea duplicados hasta confirmar persistencia. `HomeScreen` compone fragmentos locales de presentación y navega a eventos concretos mediante los parámetros históricos de React Navigation.

**Tech Stack:** Expo SDK 58, React Native 0.88, React 19.3, React Navigation 7, JavaScript, node:test/assert, tokens y recursos existentes.

**Spec:** `docs/superpowers/specs/2026-11-25-nex-p1-dia-a-dia-premium-design.md`

## Global Constraints

- No modificar dependencias, almacenamiento, privacidad, restauración, rutas históricas, widgets ni código nativo.
- Conservar ND-01, ND-02, NEX-S1 y NEX-S2.
- No crear commits adicionales, push, APK ni publicación OTA.
- Preservar `design/` y `tsconfig.json`.
- Usar fixtures aislados; no acceder a datos personales.

## Review Focus

- Dos o más clases simultáneas: principal por inicio más reciente; restantes separadas de próximas y ordenadas descendente.
- Límites exactos: inicio inclusivo, fin exclusivo y actividad finalizada nunca aparece en Ahora.
- Rutina con escritura pendiente o fallida: una sola operación, sin éxito prematuro, fila estable y reintento posterior posible.
- Horas vacías y texto ampliado: elemento en En cualquier momento, horario accesible sin recorte.
- Privacidad: notas y gastos privados no aparecen en ningún resumen nuevo.

---

### Task 1: Modelo premium del día

**Files:**
- Modify: `src/services/dashboard.js`
- Create: `scripts/home-premium-test.cjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `buildDashboard(...).currentActivity`, `.concurrentActivities`, `.nextTimedItems`, `.anytimeItems`, `.dayState`.
- Los elementos conservan `sourceId`, `kind`, `title`, `startTime`, `endTime`, `dateKey`, `detail`, `color` y estado de rutina cuando corresponda.

- [ ] Escribir fixtures literales para actividad actual, dos solapadas, próxima, terminada, suspendida, rutina y actividad con horas vacías.
- [ ] Ejecutar `node scripts/home-premium-test.cjs` y confirmar RED por campos ausentes.
- [ ] Implementar clasificación temporal en `buildDashboard`, con inicio inclusivo, fin exclusivo y orden estable.
- [ ] Añadir casos de estados vacíos: `unconfigured`, `free`, `finished` y `active`.
- [ ] Verificar privacidad con notas/gastos privados y ejecutar GREEN.
- [ ] Integrar `test:home-premium` en `npm test` sin cambiar dependencias.

### Task 2: Coordinador persistente de rutinas

**Files:**
- Create: `src/services/homeActions.js`
- Modify: `scripts/home-premium-test.cjs`

**Interfaces:**
- Produces: `createRoutineToggleGuard({ toggleRoutineCompletion, onPendingChange })`.
- `toggle(routineId, dateKey)` devuelve `{ ok, status }`; `status` es `completed`, `failed` o `busy`.
- `onPendingChange(routineId, pending)` permite reflejar `busy` en React.

- [ ] Añadir prueba RED donde dos llamadas simultáneas ejecutan una sola escritura.
- [ ] Añadir prueba RED de éxito solo después de resolver la promesa, fallo sin mutación visual definitiva y reintento permitido.
- [ ] Implementar el guard con un `Set` privado y `finally` para liberar el id.
- [ ] Ejecutar GREEN y mutation-check mental: quitar el guard debe romper la prueba doble.

### Task 3: Navegación específica de eventos

**Files:**
- Modify: `src/services/homeActions.js`
- Modify: `src/screens/HomeScreen.js`
- Modify: `src/screens/CalendarScreen.js`
- Modify: `scripts/home-premium-test.cjs`

**Interfaces:**
- Produces: `eventDestination(event) -> { route: 'Agenda', params: { focusId, dateKey } }`.
- Calendar consume `dateKey` y `focusId`; abre el editor del evento una sola vez y conserva la pila.

- [ ] Añadir prueba RED del destino literal con id y fecha.
- [ ] Implementar `eventDestination` sin cambiar nombres de rutas.
- [ ] Conectar cada evento de Inicio a su destino específico.
- [ ] Hacer que Calendar aplique primero `dateKey` y luego el `focusId` existente sin reabrir en renders posteriores.
- [ ] Ejecutar pruebas de Inicio y calendario.

### Task 4: Componentes locales accesibles de Inicio

**Files:**
- Create: `src/screens/home/DaySections.js`
- Modify: `src/screens/HomeScreen.js`
- Modify: `scripts/home-premium-test.cjs`

**Interfaces:**
- Produces: `CurrentActivitySection`, `TimedAgendaSection`, `AnytimeSection` y `RoutineActionRow`.
- `RoutineActionRow` consume `{ item, pending, reduceMotion, onToggle }` y expone estados TalkBack.

- [ ] Añadir pruebas/contratos RED para textos Ahora/Después/En cualquier momento, objetivo táctil de 48 dp, estados `checked`, `busy`, `disabled`, etiqueta Completar/Deshacer y fila estable.
- [ ] Implementar fragmentos locales usando `Icon`, `Pill`, tokens y componentes existentes.
- [ ] Aplicar transición de opacidad de 120–180 ms únicamente tras persistencia; con `reduceMotion` el cambio es inmediato.
- [ ] Anunciar éxito o fallo accesiblemente y emitir háptico solo tras éxito.
- [ ] Verificar que completar reduce contraste sin ocultar nombre, tipo u horario.

### Task 5: Composición visual Nex Premium

**Files:**
- Modify: `src/screens/HomeScreen.js`
- Modify: `src/screens/home/DaySections.js`
- Modify: `scripts/premium-smoke-test.cjs`

**Interfaces:**
- Consumes el modelo de Task 1 y componentes de Task 4.
- Conserva búsqueda, permisos, acceso a Ajustes/Horario y los tres temas.

- [ ] Escribir contratos RED de jerarquía: encabezado editorial, Ahora antes de Después, En cualquier momento al final y estados vacíos diferenciados.
- [ ] Sustituir la tarjeta monolítica actual por la portada contextual sin “todo es una tarjeta”.
- [ ] Reutilizar `assets/nex/u11/backgrounds/nex-flow.jpg`, `nex-schedule-compact.jpg` y `nex-schedule-free-day.jpg` solo en Nex y con texto legible superpuesto o separado.
- [ ] Mantener Blanco/Oscuro mediante tokens, flex-wrap y columnas horarias adaptables a `fontScale`.
- [ ] Mantener listas acotadas y cálculos memoizados; no añadir virtualización ni dependencias.
- [ ] Ejecutar `npm run test:home-premium`, `npm run test:premium`, `npm run test:privacy` y corregir hasta GREEN.

### Task 6: Verificación integral

**Files:**
- Modify únicamente archivos NEX-P1 si una verificación descubre una regresión reproducible.

- [ ] Ejecutar `npm test`.
- [ ] Ejecutar `npm run lint`.
- [ ] Ejecutar `npx expo install --check`.
- [ ] Ejecutar `npx expo-doctor`.
- [ ] Ejecutar `npx expo export --platform android`.
- [ ] Ejecutar `git diff --check`.
- [ ] Revisar `git diff 61cf827 --` y confirmar que `design/`, `tsconfig.json`, privacidad, respaldo, widgets, dependencias y código nativo no cambiaron.
- [ ] Reportar automatización separada de QA Android real y no declarar APK/build nativo.
