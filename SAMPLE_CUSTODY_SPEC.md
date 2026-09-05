# Cadena de Custodia de Muestras — Especificacion de Implementacion

> **Branch**: `feature/sample-custody`
> **Target**: `main`
> **Nivel de cumplimiento**: ISO 17025 §7.4 (Manejo de items de ensayo) — Nivel 2 (cadena completa basada en eventos, sin firma digital ni adjuntos obligatorios)
> **Estado**: sin implementar. Seguimiento en `TO_DO.md` §9.

---

## 1. Contexto

La norma ISO 17025 §7.4 exige que los laboratorios mantengan un registro documentado e ininterrumpido de cada persona que manipula una muestra, cada transferencia de responsabilidad, cada ubicacion de almacenamiento y cada cambio en las condiciones ambientales, desde el momento en que la muestra se toma en campo hasta que finalmente se descarta.

Esto se conoce como **cadena de custodia**. Es el mecanismo que le permite al laboratorio demostrar, frente a un auditor, un organismo regulador o un juez, que:

1. La muestra analizada es **la misma** que se recolecto.
2. **Nadie** fuera de la cadena autorizada la manipulo.
3. **No hubo huecos temporales** durante los cuales la muestra estuviera fuera de control.
4. Las **condiciones de transporte y almacenamiento** nunca comprometieron la integridad de la muestra.
5. Cualquier mecanismo de **evidencia de manipulacion** (precinto, firma) permanecio intacto en todo el recorrido.

Un laboratorio que no puede reconstruir la cadena para una muestra dada no puede defender sus resultados en procedimientos formales, y queda expuesto a perder su acreditacion ISO 17025.

La plataforma QualitTab2 ya soporta el ciclo de vida basico de una muestra a traves de `Sample.status` (RECEIVED, IN_TESTING, COMPLETED, etc.), pero esos cambios de estado no son lo suficientemente granulares, son mutables, no registran quien realizo la accion con certeza criptografica, no documentan transferencias de custodia (entrega entre dos personas), y no capturan condiciones ambientales (temperatura, ubicacion, estado del precinto). Esta especificacion describe la implementacion de un log de eventos dedicado y append-only que cierra esos huecos.

---

## 2. Alcance

### Dentro del alcance

- Un nuevo modelo de base de datos `SampleCustodyEvent` que registra cada evento discreto en el ciclo de vida de una muestra, con timestamps inmutables, ejecutor, receptor opcional (para transferencias), ubicacion, condiciones ambientales, informacion del precinto y notas de texto libre.
- Un nuevo modulo NestJS que expone endpoints para registrar eventos y para recuperar la cadena completa de una muestra.
- Logica de validacion que impide registrar eventos fuera de orden cronologico, que exige doble firma en eventos de transferencia, y que prohibe editar o borrar cualquier evento pasado.
- Generacion automatica de eventos de custodia cuando el `status` de la muestra cambia a traves de los endpoints existentes, para que la cadena se mantenga sincronizada con el resto del sistema sin intervencion manual.
- Una pagina frontend que renderiza la cadena como una linea de tiempo vertical, con un formulario para registrar el siguiente evento valido segun el estado actual de la cadena.
- Una vista de exportacion read-only (HTML imprimible) que lista cada evento con su metadata, lista para adjuntar al informe de ensayo.

### Fuera del alcance (diferido a un futuro Nivel 3)

- Firmas digitales con cadenas de hash criptograficas.
- Adjuntos obligatorios (fotos del precinto, planillas de papel escaneadas).
- Exportacion a PDF con firmas embebidas.
- Alertas automaticas cuando una cadena lleva mas de N horas inactiva.
- Interfaz mobile-first para muestreadores en campo.
- Integracion con hardware externo de GPS / RFID / lectores de codigo de barras.

---

## 3. Modelo de Dominio

### 3.1 Tipos de evento

El siguiente enum captura cada momento distintivo que requiere documentacion. Cada valor corresponde a una etapa especifica del ciclo de vida tipico de una muestra de laboratorio.

