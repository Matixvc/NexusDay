# NEX-P1 Día a Día Premium — Diseño

## Intención

Convertir Inicio en una portada diaria Android distintiva y accionable: debe responder rápidamente qué ocurre ahora, qué viene después y qué puede hacerse en cualquier momento, sin perder el carácter offline-first ni los contratos de NEX-S1, NEX-S2, ND-01 y ND-02.

## Objetivos

- Crear una evolución visual evidente en Blanco, Oscuro y Nex usando el sistema de temas actual.
- Dar máxima jerarquía a la actividad en curso y conservar el contador por minuto.
- Permitir completar y deshacer rutinas desde Inicio mediante el repositorio persistente existente.
- Abrir eventos en su fecha y registro concretos, preservando contexto de navegación.
- Separar agenda horaria de actividades y rutinas sin hora.
- Mantener privacidad, accesibilidad, escalado de texto, pantallas estrechas y reducción de movimiento.

## No objetivos

- No cambiar rutas históricas, navegación principal, esquemas ni claves persistidas.
- No crear otra colección, sincronización, almacenamiento paralelo ni dependencia.
- No modificar widgets, privacidad, respaldo/restauración o código nativo.
- No generar recursos nuevos: se reutilizarán los activos Nex existentes.
- No publicar OTA, generar APK ni avanzar a NEX-P2.

## Restricciones

- Expo SDK 58, React Native 0.88, React 19.3 y React Navigation 7.
- JavaScript y componentes/tokens existentes.
- El éxito visual de una rutina solo se confirma después de que la escritura persistente resuelva correctamente.
- Una rutina ocupada bloquea pulsaciones repetidas y expone `busy`/`disabled` a TalkBack.
- La información privada no participa en resúmenes, búsquedas ni superficies nuevas.
- El orden de la agenda es estable al completar o deshacer una rutina.

## Referencias verificadas

