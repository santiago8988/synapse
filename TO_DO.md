# TO_DO — Synapse

Registro único de lo que queda pendiente. Los `CLAUDE.md` describen **cómo es el
sistema hoy**; acá va **lo que falta**. Si encontrás una nota de "pendiente"
suelta en otro archivo, movela para acá.

Cada punto dice qué pasa, por qué importa y dónde tocar. Lo que no tiene una
razón concreta para existir no debería estar en esta lista.

Última revisión: 2026-09-04.

---

## Bugs confirmados

Ninguno abierto. Los dos que había —fórmulas con espacios que devolvían `null`, y
el evaluador usando `Function()` contra la regla 3— se resolvieron el 2026-09-04
reescribiendo `formula-evaluator.service` sobre mathjs.

## Seguridad

> §3 (middleware) y §4 (origen exacto de R2 en la CSP) se resolvieron el
> 2026-09-04. No queda nada abierto en esta sección.

---

## Base de datos

### 5. El historial de migraciones no coincide con el repo

`prisma migrate status` reporta cinco migraciones aplicadas en la base cuyo
nombre no existe en `prisma/migrations`:

```
20260403_matrix_versioning      → local: 20260403170633_matrix_versioning
20260403_redesign_sample_flow   → local: 20260403170634_redesign_sample_flow
20260407_stock_type             → local: 20260406235959_stock_type
20260408_calibration_templates  → local: 20260407235959_calibration_templates
20260421_drop_method_defaults   → sin equivalente local
```

Las primeras cuatro son carpetas renombradas: alguien les puso prefijo de
timestamp y la tabla `_prisma_migrations` quedó con los nombres viejos. La
quinta falta de verdad.

No bloquea nada —`prisma migrate deploy` funciona igual— pero significa que una
base reconstruida desde cero no saldría idéntica a producción, y que
`prisma migrate dev` siempre va a querer resetear.

El arreglo de las cuatro renombradas es un `UPDATE` sobre `_prisma_migrations`.
La quinta requiere averiguar qué hacía; el nombre sugiere que quitó valores
`DEFAULT` de `OrgMethod`, cuyas columnas `defaultMin`/`defaultMax` siguen
existiendo.

---

## Motor de flujos

> §7 (cadenas de cascada y anti-loop) se resolvió el 2026-09-04. El diagnóstico
> original de este archivo era incorrecto: no era que el flag no se propagara,
> sino que las entradas creadas por cascada no emitían ningún evento, así que
> la cadena moría en el primer salto.

### 6. `EMAIL` sigue sin implementarse

`apps/api/src/modules/entries/listeners/record-action.listener.ts` — el handler
solo escribe una línea en el log. En el editor visual la opción está
deshabilitada, así que nadie puede configurar un flujo que no vaya a enviar
nada.

Necesita un transport (Resend tiene plan gratuito de 3.000 correos al mes) y,
sobre todo, **un dominio propio verificado**: sin SPF/DKIM los avisos caen en
spam, y un sistema de calidad que avisa a la carpeta de correo no deseado es
peor que uno que no avisa, porque todos creen que sí.

`NOTIFY` y `WEBHOOK` se implementaron el 2026-09-04.

### 8. Conviven dos modelos de no conformidades

La página `/non-conformities` usa el enum `NonConformityStatus`, mientras que el
Record de sistema "No Conformidades" usa el motor DROPDOWN-as-status. Son dos
formas de representar lo mismo.

Está pendiente decidir cuál queda. Hay una nota en memoria del proyecto sobre
mantenerlas independientes por peso ISO en auditoría — vale confirmarlo antes de
consolidar.

---

## ISO / trazabilidad

> §10 (timeline de auditoría en el detalle de registro) se resolvió el
> 2026-09-05.

### 9. Cadena de custodia de muestras (ISO 17025 §7.4)

Especificado en detalle en `SAMPLE_CUSTODY_SPEC.md`. Falta el modelo
`SampleCustodyEvent` (append-only) y la página
`apps/web/src/app/(app)/samples/[id]/custody/page.tsx`.

Es el hueco de cumplimiento más grande que queda.

---

## Stack declarado que no existe

Figuraban en los `CLAUDE.md` como parte del stack sin estar implementadas. Ya
se corrigió la documentación; queda decidir si se implementan o se descartan.

`next-auth` se desinstaló el 2026-09-04: era dependencia y no se importaba en
ningún lado.

