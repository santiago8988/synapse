-- InstrumentCertificate — append-only.
-- Cada vez que un técnico externo entrega un certificado de calibración,
-- se inserta una nueva fila. NUNCA se hace UPDATE ni DELETE — el historial
-- es trazabilidad ISO. Mismo patrón que AuditLog / EntryStatusLog / *StatusLog.

CREATE TABLE "InstrumentCertificate" (
    "id"              TEXT          NOT NULL,
    "instrumentId"    TEXT          NOT NULL,
    "organizationId"  TEXT          NOT NULL,
    "pdfUrl"          TEXT          NOT NULL,
    "pdfKey"          TEXT          NOT NULL,
    "pdfName"         TEXT          NOT NULL,
    "pdfSize"         INTEGER       NOT NULL,
    "calibrationDate" TIMESTAMP(3),
    "notes"           TEXT,
    "uploadedById"    TEXT          NOT NULL,
    "uploadedAt"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentCertificate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstrumentCertificate_instrumentId_idx"   ON "InstrumentCertificate"("instrumentId");
CREATE INDEX "InstrumentCertificate_organizationId_idx" ON "InstrumentCertificate"("organizationId");
CREATE INDEX "InstrumentCertificate_uploadedAt_idx"     ON "InstrumentCertificate"("uploadedAt");

ALTER TABLE "InstrumentCertificate"
    ADD CONSTRAINT "InstrumentCertificate_instrumentId_fkey"
    FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InstrumentCertificate"
    ADD CONSTRAINT "InstrumentCertificate_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InstrumentCertificate"
    ADD CONSTRAINT "InstrumentCertificate_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
