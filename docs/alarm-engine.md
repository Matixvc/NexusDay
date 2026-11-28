# NEX-A1.2: motor base de alarmas Android

La infraestructura usa `expo-notifications` de Expo SDK 58. Las alarmas explícitas usan
`delivery: alarmClock` solo cuando Android concede acceso a alarmas exactas; si no, se
programan como `bestEffort` y el resultado informa precisión aproximada.

`android.permission.SCHEDULE_EXACT_ALARM` modifica el manifiesto generado por CNG. Por ello,
la integración requiere una APK nueva. Antes de distribuirla también debe asignarse un
`runtimeVersion` nuevo y probar cualquier OTA exclusivamente contra esa APK; el valor actual
se conserva en esta fase para no publicar ni separar accidentalmente el runtime instalado.

No hay formularios conectados ni migraciones. Los payloads admiten solo identificadores y las
alarmas privadas sustituyen título y cuerpo por texto genérico.
