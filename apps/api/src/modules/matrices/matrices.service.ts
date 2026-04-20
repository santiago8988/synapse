import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface ConditionDto {
  label: string
  fieldType: string
  unit?: string
  options?: string[]
  order: number
}

interface CreateMatrixDto {
  name: string
  code?: string
  description?: string
  parameters: Array<{ name: string; method?: string; unit?: string; minValue?: number; maxValue?: number; order: number }>
  conditions?: ConditionDto[]
}

interface UpdateMatrixDto {
  name?: string
  code?: string
  description?: string
  parameters?: Array<{ name: string; method?: string; unit?: string; minValue?: number; maxValue?: number; order: number }>
  conditions?: ConditionDto[]
}

@Injectable()
export class MatricesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.matrix.findMany({
      where: { organizationId, isActive: true },
      include: {
        parameters: { orderBy: { order: 'asc' } },
        conditions: { orderBy: { order: 'asc' } },
        _count: { select: { samples: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const matrix = await this.prisma.matrix.findFirst({
      where: { id, organizationId },
      include: {
        parameters: { orderBy: { order: 'asc' } },
        conditions: { orderBy: { order: 'asc' } },
      },
    })
    if (!matrix) throw new NotFoundException('Matriz no encontrada')
    return matrix
  }

  async create(organizationId: string, createdById: string, data: CreateMatrixDto) {
    if (data.code) {
      const existing = await this.prisma.matrix.findFirst({
        where: { organizationId, code: data.code, isActive: true },
      })
      if (existing) throw new ConflictException('Ya existe una matriz activa con ese código')
    }

    if (data.parameters.length === 0) {
      throw new BadRequestException('La matriz debe tener al menos un parámetro')
    }

    return this.prisma.matrix.create({
      data: {
        organizationId,
        createdById,
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        parameters: {
          create: data.parameters.map((p) => ({
            name: p.name,
            method: p.method || null,
            unit: p.unit || null,
            minValue: p.minValue ?? null,
            maxValue: p.maxValue ?? null,
            order: p.order,
          })),
        },
        conditions: data.conditions?.length
          ? {
              create: data.conditions.map((c) => ({
                label: c.label,
                fieldType: c.fieldType,
                unit: c.unit || null,
                options: c.options || [],
                order: c.order,
              })),
            }
          : undefined,
      },
      include: {
        parameters: { orderBy: { order: 'asc' } },
        conditions: { orderBy: { order: 'asc' } },
      },
    })
  }

  async update(id: string, organizationId: string, data: UpdateMatrixDto) {
    const matrix = await this.findById(id, organizationId)

    if (matrix.status === 'IN_REVIEW') {
      throw new BadRequestException('No se puede editar una matriz en revisión')
    }

    // Crear nueva versión: inactivar la actual y crear una nueva copia ACTIVE
    return this.prisma.$transaction(async (tx) => {
      // Inactivar la versión actual
      await tx.matrix.update({
        where: { id },
        data: { isActive: false },
      })

      // Crear nueva versión
      const newMatrix = await tx.matrix.create({
        data: {
          organizationId,
          createdById: matrix.createdById,
          name: data.name ?? matrix.name,
          code: data.code !== undefined ? (data.code || null) : matrix.code,
          description: data.description !== undefined ? (data.description || null) : matrix.description,
          version: matrix.version + 1,
          status: 'ACTIVE',
          isActive: true,
          parameters: {
            create: (data.parameters ?? matrix.parameters).map((p) => ({
              name: p.name,
              method: p.method || null,
              unit: p.unit || null,
              minValue: p.minValue ?? null,
              maxValue: p.maxValue ?? null,
              order: p.order,
            })),
          },
          conditions: {
            create: (data.conditions ?? matrix.conditions).map((c) => ({
              label: c.label,
              fieldType: c.fieldType,
              unit: c.unit || null,
              options: c.options || [],
              order: c.order,
            })),
          },
        },
        include: {
          parameters: { orderBy: { order: 'asc' } },
          conditions: { orderBy: { order: 'asc' } },
        },
      })

      return newMatrix
    })
  }

  async delete(id: string, organizationId: string) {
    await this.findById(id, organizationId)

    const sampleCount = await this.prisma.sample.count({ where: { matrixId: id } })
    if (sampleCount > 0) {
      throw new BadRequestException('No se puede eliminar una matriz que tiene muestras asociadas')
    }

    return this.prisma.matrix.delete({ where: { id } })
  }
}
