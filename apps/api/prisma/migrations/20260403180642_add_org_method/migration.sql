-- CreateTable
CREATE TABLE "OrgMethod" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "unit" TEXT,
    "defaultMin" DOUBLE PRECISION,
    "defaultMax" DOUBLE PRECISION,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgMethod_orgId_idx" ON "OrgMethod"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMethod_orgId_code_key" ON "OrgMethod"("orgId", "code");

-- AddForeignKey
ALTER TABLE "OrgMethod" ADD CONSTRAINT "OrgMethod_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
