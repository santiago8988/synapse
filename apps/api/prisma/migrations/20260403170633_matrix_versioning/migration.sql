-- DropIndex (idempotente — el índice puede no existir en DBs limpias)
DROP INDEX IF EXISTS "Matrix_organizationId_code_key";

-- AlterTable
ALTER TABLE "Matrix" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