| Valor del enum | Etapa | Actor tipico | Notas |
|---|---|---|---|
| `COLLECTED` | Toma en campo | Muestreador | Primer evento de toda cadena. Siempre requiere `location`. |
| `SEALED` | Aplicacion del precinto | Muestreador | Registra `sealNumber`. Opcional pero altamente recomendado. |
| `TRANSPORT_STARTED` | La muestra sale del sitio de muestreo | Muestreador / Transportista | Registra `temperatureC`. |
| `DELIVERED` | La muestra llega fisicamente a la puerta del laboratorio | Transportista | Se complementa con `RECEIVED`. Requiere `receivedById`. |
| `RECEIVED` | El laboratorio toma posesion formal | Personal de recepcion | Requiere `receivedById`. Verifica el precinto. |
| `STORED` | La muestra se ubica en un almacenamiento controlado | Recepcion / Analista | Registra `location` (ej. "Camara 2 - Estante B"). |
| `ASSIGNED_TO_ANALYST` | La muestra se asigna a un analista especifico para su ensayo | Recepcion / Jefe de laboratorio | Requiere `receivedById` (el analista). |
| `ANALYSIS_STARTED` | El analista comienza los ensayos | Analista | — |
| `ANALYSIS_COMPLETED` | El analista termina los ensayos | Analista | — |
| `RETURNED_TO_STORAGE` | La muestra regresa al almacenamiento post-analisis | Analista | Registra `location`. |
| `DISPOSED` | La muestra (o su remanente) se descarta | Personal autorizado | Evento final de la cadena. |

### 3.2 Estado del precinto

Se usa en eventos donde se verifica la integridad del precinto de evidencia de manipulacion (tipicamente `RECEIVED` y cualquier transferencia posterior).

| Valor del enum | Significado |
|---|---|
| `INTACT` | Precinto verificado y sin romper. |
| `BROKEN` | El precinto se encontro roto sin explicacion. |
| `TAMPERED` | El precinto muestra signos de manipulacion intencional. |
| `MISSING` | No habia precinto cuando se esperaba que lo hubiera. |
| `NOT_APPLICABLE` | Este tipo de evento no requiere verificacion de precinto. |

### 3.3 Reglas de validacion

El servicio de custodia debe hacer cumplir las siguientes invariantes en cada operacion de escritura. Cualquier violacion lanza un `BadRequestException` con un mensaje claro en español dirigido al usuario.

1. **Solo append**: los eventos no se pueden editar ni borrar una vez creados. No se exponen endpoints `PATCH` ni `DELETE`.
2. **Monotonia cronologica**: el `occurredAt` de un nuevo evento debe ser mayor o igual al `occurredAt` del evento mas reciente de la misma cadena. Esta prohibido retroceder en el tiempo mas alla del evento anterior.
3. **El primer evento debe ser `COLLECTED`**: la cadena de una muestra no puede empezar con ningun otro tipo de evento.
4. **Los eventos de transferencia requieren doble firma**: los eventos de tipo `DELIVERED`, `RECEIVED` y `ASSIGNED_TO_ANALYST` deben incluir un `receivedById` no nulo. El `performedById` y el `receivedById` no pueden ser el mismo usuario.
5. **Gate de verificacion del precinto**: si el evento anterior registro un `sealNumber`, el siguiente evento de transferencia debe incluir un valor en `sealStatus` (no puede ser nulo).
6. **Estado terminal**: una vez registrado un evento `DISPOSED`, no se pueden agregar mas eventos a esa cadena.
7. **Scope de organizacion**: un usuario solo puede registrar eventos sobre muestras que pertenezcan a su organizacion actual (se hace cumplir mediante el `TenantGuard` existente).
8. **Gate de roles**: solo los usuarios con rol `TECHNICIAN`, `QUALITY_MANAGER` o `ADMIN` pueden registrar eventos. Los demas roles pueden leer la cadena pero no modificarla.

### 3.4 Eventos auto-generados

Para mantener la cadena sincronizada con el ciclo de vida existente de las muestras sin obligar al usuario a registrar los eventos dos veces, se agregan los siguientes mapeos automaticos como listeners de los cambios de status actuales:

