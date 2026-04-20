# 02 -- Documentos

## Que es un documento

Un documento en QualitTab representa un **documento controlado** del sistema de calidad: procedimientos operativos estandar (POE), manuales, instructivos de trabajo, politicas, especificaciones tecnicas, etc. No es un archivo suelto -- es una entidad gestionada con versionado, estado y circuito de aprobacion conforme a los requisitos ISO.

## Propiedades de un documento

| Campo | Descripcion |
|-------|-------------|
| **Titulo** | Nombre del documento. Unico dentro de la organizacion. |
| **Codigo** | Codigo interno (ej: POE-LAB-001, IT-MC-003, MAN-CAL-001). Opcional pero recomendado. |
| **Version** | Se incrementa automaticamente al crear una nueva version (1.0, 2.0, ...). |
| **Estado** | DRAFT, IN_REVIEW, ACTIVE, SUPERSEDED. |
| **Archivo** | PDF adjunto. Se sube una sola vez por version. |
| **Contenido** | Texto enriquecido alternativo al PDF (opcional). |

## Ciclo de vida

```
DRAFT ----> IN_REVIEW ----> ACTIVE ----> SUPERSEDED
  ^                                          |
  +------------ Nueva version ---------------+
```

### Estados

- **DRAFT** (Borrador): el documento se puede editar libremente. Es el estado inicial.
- **IN_REVIEW** (En revision): se envio al circuito de aprobacion. No se puede editar hasta que se apruebe o rechace.
- **ACTIVE** (Activo): aprobado y publicado. Es la version vigente. No se puede modificar.
- **SUPERSEDED** (Reemplazado): una nueva version lo reemplazo. Se conserva para trazabilidad historica.

## Operaciones

### Crear un documento

1. Ir a **Documentos** en el menu lateral
2. Click en **Nuevo documento**
3. Completar titulo y codigo (opcional)
4. El documento se crea en estado DRAFT

### Adjuntar archivo

1. Abrir el documento
2. Click en **Subir archivo**
3. Seleccionar un PDF
4. El archivo queda vinculado a esta version

> Una vez subido, no se puede reemplazar el archivo. Para cambiar el archivo, crear una nueva version.

### Enviar a aprobacion

1. El documento debe estar en DRAFT
2. Click en **Enviar a revision**
3. El documento pasa a IN_REVIEW
4. Un revisor lo evalua y aprueba o rechaza
5. Si aprueba, un aprobador da el visto bueno final
6. El documento pasa a ACTIVE

Ver [09 - Circuito de Aprobacion](./09-circuito-aprobacion.md) para mas detalle.

### Crear nueva version

1. Abrir un documento ACTIVE
2. Click en **Nueva version**
3. Se crea una copia en DRAFT con version incrementada (ej: 2.0)
4. El documento anterior pasa automaticamente a SUPERSEDED
5. Opcionalmente se puede adjuntar un nuevo archivo

## Vinculacion con registros

Un documento puede ser la **base teorica** de uno o mas registros. Al crear un registro, se puede seleccionar el documento asociado. Esto establece trazabilidad entre el procedimiento y los datos que lo implementan:

```
POE-LAB-001 "Determinacion de pH en aguas"
  +-- Registro "Control de pH - Agua Potable"
  |     +-- Entrada 2026-04-01: pH 7.2 -- PASA
  |     +-- Entrada 2026-04-02: pH 6.8 -- PASA
  +-- Registro "Control de pH - Efluentes"
        +-- Entrada 2026-04-01: pH 8.1 -- PASA
```

## Permisos

| Accion | Roles permitidos |
|--------|-----------------|
| Ver documentos | Todos |
| Crear/editar documentos | ADMIN, QUALITY_MANAGER |
| Subir archivos | ADMIN, QUALITY_MANAGER |
| Crear nueva version | ADMIN, QUALITY_MANAGER |
