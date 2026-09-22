-- Trazabilidad de instrumental (ISO 17025 §6.4).
--
-- Que equipo se uso en que ensayo o lote. La plantilla (Matriz para muestras,
-- Formula para lotes) lista las etiquetas genericas que el metodo requiere
-- —"Termometro", "pHmetro"—, y cada corrida les asigna el instrumento real.
-- Ver TO_DO.md §26.
--
-- ─────────────────────────────────────────────────────────────────────────
-- POR QUE ESTA MIGRACION ES IDEMPOTENTE
-- ─────────────────────────────────────────────────────────────────────────
--
-- Las cuatro tablas YA EXISTEN en la base de produccion, con datos. Llegaron
-- por un `prisma db push` que nunca dejo migracion ni schema en el repo: la
-- feature se diseño, se empujo a la base y solo el frontend llego al codigo.
-- Un `CREATE TABLE` pelado falla con 42P07 (relation already exists) y deja la
-- migracion trabada, que es exactamente lo que paso en el primer intento.
--
-- Con IF NOT EXISTS, esta migracion hace lo correcto en los dos escenarios:
--
--   * base nueva      -> crea todo
--   * base con drift  -> crea solo lo que falta (los dos indices unicos)
--
-- No usa `prisma db push` como arreglo justamente para que el repo quede con
-- la migracion que describe el estado, y la proxima base arranque igual.
--
-- ROLLBACK: DROP TABLE de las cuatro. No hay backfill: ninguna tabla existente
-- se toca. Ojo con que en la base actual eso borraria las filas que ya estan.
--
-- NOTA sobre `assignedById`: queda como columna sin foreign key. Las filas que
-- ya existen apuntan a OrganizationUser que no existen, asi que la constraint
-- no se puede crear sin limpiarlas primero. Es una decision pendiente, anotada
-- en TO_DO.md §26.

-- ─────────────────────────────────────────────
-- Equipos que una plantilla requiere
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "MatrixRequiredInstrument" (
    "id"       TEXT    NOT NULL,
    "matrixId" TEXT    NOT NULL,
    -- Etiqueta generica del equipo, no un instrumento concreto.
    "label"    TEXT    NOT NULL,
    "order"    INTEGER NOT NULL,

    CONSTRAINT "MatrixRequiredInstrument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MatrixRequiredInstrument_matrixId_idx"
    ON "MatrixRequiredInstrument"("matrixId");

CREATE TABLE IF NOT EXISTS "RecipeRequiredInstrument" (
    "id"       TEXT    NOT NULL,
    "recipeId" TEXT    NOT NULL,
    "label"    TEXT    NOT NULL,
    "order"    INTEGER NOT NULL,

    CONSTRAINT "RecipeRequiredInstrument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecipeRequiredInstrument_recipeId_idx"
    ON "RecipeRequiredInstrument"("recipeId");

-- ─────────────────────────────────────────────
-- Instrumento real asignado a cada etiqueta
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "SampleInstrumentAssignment" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "SampleInstrumentAssignment_sampleId_label_key"
    ON "SampleInstrumentAssignment"("sampleId", "label");

-- Un equipo no cubre dos etiquetas de la misma muestra. La UI ya filtraba los
-- instrumentos ya usados; esto lo hace cierto tambien cuando el pedido no
-- viene de la UI. Es lo unico que esta migracion agrega sobre la base actual.
CREATE UNIQUE INDEX IF NOT EXISTS "SampleInstrumentAssignment_sampleId_instrumentId_key"
    ON "SampleInstrumentAssignment"("sampleId", "instrumentId");

-- Para responder "en que ensayos se uso este equipo", que es la pregunta que
-- hace un auditor cuando una calibracion sale no conforme.
CREATE INDEX IF NOT EXISTS "SampleInstrumentAssignment_instrumentId_idx"
    ON "SampleInstrumentAssignment"("instrumentId");

CREATE TABLE IF NOT EXISTS "BatchInstrumentAssignment" (
    "id"           TEXT         NOT NULL,
    "batchId"      TEXT         NOT NULL,
    "instrumentId" TEXT         NOT NULL,
    "label"        TEXT         NOT NULL,
    "order"        INTEGER      NOT NULL,
    "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT         NOT NULL,

    CONSTRAINT "BatchInstrumentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BatchInstrumentAssignment_batchId_label_key"
    ON "BatchInstrumentAssignment"("batchId", "label");

CREATE UNIQUE INDEX IF NOT EXISTS "BatchInstrumentAssignment_batchId_instrumentId_key"
    ON "BatchInstrumentAssignment"("batchId", "instrumentId");

CREATE INDEX IF NOT EXISTS "BatchInstrumentAssignment_instrumentId_idx"
    ON "BatchInstrumentAssignment"("instrumentId");

-- ─────────────────────────────────────────────
-- Foreign keys
-- ─────────────────────────────────────────────
--
-- Postgres no admite IF NOT EXISTS en ADD CONSTRAINT, asi que cada una se
-- agrega solo si no esta. En la base actual ya existen todas y este bloque no
-- hace nada; en una base nueva las crea.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MatrixRequiredInstrument_matrixId_fkey') THEN
        -- Cascade igual que MatrixParameter y MatrixCondition: la lista de
        -- equipos es parte de la definicion de la matriz.
        ALTER TABLE "MatrixRequiredInstrument"
            ADD CONSTRAINT "MatrixRequiredInstrument_matrixId_fkey"
            FOREIGN KEY ("matrixId") REFERENCES "Matrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecipeRequiredInstrument_recipeId_fkey') THEN
        ALTER TABLE "RecipeRequiredInstrument"
            ADD CONSTRAINT "RecipeRequiredInstrument_recipeId_fkey"
            FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SampleInstrumentAssignment_sampleId_fkey') THEN
        ALTER TABLE "SampleInstrumentAssignment"
            ADD CONSTRAINT "SampleInstrumentAssignment_sampleId_fkey"
            FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Sin cascade: un instrumento no se borra, se da de baja. Si alguna vez se
    -- borrara, la FK tiene que frenarlo antes de que se lleve la evidencia de
    -- los ensayos donde se uso.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SampleInstrumentAssignment_instrumentId_fkey') THEN
        ALTER TABLE "SampleInstrumentAssignment"
            ADD CONSTRAINT "SampleInstrumentAssignment_instrumentId_fkey"
            FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BatchInstrumentAssignment_batchId_fkey') THEN
        ALTER TABLE "BatchInstrumentAssignment"
            ADD CONSTRAINT "BatchInstrumentAssignment_batchId_fkey"
            FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BatchInstrumentAssignment_instrumentId_fkey') THEN
        ALTER TABLE "BatchInstrumentAssignment"
            ADD CONSTRAINT "BatchInstrumentAssignment_instrumentId_fkey"
            FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END
$$;