| Trigger existente | Evento auto-generado | Notas |
|---|---|---|
| `Sample` creado (el listener existente dispara al crearse el Entry) | `COLLECTED` con `occurredAt = createdAt` | Solo si todavia no existe ninguna cadena. |
| `Sample.status` → `RECEIVED` | Evento `RECEIVED` | El usuario que cambia el status es el `performedById`. El `receivedById` es el mismo usuario (aceptable porque representa un acuse, no una transferencia). |
| `Sample.status` → `IN_TESTING` | Evento `ANALYSIS_STARTED` | — |
| `Sample.status` → `COMPLETED` | Evento `ANALYSIS_COMPLETED` | — |
| `Sample.status` → `ARCHIVED` (si existe) | Evento `DISPOSED` | — |

Los eventos auto-generados tienen una bandera `auto: true` (una columna del modelo) para que la UI los muestre con un tratamiento visual ligeramente distinto y deje explicito que no fueron ingresados a mano.

Los eventos manuales registrados despues de un evento automatico siguen siendo validos siempre y cuando se respete la regla de monotonia cronologica.

---

## 4. Schema de Base de Datos

### 4.1 Adiciones al schema de Prisma

Agregar a `apps/api/prisma/schema.prisma`:

```prisma
enum CustodyEventType {
  COLLECTED
  SEALED
  TRANSPORT_STARTED
  DELIVERED
  RECEIVED
  STORED
  ASSIGNED_TO_ANALYST
  ANALYSIS_STARTED
  ANALYSIS_COMPLETED
  RETURNED_TO_STORAGE
  DISPOSED
}

enum SealStatus {
  INTACT
  BROKEN
  TAMPERED
  MISSING
  NOT_APPLICABLE
}

model SampleCustodyEvent {
  id            String            @id @default(cuid())
  sampleId      String
  eventType     CustodyEventType
  occurredAt    DateTime
  recordedAt    DateTime          @default(now())
  performedById String
  receivedById  String?
  location      String?
  sealNumber    String?
  sealStatus    SealStatus?
  temperatureC  Float?
  notes         String?
  auto          Boolean           @default(false)
  createdAt     DateTime          @default(now())

  sample      Sample @relation(fields: [sampleId], references: [id], onDelete: Cascade)
  performedBy User   @relation("CustodyPerformedBy", fields: [performedById], references: [id])
  receivedBy  User?  @relation("CustodyReceivedBy", fields: [receivedById], references: [id])

  @@index([sampleId])
  @@index([eventType])
  @@index([occurredAt])
}
```

### 4.2 Relaciones inversas

Agregar a los modelos existentes:

```prisma
// En el model Sample
custodyEvents SampleCustodyEvent[]

// En el model User
custodyEventsPerformed SampleCustodyEvent[] @relation("CustodyPerformedBy")
custodyEventsReceived  SampleCustodyEvent[] @relation("CustodyReceivedBy")
```

### 4.3 Migracion

Crear `apps/api/prisma/migrations/<timestamp>_sample_custody/migration.sql` con el siguiente contenido:

1. `CREATE TYPE "CustodyEventType" AS ENUM (...)`.
2. `CREATE TYPE "SealStatus" AS ENUM (...)`.
3. `CREATE TABLE "SampleCustodyEvent"` con todas las columnas y la primary key `cuid`.
4. Tres indices: `sampleId`, `eventType`, `occurredAt`.
5. Dos foreign keys: una a `Sample` (`ON DELETE CASCADE`) y una a `User` para `performedById` (`ON DELETE RESTRICT`). La foreign key opcional `receivedById` usa `ON DELETE SET NULL`.
6. No se requiere backfill de datos porque es una feature nueva sin datos historicos para migrar.

---

## 5. Backend (NestJS)

### 5.1 Estructura del modulo

Crear el siguiente arbol de archivos bajo `apps/api/src/modules/sample-custody/`:

```
sample-custody/
├── sample-custody.module.ts
├── sample-custody.controller.ts
├── sample-custody.service.ts
├── dto/
│   └── create-custody-event.dto.ts
└── listeners/
    └── sample-status.listener.ts
```

Registrar el modulo en `apps/api/src/app.module.ts` junto a los modulos existentes.

### 5.2 Interface del service

`sample-custody.service.ts` expone los siguientes metodos publicos:

