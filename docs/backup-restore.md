# ND-02: respaldo y restauracion

## Formato aceptado

Las exportaciones actuales usan `app: "NexusDay"`, `schema: 1` y las seis colecciones: `activities`, `events`, `birthdays`, `notes`, `habits` y `expenses`. Todas deben estar presentes, aunque esten vacias. Cada registro requiere un `id` no vacio y unico dentro de su coleccion, mas los campos minimos del dominio. Los campos conocidos se validan por tipo, incluidos los indicadores de privacidad y los elementos de checklist.

Las copias historicas sin `schema` pueden contener una o mas colecciones conocidas. Todas las colecciones presentes deben ser validas; las omitidas conservan los datos actuales y la confirmacion lo informa. Un marcador de version presente distinto de 1 se rechaza. No se descartan campos desconocidos de registros para preservar extensibilidad.

## Persistencia y recuperacion

Antes de sustituir claves, NexusDay guarda las cadenas anteriores en `@nexusday/v1/restore_journal`. Despues escribe cada coleccion/preferencia y verifica su valor. El estado de React solo se actualiza tras esas escrituras. Si el proceso se interrumpe, la siguiente lectura intenta restaurar las cadenas anteriores antes de hidratar colecciones. Si esa recuperacion falla, la app muestra un error y no guarda los datos iniciales sobre el almacenamiento pendiente.

AsyncStorage no ofrece una transaccion atomica entre claves. El journal permite revertir interrupciones y fallos controlados mientras el almacenamiento siga disponible; no garantiza recuperacion ante corrupcion fisica, perdida de espacio, fallo repetido durante la reversa ni dano del journal. La recuperacion puede quedar pendiente y volver a intentarse al abrir la app.

La autorizacion ND-01 se mantiene antes de restaurar si hay datos privados actuales, si la copia contiene notas/gastos privados o si desactiva la proteccion global. Los fallos de programacion de notificaciones se informan aparte: no revierten los datos ya restaurados.

## Adjuntos y grabaciones

El JSON conserva descriptores y URIs locales de notas, pero no incluye bytes de `Documents/attachments` ni `Documents/recordings`. Esas referencias no garantizan portabilidad entre instalaciones o dispositivos. La pantalla de confirmacion advierte esta limitacion; la restauracion no copia ni borra archivos.
