import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  async getTree(organizationId: string) {
    // Traer áreas raíz con hijos recursivos (hasta 3 niveles)
    return this.prisma.area.findMany({
      where: { organizationId, parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: { children: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  async create(organizationId: string, data: { name: string; parentId?: string }) {
    return this.prisma.area.create({
      data: {
        name: data.name,
        organizationId,
        parentId: data.parentId || null,
      },
    })
  }

  async update(areaId: string, data: { name?: string; parentId?: string | null }) {
    const area = await this.prisma.area.findUnique({ where: { id: areaId } })
    if (!area) throw new NotFoundException('Área no encontrada')

    return this.prisma.area.update({
      where: { id: areaId },
      data,
    })
  }

  async delete(areaId: string) {
    return this.prisma.area.delete({ where: { id: areaId } })
  }
}
