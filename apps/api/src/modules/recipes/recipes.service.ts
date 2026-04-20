import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface CreateRecipeDto {
  name: string
  code: string
  ingredients: Array<{ name: string; quantity: number; unit: string; order: number; fromStock?: boolean; stockRecipeId?: string }>
  steps: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
}

interface UpdateRecipeDto {
  name?: string
  code?: string
  ingredients?: Array<{ name: string; quantity: number; unit: string; order: number; fromStock?: boolean; stockRecipeId?: string }>
  steps?: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
}

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.recipe.findMany({
      where: { organizationId, isActive: true },
      include: {
        ingredients: {
          orderBy: { order: 'asc' },
          include: { stockRecipe: { select: { id: true, name: true, code: true } } },
        },
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { batches: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, organizationId },
      include: {
        ingredients: {
          orderBy: { order: 'asc' },
          include: { stockRecipe: { select: { id: true, name: true, code: true } } },
        },
        steps: { orderBy: { order: 'asc' } },
      },
    })
    if (!recipe) throw new NotFoundException('Receta no encontrada')
    return recipe
  }

  async create(organizationId: string, createdById: string, data: CreateRecipeDto) {
    if (!data.code?.trim()) {
      throw new BadRequestException('El código de producto es obligatorio')
    }

    const existing = await this.prisma.recipe.findFirst({
      where: { organizationId, code: data.code, isActive: true },
    })
    if (existing) throw new ConflictException('Ya existe una receta activa con ese código de producto')

    if (data.ingredients.length === 0) {
      throw new BadRequestException('La receta debe tener al menos un ingrediente')
    }

    return this.prisma.recipe.create({
      data: {
        organizationId,
        createdById,
        name: data.name,
        code: data.code,
        ingredients: {
          create: data.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            order: i.order,
            fromStock: i.fromStock ?? false,
            stockRecipeId: i.stockRecipeId || null,
          })),
        },
        steps: {
          create: data.steps.map((s) => ({
            order: s.order,
            name: s.name,
            description: s.description || null,
            duration: s.duration || null,
            controls: s.controls || null,
          })),
        },
      },
      include: {
        ingredients: { orderBy: { order: 'asc' } },
        steps: { orderBy: { order: 'asc' } },
      },
    })
  }

  async update(id: string, organizationId: string, data: UpdateRecipeDto) {
    const recipe = await this.findById(id, organizationId)

    if (recipe.status === 'IN_REVIEW') {
      throw new BadRequestException('No se puede editar una receta en revisión')
    }

    // DRAFT: edición in-place (todo editable)
    if (recipe.status === 'DRAFT') {
      if (data.code && data.code !== recipe.code) {
        const existing = await this.prisma.recipe.findFirst({
          where: { organizationId, code: data.code, isActive: true, id: { not: id } },
        })
        if (existing) throw new ConflictException('Ya existe una receta activa con ese código')
      }

      return this.prisma.$transaction(async (tx) => {
        if (data.ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
          await tx.recipeIngredient.createMany({
            data: data.ingredients.map((i) => ({
              recipeId: id,
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
              order: i.order,
              fromStock: i.fromStock ?? false,
              stockRecipeId: i.stockRecipeId || null,
            })),
          })
        }
        if (data.steps) {
          await tx.recipeStep.deleteMany({ where: { recipeId: id } })
          await tx.recipeStep.createMany({
            data: data.steps.map((s) => ({
              recipeId: id,
              order: s.order,
              name: s.name,
              description: s.description || null,
              duration: s.duration || null,
              controls: s.controls || null,
            })),
          })
        }
        return tx.recipe.update({
          where: { id },
          data: {
            name: data.name ?? recipe.name,
            code: data.code ?? recipe.code,
          },
          include: {
            ingredients: { orderBy: { order: 'asc' } },
            steps: { orderBy: { order: 'asc' } },
          },
        })
      })
    }

    // ACTIVE: crear nueva versión
    return this.prisma.$transaction(async (tx) => {
      await tx.recipe.update({
        where: { id },
        data: { isActive: false },
      })

      return tx.recipe.create({
        data: {
          organizationId,
          createdById: recipe.createdById,
          name: recipe.name,
          code: recipe.code,
          version: recipe.version + 1,
          status: 'ACTIVE',
          isActive: true,
          ingredients: {
            create: (data.ingredients ?? recipe.ingredients).map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unit: i.unit,
              order: i.order,
              fromStock: i.fromStock ?? false,
              stockRecipeId: i.stockRecipeId || null,
            })),
          },
          steps: {
            create: (data.steps ?? recipe.steps).map((s) => ({
              order: s.order,
              name: s.name,
              description: s.description || null,
              duration: s.duration || null,
              controls: s.controls || null,
            })),
          },
        },
        include: {
          ingredients: { orderBy: { order: 'asc' } },
          steps: { orderBy: { order: 'asc' } },
        },
      })
    })
  }

  async delete(id: string, organizationId: string) {
    const recipe = await this.findById(id, organizationId)

    const batchCount = await this.prisma.batch.count({ where: { recipeId: id } })
    if (batchCount > 0) {
      throw new BadRequestException('No se puede eliminar una receta que tiene lotes de producción asociados')
    }

    return this.prisma.recipe.delete({ where: { id } })
  }
}
