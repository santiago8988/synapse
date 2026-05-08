import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Crear organización de prueba
  const org = await prisma.organization.upsert({
    where: { slug: 'synapse-demo-lab' },
    update: {},
    create: {
      name: 'Laboratorio Synapse Demo',
      slug: 'synapse-demo-lab',
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

  // Agregar emails a whitelist como ADMIN (ambos para tolerar el login con cualquiera)
  const adminEmails = ['santiago.mdp@gmail.com', 'santiago@gmail.com']
  for (const email of adminEmails) {
    await prisma.emailWhitelist.upsert({
      where: {
        email_organizationId: {
          email,
          organizationId: org.id,
        },
      },
      update: {},
      create: {
        email,
        organizationId: org.id,
        role: 'ADMIN',
      },
    })
    console.log(`Whitelist: ${email} como ADMIN`)
  }

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

  // Crear registro "No Conformidades" (sistema) — pilot del workflow engine v2
  // con DROPDOWN-as-status. Es el primer Record que usa isStatus + transitions
  // en lugar del enum NonConformityStatus legacy.
  const existingNCs = await prisma.record.findFirst({
    where: { organizationId: org.id, name: 'No Conformidades', isSystem: true },
  })
  if (!existingNCs) {
    const orgUserNc = await prisma.organizationUser.findFirst({
      where: { organizationId: org.id },
    })
    const createdByIdNc = orgUserNc?.id || 'system'

    await prisma.record.create({
      data: {
        organizationId: org.id,
        createdById: createdByIdNc,
        name: 'No Conformidades',
        type: 'NOT_PERIODIC',
        status: 'ACTIVE',
        isSystem: true,
        fields: {
          create: [
            {
              label: 'TÍTULO',
              fieldType: 'TEXT',
              order: 0,
              isIdentifier: true,
              isRequired: true,
            },
            {
              label: 'DESCRIPCIÓN',
              fieldType: 'TEXT',
              order: 1,
              isIdentifier: false,
              isRequired: true,
            },
            {
              label: 'ESTADO',
              fieldType: 'DROPDOWN',
              order: 2,
              isIdentifier: false,
              isRequired: true,
              comparisonConfig: {
                isStatus: true,
                options: [
                  { value: 'OPEN', label: 'Abierta', color: 'red', isInitial: true },
                  { value: 'IN_PROGRESS', label: 'En progreso', color: 'amber' },
                  { value: 'RESOLVED', label: 'Resuelta', color: 'blue' },
                  { value: 'CLOSED', label: 'Cerrada', color: 'green', isFinal: true },
                ],
                transitions: [
                  { from: 'OPEN', to: 'IN_PROGRESS' },
                  { from: 'IN_PROGRESS', to: 'RESOLVED' },
                  { from: 'IN_PROGRESS', to: 'OPEN' },
                  { from: 'RESOLVED', to: 'IN_PROGRESS' },
                  { from: 'RESOLVED', to: 'CLOSED', requireReason: true },
                  { from: 'CLOSED', to: 'OPEN', requireReason: true },
                ],
              },
            },
            {
              label: 'DETECTADA',
              fieldType: 'DATE',
              order: 3,
              isIdentifier: false,
              isRequired: true,
            },
          ],
        },
      },
    })
    console.log('No Conformidades (record) creado')
  } else {
    console.log('No Conformidades (record) ya existe')
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
