/*
  Warnings:

  - You are about to drop the column `position` on the `OrganizationUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "leaderId" TEXT;

-- AlterTable
ALTER TABLE "OrganizationUser" DROP COLUMN "position",
ADD COLUMN     "positionId" TEXT;

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_organizationId_idx" ON "Position"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_organizationId_name_key" ON "Position"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "OrganizationUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
