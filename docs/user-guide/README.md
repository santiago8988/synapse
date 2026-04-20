# QualitTab -- Guia de Usuario

Documentacion completa del sistema de gestion de calidad QualitTab. Esta guia cubre todos los modulos del sistema, desde la configuracion organizacional hasta la gestion de stock e inventario.

## Indice

| # | Modulo | Descripcion |
|---|--------|-------------|
| 01 | [Conceptos Generales](./01-conceptos-generales.md) | Estructura del sistema, roles, organizaciones, areas y puestos |
| 02 | [Documentos](./02-documentos.md) | Gestion documental con versionado y circuito de aprobacion |
| 03 | [Registros](./03-registros.md) | Tipos de registro, campos personalizables, validaciones y versionado |
| 04 | [Entradas](./04-entradas.md) | Carga de datos, UPPERCASE, entidades companeras, comparaciones y formulas |
| 05 | [Recetas](./05-recetas.md) | Formulas de produccion: ingredientes (BOM), vinculacion con stock y versionado |
| 06 | [Lotes de Produccion](./06-lotes.md) | Produccion por lotes, seleccion de receta por entrada, consumo de stock |
| 07 | [Muestras](./07-muestras.md) | Recepcion de muestras, seleccion de matriz y metodos, condiciones y resultados |
| 08 | [Instrumental](./08-instrumental.md) | Gestion de equipos, calibracion, estados y validacion de uso |
| 09 | [Circuito de Aprobacion](./09-circuito-aprobacion.md) | Workflow ISO: elaborador, revisor, aprobador. Aplica a documentos, registros, recetas y matrices |
| 10 | [No Conformidades](./10-no-conformidades.md) | Deteccion automatica y manual, acciones correctivas y seguimiento |
| 11 | [Stock e Inventario](./11-stock.md) | Movimientos de inventario: ingresos, egresos, ajustes. Resumen por producto y lote |
| 12 | [Matrices y Metodos Analiticos](./12-matrices-metodos.md) | Matrices de ensayo, condiciones de muestreo, catalogo de metodos analiticos |

## Audiencia

Esta guia esta orientada a:

- **Administradores** que configuran la organizacion, areas, puestos y permisos
- **Responsables de Calidad** que definen registros, documentos, recetas, matrices y circuitos de aprobacion
- **Tecnicos** que cargan datos en las entradas diarias, operan lotes y registran muestras
- **Auditores** que consultan trazabilidad, historial y reportes

## Convenciones

- Los ejemplos usan datos ficticios de entornos industriales: laboratorios analiticos, plantas quimicas, farmaceuticas y de materiales de construccion
- Cada modulo es independiente pero incluye referencias cruzadas donde corresponde
- Todos los valores de texto ingresados en el sistema se almacenan en **MAYUSCULAS** para garantizar consistencia y facilitar busquedas
- Los nombres de campos, estados y tipos se muestran en su forma tecnica (ej: `BATCH`, `IN_PROGRESS`) para facilitar la correlacion con la interfaz
