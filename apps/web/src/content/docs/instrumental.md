# Instrumental

## Qué es el módulo instrumental

El módulo instrumental gestiona los **equipos e instrumentos de medición** del laboratorio o la planta industrial: balanzas analíticas, pHmetros, cromatógrafos, espectrofotómetros, autoclaves, termómetros calibrados, pipetas volumétricas, etc. Cada instrumento tiene un estado operativo, una fecha de próxima calibración y un historial completo de cambios de estado.

## Como se crea un instrumento

Los instrumentos se crean automáticamente al crear una entrada en un registro de tipo **INSTRUMENTAL**:

1. Crear un registro tipo INSTRUMENTAL (ej: "BALANZAS ANALÍTICAS")
   - Definir campo con label **"CÓDIGO"** (TEXT, identificador) -- **obligatorio** para registros INSTRUMENTAL
   - Agregar campos adicionales: MARCA (TEXT), MODELO (TEXT), NÚMERO DE SERIE (TEXT), RANGO (TEXT), RESOLUCIÓN (TEXT)
   - Configurar periodicidad de calibración (ej: 365 días para calibración anual)
2. Aprobar el registro vía circuito de aprobación
3. Crear entrada: la entrada se completa automáticamente y se crea un **Instrument** vinculado en estado ACTIVE

> **Nota:** El registro debe incluir un campo con label exacto "CÓDIGO" para que el sistema pueda identificar cada instrumento. Si falta este campo, el registro no pasara la validación de aprobación.

## Estados del instrumento

```
ACTIVE <----> IN_CALIBRATION
   |               |
   +---> IN_REPAIR <+
            |
            +---> DECOMMISSIONED
```

| Estado | Significado |
|--------|-------------|
| **ACTIVE** | En uso, disponible para mediciones. Estado inicial. |
| **IN_CALIBRATION** | En proceso de calibración, no disponible para uso |
| **IN_REPAIR** | En reparación, no disponible para uso |
| **DECOMMISSIONED** | Dado de baja permanentemente |

### Transiciones permitidas

| Desde | Hacia | Caso de uso |
|-------|-------|-------------|
| ACTIVE | IN_CALIBRATION | Se envia a calibrar |
| ACTIVE | IN_REPAIR | Se detecta falla o daño |
| IN_CALIBRATION | ACTIVE | Calibración completada satisfactoriamente |
| IN_CALIBRATION | IN_REPAIR | Durante calibración se detecta falla |
| IN_REPAIR | ACTIVE | Reparación completada |
| IN_REPAIR | DECOMMISSIONED | Equipo irreparable, se da de baja |

## Calibración

La fecha de próxima calibración se calcula automáticamente al crear el instrumento:

```
Proxima calibracion = Fecha de alta + Periodicidad del registro (en dias)
```

El dashboard alerta cuando un instrumento esta próximo a necesitar calibración, permitiendo programar el servicio con anticipación.

**Ejemplo:**
```
Instrumento: BAL-001 (Balanza Analitica Mettler Toledo)
  Fecha de alta: 2026-01-15
  Periodicidad: 365 dias
  Proxima calibracion: 2027-01-15
  Estado: ACTIVE
```

## Validación de uso

Cuando un registro tiene un campo **RELATED_ENTRY** que apunta a un registro INSTRUMENTAL, el sistema valida automáticamente que el instrumento referenciado este en estado **ACTIVE**. Si el instrumento esta en otro estado, no se permite crear la entrada.

**Ejemplo:** si un técnico intenta registrar una medición de pH usando el pHmetro PH-003 que esta IN_CALIBRATION, el sistema rechaza la entrada con un mensaje indicando que el equipo no esta disponible.

Esto garantiza que todas las mediciones se realizan con equipos en condiciones operativas y calibración vigente, conforme a los requisitos de ISO 17025.

## Historial de estados

Cada cambio de estado queda registrado en el **InstrumentStatusLog** con:

| Campo | Descripción |
|-------|-------------|
| **Estado anterior** | Estado desde el cual se realizó el cambio |
| **Nuevo estado** | Estado al cual paso el instrumento |
| **Motivo** | Razón del cambio (ej: "CALIBRACIÓN ANUAL PROGRAMADA") |
| **Quien lo cambio** | Usuario que realizó la acción |
| **Fecha y hora** | Momento exacto del cambio |

Este historial proporciona trazabilidad completa del ciclo de vida de cada equipo, requerido para auditorías ISO.

## Ejemplo completo: Laboratorio de fisicoquímica

```
Registro INSTRUMENTAL: "PHMETROS"
  +-- Campo: CODIGO (TEXT, identificador) -- obligatorio
  +-- Campo: MARCA (TEXT)
  +-- Campo: MODELO (TEXT)
  +-- Campo: NUMERO DE SERIE (TEXT)
  +-- Campo: RANGO (TEXT)
  +-- Campo: RESOLUCION (TEXT)
  +-- Periodicidad: 180 dias (calibracion semestral)

Instrumentos creados:
  +-- PH-001: HANNA HI2020, S/N 12345 -- ACTIVE (prox. cal: 2026-10-01)
  +-- PH-002: METTLER TOLEDO S220, S/N 67890 -- ACTIVE (prox. cal: 2026-11-15)
  +-- PH-003: HANNA HI2020, S/N 11111 -- IN_CALIBRATION (desde 2026-04-01)
```

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver instrumentos | Todos |
| Crear instrumentos (crear entrada en registro INSTRUMENTAL) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cambiar estado | ADMIN, QUALITY_MANAGER |
