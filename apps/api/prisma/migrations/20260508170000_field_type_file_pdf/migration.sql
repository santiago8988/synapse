-- Agregar valor FILE_PDF al enum FieldType.
-- Habilita campos de tipo "Archivo PDF" en Records configurables, con
-- isRequired opcional. El value en Entry.data[fieldId] tiene la forma:
--   { url: string, key: string, name: string, size: number,
--     uploadedAt: ISO, uploadedById: string }
--
-- Migración aditiva pura — solo agrega un valor al enum, no toca data ni
-- tablas. Reversible si fuera necesario.

ALTER TYPE "FieldType" ADD VALUE IF NOT EXISTS 'FILE_PDF';
