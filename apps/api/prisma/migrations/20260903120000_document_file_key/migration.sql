-- Document guardaba solo `fileUrl`, una ruta armada a mano contra el endpoint
-- que servía el archivo. Al abstraer el almacenamiento (disco en desarrollo,
-- R2 en producción) hace falta persistir la clave del objeto y derivar la URL
-- firmada en cada lectura.
--
-- Migración aditiva: la columna es nullable y no se borra `fileUrl`.

ALTER TABLE "Document" ADD COLUMN "fileKey" TEXT;

-- Backfill de los documentos ya cargados. Las URLs viejas tienen la forma
-- /api/documents/<id>/file/<filename> y los archivos correspondientes están en
-- uploads/documents/<filename> con nombre plano, así que la clave es el último
-- segmento de la ruta. Los que no matcheen quedan en NULL y se comportan como
-- un documento sin archivo hasta que se vuelva a subir.
UPDATE "Document"
SET "fileKey" = substring("fileUrl" from '[^/]+$')
WHERE "fileUrl" IS NOT NULL
  AND "fileUrl" LIKE '/api/documents/%/file/%';
