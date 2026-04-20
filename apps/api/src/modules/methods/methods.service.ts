import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface CreateMethodDto {
  code: string
  name: string
  parameter: string
  unit?: string
  defaultMin?: number
  defaultMax?: number
  sourceRef?: string
}

@Injectable()
export class MethodsService {
  constructor(private prisma: PrismaService) {}

  async search(organizationId: string, query?: string) {
    const where = {
      OR: [
        { orgId: null },
        { orgId: organizationId },
      ],
      ...(query
        ? {
            AND: {
              OR: [
                { code: { contains: query, mode: 'insensitive' as const } },
                { name: { contains: query, mode: 'insensitive' as const } },
                { parameter: { contains: query, mode: 'insensitive' as const } },
              ],
            },
          }
        : {}),
    }

    return this.prisma.orgMethod.findMany({
      where,
      orderBy: [{ orgId: { sort: 'asc', nulls: 'first' } }, { code: 'asc' }],
      take: 50,
    })
  }

  async create(organizationId: string, data: CreateMethodDto) {
    // Verificar unicidad dentro de la org
    const existing = await this.prisma.orgMethod.findFirst({
      where: { orgId: organizationId, code: data.code },
    })
    if (existing) throw new ConflictException('Ya existe un método con ese código en tu organización')

    return this.prisma.orgMethod.create({
      data: {
        orgId: organizationId,
        code: data.code,
        name: data.name,
        parameter: data.parameter,
        unit: data.unit || null,
        defaultMin: data.defaultMin ?? null,
        defaultMax: data.defaultMax ?? null,
        sourceRef: data.sourceRef || null,
        isGlobal: false,
      },
    })
  }

  async update(id: string, organizationId: string, data: Partial<CreateMethodDto>) {
    const method = await this.prisma.orgMethod.findUnique({ where: { id } })
    if (!method) throw new NotFoundException('Método no encontrado')
    if (method.orgId !== organizationId) {
      throw new ForbiddenException('Solo podés editar métodos de tu organización')
    }

    if (data.code && data.code !== method.code) {
      const existing = await this.prisma.orgMethod.findFirst({
        where: { orgId: organizationId, code: data.code },
      })
      if (existing) throw new ConflictException('Ya existe un método con ese código')
    }

    return this.prisma.orgMethod.update({
      where: { id },
      data: {
        code: data.code ?? method.code,
        name: data.name ?? method.name,
        parameter: data.parameter ?? method.parameter,
        unit: data.unit !== undefined ? (data.unit || null) : method.unit,
        defaultMin: data.defaultMin !== undefined ? (data.defaultMin ?? null) : method.defaultMin,
        defaultMax: data.defaultMax !== undefined ? (data.defaultMax ?? null) : method.defaultMax,
        sourceRef: data.sourceRef !== undefined ? (data.sourceRef || null) : method.sourceRef,
      },
    })
  }

  async delete(id: string, organizationId: string) {
    const method = await this.prisma.orgMethod.findUnique({ where: { id } })
    if (!method) throw new NotFoundException('Método no encontrado')
    if (method.orgId !== organizationId) {
      throw new ForbiddenException('Solo podés eliminar métodos de tu organización')
    }

    return this.prisma.orgMethod.delete({ where: { id } })
  }
}
