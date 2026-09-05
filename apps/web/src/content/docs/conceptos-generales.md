# Conceptos Generales

## Qué es Synapse

Synapse es un sistema de gestión de calidad diseñado para laboratorios, plantas industriales y organizaciones que operan bajo normas ISO (especialmente ISO 17025 e ISO 9001). Centraliza la gestión de documentos controlados, registros de calidad, instrumental, muestras, lotes de producción, stock de insumos, matrices de ensayo y no conformidades.

## Estructura del sistema

```
Organizacion
+-- Areas (jerarquicas)
|   +-- Laboratorio Central
|   |   +-- Fisicoquimica
|   |   +-- Microbiologia
|   |   +-- Cromatografia
|   +-- Control de Calidad
|   +-- Produccion
|       +-- Planta 1
|       +-- Planta 2
+-- Usuarios (con roles y puestos)
+-- Documentos (procedimientos, manuales, instructivos)
+-- Registros (plantillas de datos)
|   +-- Entradas (instancias con datos cargados)
+-- Recetas (formulas de produccion con BOM)
+-- Matrices (matrices de ensayo con parametros y condiciones)
+-- Metodos Analiticos (catalogo de metodos normativos y propios)
+-- Instrumental (equipos con control de calibracion)
+-- Lotes (corridas de produccion con trazabilidad)
+-- Muestras (especimenes con ensayos y resultados)
+-- Stock (inventario de insumos y materias primas)
+-- No Conformidades (desvios y acciones correctivas)
```

## Organización

Cada organización es un espacio aislado (multitenant). Los datos de una organización no son visibles desde otra. Una organización tiene:

- **Nombre** y **slug** (identificador único en la URL)
- **Logo** personalizable
- **Áreas** organizadas en árbol jerárquico
- **Usuarios** invitados por email (whitelist)
- **Puestos** configurables (ej: Analista Químico, Jefe de Planta)
- **Circuito de aprobación** con revisores y aprobadores asignados
- **Métodos analíticos** propios, además de acceso al catálogo global

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Control total. Gestiona usuarios, áreas, puestos, configuración. Accede a todo sin restricción de área. |
| **QUALITY_MANAGER** | Crea y edita registros, documentos, recetas, matrices. Gestiona no conformidades. Acceso limitado a su área y sub-áreas. |
| **TECHNICIAN** | Carga datos en entradas, opera lotes, registra muestras y movimientos de stock. No puede crear ni modificar registros o documentos. Acceso a su área asignada. |
| **AUDITOR** | Solo lectura. Accede a toda la organización para auditorías. No puede modificar nada. |

## Áreas

Las áreas representan la estructura organizacional. Son jerarquicas: un área puede contener sub-áreas.

- Cada área puede tener un **jefe de área** asignado
- Los usuarios con rol TECHNICIAN o QUALITY_MANAGER solo ven los datos de su área y sus sub-áreas
- ADMIN y AUDITOR ven todas las áreas

**Ejemplo:**
```
Laboratorio Central              <-- Jefe: Dra. Maria Garcia
+-- Fisicoquimica                <-- Jefe: Lic. Carlos Lopez
+-- Microbiologia                <-- Jefe: Dra. Laura Martinez
+-- Cromatografia
Produccion
+-- Planta Fertilizantes         <-- Jefe: Ing. Roberto Sanchez
+-- Planta Soluciones
```

## Puestos

Los puestos son configurables por cada organización. Se definen en **Configuración > Puestos** y se asignan a los usuarios. Ejemplos tipicos:

- Analista Químico
- Jefe de Laboratorio
- Técnico de Muestreo
- Director Técnico
- Responsable de Calidad
- Jefe de Planta
- Operador de Producción

## Capacitaciones

Cada usuario puede tener capacitaciones registradas con:

- Nombre de la capacitación y entidad capacitadora
- Fecha de realización y fecha de vencimiento
- Certificado adjunto (URL)
- Estado automático: **Vigente**, **Por vencer** (30 días), **Vencida**

El dashboard alerta sobre capacitaciones próximas a vencer.

## Registro de auditoría

Todas las acciones relevantes en el sistema quedan registradas en el **Audit Log** con:

- Usuario que realizó la acción
- Tipo de acción y entidad afectada
- Estado anterior y posterior (before/after)
- Dirección IP y fecha/hora

Esto garantiza la trazabilidad requerida por ISO 17025.

## Texto en mayúsculas

Todos los valores de texto ingresados por los usuarios se almacenan automáticamente en **MAYÚSCULAS**. Esto garantiza consistencia en los datos, facilita búsquedas y evita duplicados por diferencias de capitalización (ej: "Agua Potable" vs "AGUA POTABLE").

## Acceso al sistema

1. Un ADMIN agrega el email del usuario a la **whitelist** con un rol asignado
2. El usuario ingresa con su cuenta de Google (autenticación OAuth)
3. El sistema verifica que el email este en la whitelist
4. Se crea automáticamente su perfil en la organización
5. El ADMIN puede completar su perfil: puesto, área, teléfono, firma
