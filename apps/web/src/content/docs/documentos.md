# Documentos

## Qué es un documento

Un documento en Synapse representa un **documento controlado** del sistema de calidad: procedimientos operativos estándar (POE), manuales, instructivos de trabajo, políticas, especificaciones técnicas, etc. No es un archivo suelto -- es una entidad gestionada con versionado, estado y circuito de aprobación conforme a los requisitos ISO.

## Propiedades de un documento

| Campo | Descripción |
|-------|-------------|
| **Título** | Nombre del documento. Único dentro de la organización. |
| **Código** | Código interno (ej: POE-LAB-001, IT-MC-003, MAN-CAL-001). Opcional pero recomendado. |
| **Versión** | Se incrementa automáticamente al crear una nueva versión (1.0, 2.0, ...). |
| **Estado** | DRAFT, IN_REVIEW, ACTIVE, SUPERSEDED. |
| **Archivo** | PDF adjunto. Se sube una sola vez por versión. |
| **Contenido** | Texto enriquecido alternativo al PDF (opcional). |

## Ciclo de vida

```
DRAFT ----> IN_REVIEW ----> ACTIVE ----> SUPERSEDED
  ^                                          |
  +------------ Nueva version ---------------+
```

### Estados

- **DRAFT** (Borrador): el documento se puede editar libremente. Es el estado inicial.
- **IN_REVIEW** (En revisión): se envio al circuito de aprobación. No se puede editar hasta que se apruebe o rechace.
- **ACTIVE** (Activo): aprobado y publicado. Es la versión vigente. No se puede modificar.
- **SUPERSEDED** (Reemplazado): una nueva versión lo reemplazo. Se conserva para trazabilidad histórica.

## Operaciones

### Crear un documento

1. Ir a **Documentos** en el menú lateral
2. Click en **Nuevo documento**
3. Completar título y código (opcional)
4. El documento se crea en estado DRAFT

### Adjuntar archivo

1. Abrir el documento
2. Click en **Subir archivo**
3. Seleccionar un PDF
4. El archivo queda vinculado a esta versión

> Una vez subido, no se puede reemplazar el archivo. Para cambiar el archivo, crear una nueva versión.

### Enviar a aprobación

1. El documento debe estar en DRAFT
2. Click en **Enviar a revisión**
3. El documento pasa a IN_REVIEW
4. Un revisor lo evalúa y aprueba o rechaza
5. Si aprueba, un aprobador da el visto bueno final
6. El documento pasa a ACTIVE

Ver [09 - Circuito de Aprobación](./09-circuito-aprobación.md) para más detalle.

### Crear nueva versión

1. Abrir un documento ACTIVE
2. Click en **Nueva versión**
3. Se crea una copia en DRAFT con versión incrementada (ej: 2.0)
4. El documento anterior pasa automáticamente a SUPERSEDED
5. Opcionalmente se puede adjuntar un nuevo archivo

## Vinculación con registros

Un documento puede ser la **base teórica** de uno o más registros. Al crear un registro, se puede seleccionar el documento asociado. Esto establece trazabilidad entre el procedimiento y los datos que lo implementan:

```
POE-LAB-001 "Determinacion de pH en aguas"
  +-- Registro "Control de pH - Agua Potable"
  |     +-- Entrada 2026-04-01: pH 7.2 -- PASA
  |     +-- Entrada 2026-04-02: pH 6.8 -- PASA
  +-- Registro "Control de pH - Efluentes"
        +-- Entrada 2026-04-01: pH 8.1 -- PASA
```

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Ver documentos | Todos |
| Crear/editar documentos | ADMIN, QUALITY_MANAGER |
| Subir archivos | ADMIN, QUALITY_MANAGER |
| Crear nueva versión | ADMIN, QUALITY_MANAGER |
