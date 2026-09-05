# TO_DO — Synapse

Registro único de lo que queda pendiente. Los `CLAUDE.md` describen **cómo es el
sistema hoy**; acá va **lo que falta**. Si encontrás una nota de "pendiente"
suelta en otro archivo, movela para acá.

Cada punto dice qué pasa, por qué importa y dónde tocar. Lo que no tiene una
razón concreta para existir no debería estar en esta lista.

Última revisión: 2026-09-05.

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

> §13 (service worker) se resolvió el 2026-09-05 con **Serwist**, no con
> `next-pwa`: este último está sin mantenimiento desde 2022 y Serwist es su
> continuación. La app lee sin conexión; escribir sin conexión quedó afuera a
> pedido, ver abajo.

### 13b. Carga de datos sin conexión

Hoy todo lo que no sea `GET` va contra la red y falla en el momento si no hay.
Es la decisión correcta por defecto —el operario se entera cuando todavía puede
hacer algo— pero deja sin resolver el caso de la planta sin señal.

Encolar las cargas y sincronizarlas al volver la conexión no es un problema
técnico sino normativo: una entrada que se completa a las 10:15 y se sincroniza
a las 14:00 no tiene una hora obvia para el `AuditLog`. Registrar la de carga
miente sobre cuándo se hizo el ensayo; registrar la de sincronización miente
sobre cuándo se registró. La salida honesta es guardar las dos y que la
auditoría muestre ambas, lo que implica una columna nueva en `Entry` y decidir
cuál manda para los vencimientos.

Queda pendiente de decisión, junto con §9.

### 13c. La PWA no está verificada en un dispositivo real

El service worker está implementado y el build lo genera, pero **nadie lo vio
funcionar en un celular todavía**. Se intentó el 2026-09-05 con el reenvío de
puertos de VS Code y no se llegó: el frontend cargó, el login no.

La razón no es un bug sino cómo está armada la configuración, y conviene
tenerla escrita porque va a volver a aparecer:

- `NEXT_PUBLIC_API_URL` se hornea en el bundle **al construir**, no al
  arrancar. Con el valor de desarrollo (`http://localhost:3001/api`), el
  celular le pide la API a sí mismo y recibe `ERR_CONNECTION_REFUSED`.
- Probar de verdad exige que coincidan cuatro URLs: `NEXT_PUBLIC_API_URL` en
  el front, `FRONTEND_URL` y `GOOGLE_CALLBACK_URL` en la API, y el *authorized
  redirect URI* registrado en Google Cloud Console.
- No sirve la IP de la LAN: `http://192.168.x.x` no es un contexto seguro, así
  que el navegador **no registra ningún service worker**. Hace falta HTTPS.

Por eso se difiere al deploy en Vercel, donde las cuatro URLs son estables y el
HTTPS viene dado. Ver §22.

Lo que falta comprobar ahí: que la app se instale desde el celular, que una
pantalla ya visitada siga abriendo en modo avión, que una no visitada caiga en
`/offline`, y que el banner de sin conexión aparezca.

---

## Deploy

### 22. Primer deploy a Vercel

Nunca se desplegó. Además de conectar el repo, hay que dejar consistentes las
URLs que hoy apuntan a `localhost`:

| Dónde | Variable | Hoy |
|---|---|---|
| Vercel (web) | `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` |
| API | `FRONTEND_URL` | `http://localhost:3000` |
| API | `GOOGLE_CALLBACK_URL` | `http://localhost:3001/api/auth/google/callback` |
| Google Cloud Console | *Authorized redirect URI* | debe igualar a `GOOGLE_CALLBACK_URL` |

`FRONTEND_URL` cumple doble función en el backend: es el origen que acepta por
CORS (`main.ts`) y a dónde redirige después del login (`auth.controller.ts`).
Si queda desactualizada, el síntoma es un login que "no hace nada".

Queda por decidir dónde vive la API: Vercel hostea el frontend, pero el backend
NestJS necesita un proceso propio (Railway, Fly, Render). Con eso definido se
cierra también §13c.

---

## Tests

Hay 131 tests en `apps/api` y 47 en `apps/web`. Corren con `pnpm test` y en CI.

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

> §23 (jerarquía de áreas en el dashboard) se resolvió el 2026-09-05 con
> `common/areas/area-scope.ts`, con 15 tests. Al hacerlo apareció algo más
> grande, abajo.

### 24. La visibilidad por área no se aplica en ningún módulo

`AreaAccessGuard` existe desde el principio y **no está referenciado en ningún
controller**. O sea que la regla más citada del sistema —cada uno ve su área y
las que dependen de ella— hoy solo rige en el dashboard, que fue el primero en
aplicarla.

En la práctica, cualquier usuario que entre a `/records`, `/non-conformities` o
`/instruments` ve todo lo de la organización. No es una fuga entre inquilinos
—el filtro por `organizationId` está en todos lados— pero contradice lo que la
documentación afirma y lo que un auditor esperaría de un control de accesos.

El resultado incómodo mientras tanto: **el dashboard es más estricto que las
listas a las que lleva.** Alguien puede no ver un vencimiento en el resumen y
encontrarlo entrando al módulo.

La pieza que falta ya está hecha: `alcanceDeAreas` y `filtroDeRecordsVisibles`
en `common/areas/area-scope.ts`. Lo que resta es aplicarla módulo por módulo,
y eso hay que hacerlo con cuidado y de a poco, porque cada módulo que se
restringe le puede sacar de la vista a alguien algo que hoy usa. Conviene
empezar por `records`, que es de donde cuelga el área de casi todo lo demás.

Decisiones ya tomadas al resolver §23, para no reabrirlas en cada módulo:

- `ADMIN` y `AUDITOR` no tienen restricción.
- Un registro **sin área** se muestra a todos. Desde el 2026-09-05 el alta
  obliga a elegir alcance explícitamente —"toda la organización" o áreas
  concretas— así que para los registros nuevos el vacío ya no es una omisión
  sino una decisión. Los anteriores quedan grandfathered como "toda la
  organización", que es como el sistema ya los trataba.
- Sin área asignada, un usuario solo ve lo no clasificado — y la pantalla se lo
  dice, en vez de mostrarle un tablero vacío que parece "todo en orden".
- Las aprobaciones no se filtran por área: un `ApprovalRequest` apunta a su
  entidad de forma polimórfica y no tiene área. El alcance que importa ahí es
  el rol de calidad — lo que a uno le toca revisar o aprobar.

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
