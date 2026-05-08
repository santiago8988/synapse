---
name: synapse-iso-spec-writer
description: Convierte un requisito ISO 9001 / 17025 en una especificación de implementación con la estructura de SAMPLE_CUSTODY_SPEC.md. Cubre contexto, alcance, modelo de dominio, reglas de validación, schema Prisma, módulo backend, página frontend, checklist por fases y criterios de aceptación. Útil para features que necesitan paper trail para auditoría.
---

# synapse-iso-spec-writer

Genera specs de features ISO en el formato canónico de Synapse. La spec sirve como contrato de implementación y como evidencia de diseño para auditoría externa.

## Cuándo usar

- Feature nuevo que cubre un requisito de ISO 9001 o ISO/IEC 17025.
- Feature que toca tablas append-only o el circuito de aprobación documental.
- Feature que se debe poder defender frente a un auditor (OAA, ENAC, ILAC, etc.).

Para features puramente de DX o UX, usar `synapse-new-module` u otra skill — no esta.

## Estructura obligatoria de la spec

Crear el archivo en `<FEATURE_NAME>_SPEC.md` en la raíz del repo (igual que `SAMPLE_CUSTODY_SPEC.md`). Mantener este árbol exacto de secciones:

```
1. Contexto
   - El requisito ISO que cubre (cita la cláusula, ej. "ISO 17025 §7.4")
   - Por qué el sistema actual no lo cumple
   - Qué se pretende lograr
   
2. Alcance
   2.1 Dentro del alcance (lista concreta de cambios)
   2.2 Fuera del alcance (lista explícita de lo que se difiere)
   
3. Modelo de Dominio
   3.1 Tipos de evento / entidades nuevas (con tabla descriptiva)
   3.2 Enums asociados (con tabla)
   3.3 Reglas de validación numeradas (cada regla con su justificación)
   3.4 Eventos auto-generados (si aplica — tabla trigger → evento)
   
4. Schema de Base de Datos
   4.1 Adiciones al schema.prisma (bloque de código exacto)
   4.2 Relaciones inversas en modelos existentes
   4.3 Migración (descripción del SQL, no necesariamente el SQL completo)
   
5. Backend (NestJS)
   5.1 Estructura del módulo (árbol de archivos)
   5.2 Interface del service (tabla de métodos públicos)
   5.3 Endpoints del controller (tabla con HTTP, path, body, roles)
   5.4 Listeners (si consume domain events)
   5.5 API client (cambios en apps/web/src/lib/api.ts)
   
6. Frontend (Next.js)
   6.1 Página nueva (path en App Router)
   6.2 Layout y componentes
   6.3 Campos condicionales / interacciones
   6.4 Estados especiales (read-only, terminal, etc.)
   
7. Integración con el sistema existente
   7.1 Páginas/componentes que se modifican
   7.2 Sidebar / navegación
   7.3 Audit log (relación con el existente)
   7.4 Permisos (qué roles pueden qué)
   
8. Checklist de implementación (fases con tareas marcables)
   Fase 1 — Schema y migración
   Fase 2 — Módulo del backend
   Fase 3 — Listener de auto-generación (si aplica)
   Fase 4 — API client
   Fase 5 — Página del frontend
   Fase 6 — Integración con páginas existentes
   Fase 7 — Verificación manual end-to-end (con casos concretos)
   Fase 8 — Commit y merge
   
9. Mapa de archivos
   9.1 Creados
   9.2 Modificados
   
10. Criterios de aceptación (numerados, todos verificables)

11. Riesgos y rollback
    Riesgos
    Rollback (pasos concretos)

12. Evolución futura (Nivel 3)
    Mejoras opcionales que la spec actual habilita pero no implementa

13. Referencias normativas
    - Cláusulas ISO citadas
    - Métodos estándar relevantes (APHA, EPA, etc. cuando aplique)
    - Documentos del organismo de acreditación local (OAA, ENAC, etc.)
```

## Reglas de redacción

1. **Idioma**: español. Sin tildes en código, sí en prosa.
2. **Concreto sobre abstracto**: cada regla de validación tiene un mensaje de error en español listo para mostrar al usuario.
3. **Tablas para todo lo enumerable**: tipos de evento, validaciones por tipo, mapeo trigger→evento, campos requeridos por estado.
4. **Sin TODOs**: si algo es ambiguo, escribir "Diferido a Nivel 3" en sección 12 en vez de dejar TODO.
5. **Criterios de aceptación verificables**: cada criterio se puede testear manualmente o con un comando.
6. **Justificación ISO en sección 1**: citar cláusula, no parafrasear.

## Ejemplo de regla de validación bien escrita

```
4. **Los eventos de transferencia requieren doble firma**: los eventos de tipo
   `DELIVERED`, `RECEIVED` y `ASSIGNED_TO_ANALYST` deben incluir un
   `receivedById` no nulo. El `performedById` y el `receivedById` no pueden
   ser el mismo usuario.

   Mensaje al usuario: "El receptor no puede ser la misma persona que entrega."
   Justificación ISO: ISO 17025 §7.4.5 — la transferencia de custodia debe
   quedar evidenciada por dos personas distintas.
```

## Patrón de output

Generar el archivo `.md` directamente, listo para commit. Si la spec es para un feature ya en progreso, leer primero el código existente (Read + Glob) para que las secciones 4 (schema), 5 (backend) y 6 (frontend) reflejen el estado real y propongan deltas concretos.

## Ejemplo de invocación

Usuario: "Necesito una spec para implementar control de equipos de medición según ISO 9001 §7.1.5"

Pasos:
1. Leer `apps/api/prisma/schema.prisma` para ver qué hay ya de instrumentos.
2. Leer `apps/api/src/modules/instruments/` para ver el módulo actual.
3. Identificar qué cubre §7.1.5 que no cubre el módulo (ej. registros de incertidumbre de medida, trazabilidad metrológica al SI).
4. Generar `MEASUREMENT_TRACEABILITY_SPEC.md` con las 13 secciones.

## Salida esperada

- Un archivo `<FEATURE>_SPEC.md` en la raíz del repo con todas las secciones.
- Lo suficientemente detallado para que un desarrollador (humano o agente) pueda implementar sin volver a hacer preguntas de diseño.
- Citas a `SAMPLE_CUSTODY_SPEC.md` cuando el patrón se repite (no copiar texto).
