# NexusDay

**Tu día, organizado en un solo lugar.**

NexusDay es una aplicación móvil de organización personal, diseñada para funcionar sin cuenta y guardar la información de la aplicación en el dispositivo. Reúne el horario, las rutinas, las notas y el calendario en una experiencia sencilla con tres temas: **Blanco, Oscuro y Nex**.

> **Estado:** primera pre-release pública para Android. NexusDay 1.2.0 ya está disponible para descargar.

[![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-4630EB?logo=expo)](https://docs.expo.dev/versions/v58.0.0/)
[![Android](https://img.shields.io/badge/plataforma-Android-3DDC84?logo=android&logoColor=white)](#requisitos)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

## Descargar

**[Descargar NexusDay 1.2.0 Preview para Android](https://github.com/Matixvc/NexusDay/releases/download/v1.2.0-preview/NexusDay-v1.2.0-preview.apk)**
[Ver todas las versiones en GitHub Releases](https://github.com/Matixvc/NexusDay/releases)


## Qué incluye

- **Día a Día:** resumen de la jornada, clases, rutinas y eventos próximos.
- **Horario:** clases semanales y estados como día libre o clases suspendidas.
- **Rutinas:** actividades recurrentes por día, con seguimiento de cumplimiento.
- **Notas:** texto, listas, búsqueda, etiquetas y notas fijadas.
- **Privacidad ND-01:** las notas y gastos privados requieren autorización al acceder cuando la protección está activa; su contenido se mantiene redactado en las vistas y resúmenes correspondientes.
- **Calendario:** agenda, eventos y cumpleaños.
- **Recordatorios:** avisos locales asociados a actividades, cuando están configurados y permitidos por Android.
- **Ajustes:** personalización, preferencias, ayuda y gestión de datos.
- **Respaldos ND-02:** exportación e importación con validación y recuperación ante fallos controlados.
- **Temas:** Blanco, Oscuro y Nex.

### Funciones experimentales o pendientes

- **Widget Android «Mi horario»:** integración experimental; su disponibilidad y actualización deben validarse en una compilación nativa y en un launcher Android. No se garantiza actualización exacta con la aplicación cerrada.
- **Nex AI:** aparece como próximamente. No ofrece un chat o servicio de IA en esta versión.
- **Audio y archivos adjuntos:** se guardan como archivos locales. Los respaldos JSON conservan referencias, pero no incluyen esos archivos y no garantizan que puedan recuperarse en otro dispositivo.

## Requisitos

- Dispositivo Android compatible.
- Para instalar una APK descargada manualmente, Android puede solicitar permitir instalaciones desde el navegador o administrador de archivos utilizado.
- NexusDay no requiere Expo Go para ejecutar una APK instalada.

No se publica aquí una versión mínima de Android hasta verificarla en el artefacto final.

## Instalar o actualizar

1. Descarga el archivo APK desde la sección **Assets** de una Release oficial de este repositorio.
2. Comprueba que el nombre del archivo y el SHA-256 coincidan con las notas de esa versión.
3. Abre la APK y confirma la instalación solicitada por Android.
4. Para actualizar una instalación existente, instala la APK sobre la aplicación actual; no la desinstales. La actualización solo conservará los datos si usa el mismo identificador Android y certificado de firma, y un `versionCode` superior.

Si Android rechaza la actualización por conflicto de firma o versión, detente y conserva la instalación y sus datos. No desinstales la app como solución.

## Actualizaciones de la aplicación

NexusDay prepara dos canales de EAS Update:

| Canal | Uso | Distribución |
| --- | --- | --- |
| `preview` | Pruebas personales | APK interna de prueba |
| `stable` | Versiones compartidas | APK publicada en GitHub Releases |

El canal se incorpora a una APK al compilarla. Por eso, las instalaciones existentes de `preview` continúan en `preview`; añadir el perfil `stable` no las cambia. Una actualización OTA solo llega a una instalación si coinciden plataforma, canal y `runtimeVersion`, y si la actualización no depende de código nativo ausente en esa APK.

Las mejoras de JavaScript y recursos compatibles pueden entregarse por OTA. Cambios en módulos nativos, plugins, permisos o configuración nativa requieren una nueva APK. Las actualizaciones OTA no sustituyen una instalación ni convierten el canal `preview` en `stable`.

La configuración actual fija `runtimeVersion` en `1.1.0` para mantener compatibilidad con la APK base de ese runtime. Debe cambiarse al preparar una versión con cambios nativos incompatibles. No publiques una OTA hasta probarla con una APK del mismo canal y runtime.

## Privacidad y datos

- No se necesita una cuenta para utilizar las funciones locales.
- Las colecciones de la app se guardan en el almacenamiento privado de NexusDay mediante AsyncStorage. EAS Update se usa para entregar código y recursos compatibles; no es sincronización de los registros personales.
- ND-01 protege el acceso a contenido marcado como privado mediante la autenticación disponible en el dispositivo y la preferencia de protección de la aplicación.
- La protección ND-01 controla el acceso dentro de la app; no equivale a cifrado de los datos de AsyncStorage en reposo.
- ND-02 valida los respaldos y mantiene compatibilidad con formatos anteriores. AsyncStorage no ofrece transacciones atómicas: el journal permite recuperarse de fallos controlados, pero no garantiza recuperación frente a corrupción física o fallos repetidos del almacenamiento.
- Los JSON de respaldo no incorporan los bytes de grabaciones ni adjuntos locales.
- Desinstalar la aplicación puede borrar sus datos locales. Exporta una copia y verifica sus limitaciones antes de cambiar de dispositivo.

## Capturas

Las capturas reales de la aplicación se añadirán cuando estén disponibles. No se incluyen maquetas como si fueran imágenes de la versión instalada.

## Desarrollo

### Tecnologías

- Expo SDK 58, React Native 0.88 y React 19.
- JavaScript y React Navigation 7.
- AsyncStorage para persistencia local.
- EAS Build y EAS Update para compilaciones y actualizaciones compatibles.

### Ejecutar localmente

```bash
git clone https://github.com/Matixvc/NexusDay.git
cd NexusDay
npm ci
npx expo start
```

Expo Go sirve para desarrollar partes de la interfaz, pero no sustituye una compilación nativa para validar widgets y módulos que requieren código nativo.

### Comprobaciones del proyecto

```bash
npm test
npm run lint
npx expo install --check
npx expo-doctor
npx expo export --platform android
git diff --check
```

## Desarrollo y autoría

Desarrollado por **Matixvc**. El repositorio es público y el proyecto continúa en evolución; revisa las notas de cada Release para conocer su alcance y limitaciones.

El repositorio incluye una licencia MIT. Consulta [`LICENSE`](LICENSE) para sus términos.
