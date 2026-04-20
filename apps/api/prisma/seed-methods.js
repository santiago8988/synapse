const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const methods = [
    { code: 'APHA 4500-H', name: 'Potencial de Hidrógeno - Electrométrico', parameter: 'pH', unit: null, defaultMin: 6.5, defaultMax: 8.5, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 2130-B', name: 'Turbidez - Nefelométrico', parameter: 'Turbidez', unit: 'NTU', defaultMin: null, defaultMax: 3, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 4500-Cl', name: 'Cloro Residual - DPD Colorimétrico', parameter: 'Cloro Residual', unit: 'mg/L', defaultMin: 0.2, defaultMax: 2, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 2510-B', name: 'Conductividad - Electrodo', parameter: 'Conductividad', unit: 'µS/cm', defaultMin: null, defaultMax: null, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 2550', name: 'Temperatura', parameter: 'Temperatura', unit: '°C', defaultMin: null, defaultMax: null, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 4500-N', name: 'Nitratos - Reducción de Cadmio', parameter: 'Nitratos', unit: 'mg/L', defaultMin: null, defaultMax: 45, sourceRef: 'APHA Standard Methods 24th Ed.' },
    { code: 'APHA 4500-F', name: 'Fluoruros - SPADNS', parameter: 'Fluoruros', unit: 'mg/L', defaultMin: 0.5, defaultMax: 1.5, sourceRef: 'APHA Standard Methods 24th Ed.' },
  ]

  for (const m of methods) {
    const existing = await prisma.orgMethod.findFirst({ where: { orgId: null, code: m.code } })
    if (!existing) {
      await prisma.orgMethod.create({ data: { orgId: null, isGlobal: true, ...m } })
      console.log('Created:', m.code)
    } else {
      console.log('Exists:', m.code)
    }
  }
  console.log('Done')
}

main().catch(console.error).finally(() => prisma.$disconnect())
