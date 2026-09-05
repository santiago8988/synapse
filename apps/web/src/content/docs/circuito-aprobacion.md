# Circuito de Aprobación

## Qué es el circuito de aprobación

El circuito de aprobación implementa el requisito ISO 17025 e ISO 9001 de **control documental**: toda documentacion, plantilla o fórmula del sistema de calidad debe ser elaborada, revisada y aprobada antes de entrar en vigencia. Garantiza que ningún elemento crítico se ponga en uso sin la supervisión y aprobación de personal calificado.

## Flujo

```
Elaborador           Revisor            Aprobador
    |                   |                   |
    |  Crea entidad     |                   |
    |  (DRAFT)          |                   |
    |                   |                   |
    +--"Enviar a --->   |                   |
    |   revision"       |                   |
    |  (IN_REVIEW)      |                   |
    |                   |                   |
    |               Revisa contenido        |
    |               tecnico                 |
    |                   |                   |
    |             +- APRUEBA --->           |
    |             |     |            Revisa y da
    |             |     |            visto bueno
    |             |     |                   |
    |             |     |             +- APRUEBA --> ACTIVE
    |             |     |             |     |
    |             |     |             +- RECHAZA --> DRAFT
    |             |     |                   |
    |             +- RECHAZA ---> DRAFT     |
    |                   |       (con        |
    |                   |     comentarios)  |
```

## Roles de calidad

El circuito usa dos roles especiales que se asignan a usuarios de la organización:

| Rol | Función |
|-----|---------|
| **REVIEWER** (Revisor) | Revisa el contenido técnico. Puede aprobar o rechazar con comentarios. |
| **APPROVER** (Aprobador) | Da el visto bueno final. Solo actúa después de que un revisor aprobó. |

Estos roles son **independientes** del rol del usuario (ADMIN, QUALITY_MANAGER, etc.). Un TECHNICIAN podría ser REVIEWER si la organización lo decide. Un usuario puede tener ambos roles simultáneamente.

## Configurar el circuito

1. Ir a **Configuración** > **Calidad**
2. Click en **Asignar rol**
3. Seleccionar el rol (Revisor o Aprobador)
4. Seleccionar el usuario
5. El usuario aparece en la lista correspondiente

Solo el ADMIN puede asignar roles de calidad.

> **Requisito:** Deben existir al menos un REVIEWER y un APPROVER asignados para poder enviar entidades a aprobación.

## Entidades aprobables

El circuito aplica a las siguientes entidades:

| Entidad | Descripción | Ver módulo |
|---------|-------------|------------|
| **DOCUMENT** | Procedimientos, manuales, instructivos | [02 - Documentos](./02-documentos.md) |
| **RECORD** | Plantillas de datos antes de poder usarse | [03 - Registros](./03-registros.md) |
| **RECIPE** | Fórmulas de producción | [05 - Recetas](./05-recetas.md) |
| **MATRIX** | Matrices de ensayo con parámetros y condiciones | [12 - Matrices y Métodos](./12-matrices-métodos.md) |

## Validación de registros antes de aprobación

Para registros con seguimiento (INSTRUMENTAL, BATCH, SAMPLE, STOCK), el sistema **valida que existan los campos con labels obligatorios** antes de permitir la aprobación. Si faltan campos requeridos, el revisor/aprobador recibe un mensaje de error indicando que labels faltan.

| Tipo de registro | Labels obligatorios |
|-----------------|---------------------|
| INSTRUMENTAL | CÓDIGO |
| BATCH | LOTE |
| SAMPLE | CÓDIGO MUESTRA, MATRIZ Y MÉTODOS (tipo MATRIX_METHOD) |
| STOCK | LOTE, PRODUCTO, TIPO MOVIMIENTO, CANTIDAD |

Esta validación previene que se aprueben registros incompletos que luego no podrían crear correctamente las entidades compañeras.

## Enviar a aprobación

1. La entidad debe estar en estado **DRAFT**
2. Deben existir al menos un REVIEWER y un APPROVER asignados en la organización
3. Para registros: deben cumplir las validaciones de labels requeridos según su tipo
4. Desde la entidad, click en **Enviar a revisión**
5. La entidad pasa a **IN_REVIEW**
6. No se puede editar mientras esta en revisión

## Decidir (revisar / aprobar)

Los usuarios con el rol correspondiente ven las solicitudes pendientes:

1. Ir a **Aprobaciones** en el menú lateral
2. Ver el detalle de la solicitud
3. Revisar el contenido técnico de la entidad
4. Click en **Aprobar** o **Rechazar**
5. Si rechaza, **debe** agregar comentarios explicando que se debe corregir

### Flujo de decisiones

| Paso | Acción | Resultado |
|------|--------|-----------|
| 1 | **Revisor aprueba** | Solicitud pasa a PENDING_APPROVAL |
| 2a | **Aprobador aprueba** | Entidad pasa a ACTIVE, solicitud se cierra como APPROVED |
| 2b | **Aprobador rechaza** | Entidad vuelve a DRAFT con comentarios |
| 1b | **Revisor rechaza** | Entidad vuelve a DRAFT con comentarios |

## Auditoría

Cada decisión queda registrada en **ApprovalDecision** con:

| Campo | Descripción |
|-------|-------------|
| **Quien decidió** | Usuario (OrganizationUser) que tomó la decisión |
| **Que decidió** | APPROVED o REJECTED |
| **Comentarios** | Justificación o indicaciones de corrección |
| **Fecha y hora** | Momento exacto de la decisión |
| **Etapa** | REVIEW (revisor) o APPROVAL (aprobador) |

Este historial es consultable por auditores y proporciona la evidencia requerida por ISO 17025.

## Ejemplo práctico

```
1. Responsable de Calidad crea Registro "CONTROL DE PH - AGUA POTABLE" (DRAFT)
   - Tipo: NOT_PERIODIC
   - Campos: PUNTO DE MUESTREO, PH MEDIDO (COMPARISON), EQUIPO (RELATED_ENTRY)

2. Envia a revision --> estado: IN_REVIEW

3. Dra. Garcia (REVIEWER) revisa:
   - Verifica que los limites de comparacion son correctos (6.5 - 8.5)
   - Verifica que el campo de equipo referencia al registro de pHmetros
   - APRUEBA --> solicitud pasa a PENDING_APPROVAL

4. Ing. Martinez (APPROVER) revisa:
   - Confirma que el registro es conforme al POE-LAB-001
   - APRUEBA --> Registro pasa a ACTIVE

5. Los tecnicos ya pueden crear entradas en el registro.
```

## Permisos

| Acción | Roles permitidos |
|--------|-----------------|
| Configurar roles de calidad | ADMIN |
| Enviar a aprobación | ADMIN, QUALITY_MANAGER |
| Decidir (revisar/aprobar) | Cualquiera con QualityRole asignado |
| Ver solicitudes pendientes | Todos |
| Ver historial de decisiones | Todos (trazabilidad) |
