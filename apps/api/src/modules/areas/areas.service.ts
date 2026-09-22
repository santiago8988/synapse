import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
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

  /**
   * Resuelve un área exigiendo que sea de la organización que la pide.
   *
   * El id llega de la URL y el `:orgId` de la ruta no autoriza nada (TenantGuard
   * lee el claim del JWT, no el path param), así que este filtro es lo único que
   * separa un tenant de otro. Sin él, conocer un id alcanzaba para renombrar o
   * borrar el área de cualquier organización.
   *
   * 404 y no 403: a quien prueba ids no se le confirma que el área existe.
   */
  private async findInOrg(areaId: string, organizationId: string) {
    const area = await this.prisma.area.findFirst({
      where: { id: areaId, organizationId },
    })
    if (!area) throw new NotFoundException('Área no encontrada')
    return area
  }

  /**
   * El padre se valida igual que el área. Un parentId de otro tenant colgaría el
   * árbol propio del ajeno, y el `getTree` del otro lado empezaría a devolver
   * áreas que no le pertenecen.
   */
  private async assertParentInOrg(
    parentId: string | null | undefined,
    organizationId: string,
    areaId?: string,
  ) {
    if (!parentId) return
    if (areaId && parentId === areaId) {
      throw new BadRequestException('Un área no puede ser su propio padre')
    }
    const parent = await this.prisma.area.findFirst({
      where: { id: parentId, organizationId },
      select: { id: true },
    })
    if (!parent) throw new NotFoundException('Área padre no encontrada')
  }

  async create(organizationId: string, data: { name: string; parentId?: string }) {
    await this.assertParentInOrg(data.parentId, organizationId)

    return this.prisma.area.create({
      data: {
        name: data.name,
        organizationId,
        parentId: data.parentId || null,
      },
    })
  }

  async update(
    areaId: string,
    organizationId: string,
    data: { name?: string; parentId?: string | null },
  ) {
    await this.findInOrg(areaId, organizationId)
    if (data.parentId !== undefined) {
      await this.assertParentInOrg(data.parentId, organizationId, areaId)
    }

    // Los campos se enumeran uno por uno en vez de pasar `data` entero.
    //
    // El tipo de `data` solo existe en compilacion: en runtime es el body tal
    // como llego, y Prisma acepta cualquier campo real del modelo. Pasandolo
    // entero, un body con `{"organizationId": "<otro tenant>"}` movia el area a
    // otra organizacion —aparecia en el getTree de la victima— y `leaderId`
    // permitia apuntar a un miembro ajeno. El filtro por organizacion no lo
    // cubre: el area es propia y la operacion esta autorizada; lo que sobraba
    // eran los campos que se podian tocar.
    return this.prisma.area.update({
      where: { id: areaId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      },
    })
  }

  async delete(areaId: string, organizationId: string) {
    await this.findInOrg(areaId, organizationId)

    return this.prisma.area.delete({ where: { id: areaId } })
  }
}