| Metodo | Firma | Proposito |
|---|---|---|
| `createEvent` | `(sampleId, organizationId, performedById, dto) → SampleCustodyEvent` | Valida y persiste un nuevo evento. Lo usan tanto el controller como el listener de auto-generacion. |
| `listEvents` | `(sampleId, organizationId) → SampleCustodyEvent[]` | Devuelve todos los eventos de la muestra ordenados ascendente por `occurredAt`. Incluye los objetos `performedBy` y `receivedBy`. |
| `getLastEvent` | `(sampleId) → SampleCustodyEvent \| null` | Helper interno usado por las validaciones. |
| `assertChainIntegrity` | `(sampleId) → void` | Valida que la cadena no tenga huecos logicos. Lanza excepcion si los hay. Lo usa internamente y el endpoint de exportacion. |

El metodo `createEvent` debe:

1. Buscar la muestra y verificar que pertenezca a `organizationId` (404 si no).
2. Buscar el ultimo evento de la cadena via `getLastEvent`.
3. Aplicar las reglas de validacion del §3.3 en orden, lanzando el `BadRequestException` apropiado en la primera violacion.
4. Persistir el evento dentro de una transaccion para que escrituras concurrentes no compitan.
5. Retornar el evento persistido con `performedBy` y `receivedBy` ya populados.

### 5.3 Endpoints del controller

`sample-custody.controller.ts` se monta bajo el prefijo de rutas existente para samples. Todos los endpoints heredan `JwtAuthGuard`, `TenantGuard` y `RolesGuard` del setup global.

| HTTP | Path | Body / Params | Roles | Descripcion |
|---|---|---|---|---|
| `POST` | `/samples/:id/custody` | `CreateCustodyEventDto` | `TECHNICIAN`, `QUALITY_MANAGER`, `ADMIN` | Registra un nuevo evento en la cadena. |
| `GET` | `/samples/:id/custody` | — | cualquier usuario autenticado | Lista la cadena completa. |

#### `CreateCustodyEventDto`

```typescript
export class CreateCustodyEventDto {
  eventType: CustodyEventType
  occurredAt: string             // ISO 8601, validado y parseado a Date
  receivedById?: string
  location?: string
  sealNumber?: string
  sealStatus?: SealStatus
  temperatureC?: number
  notes?: string
}
```

El `performedById` se obtiene del JWT (`user.sub`), nunca del body, asi que el actor no se puede falsificar.

### 5.4 Listener de auto-generacion

`listeners/sample-status.listener.ts` se subscribe a los eventos de dominio existentes que se emiten cuando cambia el status de una muestra (verificar los nombres de eventos en `apps/api/src/common/events/domain-events.ts` y reusarlos — no crear nuevos).

Por cada evento subscripto, el listener construye el `CreateCustodyEventDto` apropiado y llama a `sample-custody.service.createEvent`. La bandera `auto` se setea en `true` para que la UI distinga entre eventos manuales y automaticos.

Si `createEvent` lanza una excepcion (por ejemplo por violacion cronologica), el listener captura la excepcion y la loggea via el logger existente, pero no la re-lanza, porque el cambio de status de la muestra ya fue commiteado y rollbackearlo resultaria confuso para el usuario. Un evento automatico fallido deja un warning en el log de la aplicacion para que un operador pueda investigar y agregar el evento faltante manualmente.

### 5.5 API client

Agregar a `apps/web/src/lib/api.ts` bajo el namespace existente `samples`:

```typescript
custody: {
  list: (sampleId: string) =>
    fetchApi(`/samples/${sampleId}/custody`),
  create: (sampleId: string, data: {
    eventType: string
    occurredAt: string
    receivedById?: string
    location?: string
    sealNumber?: string
    sealStatus?: string
    temperatureC?: number
    notes?: string
  }) =>
    fetchApi(`/samples/${sampleId}/custody`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
},
```

---

## 6. Frontend (Next.js)

### 6.1 Pagina nueva

Crear `apps/web/src/app/(app)/samples/[id]/custody/page.tsx`. La pagina es accesible desde la pagina de detalle de muestra existente a traves de un nuevo tab o seccion etiquetada "Cadena de custodia".

### 6.2 Layout de la pagina

La pagina renderiza dos areas principales:

