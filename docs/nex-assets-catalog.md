# NexusDay — catálogo de recursos Nex (U9.2)

Los 20 recursos de esta biblioteca son originales y locales. Se optimizaron desde sus PNG de generación usando Windows GDI+: JPEG calidad 84 para arte opaco y PNG con alfa para adornos. No reemplazan recursos anteriores. En U9.3 se integraron los tres adornos indicados para Ajustes; las demás familias quedan preparadas para U9.4. El peso es el tamaño final en disco.

| Nombre | Ruta | Dimensiones | Peso | Destino | Tema | Uso recomendado |
| --- | --- | ---: | ---: | --- | --- | --- |
| Nex Home | `assets/nex/backgrounds/nex-home.jpg` | 941×1672 | 54 KB | Inicio | Nex | Fondo atmosférico; reservar la zona superior para controles nativos. |
| Nex Notes | `assets/nex/backgrounds/nex-notes.jpg` | 941×1672 | 40 KB | Notas | Nex | Fondo de baja prominencia; no usar en cada fila. |
| Nex Calendar | `assets/nex/backgrounds/nex-calendar.jpg` | 941×1672 | 51 KB | Calendario | Nex | Fondo editorial con espacio para agenda. |
| AI Orbit | `assets/nex/ai/nex-ai-orbit.jpg` | 1254×1254 | 75 KB | Experiencias Nex AI | Nex | Núcleo oscuro con órbita vítrea violeta. |
| AI Core | `assets/nex/ai/nex-ai-core.jpg` | 1254×1254 | 74 KB | Experiencias Nex AI | Nex | Núcleo violeta y menta; imagen individual, no icono funcional. |
| AI Petal | `assets/nex/ai/nex-ai-petal.jpg` | 1254×1254 | 104 KB | Experiencias Nex AI | Nex | Esfera de capas grafito con luz violeta/cian. |
| Onboarding Day | `assets/nex/onboarding/nex-onboarding-day.jpg` | 1122×1402 | 98 KB | Tutorial, Día a Día | Nex; adaptable con placa | Planificador de día con bloques vacíos y lazo violeta. |
| Onboarding Notes | `assets/nex/onboarding/nex-onboarding-notes.jpg` | 1122×1402 | 71 KB | Tutorial, Notas | Nex | Cuaderno grafito abierto sin escritura. |
| Onboarding Calendar | `assets/nex/onboarding/nex-onboarding-calendar.jpg` | 1122×1402 | 63 KB | Tutorial, Calendario | Nex | Mosaico grafito sin fechas ni números. |
| Notes Empty | `assets/nex/notes/nex-notes-empty.jpg` | 1254×1254 | 52 KB | Estado vacío de Notas | Nex | Hoja vacía con marcador; sin contenido de usuario. |
| Checklist Empty | `assets/nex/notes/nex-checklist-empty.jpg` | 1254×1254 | 66 KB | Estado vacío de checklists | Nex | Bloques vacíos y cinta abstracta. |
| Calendar Empty | `assets/nex/calendar/nex-calendar-empty.jpg` | 1254×1254 | 57 KB | Estado vacío de agenda | Nex | Módulo vacío bajo una órbita violeta. |
| Birthday | `assets/nex/calendar/nex-birthday.jpg` | 1254×1254 | 85 KB | Tutorial/estado de cumpleaños | Nex | Regalo grafito con lazo violeta; no representa una fecha concreta. |
| Schedule Compact | `assets/nex/schedule/nex-schedule-compact.jpg` | 1672×941 | 57 KB | Widget compacto, tutorial | Nex | Tres bloques abstractos; superponer texto nativo solo si el contraste lo permite. |
| Schedule Expanded | `assets/nex/schedule/nex-schedule-expanded.jpg` | 1672×941 | 64 KB | Widget expandido, tutorial | Nex | Filas vacías; no refleja clases reales. |
| Schedule Free Day | `assets/nex/schedule/nex-schedule-free-day.jpg` | 1254×1254 | 46 KB | Estado de día libre | Nex | Símbolo orbital abstracto, sin calendario ni datos. |
| Decor Ring | `assets/nex/decor/nex-decor-ring.png` | 640×427 | 55 KB | Preview del tema Nex en Ajustes | Nex | Aro translúcido aislado; transparencia alfa real. |
| Decor Halo | `assets/nex/decor/nex-decor-halo.png` | 700×350 | 267 KB | Encabezado de Ajustes | Nex | Halo difuso aislado; aparece una vez y solo en Nex. |
| Decor Arc | `assets/nex/decor/nex-decor-arc.png` | 1000×333 | 132 KB | Marca de Apariencia en Ajustes | Nex | Arco de vidrio aislado, transparencia alfa real. |
| Decor Fragments | `assets/nex/decor/nex-decor-fragments.png` | 700×467 | 124 KB | Composición reutilizable | Nex | Tres formas aisladas con transparencia alfa real. |

**Peso total de la biblioteca:** 1,59 MB (1.668.382 bytes). Las imágenes son mayormente oscuras y Nex-first; antes de mostrarlas en Claro, Oscuro o Blanco y negro, comprobar contraste y colocar texto/controles nativos fuera de la ilustración o sobre una superficie con contraste suficiente. Las decoraciones con alfa no deben escalarse como fondos completos. Los fondos solo deben cargarse en superficies de pantalla individuales, nunca en listas repetidas.

**Dirección compartida y generación:** ver [nex-visual-identity.md](nex-visual-identity.md). Todas las piezas se generaron individualmente con prompts de ilustración 3D editorial y restricciones comunes de no incluir texto, fechas, marcas, personas ni interfaces.
