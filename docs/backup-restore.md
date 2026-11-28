# ND-02: respaldo y restauracion

## Formato aceptado

Las nuevas exportaciones usan `app: "NexusDay"`, `schema: 2` y siete colecciones: `activities`, `events`, `birthdays`, `notes`, `habits`, `expenses` y `routines`. Todas deben estar presentes, aunque esten vacias. Rutinas usa un registro por recurrencia; sus fechas de cumplimiento se validan, deduplican y ordenan sin eliminar historial. `alarmLeadMinutes` y `alarmNotificationId` son opcionales: una rutina histórica sin ellos conserva la alarma desactivada, y los IDs importados se descartan antes de reconciliar con Android.

Se aceptan copias `schema: 1` con las seis colecciones anteriores y exportaciones historicas sin `schema`. Al restaurar una copia anterior que no incluya `routines`, las rutinas actuales se conservan; una copia schema 2 puede reemplazarlas o vaciarlas explicitamente. Las copias historicas sin `schema` pueden omitir dominios conocidos: las colecciones omitidas conservan los datos actuales. Se rechazan esquemas desconocidos, colecciones malformadas, IDs duplicados y tipos incompatibles. Los campos desconocidos de los registros se conservan para extensibilidad.

## Persistencia y recuperacion

Antes de sustituir claves, NexusDay guarda las cadenas anteriores en `@nexusday/v1/restore_journal`. Despues escribe cada coleccion/preferencia y verifica su valor. El estado de React solo se actualiza tras esas escrituras. Si el proceso se interrumpe, la siguiente lectura intenta restaurar las cadenas anteriores antes de hidratar colecciones. Si esa recuperacion falla, la app muestra un error y no guarda los datos iniciales sobre el almacenamiento pendiente.

AsyncStorage no ofrece una transaccion atomica entre claves. El journal permite revertir interrupciones y fallos controlados mientras el almacenamiento siga disponible; incluye la nueva clave de rutinas y el borrado total. No garantiza recuperacion ante corrupcion fisica, perdida de espacio, fallo repetido durante la reversa ni dano del journal. La recuperacion puede quedar pendiente y volver a intentarse al abrir la app.

La autorizacion ND-01 se mantiene antes de restaurar si hay datos privados actuales, si la copia contiene notas/gastos privados o si desactiva la proteccion global. Los fallos de programacion de notificaciones se informan aparte: no revierten los datos ya restaurados.

Las rutinas no generan recordatorios del sistema en esta version: la infraestructura disponible solo permite reprogramar ocurrencias puntuales mientras la app se ejecuta y no garantiza recurrencia semanal fiable en segundo plano. Tampoco se incluyen en el widget Android de horario.

## Adjuntos y grabaciones

El JSON conserva descriptores y URIs locales de notas, pero no incluye bytes de `Documents/attachments` ni `Documents/recordings`. Esas referencias no garantizan portabilidad entre instalaciones o dispositivos. La pantalla de confirmacion advierte esta limitacion; la restauracion no copia ni borra archivos.
