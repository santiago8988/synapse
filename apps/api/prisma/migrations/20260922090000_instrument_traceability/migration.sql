-- Trazabilidad de instrumental (ISO 17025 §6.4).
--
-- Que equipo se uso en que ensayo o lote. La UI de esta feature ya existia
-- entera en el frontend y el backend no tenia nada: ni modelo, ni servicio, ni
-- endpoint. Los bloques quedaban invisibles porque colgaban de un campo que la
-- API nunca devolvia, y lo que el usuario cargaba en "Instrumentos requeridos"
-- del formulario de matrices se descartaba en silencio. Ver TO_DO.md §26.
--
-- Se declara en dos pasos:
--
--   1. La plantilla (Matriz para muestras, Formula para lotes) lista los
--      equipos que el metodo REQUIERE, por etiqueta generica: "Termometro",
--      "pHmetro". Son labels y no instrumentos concretos porque la plantilla
--      describe el metodo, no una corrida.
--   2. Cada muestra o lote ASIGNA a cada etiqueta el instrumento real que se
--      uso. Ahi la trazabilidad se vuelve verificable: la asignacion apunta a
--      un Instrument, con su estado, su proxima calibracion y sus certificados.
--
-- Solo agrega tablas. No toca ninguna existente, asi que el rollback es
-- DROP TABLE de las cuatro y no hay backfill que hacer: arrancan vacias y las
-- pantallas que las leen ya toleran la lista vacia.
--
-- Las asignaciones NO son append-only: mientras la corrida esta abierta se
-- puede corregir a que equipo se apunto. Queda registrado quien asigno y
-- cuando; el paper trail del acto vive en AuditLog, que loguea el POST y el
-- DELETE.

-- ─────────────────────────────────────────────
-- Equipos que una plantilla requiere
-- ─────────────────────────────────────────────

CREATE TABLE "MatrixRequiredInstrument" (
    "id"       TEXT    NOT NULL,
    "matrixId" TEXT    NOT NULL,
    -- Etiqueta generica del equipo, no un instrumento concreto.
    "label"    TEXT    NOT NULL,
    "order"    INTEGER NOT NULL,

    CONSTRAINT "MatrixRequiredInstrument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatrixRequiredInstrument_matrixId_idx" ON "MatrixRequiredInstrument"("matrixId");

-- Cascade igual que MatrixParameter y MatrixCondition: la lista de equipos es
-- parte de la definicion de la matriz y no sobrevive sin ella.
ALTER TABLE "MatrixRequiredInstrument"
    ADD CONSTRAINT "MatrixRequiredInstrument_matrixId_fkey"
    FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RecipeRequiredInstrument" (
    "id"       TEXT    NOT NULL,
    "recipeId" TEXT    NOT NULL,
    "label"    TEXT    NOT NULL,
    "order"    INTEGER NOT NULL,

    CONSTRAINT "RecipeRequiredInstrument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipeRequiredInstrument_recipeId_idx" ON "RecipeRequiredInstrument"("recipeId");

ALTER TABLE "RecipeRequiredInstrument"
    ADD CONSTRAINT "RecipeRequiredInstrument_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────
-- Instrumento real asignado a cada etiqueta
-- ─────────────────────────────────────────────

CREATE TABLE "SampleInstrumentAssignment" (
    "id"           TEXT         NOT NULL,
    "sampleId"     TEXT         NOT NULL,
    "instrumentId" TEXT         NOT NULL,
    -- Copia de la etiqueta de la plantilla. Se guarda y no se referencia por
    -- id: si la matriz se edita y la etiqueta cambia o desaparece, la muestra
    -- ya cerrada tiene que seguir diciendo contra que equipo se ensayo.
    "label"        TEXT         NOT NULL,
    "order"        INTEGER      NOT NULL,
    "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT         NOT NULL,

    CONSTRAINT "SampleInstrumentAssignment_pkey" PRIMARY KEY ("id")
);

-- Una etiqueta se cubre con un solo equipo, y un equipo no cubre dos etiquetas
-- de la misma muestra. La UI ya filtraba los instrumentos ya usados; esto lo
-- hace cierto tambien cuando el pedido no viene de la UI.
CREATE UNIQUE INDEX "SampleInstrumentAssignment_sampleId_label_key"
    ON "SampleInstrumentAssignment"("sampleId", "label");
CREATE UNIQUE INDEX "SampleInstrumentAssignment_sampleId_instrumentId_key"
    ON "SampleInstrumentAssignment"("sampleId", "instrumentId");
CREATE INDEX "SampleInstrumentAssignment_sampleId_idx"
    ON "SampleInstrumentAssignment"("sampleId");
-- Para responder "en que ensayos se uso este equipo", que es la pregunta que
-- hace un auditor cuando una calibracion sale no conforme.
CREATE INDEX "SampleInstrumentAssignment_instrumentId_idx"
    ON "SampleInstrumentAssignment"("instrumentId");

ALTER TABLE "SampleInstrumentAssignment"
    ADD CONSTRAINT "SampleInstrumentAssignment_sampleId_fkey"
    FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sin cascade: un instrumento no se borra, se da de baja (DECOMMISSIONED). Si
-- alguna vez se borrara, la FK tiene que frenarlo antes de que se lleve la
-- evidencia de los ensayos donde se uso.
ALTER TABLE "SampleInstrumentAssignment"
    ADD CONSTRAINT "SampleInstrumentAssignment_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SampleInstrumentAssignment"
    ADD CONSTRAINT "SampleInstrumentAssignment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "OrganizationUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BatchInstrumentAssignment" (
    "id"           TEXT         NOT NULL,
    "batchId"      TEXT         NOT NULL,
    "instrumentId" TEXT         NOT NULL,
    "label"        TEXT         NOT NULL,
    "order"        INTEGER      NOT NULL,
    "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT         NOT NULL,

    CONSTRAINT "BatchInstrumentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BatchInstrumentAssignment_batchId_label_key"
    ON "BatchInstrumentAssignment"("batchId", "label");
CREATE UNIQUE INDEX "BatchInstrumentAssignment_batchId_instrumentId_key"
    ON "BatchInstrumentAssignment"("batchId", "instrumentId");
CREATE INDEX "BatchInstrumentAssignment_batchId_idx"
    ON "BatchInstrumentAssignment"("batchId");
CREATE INDEX "BatchInstrumentAssignment_instrumentId_idx"
    ON "BatchInstrumentAssignment"("instrumentId");

ALTER TABLE "BatchInstrumentAssignment"
    ADD CONSTRAINT "BatchInstrumentAssignment_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BatchInstrumentAssignment"
    ADD CONSTRAINT "BatchInstrumentAssignment_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BatchInstrumentAssignment"
    ADD CONSTRAINT "BatchInstrumentAssignment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "OrganizationUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
