const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Copy Record.recipeId to Batch.recipeId where Batch doesn't have one
  const result = await prisma.$executeRaw`
    UPDATE "Batch" b
    SET "recipeId" = r."recipeId"
    FROM "Record" r
    WHERE b."recordId" = r.id
    AND b."recipeId" IS NULL
    AND r."recipeId" IS NOT NULL
  `
  console.log('Updated batches:', result)
  console.log('Data migration complete')
}

main().catch(console.error).finally(() => prisma.$disconnect())
