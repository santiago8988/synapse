import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtPayload } from '../decorators/current-user.decorator'

@Injectable()
export class AreaAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user = request.user as JwtPayload

    // ADMIN y AUDITOR pueden ver todo
    if (user.role === 'ADMIN' || user.role === 'AUDITOR') return true

    // Si no tiene área asignada, no puede acceder a nada con restricción de área
    if (!user.areaId) return false

    const targetAreaId = request.params.areaId || request.body?.areaId
    if (!targetAreaId) return true // Sin área target, no se restringe aquí

    // Verificar si targetAreaId es descendiente del área del usuario
    const allowedIds = await this.getDescendantAreaIds(user.areaId)
    allowedIds.push(user.areaId)

    return allowedIds.includes(targetAreaId)
  }

  private async getDescendantAreaIds(areaId: string): Promise<string[]> {
    const descendants: string[] = []
    const children = await this.prisma.area.findMany({
      where: { parentId: areaId },
      select: { id: true },
    })

    for (const child of children) {
      descendants.push(child.id)
      const childDescendants = await this.getDescendantAreaIds(child.id)
      descendants.push(...childDescendants)
    }

    return descendants
  }
}
