# 08 -- Instrumental

## Que es el modulo instrumental

El modulo instrumental gestiona los **equipos e instrumentos de medicion** del laboratorio o la planta industrial: balanzas analiticas, pHmetros, cromatografos, espectrofotometros, autoclaves, termometros calibrados, pipetas volumetricas, etc. Cada instrumento tiene un estado operativo, una fecha de proxima calibracion y un historial completo de cambios de estado.

## Como se crea un instrumento

Los instrumentos se crean automaticamente al crear una entrada en un registro de tipo **INSTRUMENTAL**:

1. Crear un registro tipo INSTRUMENTAL (ej: "BALANZAS ANALITICAS")
   - Definir campo con label **"CODIGO"** (TEXT, identificador) -- **obligatorio** para registros INSTRUMENTAL
   - Agregar campos adicionales: MARCA (TEXT), MODELO (TEXT), NUMERO DE SERIE (TEXT), RANGO (TEXT), RESOLUCION (TEXT)
   - Configurar periodicidad de calibracion (ej: 365 dias para calibracion anual)
2. Aprobar el registro via circuito de aprobacion
3. Crear entrada: la entrada se completa automaticamente y se crea un **Instrument** vinculado en estado ACTIVE

> **Nota:** El registro debe incluir un campo con label exacto "CODIGO" para que el sistema pueda identificar cada instrumento. Si falta este campo, el registro no pasara la validacion de aprobacion.

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
| **IN_CALIBRATION** | En proceso de calibracion, no disponible para uso |
| **IN_REPAIR** | En reparacion, no disponible para uso |
| **DECOMMISSIONED** | Dado de baja permanentemente |

### Transiciones permitidas

| Desde | Hacia | Caso de uso |
|-------|-------|-------------|
| ACTIVE | IN_CALIBRATION | Se envia a calibrar |
| ACTIVE | IN_REPAIR | Se detecta falla o dano |
| IN_CALIBRATION | ACTIVE | Calibracion completada satisfactoriamente |
| IN_CALIBRATION | IN_REPAIR | Durante calibracion se detecta falla |
| IN_REPAIR | ACTIVE | Reparacion completada |
| IN_REPAIR | DECOMMISSIONED | Equipo irreparable, se da de baja |

## Calibracion

La fecha de proxima calibracion se calcula automaticamente al crear el instrumento:

```
Proxima calibracion = Fecha de alta + Periodicidad del registro (en dias)
```

El dashboard alerta cuando un instrumento esta proximo a necesitar calibracion, permitiendo programar el servicio con anticipacion.

**Ejemplo:**
```
Instrumento: BAL-001 (Balanza Analitica Mettler Toledo)
  Fecha de alta: 2026-01-15
  Periodicidad: 365 dias
  Proxima calibracion: 2027-01-15
  Estado: ACTIVE
```

## Validacion de uso

Cuando un registro tiene un campo **RELATED_ENTRY** que apunta a un registro INSTRUMENTAL, el sistema valida automaticamente que el instrumento referenciado este en estado **ACTIVE**. Si el instrumento esta en otro estado, no se permite crear la entrada.

**Ejemplo:** si un tecnico intenta registrar una medicion de pH usando el pHmetro PH-003 que esta IN_CALIBRATION, el sistema rechaza la entrada con un mensaje indicando que el equipo no esta disponible.

Esto garantiza que todas las mediciones se realizan con equipos en condiciones operativas y calibracion vigente, conforme a los requisitos de ISO 17025.

## Historial de estados

Cada cambio de estado queda registrado en el **InstrumentStatusLog** con:

| Campo | Descripcion |
|-------|-------------|
| **Estado anterior** | Estado desde el cual se realizo el cambio |
| **Nuevo estado** | Estado al cual paso el instrumento |
| **Motivo** | Razon del cambio (ej: "CALIBRACION ANUAL PROGRAMADA") |
| **Quien lo cambio** | Usuario que realizo la accion |
| **Fecha y hora** | Momento exacto del cambio |

Este historial proporciona trazabilidad completa del ciclo de vida de cada equipo, requerido para auditorias ISO.

## Ejemplo completo: Laboratorio de fisicoquimica

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

| Accion | Roles permitidos |
|--------|-----------------|
| Ver instrumentos | Todos |
| Crear instrumentos (crear entrada en registro INSTRUMENTAL) | ADMIN, QUALITY_MANAGER, TECHNICIAN |
| Cambiar estado | ADMIN, QUALITY_MANAGER |
