-- Recipe.stepsPdf* — columnas opcionales para que el usuario adjunte un PDF
-- con los pasos del proceso. Reemplaza progresivamente el modelo RecipeStep
-- textual (la tabla queda en schema por ahora; data preexistente se respeta).
--
-- Migración aditiva pura. NO drop de RecipeStep — esa decisión es separada
-- y requiere confirmación del usuario para no perder pasos existentes.

ALTER TABLE "Recipe" ADD COLUMN "stepsPdfUrl"        TEXT;
ALTER TABLE "Recipe" ADD COLUMN "stepsPdfKey"        TEXT;
ALTER TABLE "Recipe" ADD COLUMN "stepsPdfName"       TEXT;
ALTER TABLE "Recipe" ADD COLUMN "stepsPdfSize"       INTEGER;
ALTER TABLE "Recipe" ADD COLUMN "stepsPdfUploadedAt" TIMESTAMP(3);