1. **Header con resumen de la muestra**: muestra el identificador de la muestra, el status actual, la matriz a la que pertenece, y la cantidad de eventos de custodia. Reusa los componentes de card existentes de `@/components/ui/card`.

2. **Linea de tiempo vertical**: cada evento se renderiza como un nodo sobre una linea vertical alineada a la izquierda, en orden cronologico de arriba (mas viejo) hacia abajo (mas nuevo). Cada nodo contiene:
   - Icono correspondiente al tipo de evento (usar iconos Lucide: `MapPin` para COLLECTED, `Lock` para SEALED, `Truck` para TRANSPORT_STARTED, `PackageCheck` para DELIVERED/RECEIVED, `Archive` para STORED, `User` para ASSIGNED_TO_ANALYST, `FlaskConical` para ANALYSIS_*, `Trash2` para DISPOSED).
   - Etiqueta del tipo de evento en español.
   - Fecha y hora (formato `dd/MM/yyyy HH:mm`).
   - "Realizado por: <nombre del usuario>".
   - "Recibido por: <nombre del usuario>" si corresponde.
   - Ubicacion, numero de precinto + estado, temperatura, notas si estan presentes.
   - Un pequeño badge `[AUTO]` si `auto === true`.

3. **Formulario para agregar evento**: al final de la linea de tiempo, una card con un formulario para registrar el siguiente evento. Los campos del formulario son condicionales segun el `eventType` seleccionado — por ejemplo, `sealNumber` y `sealStatus` solo aparecen para eventos que involucran precintos; `receivedById` solo aparece para eventos de transferencia y se renderiza como un selector de usuarios filtrado por organizacion. El submit dispara `api.samples.custody.create`, que en caso de exito invalida el cache de React Query para la cadena y limpia el formulario.

4. **Badge de integridad de la cadena**: en la parte superior de la linea de tiempo, un badge que dice "Cadena integra" (verde) si la ultima validacion fue exitosa, o "Cadena con inconsistencias" (rojo) con un tooltip explicando el problema, si la validacion fallo en algun punto. Es puramente informativo, ya que la validacion se hace cumplir del lado del servidor en cada escritura.

### 6.3 Campos condicionales del formulario por tipo de evento

| `eventType` | Requeridos | Opcionales |
|---|---|---|
| `COLLECTED` | `occurredAt`, `location` | `notes`, `temperatureC` |
| `SEALED` | `occurredAt`, `sealNumber` | `notes` |
| `TRANSPORT_STARTED` | `occurredAt`, `temperatureC` | `notes` |
| `DELIVERED` | `occurredAt`, `receivedById` | `sealStatus`, `notes` |
| `RECEIVED` | `occurredAt`, `receivedById`, `sealStatus` | `temperatureC`, `location`, `notes` |
| `STORED` | `occurredAt`, `location` | `temperatureC`, `notes` |
| `ASSIGNED_TO_ANALYST` | `occurredAt`, `receivedById` | `notes` |
| `ANALYSIS_STARTED` | `occurredAt` | `notes` |
| `ANALYSIS_COMPLETED` | `occurredAt` | `notes` |
| `RETURNED_TO_STORAGE` | `occurredAt`, `location` | `notes` |
| `DISPOSED` | `occurredAt` | `notes` |

El formulario debe deshabilitar el boton de submit si algun campo requerido del `eventType` seleccionado esta vacio.

### 6.4 Selector de usuario

El campo `receivedById` usa un dropdown poblado desde `api.organizations.getUsers(currentOrgId)`. Filtrar para excluir al usuario actualmente logueado (porque las transferencias no pueden tener al mismo como receptor). Cachear la lista de usuarios con React Query (`['org-users', orgId]`) durante la sesion de la pagina.

### 6.5 Modo solo lectura

Si la cadena de la muestra alcanzo el estado `DISPOSED`, el formulario de agregar evento se oculta y se reemplaza con un mensaje: "Cadena finalizada. No se pueden registrar mas eventos."

---

## 7. Integracion con el sistema existente

### 7.1 Pagina de detalle de muestra

