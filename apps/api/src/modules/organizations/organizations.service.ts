import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        areas: {
          where: { parentId: null },
          include: {
            leader: { include: { user: { select: { name: true } } } },
            children: {
              include: {
                leader: { include: { user: { select: { name: true } } } },
                children: {
                  include: {
                    leader: { include: { user: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!org) throw new NotFoundException('Organización no encontrada')
    return org
  }

  async update(id: string, data: { name?: string; logoUrl?: string }) {
    return this.prisma.organization.update({ where: { id }, data })
  }

  async getWhitelist(organizationId: string) {
    return this.prisma.emailWhitelist.findMany({
      where: { organizationId },
      orderBy: { invitedAt: 'desc' },
    })
  }

  async addToWhitelist(organizationId: string, data: { email: string; role?: string; areaId?: string }) {
    return this.prisma.emailWhitelist.create({
      data: {
        email: data.email,
        organizationId,
        role: (data.role as 'ADMIN' | 'QUALITY_MANAGER' | 'TECHNICIAN' | 'AUDITOR') || 'TECHNICIAN',
        areaId: data.areaId || null,
      },
    })
  }

  async removeFromWhitelist(whitelistId: string) {
    return this.prisma.emailWhitelist.delete({ where: { id: whitelistId } })
  }

  async getUsers(organizationId: string) {
    return this.prisma.organizationUser.findMany({
      where: { organizationId },
      include: { user: true, area: true, position: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async updateUser(
    id: string,
    data: {
      role?: string
      areaId?: string | null
      positionId?: string | null
      phone?: string | null
      signature?: string | null
      isActive?: boolean
    },
  ) {
    return this.prisma.organizationUser.update({
      where: { id },
      data: {
        role: data.role as 'ADMIN' | 'QUALITY_MANAGER' | 'TECHNICIAN' | 'AUDITOR' | undefined,
        areaId: data.areaId,
        positionId: data.positionId,
        phone: data.phone,
        signature: data.signature,
        isActive: data.isActive,
      },
      include: { user: true, area: true, position: true },
    })
  }

  // ─── Positions ──────────────────────────────

  async getPositions(organizationId: string) {
    return this.prisma.position.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    })
  }

  async createPosition(organizationId: string, name: string) {
    const existing = await this.prisma.position.findUnique({
      where: { organizationId_name: { organizationId, name } },
    })
    if (existing) throw new ConflictException('Ya existe un puesto con ese nombre')

    return this.prisma.position.create({
      data: { organizationId, name },
    })
  }

  async deletePosition(positionId: string, organizationId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, organizationId },
    })
    if (!position) throw new NotFoundException('Puesto no encontrado')

    // Desasignar usuarios que tengan este puesto
    await this.prisma.organizationUser.updateMany({
      where: { positionId },
      data: { positionId: null },
    })

    return this.prisma.position.delete({ where: { id: positionId } })
  }

  // ─── Area Leader ────────────────────────────

  async setAreaLeader(organizationId: string, areaId: string, leaderId: string | null) {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, organizationId },
    })
    if (!area) throw new NotFoundException('Área no encontrada')

    if (leaderId) {
      const orgUser = await this.prisma.organizationUser.findFirst({
        where: { id: leaderId, organizationId },
      })
      if (!orgUser) throw new NotFoundException('Usuario no encontrado en esta organización')
    }

    return this.prisma.area.update({
      where: { id: areaId },
      data: { leaderId },
      include: {
        leader: { include: { user: { select: { name: true } } } },
      },
    })
  }

  // ─── Trainings ──────────────────────────────

  async getTrainings(organizationId: string, organizationUserId: string) {
    return this.prisma.training.findMany({
      where: { organizationId, organizationUserId },
      orderBy: { completedAt: 'desc' },
    })
  }

  async addTraining(
    organizationId: string,
    organizationUserId: string,
    data: {
      name: string
      description?: string
      provider?: string
      completedAt: string
      expiresAt?: string
      certificateUrl?: string
    },
  ) {
    // Verificar que el usuario pertenece a la org
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: organizationUserId, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado en esta organización')

    return this.prisma.training.create({
      data: {
        organizationId,
        organizationUserId,
        name: data.name,
        description: data.description || null,
        provider: data.provider || null,
        completedAt: new Date(data.completedAt),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        certificateUrl: data.certificateUrl || null,
      },
    })
  }

  async removeTraining(trainingId: string, organizationId: string) {
    const training = await this.prisma.training.findFirst({
      where: { id: trainingId, organizationId },
    })
    if (!training) throw new NotFoundException('Capacitación no encontrada')

    return this.prisma.training.delete({ where: { id: trainingId } })
  }
}
