import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface PointDto {
  name: string
  order: number
  load?: number
  unit?: string
}

interface TestDto {
  name: string
  description?: string
  order: number
  tolerance?: number
  toleranceUnit?: string
  readingsPerPoint?: number
  formulaError?: string
  criteriaOperator?: string
  notes?: string
  points: PointDto[]
}

interface CreateTemplateDto {
  name: string
  code?: string
  description?: string
  unitMain?: string
  unitTolerance?: string
  periodicity?: number
  notifyDaysBefore?: number
  tests: TestDto[]
}

interface UpdateTemplateDto {
  name?: string
  code?: string
  description?: string
  unitMain?: string
  unitTolerance?: string
  periodicity?: number
  notifyDaysBefore?: number
  tests?: TestDto[]
}

@Injectable()
export class CalibrationTemplatesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.calibrationTemplate.findMany({
      where: { organizationId, isActive: true },
      include: {
        tests: {
          orderBy: { order: 'asc' },
          include: { points: { orderBy: { order: 'asc' } } },
        },
        _count: { select: { calibrations: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const template = await this.prisma.calibrationTemplate.findFirst({
      where: { id, organizationId },
      include: {
        tests: {
          orderBy: { order: 'asc' },
          include: { points: { orderBy: { order: 'asc' } } },
        },
      },
    })
    if (!template) throw new NotFoundException('Plantilla de calibracion no encontrada')
    return template
  }

  async create(organizationId: string, createdById: string, data: CreateTemplateDto) {
    if (data.tests.length === 0) {
      throw new BadRequestException('La plantilla debe tener al menos una prueba')
    }

    return this.prisma.calibrationTemplate.create({
      data: {
        organizationId,
        createdById,
        name: data.name.toUpperCase(),
        code: data.code?.toUpperCase() || null,
        description: data.description || null,
        unitMain: data.unitMain?.toUpperCase() || null,
        unitTolerance: data.unitTolerance?.toUpperCase() || null,
        periodicity: data.periodicity ?? null,
        notifyDaysBefore: data.notifyDaysBefore ?? null,
        tests: {
          create: data.tests.map((t) => ({
            name: t.name.toUpperCase(),
            description: t.description || null,
            order: t.order,
            tolerance: t.tolerance ?? null,
            toleranceUnit: t.toleranceUnit?.toUpperCase() || null,
            readingsPerPoint: t.readingsPerPoint ?? 3,
            formulaError: t.formulaError?.toUpperCase() || null,
            criteriaOperator: t.criteriaOperator || null,
            notes: t.notes || null,
            points: {
              create: t.points.map((p) => ({
                name: p.name.toUpperCase(),
                order: p.order,
                load: p.load ?? null,
                unit: p.unit?.toUpperCase() || null,
              })),
            },
          })),
        },
      },
      include: {
        tests: {
          orderBy: { order: 'asc' },
          include: { points: { orderBy: { order: 'asc' } } },
        },
      },
    })
  }

  async update(id: string, organizationId: string, data: UpdateTemplateDto) {
    const template = await this.findById(id, organizationId)

    if (template.status === 'IN_REVIEW') {
      throw new BadRequestException('No se puede editar una plantilla en revision')
    }

    // DRAFT: edit in-place
    if (template.status === 'DRAFT') {
      return this.prisma.$transaction(async (tx) => {
        if (data.tests) {
          // Delete existing tests (cascade deletes points)
          await tx.calibrationTest.deleteMany({ where: { templateId: id } })
          // Create new tests with points
          for (const t of data.tests) {
            await tx.calibrationTest.create({
              data: {
                templateId: id,
                name: t.name.toUpperCase(),
                description: t.description || null,
                order: t.order,
                tolerance: t.tolerance ?? null,
                toleranceUnit: t.toleranceUnit?.toUpperCase() || null,
                readingsPerPoint: t.readingsPerPoint ?? 3,
                formulaError: t.formulaError?.toUpperCase() || null,
                criteriaOperator: t.criteriaOperator || null,
                notes: t.notes || null,
                points: {
                  create: t.points.map((p) => ({
                    name: p.name.toUpperCase(),
                    order: p.order,
                    load: p.load ?? null,
                    unit: p.unit?.toUpperCase() || null,
                  })),
                },
              },
            })
          }
        }

        return tx.calibrationTemplate.update({
          where: { id },
          data: {
            name: data.name?.toUpperCase() ?? template.name,
            code: data.code !== undefined ? (data.code?.toUpperCase() || null) : template.code,
            description: data.description !== undefined ? (data.description || null) : template.description,
            unitMain: data.unitMain !== undefined ? (data.unitMain?.toUpperCase() || null) : template.unitMain,
            unitTolerance: data.unitTolerance !== undefined ? (data.unitTolerance?.toUpperCase() || null) : template.unitTolerance,
            periodicity: data.periodicity !== undefined ? (data.periodicity ?? null) : template.periodicity,
            notifyDaysBefore: data.notifyDaysBefore !== undefined ? (data.notifyDaysBefore ?? null) : template.notifyDaysBefore,
          },
          include: {
            tests: {
              orderBy: { order: 'asc' },
              include: { points: { orderBy: { order: 'asc' } } },
            },
          },
        })
      })
    }

    // ACTIVE: create new version
    return this.prisma.$transaction(async (tx) => {
      await tx.calibrationTemplate.update({
        where: { id },
        data: { isActive: false },
      })

      const newTemplate = await tx.calibrationTemplate.create({
        data: {
          organizationId,
          createdById: template.createdById,
          name: template.name,
          code: template.code,
          description: data.description !== undefined ? (data.description || null) : template.description,
          unitMain: data.unitMain !== undefined ? (data.unitMain?.toUpperCase() || null) : template.unitMain,
          unitTolerance: data.unitTolerance !== undefined ? (data.unitTolerance?.toUpperCase() || null) : template.unitTolerance,
          periodicity: data.periodicity !== undefined ? (data.periodicity ?? null) : template.periodicity,
          notifyDaysBefore: data.notifyDaysBefore !== undefined ? (data.notifyDaysBefore ?? null) : template.notifyDaysBefore,
          version: template.version + 1,
          status: 'ACTIVE',
          isActive: true,
        },
      })

      const tests = data.tests ?? template.tests
      for (const t of tests) {
        await tx.calibrationTest.create({
          data: {
            templateId: newTemplate.id,
            name: t.name.toUpperCase(),
            description: t.description || null,
            order: t.order,
            tolerance: t.tolerance ?? null,
            toleranceUnit: t.toleranceUnit?.toUpperCase() || null,
            readingsPerPoint: t.readingsPerPoint ?? 3,
            formulaError: t.formulaError?.toUpperCase() || null,
            criteriaOperator: t.criteriaOperator || null,
            notes: t.notes || null,
            points: {
              create: (t.points || []).map((p) => ({
                name: p.name.toUpperCase(),
                order: p.order,
                load: p.load ?? null,
                unit: p.unit?.toUpperCase() || null,
              })),
            },
          },
        })
      }

      return tx.calibrationTemplate.findUnique({
        where: { id: newTemplate.id },
        include: {
          tests: {
            orderBy: { order: 'asc' },
            include: { points: { orderBy: { order: 'asc' } } },
          },
        },
      })
    })
  }

  async delete(id: string, organizationId: string) {
    await this.findById(id, organizationId)

    const calibrationCount = await this.prisma.calibration.count({ where: { templateId: id } })
    if (calibrationCount > 0) {
      throw new BadRequestException('No se puede eliminar una plantilla que tiene calibraciones asociadas')
    }

    return this.prisma.calibrationTemplate.delete({ where: { id } })
  }
}