Agregar un nuevo tab o seccion etiquetada **"Cadena de custodia"** a la pagina existente `apps/web/src/app/(app)/samples/[id]/page.tsx`. El tab puede rutear a la nueva pagina de custodia o renderizarla embebida como un panel — cualquiera de las dos opciones es aceptable, preferir embebida si la pagina existente ya usa tabs, o ruteada si usa un patron de navegacion distinto. Verificar el layout existente antes de decidir.

### 7.2 Sidebar / navegacion

No se requiere un nuevo item de navegacion top-level. La cadena de custodia siempre se accede en el contexto de una muestra especifica, nunca de manera independiente.

### 7.3 Audit log

El audit log existente en `apps/api/src/modules/audit/` sigue registrando los cambios sobre samples como antes. La cadena de custodia es un mecanismo separado, mas granular, no un reemplazo. Coexisten.

### 7.4 Permisos

El check de roles en `POST /samples/:id/custody` usa el decorator existente `@Roles('TECHNICIAN', 'QUALITY_MANAGER', 'ADMIN')`. No se requieren nuevas definiciones de roles.

---

## 8. Checklist de implementacion

La siguiente lista esta ordenada para progreso incremental. Cada item es lo suficientemente chico como para completarlo y verificarlo aislado antes de pasar al siguiente.

### Fase 1 — Schema y migracion

- [ ] Agregar el enum `CustodyEventType` a `apps/api/prisma/schema.prisma`.
- [ ] Agregar el enum `SealStatus` a `apps/api/prisma/schema.prisma`.
- [ ] Agregar el modelo `SampleCustodyEvent` a `apps/api/prisma/schema.prisma`.
- [ ] Agregar las relaciones inversas a los modelos `Sample` y `User`.
- [ ] Crear el directorio de migracion `apps/api/prisma/migrations/<YYYYMMDD>_sample_custody/` y escribir `migration.sql`.
- [ ] Correr `npx prisma generate` y verificar que no haya errores de schema.
- [ ] Aplicar la migracion en Supabase (ejecucion manual del SQL).

### Fase 2 — Modulo del backend

- [ ] Crear `apps/api/src/modules/sample-custody/sample-custody.module.ts`.
- [ ] Crear `apps/api/src/modules/sample-custody/sample-custody.service.ts` con los cuatro metodos publicos listados en §5.2.
- [ ] Implementar las reglas de validacion del §3.3 dentro de `createEvent`, con mensajes de error explicitos en español.
- [ ] Crear `apps/api/src/modules/sample-custody/dto/create-custody-event.dto.ts`.
- [ ] Crear `apps/api/src/modules/sample-custody/sample-custody.controller.ts` con ambos endpoints.
- [ ] Registrar el modulo en `apps/api/src/app.module.ts`.
- [ ] Correr `npx tsc --noEmit` desde `apps/api/` y verificar cero errores.

### Fase 3 — Listener de auto-generacion

- [ ] Leer `apps/api/src/common/events/domain-events.ts` para identificar los eventos existentes relacionados con samples.
- [ ] Crear `apps/api/src/modules/sample-custody/listeners/sample-status.listener.ts`.
- [ ] Subscribirse a los eventos relevantes usando `@OnEvent`.
- [ ] Implementar la tabla de mapeos del §3.4.
- [ ] Envolver cada llamada a `createEvent` en un try/catch que loggee pero no re-lance.
- [ ] Registrar el listener como provider en `sample-custody.module.ts`.
- [ ] Correr `npx tsc --noEmit` desde `apps/api/` y verificar cero errores.

### Fase 4 — API client

- [ ] Agregar el namespace `samples.custody` a `apps/web/src/lib/api.ts`.

### Fase 5 — Pagina del frontend

- [ ] Crear `apps/web/src/app/(app)/samples/[id]/custody/page.tsx`.
- [ ] Implementar el renderizado de la linea de tiempo con metadata condicional por evento.
- [ ] Implementar el formulario condicional de agregar evento segun la tabla del §6.3.
- [ ] Implementar el selector de usuario para `receivedById` usando `api.organizations.getUsers`.
- [ ] Ocultar el formulario de agregar evento si el ultimo evento es `DISPOSED`.
- [ ] Agregar el badge de integridad de la cadena.
- [ ] Correr `npx tsc --noEmit` desde `apps/web/` y verificar cero errores relacionados con los archivos nuevos (los errores pre-existentes en `records/[id]` y `settings` no son relacionados y no deben bloquear este trabajo).