- [Structured](https://structured.app/): una única línea visual facilita comprender el día, pero NexusDay no copiará su interfaz ni obligará elementos sin hora a ocupar un bloque temporal.
- [Todoist Today](https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs): foco diario, acción de completar in situ y separación de tareas con fecha/hora.
- [Microsoft To Do My Day](https://support.microsoft.com/en-us/todo/my-day-and-suggestions): superficie deliberadamente acotada a lo que importa hoy.
- [Google Calendar Android Schedule](https://support.google.com/calendar/answer/6110849?co=GENIE.Platform%3DAndroid&hl=EN): lectura cronológica y navegación a una fecha concreta.

Estas referencias aportan principios, no composiciones, imágenes ni identidad visual.

## Enfoques considerados

### 1. Línea temporal única

Un eje vertical reúne clases, eventos y rutinas. Es fuerte para actividades horarias, pero inventa posiciones para rutinas y elementos sin hora y pierde claridad cuando el día está vacío.

### 2. Módulos independientes

Tarjetas separadas para actividad, rutinas y eventos. Es el cambio más seguro, pero conserva el problema actual de fragmentación y favorece “todo es una tarjeta”.

### 3. Portada editorial contextual — elegido

Una composición jerárquica con tres zonas: “Ahora”, “Después” y “En cualquier momento”. Mantiene una lectura temporal sin forzar datos, permite acciones directas y ofrece una identidad Nex propia mediante ritmo, acento y recursos existentes.

## Arquitectura funcional

### Modelo de presentación

`src/services/dashboard.js` será la única fuente de clasificación. Devolverá:

- `currentActivity`: entre las actividades horarias en curso, la que comenzó más recientemente. Conserva nombre, tipo y rango horario.
- `concurrentActivities`: las demás actividades simultáneas, inmediatamente después de la principal, también marcadas “En curso” y ordenadas por hora de inicio descendente. Nunca se mezclan con próximas.
- `nextTimedItems`: actividades y eventos futuros ordenados cronológicamente, conservando tipo, identificador original, fecha y hora.
- `anytimeItems`: rutinas del día y actividades heredadas cuya hora esté ausente o vacía, sin reordenamiento por estado completado. Los eventos conservan su contrato horario y no se amplían ni migran en esta fase.
- estados vacíos diferenciados para día libre, agenda terminada y semana aún sin configurar.

La pantalla no duplicará reglas temporales ni privacidad.

### Rutinas

- Inicio consumirá `toggleRoutineCompletion(id, dateKey)` del contexto existente.
- Cada fila mantendrá estado ocupado por id hasta que la promesa termine.
- Durante la escritura: control deshabilitado, `accessibilityState.busy = true` y copia neutra.
- Al resolver: la misma fila mostrará check, “Completada”, menor contraste y acción “Deshacer”.
- Al rechazar: conservará el estado anterior y mostrará feedback de error accesible; no anunciará éxito.
- Pulsaciones adicionales durante la escritura no ejecutarán otra mutación.

### Eventos

Cada evento conservará `eventId` y `dateKey`. Al pulsarlo, Inicio navegará a `Agenda` con la fecha seleccionada y `focusId`, usando el patrón existente de parámetros y sin perder la pila actual. El calendario aplicará ambos parámetros una vez y enfocará el registro concreto.

### Actividades

- “Ahora” mostrará una actividad en curso con rango horario, ubicación y progreso textual por tiempo restante.
- “Después” priorizará el siguiente elemento horario y continuará con una agenda compacta.
- “En cualquier momento” alojará rutinas y elementos sin hora.
- Clases, eventos y rutinas usarán iconografía y etiquetas semánticas distintas, no solo color.

## Arquitectura visual

### Encabezado editorial

Saludo, fecha y ajustes conservan el encabezado actual, pero el rótulo Día a Día y el resumen de carga diaria formarán una introducción compacta. La búsqueda permanece disponible sin desplazar la acción principal fuera de la primera pantalla.

### Ahora

Superficie destacada única, no una pila de tarjetas. En Blanco y Oscuro usa contraste de superficie y borde; en Nex añade el recurso existente `nex-flow.jpg` o decoración ya integrada con una superposición legible. Sin actividad actual, cambia a un estado útil: próxima actividad, agenda finalizada o día libre.

### Después

Agenda lineal compacta con columna horaria flexible, marcador semántico, título y metadatos. Las horas no usan anchos rígidos incompatibles con escalado; el layout puede envolver sin cortar información.

### En cualquier momento

Filas ligeras para rutinas y elementos sin hora. El control de rutina tiene objetivo táctil mínimo de 48 dp, texto accesible y estado visual persistente. Completar no mueve la fila.

### Temas

- Blanco: superficies claras, contraste editorial y acento controlado.
- Oscuro: profundidad por superficies, bordes y tipografía; no depender de sombras.
- Nex: identidad reconocible mediante composición, acento y arte existente; no mediante un hero decorativo que desplace tareas.

## Movimiento y feedback

- Frecuencia: decenas de veces al día; propósito: feedback y cambio de estado.
- Solo feedback de presión ya existente y una transición breve de opacidad posterior a la persistencia; sin animaciones de montaje por fila ni reordenamiento. Como el proyecto no declara Reanimated y no se permiten dependencias, se usará el mecanismo nativo mínimo disponible para opacidad con driver nativo, sin gestos ni estado por frame en JavaScript.
- Duración objetivo: 120–180 ms.
- Si `settings.reduceMotion` es verdadero, se elimina escala/traslación y permanece únicamente el cambio instantáneo de estado/contraste.
- Un solo háptico tras persistencia exitosa; nunca es el único feedback.
- No se añade Reanimated ni otra dependencia.

## Accesibilidad

- Objetivos táctiles mínimos de 48 dp y `hitSlop` cuando el control visual sea menor.
- Roles, etiquetas, hints y estados `checked`, `busy` y `disabled` para TalkBack.
- Anuncio de éxito o fallo después de la persistencia.
- El orden de lectura coincide con “Ahora”, “Después”, “En cualquier momento”.
- Texto ampliado puede envolver; horas y acciones no se recortan.
- Tipo de elemento se comunica con icono/texto además de color.

## Rendimiento

- Conservar `ScrollView` mientras el dashboard mantenga listas acotadas; no hay evidencia para añadir virtualización.
- Clasificación memoizada a través de `buildDashboard` y callbacks estables.
- No introducir estado por frame ni animaciones de layout/elevación.
- Extraer componentes locales de Inicio solo cuando reduzcan la complejidad y permitan pruebas de contrato; no crear primitivas globales especulativas.

## Pruebas y criterios de aceptación

- RED → GREEN para actividad en curso, siguiente actividad y elementos sin hora.
- RED → GREEN para completar, deshacer, fallo persistente y doble pulsación.
- Evento desde Inicio navega con fecha e id concretos y el calendario consume ambos.
- Estados vacíos distinguen configuración ausente, día libre y agenda terminada.
- Controles de rutina exponen estados accesibles y texto accionable.
- Los fixtures privados no aparecen en el modelo ni en la UI del dashboard.
- Suite completa, lint, compatibilidad Expo, Expo Doctor, export Android y `git diff --check` pasan.

## Compatibilidad y despliegue

El cambio es JavaScript/recursos ya empaquetados, sin configuración nativa ni dependencias: compatible con OTA desde el punto de vista técnico. Esta fase no publicará OTA. La exportación Android valida el bundle, pero no sustituye un build nativo o QA real.

## QA Android requerida

- Teléfono estrecho y tableta; fuentes 100%, 150% y 200%.
- TalkBack: orden, check, busy, completada y deshacer.
- Pulsaciones rápidas y fallo de escritura simulado/fixture aislado.
- Cambio de Blanco/Oscuro/Nex y reducción de movimiento.
- Cruces exactos de hora de inicio/fin y retorno desde Calendario.
- Rendimiento en dispositivo Android de gama media/baja.
