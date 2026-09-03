-- Resultado del certificado de calibración (conforme / no conforme).
-- Solo PASSED dispara el recálculo de nextCalibrationAt en el service.

CREATE TYPE "CertificateResult" AS ENUM ('PASSED', 'FAILED');

ALTER TABLE "InstrumentCertificate"
  ADD COLUMN "result" "CertificateResult" NOT NULL DEFAULT 'PASSED';