### Fase 6 — Integracion con el detalle de muestra

- [ ] Leer `apps/web/src/app/(app)/samples/[id]/page.tsx` para entender el layout existente.
- [ ] Agregar un tab o panel "Cadena de custodia".
- [ ] Linkear o embeber la pagina de custodia.
- [ ] Verificar que la navegacion funcione en ambas direcciones (de detalle a custodia y vuelta).

### Fase 7 — Verificacion manual end-to-end

- [ ] Crear una muestra nueva a traves del flujo existente.
- [ ] Verificar que se haya generado un evento `COLLECTED` automatico.
- [ ] Registrar manualmente un evento `SEALED` con un numero de precinto.
- [ ] Registrar manualmente un evento `TRANSPORT_STARTED` con una temperatura.
- [ ] Registrar manualmente un evento `DELIVERED` con un receptor.
- [ ] Cambiar el status de la muestra a `RECEIVED` por la UI existente y verificar que se genere el evento automatico.
- [ ] Intentar registrar un evento con `occurredAt` anterior al evento previo y verificar el error de validacion.
- [ ] Intentar registrar un evento de transferencia sin `receivedById` y verificar el error de validacion.
- [ ] Intentar registrar un evento de transferencia donde `performedById === receivedById` y verificar el error de validacion.
- [ ] Registrar un evento `DISPOSED` y verificar que el formulario de agregar evento desaparezca.
- [ ] Intentar registrar otro evento despues de `DISPOSED` directamente por API y verificar el response 400.

### Fase 8 — Commit y merge

- [ ] Stagear todos los cambios.
- [ ] Commitear con un mensaje descriptivo siguiendo la convencion existente.
- [ ] Hacer checkout de `main`.
- [ ] Mergear `feature/sample-custody` con `--no-ff`.
- [ ] Hacer push cuando el usuario lo autorice explicitamente.
- [ ] Opcionalmente borrar la branch de feature.

---

## 9. Mapa de archivos

Esta es la lista completa de archivos que se crearan o modificaran durante la implementacion.

### Creados

```
apps/api/prisma/migrations/<YYYYMMDD>_sample_custody/migration.sql
apps/api/src/modules/sample-custody/sample-custody.module.ts
apps/api/src/modules/sample-custody/sample-custody.controller.ts
apps/api/src/modules/sample-custody/sample-custody.service.ts
apps/api/src/modules/sample-custody/dto/create-custody-event.dto.ts
apps/api/src/modules/sample-custody/listeners/sample-status.listener.ts
apps/web/src/app/(app)/samples/[id]/custody/page.tsx
SAMPLE_CUSTODY_SPEC.md  (este archivo)
```

### Modificados

```
apps/api/prisma/schema.prisma                       (enums + nuevo modelo + relaciones inversas)
apps/api/src/app.module.ts                          (registrar SampleCustodyModule)
apps/web/src/lib/api.ts                             (agregar namespace samples.custody)
apps/web/src/app/(app)/samples/[id]/page.tsx        (agregar tab/panel para custodia)
```

---

## 10. Criterios de aceptacion

La feature se considera completa y lista para mergear a `main` cuando todos los siguientes puntos sean verdaderos simultaneamente.

1. El schema de Prisma valida y la migracion corre sin errores en Supabase.
2. `npx tsc --noEmit` desde `apps/api/` devuelve cero errores.
3. `npx tsc --noEmit` desde `apps/web/` devuelve cero errores nuevos comparado con el baseline en `main` (los errores pre-existentes en archivos no relacionados se toleran).
4. Las ocho reglas de validacion del §3.3 se cumplen y se verifican mediante testing manual.
5. El listener de auto-generacion crea correctamente los eventos cuando ocurren los cambios de status existentes en samples, y la bandera `auto: true` se ve en la linea de tiempo.
6. La linea de tiempo del frontend renderiza todos los tipos de evento con sus iconos, etiquetas y metadata correctos.
7. El formulario condicional de agregar evento muestra y oculta los campos correctamente segun el `eventType`.
8. Un evento `DISPOSED` correctamente bloquea la cadena y oculta el formulario de agregar evento.
9. La feature esta documentada en esta especificacion y la especificacion esta commiteada al repositorio.