### 11. BullMQ + Redis

`REDIS_URL` está en el `.env` y la documentación hablaba de colas y scheduling
de notificaciones, pero **no hay dependencia ni una sola importación**. Cualquier
trabajo diferido —recordatorios de vencimiento, reintentos de acciones
fallidas— hoy no tiene dónde correr.

El almacén de códigos de login (`auth-code.service.ts`) también lo necesitaría
si la API pasa a correr en más de una instancia; hoy es memoria del proceso.

### 13. `next-pwa`

La documentación describía una PWA con service worker y runtime caching. El
paquete **no está instalado** y `next.config.js` no lo configura. Existe
`public/manifest.json`, así que la app es instalable, pero no funciona offline
ni cachea nada.

---

## Tests

Hay 116 tests en `apps/api` y 34 en `apps/web`. Corren con `pnpm test` y en CI.

> §14 (tests del frontend) se resolvió el 2026-09-05: runner montado, helpers de
> fórmulas y comparaciones, manejo de sesión y el `DynamicRecordForm`.

### 15. Backend sin cubrir

Por orden de valor:

- `area-access.guard` — resolución del árbol recursivo de áreas.
- Flujo de auth completo: whitelist, multi-organización, switch-org.
- `TransitionValidatorService` — transiciones permitidas y `requireReason`.

---

## Menores

### 16. `EntryStatus.INACTIVE`

`packages/types` lo menciona como pendiente. Requiere decidir la cascada: qué
pasa con las entries y companions que dependen de una entry inactivada.

### 17. Crear entry desde una subruta propia

`records/[id]/entries/new` está previsto en la estructura de rutas pero hoy la
creación se maneja inline en el detalle del registro.

---

## Consistencia

### 19. El preview de fórmulas y el backend son dos motores distintos

El frontend calcula el valor en vivo con `Function` y un puñado de funciones de
`Math`; el backend lo calcula con mathjs. Están alineados en lo que importa —se
tradujo `^` a `**` porque en JavaScript es XOR y en mathjs es potencia, y se
limitó el preview a la misma lista de funciones— pero son implementaciones
separadas que pueden divergir de nuevo.

Traer mathjs al bundle resolvería el problema de raíz, al costo de sumarle peso
a una PWA pensada para usarse en planta. Vale la pena medirlo antes de decidir.

Mientras tanto: cualquier función que se agregue de un lado hay que agregarla
del otro.

---

## Visualización

### 20. Las dos columnas de estado dicen lo mismo con distinto detalle

En `/records/[id]`, para registros con companion, la tabla muestra el estado del
lote (`PLANNED → IN_PROGRESS → COMPLETED → APPROVED/REJECTED`) y el de la
entrada (`DRAFT`/`COMPLETED`) en columnas adyacentes, ambas rotuladas ESTADO.

No son independientes: `batches.service.changeStatus` completa la entrada
automáticamente cuando el lote llega a COMPLETED. Así que el estado de la
entrada es una sombra binaria de una escala de cinco pasos.

La implicación va en un solo sentido: completar la entrada por
`POST /entries/:id/complete` **no** toca el lote. O sea que es alcanzable
"entrada COMPLETADA con lote PLANIFICADO", que no es un estado legítimo sino
una inconsistencia — alguien dio por cerrado el registro de una producción que
no arrancó.

Propuesta: una sola columna, la del lote, y mostrar la de la entrada solo cuando
contradiga lo que el lote implica. Ahí deja de ser ruido y pasa a ser un
detector de inconsistencias.

Se decidió dejar las dos por ahora.

### 21. El desvío entre cantidad pedida y producida no se ve

Un lote puede pedir 100 L y producir 90. Lo que viaja al stock por el flujo es
lo producido (`$batch.quantity`), así que el desvío importa. Hoy están en
columnas separadas por el borde de un grupo y el ojo no las compara solo.

Mostrarlo junto —`90 / 100 L`, con el desvío marcado— requiere que el sistema
sepa qué campo del registro representa la cantidad esperada, y hoy no hay
ninguna relación declarada entre el campo `CANTIDAD` y `Batch.producedQuantity`.
Inferirlo por el nombre sería frágil.

La forma honesta es declararlo: que un registro tipo BATCH pueda marcar cuál de
sus campos es la cantidad esperada. Es una decisión de modelado, no de UI, y
habilitaría además advertir cuando el desvío supera un umbral.
