-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "producedQuantity" DOUBLE PRECISION,
ADD COLUMN     "unit" TEXT;

-- CreateTable
CREATE TABLE "BatchStatusLog" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fromStatus" "BatchStatus" NOT NULL,
    "toStatus" "BatchStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchStatusLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BatchStatusLog" ADD CONSTRAINT "BatchStatusLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
