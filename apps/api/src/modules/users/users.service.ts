import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } })
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } })
  }

  async getUserOrganizations(userId: string) {
    return this.prisma.organizationUser.findMany({
      where: { userId, isActive: true },
      include: { organization: true },
    })
  }
}
