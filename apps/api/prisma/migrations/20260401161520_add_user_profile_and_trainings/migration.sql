-- AlterTable
ALTER TABLE "OrganizationUser" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "signature" TEXT;

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "organizationUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "provider" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Training_organizationId_idx" ON "Training"("organizationId");

-- CreateIndex
CREATE INDEX "Training_organizationUserId_idx" ON "Training"("organizationUserId");

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_organizationUserId_fkey" FOREIGN KEY ("organizationUserId") REFERENCES "OrganizationUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
