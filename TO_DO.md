# TO_DO — Synapse

Registro único de lo que queda pendiente. Los `CLAUDE.md` describen **cómo es el
sistema hoy**; acá va **lo que falta**. Si encontrás una nota de "pendiente"
suelta en otro archivo, movela para acá.

Cada punto dice qué pasa, por qué importa y dónde tocar. Lo que no tiene una
razón concreta para existir no debería estar en esta lista.

Última revisión: 2026-09-04.

---

## Bugs confirmados

### 1. Las fórmulas con espacios no evalúan

`apps/api/src/modules/entries/services/formula-evaluator.service.ts`

`"2+3"` devuelve 5, pero `"2 + 3"` devuelve `null` sin ningún aviso. La causa
está en el saneado: la cadena que se evalúa conserva los espacios y la que se
usa para compararla los elimina, así que nunca coinciden si el usuario escribió
la fórmula con espacios — que es lo normal.

```
"2+3"          → 5
"2 + 3"        → null
"(10-2)*4"     → 32
"(10 - 2) * 4" → null
```

Un campo `FORMULA` afectado queda vacío y el usuario no tiene forma de saber por
qué. Impacto directo en registros que calculan resultados.

### 2. El evaluador de fórmulas usa `Function()`, no mathjs

Mismo archivo. La regla 3 de `CLAUDE.md` dice "**Nunca** usar `eval()` para
fórmulas. Solo `mathjs` con scope explícito", pero **mathjs no está instalado en
ningún workspace** y la evaluación se hace con `Function(...)`, que es `eval`
por otro nombre.

El riesgo real hoy es bajo: antes de evaluar se descarta todo carácter que no
sea dígito, operador, paréntesis o punto, y con ese alfabeto no se puede
alcanzar ningún global ni llamar funciones. Pero la defensa depende de que esa
expresión regular sea correcta para siempre, que es exactamente lo que la regla
buscaba evitar.

Hay que decidir una de dos: instalar mathjs y usarlo con scope explícito, o
documentar la excepción en `CLAUDE.md` explicando por qué el whitelist alcanza.
Lo que no puede quedar es la regla diciendo una cosa y el código haciendo otra.

Conviene resolver esto junto con el punto 1, que toca la misma función.

---

## Seguridad

### 3. No hay `middleware.ts` que proteja las rutas privadas

`apps/web` — las páginas bajo `(app)/*` no verifican sesión del lado del
servidor. Si no hay token, la protección real la da la API, que responde 401 y
recién ahí el cliente redirige a `/login`. El efecto es que se renderiza el
armazón de una página privada antes de rebotar.

Falta un `middleware.ts` que redirija a `/login` cuando no hay sesión válida.

### 4. La CSP acepta cualquier bucket de R2

`apps/web/next.config.js` — `frame-src` e `img-src` permiten
`https://*.r2.cloudflarestorage.com` porque el account id no está expuesto al
frontend. Funciona, pero es más amplio de lo necesario.

Se endurece definiendo `NEXT_PUBLIC_R2_URL` con el origen exacto; el código ya
lo prefiere si está presente.

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

### 6. `NOTIFY`, `EMAIL` y `WEBHOOK` son stubs

`apps/api/src/modules/entries/listeners/record-action.listener.ts` — los tres
`actionType` existen en el enum y se pueden elegir desde el editor visual, pero
sus handlers solo escriben una línea en el log.

El usuario puede configurar un flujo que "envía un email" y nunca se entera de
que no pasa nada. O se implementan, o el editor debería marcarlos como no
disponibles.

`EMAIL` necesita un transport (Resend o nodemailer); `NOTIFY` necesita definir
el modelo de notificaciones, que hoy no existe.

### 7. `triggeredByCascade` no se propaga en las cascadas

Cuando una acción crea una entry, el evento resultante no lleva el flag, así que
el anti-loop de `allowCascade` no protege más allá del primer salto. Con dos
flujos que se apuntan mutuamente y `allowCascade` en `true`, la cadena no tiene
corte.

Viene anotado de `WORKFLOW_ENGINE_SPEC.md` §riesgos.

### 8. Conviven dos modelos de no conformidades

La página `/non-conformities` usa el enum `NonConformityStatus`, mientras que el
Record de sistema "No Conformidades" usa el motor DROPDOWN-as-status. Son dos
formas de representar lo mismo.

Está pendiente decidir cuál queda. Hay una nota en memoria del proyecto sobre
mantenerlas independientes por peso ISO en auditoría — vale confirmarlo antes de
consolidar.

---

## ISO / trazabilidad

### 9. Cadena de custodia de muestras (ISO 17025 §7.4)

Especificado en detalle en `SAMPLE_CUSTODY_SPEC.md`. Falta el modelo
`SampleCustodyEvent` (append-only) y la página
`apps/web/src/app/(app)/samples/[id]/custody/page.tsx`.

Es el hueco de cumplimiento más grande que queda.

### 10. La pestaña Auditoría del detalle de registro es un placeholder

`apps/web/src/app/(app)/records/[id]/page.tsx` — la pestaña existe pero no
muestra el timeline. Los datos ya están: el `AuditLog` guarda `before` y `after`
desde 2026-09-04, y `/audit` los lista de forma global.

---

## Stack declarado que no existe

Estas tres cosas figuraban en los `CLAUDE.md` como parte del stack sin estar
implementadas. Ya se corrigió la documentación; queda decidir si se implementan
o se descartan definitivamente.

### 11. BullMQ + Redis

`REDIS_URL` está en el `.env` y la documentación hablaba de colas y scheduling
de notificaciones, pero **no hay dependencia ni una sola importación**. Cualquier
trabajo diferido —recordatorios de vencimiento, reintentos de acciones
fallidas— hoy no tiene dónde correr.

El almacén de códigos de login (`auth-code.service.ts`) también lo necesitaría
si la API pasa a correr en más de una instancia; hoy es memoria del proceso.

### 12. `next-auth`

Es dependencia de `apps/web` pero **no se importa en ningún archivo**. El login
es un flujo propio: Google OAuth contra la API, código de un solo uso, y el JWT
en `localStorage`. Se puede desinstalar.

### 13. `next-pwa`

La documentación describía una PWA con service worker y runtime caching. El
paquete **no está instalado** y `next.config.js` no lo configura. Existe
`public/manifest.json`, así que la app es instalable, pero no funciona offline
ni cachea nada.

---

## Tests

Hay 70 tests en `apps/api`, todos de lógica pura. Corren con `pnpm test` y en CI.

### 14. El frontend no tiene ningún test

Ni runner configurado. Los primeros que valdría la pena: el `DynamicRecordForm`
(que es el corazón de la app) y los helpers de fórmulas.

### 15. Backend sin cubrir

Por orden de valor:

- `comparison-evaluator.service` — todos los operadores, constante contra campo.
- `formula-evaluator.service` — junto con el arreglo de los puntos 1 y 2.
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

### 18. `caniuse-lite` desactualizado

El build avisa que la base de datos de browsers tiene 6 meses. Se arregla con
`npx update-browserslist-db@latest`.
