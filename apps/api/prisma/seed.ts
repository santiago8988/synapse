import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Crear organización
  const org = await prisma.organization.upsert({
    where: { slug: 'qualitab-lab' },
    update: {},
    create: {
      name: 'QualitTab Laboratorio',
      slug: 'qualitab-lab',
    },
  })
  console.log('Organización creada:', org.name)

  // Crear áreas
  const labCentral = await prisma.area.create({
    data: {
      name: 'Laboratorio Central',
      organizationId: org.id,
    },
  })

  await prisma.area.createMany({
    data: [
      { name: 'Química Analítica', organizationId: org.id, parentId: labCentral.id },
      { name: 'Microbiología', organizationId: org.id, parentId: labCentral.id },
      { name: 'Instrumental', organizationId: org.id, parentId: labCentral.id },
    ],
  })

  const controlCalidad = await prisma.area.create({
    data: {
      name: 'Control de Calidad',
      organizationId: org.id,
    },
  })

  await prisma.area.createMany({
    data: [
      { name: 'Materias Primas', organizationId: org.id, parentId: controlCalidad.id },
      { name: 'Producto Terminado', organizationId: org.id, parentId: controlCalidad.id },
    ],
  })

  await prisma.area.create({
    data: {
      name: 'Aseguramiento de Calidad',
      organizationId: org.id,
    },
  })

  console.log('Áreas creadas')

  // Agregar email a whitelist como ADMIN
  await prisma.emailWhitelist.upsert({
    where: {
      email_organizationId: {
        email: 'santiago.mdp@gmail.com',
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      email: 'santiago.mdp@gmail.com',
      organizationId: org.id,
      role: 'ADMIN',
    },
  })

  console.log('Whitelist: santiago.mdp@gmail.com como ADMIN')

  // Métodos analíticos globales (orgId = null)
  const globalMethods = [
    { code: 'APHA 4500-H', name: 'Potencial de Hidrógeno - Electrométrico', parameter: 'pH', unit: null, defaultMin: 6.5, defaultMax: 8.5, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 2130-B', name: 'Turbidez - Nefelométrico', parameter: 'Turbidez', unit: 'NTU', defaultMin: null, defaultMax: 3, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 4500-Cl', name: 'Cloro Residual - DPD Colorimétrico', parameter: 'Cloro Residual', unit: 'mg/L', defaultMin: 0.2, defaultMax: 2, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 2510-B', name: 'Conductividad - Electrodo', parameter: 'Conductividad', unit: 'µS/cm', defaultMin: null, defaultMax: null, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 2550', name: 'Temperatura', parameter: 'Temperatura', unit: '°C', defaultMin: null, defaultMax: null, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 4500-N', name: 'Nitratos - Reducción de Cadmio', parameter: 'Nitratos', unit: 'mg/L', defaultMin: null, defaultMax: 45, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 4500-F', name: 'Fluoruros - SPADNS', parameter: 'Fluoruros', unit: 'mg/L', defaultMin: 0.5, defaultMax: 1.5, sourceRef: 'APHA Standard Methods 24th Ed.' },
  ]

  for (const method of globalMethods) {
    const existing = await prisma.orgMethod.findFirst({
      where: { orgId: null, code: method.code },
    })
    if (!existing) {
      await prisma.orgMethod.create({
        data: {
          orgId: null,
          code: method.code,
          name: method.name,
          parameter: method.parameter,
          unit: method.unit,
          defaultMin: method.defaultMin,
          defaultMax: method.defaultMax,
          isGlobal: true,
          sourceRef: method.sourceRef,
        },
      })
    }
  }
  console.log('Métodos globales APHA creados')

  // Crear registro Stock Interno (sistema) si no existe
  const existingStock = await prisma.record.findFirst({
    where: { organizationId: org.id, type: 'STOCK', isSystem: true },
  })
  if (!existingStock) {
    // Buscar un orgUser para createdById, o usar un placeholder
    const orgUser = await prisma.organizationUser.findFirst({
      where: { organizationId: org.id },
    })
    const createdById = orgUser?.id || 'system'

    await prisma.record.create({
      data: {
        organizationId: org.id,
        createdById,
        name: 'Stock Interno',
        type: 'STOCK',
        status: 'ACTIVE',
        isSystem: true,
        fields: {
          create: [
            { label: 'LOTE', fieldType: 'TEXT', order: 0, isIdentifier: true, isRequired: true },
            { label: 'PRODUCTO', fieldType: 'TEXT', order: 1, isIdentifier: false, isRequired: true },
            { label: 'TIPO MOVIMIENTO', fieldType: 'DROPDOWN', order: 2, isIdentifier: false, isRequired: true, comparisonConfig: { options: ['INGRESO', 'EGRESO', 'AJUSTE'] } },
            { label: 'CANTIDAD', fieldType: 'QUANTITY', order: 3, isIdentifier: false, isRequired: true, comparisonConfig: { units: ['KG', 'G', 'L', 'ML', 'U'] } },
          ],
        },
      },
    })
    console.log('Stock Interno creado')
  } else {
    console.log('Stock Interno ya existe')
  }

  console.log('Seed completado!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
