import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtPayload } from '../../common/decorators/current-user.decorator'

interface GoogleProfile {
  email: string
  name: string
  picture?: string
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateGoogleUser(profile: GoogleProfile) {
    // Buscar email en whitelist de cualquier organización
    const whitelistEntries = await this.prisma.emailWhitelist.findMany({
      where: { email: profile.email },
      include: { organization: true },
    })

    if (whitelistEntries.length === 0) {
      throw new UnauthorizedException('Email no autorizado en ninguna organización')
    }

    // Buscar o crear usuario
    let user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    })

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.picture || null,
        },
      })
    }

    // Crear OrganizationUser para cada whitelist entry sin usar
    for (const entry of whitelistEntries) {
      const existing = await this.prisma.organizationUser.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: entry.organizationId,
          },
        },
      })

      if (!existing) {
        await this.prisma.organizationUser.create({
          data: {
            userId: user.id,
            organizationId: entry.organizationId,
            role: entry.role,
            areaId: entry.areaId,
          },
        })

        // Marcar whitelist como usada
        if (!entry.usedAt) {
          await this.prisma.emailWhitelist.update({
            where: { id: entry.id },
            data: { usedAt: new Date() },
          })
        }
      }
    }

    // Obtener las organizaciones del usuario
    const memberships = await this.prisma.organizationUser.findMany({
      where: { userId: user.id, isActive: true },
      include: { organization: true },
    })

    return { user, memberships }
  }

  /**
   * Organizaciones que el usuario puede elegir al iniciar sesion. Se cruza lo
   * que autoriza el codigo con las membresias activas de la base: si a alguien
   * le revocaron el acceso entre el login y la eleccion, la organizacion ya no
   * aparece.
   */
  async listOrganizations(userId: string, organizationIds: string[]) {
    const memberships = await this.prisma.organizationUser.findMany({
      where: {
        userId,
        organizationId: { in: organizationIds },
        isActive: true,
      },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    })
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    }))
  }

  async generateToken(userId: string, organizationId: string): Promise<string> {
    const membership = await this.prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    })

    if (!membership || !membership.isActive) {
      throw new UnauthorizedException('No tenés acceso a esta organización')
    }

    const payload: JwtPayload = {
      sub: userId,
      email: (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })).email,
      organizationId,
      role: membership.role,
      areaId: membership.areaId,
    }

    return this.jwtService.sign(payload)
  }

  async getMe(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    })

    const membership = await this.prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      include: { organization: true, area: true },
    })

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: membership?.organizationId,
      organizationName: membership?.organization.name,
      role: membership?.role,
      areaId: membership?.areaId,
      areaName: membership?.area?.name,
    }
  }
}