---

## 11. Riesgos y rollback

### Riesgos

- **Loops del listener**: si el listener de auto-generacion dispara sobre un evento que a su vez dispara el listener de nuevo, son posibles loops infinitos. Mitigacion: el listener filtra por `auto === false` en los eventos entrantes, y nunca registra un evento automatico en respuesta a otro evento automatico.
- **Race conditions en la insercion de la cadena**: dos requests concurrentes agregando eventos a la misma muestra podrian pasar la validacion de manera independiente pero resultar en una cadena cronologicamente inconsistente. Mitigacion: envolver la lectura de validacion y la escritura de insercion en una unica transaccion de Prisma con isolation `Serializable`, o alternativamente usar un `SELECT ... FOR UPDATE` sobre la fila de la muestra.
- **Fallo del evento automatico deja la cadena incompleta**: si el listener lanza una excepcion y se captura, la cadena queda con un hueco que el usuario debe llenar manualmente. Mitigacion: loggear cada excepcion capturada con suficiente contexto (sampleId, eventType, mensaje de error) para que un operador pueda reaccionar.

### Rollback

Si despues de mergear la feature revela un bug critico, el rollback se hace asi:

1. Revertir el merge commit en `main` con `git revert -m 1 <merge_commit_sha>`.
2. Pushear la reversion.
3. Opcionalmente rollbackear la migracion en Supabase dropeando la tabla `SampleCustodyEvent` y los dos enums (ninguna otra tabla depende de ellos).
4. Re-abrir la branch de feature para los fixes.

El cambio es completamente aditivo al schema y a la superficie de la aplicacion, asi que el rollback no afecta a ninguna funcionalidad pre-existente.

---

## 12. Evolucion futura (Nivel 3)

Una vez que esta implementacion de Nivel 2 este en produccion y validada, las siguientes mejoras conforman el siguiente paso natural hacia el cumplimiento total ISO 17025 con organismos de acreditacion formales (OAA, ENAC, ILAC). Estan explicitamente fuera del alcance de esta iteracion pero el schema y el codigo se diseñaron para acomodarlas sin breaking changes.

- Agregar una columna `signatureHash` a `SampleCustodyEvent` y una tabla separada `SampleCustodySignature` que almacene la cadena de hash, la clave publica del firmante y la firma criptografica de cada evento. La firma cubre la fila completa (incluyendo el hash del evento anterior) asi que cualquier manipulacion rompe la cadena matematicamente.
- Agregar una relacion `attachments` a `SampleCustodyEvent` apuntando a una nueva tabla `SampleCustodyAttachment` que almacene referencias a archivos (URLs de S3 o equivalente) para fotos de precintos, planillas escaneadas, capturas de GPS, etc.
- Hacer que los adjuntos sean obligatorios para ciertos tipos de evento (configurable por organizacion).
- Agregar un endpoint `exportToPdf` que renderice la cadena completa como un documento PDF imprimible con marca de agua, con todas las firmas y adjuntos embebidos.
- Agregar un sistema de alertas configurable que marque cadenas inactivas por mas de N horas y notifique al quality manager responsable.
- Agregar una UI mobile optimizada para captura en campo con conectividad pobre (offline-first, sync al reconectar).
- Integrar con hardware de lectura de codigo de barras / RFID para identificar muestras.

---

## 13. Referencias

- ISO/IEC 17025:2017 — Requisitos generales para la competencia de los laboratorios de ensayo y calibracion, clausula 7.4 (Manejo de items de ensayo o calibracion).
- APHA Standard Methods for the Examination of Water and Wastewater, 24a Edicion — Seccion 1060 (Coleccion y preservacion de muestras), que describe los procedimientos de cadena de custodia aplicados especificamente al analisis de aguas.
- USEPA SW-846, Capitulo Uno — Quality Control, que establece la cadena de custodia como una practica obligatoria para el muestreo ambiental bajo regulaciones federales en Estados Unidos.
- OAA (Organismo Argentino de Acreditacion) — Documento DA-acr-04, requisitos especificos para laboratorios de ensayo y calibracion, parrafo 7.4 sobre manejo de items.
