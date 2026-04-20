# 01 -- Conceptos Generales

## Que es QualitTab

QualitTab es un sistema de gestion de calidad disenado para laboratorios, plantas industriales y organizaciones que operan bajo normas ISO (especialmente ISO 17025 e ISO 9001). Centraliza la gestion de documentos controlados, registros de calidad, instrumental, muestras, lotes de produccion, stock de insumos, matrices de ensayo y no conformidades.

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

## Organizacion

Cada organizacion es un espacio aislado (multitenant). Los datos de una organizacion no son visibles desde otra. Una organizacion tiene:

- **Nombre** y **slug** (identificador unico en la URL)
- **Logo** personalizable
- **Areas** organizadas en arbol jerarquico
- **Usuarios** invitados por email (whitelist)
- **Puestos** configurables (ej: Analista Quimico, Jefe de Planta)
- **Circuito de aprobacion** con revisores y aprobadores asignados
- **Metodos analiticos** propios, ademas de acceso al catalogo global

## Roles de usuario

| Rol | Permisos |
|-----|----------|
| **ADMIN** | Control total. Gestiona usuarios, areas, puestos, configuracion. Accede a todo sin restriccion de area. |
| **QUALITY_MANAGER** | Crea y edita registros, documentos, recetas, matrices. Gestiona no conformidades. Acceso limitado a su area y sub-areas. |
| **TECHNICIAN** | Carga datos en entradas, opera lotes, registra muestras y movimientos de stock. No puede crear ni modificar registros o documentos. Acceso a su area asignada. |
| **AUDITOR** | Solo lectura. Accede a toda la organizacion para auditorias. No puede modificar nada. |

## Areas

Las areas representan la estructura organizacional. Son jerarquicas: un area puede contener sub-areas.

- Cada area puede tener un **jefe de area** asignado
- Los usuarios con rol TECHNICIAN o QUALITY_MANAGER solo ven los datos de su area y sus sub-areas
- ADMIN y AUDITOR ven todas las areas

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

Los puestos son configurables por cada organizacion. Se definen en **Configuracion > Puestos** y se asignan a los usuarios. Ejemplos tipicos:

- Analista Quimico
- Jefe de Laboratorio
- Tecnico de Muestreo
- Director Tecnico
- Responsable de Calidad
- Jefe de Planta
- Operador de Produccion

## Capacitaciones

Cada usuario puede tener capacitaciones registradas con:

- Nombre de la capacitacion y entidad capacitadora
- Fecha de realizacion y fecha de vencimiento
- Certificado adjunto (URL)
- Estado automatico: **Vigente**, **Por vencer** (30 dias), **Vencida**

El dashboard alerta sobre capacitaciones proximas a vencer.

## Registro de auditoria

Todas las acciones relevantes en el sistema quedan registradas en el **Audit Log** con:

- Usuario que realizo la accion
- Tipo de accion y entidad afectada
- Estado anterior y posterior (before/after)
- Direccion IP y fecha/hora

Esto garantiza la trazabilidad requerida por ISO 17025.

## Texto en mayusculas

Todos los valores de texto ingresados por los usuarios se almacenan automaticamente en **MAYUSCULAS**. Esto garantiza consistencia en los datos, facilita busquedas y evita duplicados por diferencias de capitalizacion (ej: "Agua Potable" vs "AGUA POTABLE").

## Acceso al sistema

1. Un ADMIN agrega el email del usuario a la **whitelist** con un rol asignado
2. El usuario ingresa con su cuenta de Google (autenticacion OAuth)
3. El sistema verifica que el email este en la whitelist
4. Se crea automaticamente su perfil en la organizacion
5. El ADMIN puede completar su perfil: puesto, area, telefono, firma
