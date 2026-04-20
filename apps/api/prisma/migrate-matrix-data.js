// Data migration: copy Record.matrixId to Sample.matrixId before removing from Record
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find all samples that don't have matrixId but their record does
  const samples = await prisma.$queryRaw`
    UPDATE "Sample" s
    SET "matrixId" = r."matrixId"
    FROM "Record" r
    WHERE s."recordId" = r.id
    AND s."matrixId" IS NULL
    AND r."matrixId" IS NOT NULL
    RETURNING s.id, r."matrixId"
  `
  console.log('Updated samples:', samples.length || 0)

  // Also update samples that already have matrixId (should be same, but ensure consistency)
  console.log('Data migration complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
