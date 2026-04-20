import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { QualityRoleType, ApprovableEntity, ApprovalStatus } from '@prisma/client'

@Injectable()
export class ApprovalService {
  constructor(private prisma: PrismaService) {}

  private getRequiredLabels(recordType: string): Array<{ label: string; fieldType?: string }> {
    switch (recordType) {
      case 'INSTRUMENTAL':
        return [{ label: 'CODIGO' }]
      case 'BATCH':
        return [{ label: 'LOTE' }]
      case 'SAMPLE':
        return [
          { label: 'CODIGO MUESTRA' },
          { label: 'MATRIZ Y METODOS', fieldType: 'MATRIX_METHOD' },
        ]
      case 'STOCK':
        return [
          { label: 'LOTE' },
          { label: 'PRODUCTO' },
          { label: 'TIPO MOVIMIENTO' },
          { label: 'CANTIDAD' },
        ]
      default:
        return []
    }
  }

  // ─── Quality Roles ──────────────────────────

  async getQualityRoles(organizationId: string) {
    return this.prisma.qualityRole.findMany({
      where: { organizationId },
      include: {
        organizationUser: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async assignQualityRole(
    organizationId: string,
    organizationUserId: string,
    role: QualityRoleType,
  ) {
    // Verificar que el OrganizationUser pertenece a esta org
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { id: organizationUserId, organizationId },
    })
    if (!orgUser) {
      throw new NotFoundException('Usuario no encontrado en esta organización')
    }

    // Verificar que no tenga ya este rol
    const existing = await this.prisma.qualityRole.findUnique({
      where: { organizationUserId_role: { organizationUserId, role } },
    })
    if (existing) {
      throw new ConflictException(`El usuario ya tiene el rol ${role}`)
    }

    return this.prisma.qualityRole.create({
      data: { organizationId, organizationUserId, role },
      include: {
        organizationUser: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })
  }

  async removeQualityRole(qualityRoleId: string, organizationId: string) {
    const qr = await this.prisma.qualityRole.findFirst({
      where: { id: qualityRoleId, organizationId },
    })
    if (!qr) throw new NotFoundException('Rol de calidad no encontrado')

    return this.prisma.qualityRole.delete({ where: { id: qualityRoleId } })
  }

  // ─── Approval Requests ──────────────────────

  async submitForApproval(
    organizationId: string,
    entityType: ApprovableEntity,
    entityId: string,
    submittedById: string,
  ) {
    // Verificar que existan reviewers y approvers en la org
    const reviewerCount = await this.prisma.qualityRole.count({
      where: { organizationId, role: 'REVIEWER' },
    })
    if (reviewerCount === 0) {
      throw new BadRequestException('No hay revisores asignados en la organización')
    }

    const approverCount = await this.prisma.qualityRole.count({
      where: { organizationId, role: 'APPROVER' },
    })
    if (approverCount === 0) {
      throw new BadRequestException('No hay aprobadores asignados en la organización')
    }

    // Verificar que la entidad existe y está en DRAFT
    if (entityType === 'DOCUMENT') {
      const doc = await this.prisma.document.findFirst({
        where: { id: entityId, organizationId },
      })
      if (!doc) throw new NotFoundException('Documento no encontrado')
      if (doc.status !== 'DRAFT') {
        throw new BadRequestException('Solo se pueden enviar a revisión documentos en estado DRAFT')
      }
    } else if (entityType === 'RECIPE') {
      const recipe = await this.prisma.recipe.findFirst({
        where: { id: entityId, organizationId },
      })
      if (!recipe) throw new NotFoundException('Receta no encontrada')
      if (recipe.status !== 'DRAFT') {
        throw new BadRequestException('Solo se pueden enviar a revisión recetas en estado DRAFT')
      }
    } else if (entityType === 'CALIBRATION_TEMPLATE') {
      const template = await this.prisma.calibrationTemplate.findFirst({
        where: { id: entityId, organizationId },
      })
      if (!template) throw new NotFoundException('Plantilla de calibracion no encontrada')
      if (template.status !== 'DRAFT') {
        throw new BadRequestException('Solo se pueden enviar a revision plantillas en estado DRAFT')
      }
    } else if (entityType === 'MATRIX') {
      const matrix = await this.prisma.matrix.findFirst({
        where: { id: entityId, organizationId },
      })
      if (!matrix) throw new NotFoundException('Matriz no encontrada')
      if (matrix.status !== 'DRAFT') {
        throw new BadRequestException('Solo se pueden enviar a revisión matrices en estado DRAFT')
      }
    } else {
      const record = await this.prisma.record.findFirst({
        where: { id: entityId, organizationId },
        include: { fields: { where: { isActive: true } } },
      })
      if (!record) throw new NotFoundException('Registro no encontrado')
      if (record.status !== 'DRAFT') {
        throw new BadRequestException('Solo se pueden enviar a revisión registros en estado DRAFT')
      }

      // Validar labels obligatorios según tipo de registro
      const labels = record.fields.map((f) => f.label.toUpperCase())
      const requiredLabels = this.getRequiredLabels(record.type)
      const missing = requiredLabels.filter((r) => {
        if (r.fieldType) {
          return !record.fields.some((f) => f.label.toUpperCase() === r.label && f.fieldType === r.fieldType)
        }
        return !labels.includes(r.label)
      })
      if (missing.length > 0) {
        throw new BadRequestException(
          `El registro tipo ${record.type} requiere los campos: ${missing.map((m) => m.label + (m.fieldType ? ` (${m.fieldType})` : '')).join(', ')}`,
        )
      }
    }

    // Verificar que no haya un request pendiente para esta entidad
    const pendingRequest = await this.prisma.approvalRequest.findFirst({
      where: {
        entityType,
        entityId,
        status: { in: ['PENDING_REVIEW', 'PENDING_APPROVAL'] },
      },
    })
    if (pendingRequest) {
      throw new ConflictException('Ya existe una solicitud de aprobación pendiente para esta entidad')
    }

    // Obtener el OrganizationUser.id del submitter
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: submittedById, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado en la organización')

    // Crear request y cambiar status de la entidad a IN_REVIEW
    const [request] = await this.prisma.$transaction([
      this.prisma.approvalRequest.create({
        data: {
          organizationId,
          entityType,
          entityId,
          submittedById: orgUser.id,
        },
        include: {
          submittedBy: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          decisions: true,
        },
      }),
      entityType === 'DOCUMENT'
        ? this.prisma.document.update({ where: { id: entityId }, data: { status: 'IN_REVIEW' } })
        : entityType === 'RECIPE'
        ? this.prisma.recipe.update({ where: { id: entityId }, data: { status: 'IN_REVIEW' } })
        : entityType === 'MATRIX'
        ? this.prisma.matrix.update({ where: { id: entityId }, data: { status: 'IN_REVIEW' } })
        : entityType === 'CALIBRATION_TEMPLATE'
        ? this.prisma.calibrationTemplate.update({ where: { id: entityId }, data: { status: 'IN_REVIEW' } })
        : this.prisma.record.update({ where: { id: entityId }, data: { status: 'IN_REVIEW' } }),
    ])

    return request
  }

  async decide(
    approvalRequestId: string,
    organizationId: string,
    decidedByUserId: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string,
  ) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalRequestId, organizationId },
      include: { decisions: true },
    })
    if (!request) throw new NotFoundException('Solicitud de aprobación no encontrada')

    if (request.status !== 'PENDING_REVIEW' && request.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Esta solicitud ya fue resuelta')
    }

    // Obtener OrganizationUser del decisor
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: decidedByUserId, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado en la organización')

    // Determinar qué rol se necesita según el estado actual
    const requiredRole: QualityRoleType =
      request.status === 'PENDING_REVIEW' ? 'REVIEWER' : 'APPROVER'

    // Verificar que el usuario tiene el QualityRole requerido
    const hasRole = await this.prisma.qualityRole.findFirst({
      where: { organizationUserId: orgUser.id, role: requiredRole },
    })
    if (!hasRole) {
      throw new ForbiddenException(
        `No tenés el rol de ${requiredRole === 'REVIEWER' ? 'revisor' : 'aprobador'} para realizar esta acción`,
      )
    }

    // Registrar la decisión
    const approvalDecision = await this.prisma.approvalDecision.create({
      data: {
        approvalRequestId,
        stage: requiredRole,
        decision,
        comments: comments || null,
        decidedById: orgUser.id,
      },
      include: {
        decidedBy: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    })

    // Helper para cambiar status de la entidad
    const updateEntityStatus = (status: 'DRAFT' | 'IN_REVIEW' | 'ACTIVE') => {
      if (request.entityType === 'DOCUMENT') {
        return this.prisma.document.update({ where: { id: request.entityId }, data: { status } })
      } else if (request.entityType === 'RECIPE') {
        return this.prisma.recipe.update({ where: { id: request.entityId }, data: { status } })
      } else if (request.entityType === 'MATRIX') {
        return this.prisma.matrix.update({ where: { id: request.entityId }, data: { status } })
      } else if (request.entityType === 'CALIBRATION_TEMPLATE') {
        return this.prisma.calibrationTemplate.update({ where: { id: request.entityId }, data: { status } })
      }
      return this.prisma.record.update({ where: { id: request.entityId }, data: { status } })
    }

    // Actualizar estado del request y de la entidad
    if (decision === 'REJECTED') {
      await this.prisma.$transaction([
        this.prisma.approvalRequest.update({
          where: { id: approvalRequestId },
          data: { status: 'REJECTED', completedAt: new Date() },
        }),
        updateEntityStatus('DRAFT'),
      ])
    } else if (decision === 'APPROVED' && requiredRole === 'REVIEWER') {
      await this.prisma.approvalRequest.update({
        where: { id: approvalRequestId },
        data: { status: 'PENDING_APPROVAL' },
      })
    } else if (decision === 'APPROVED' && requiredRole === 'APPROVER') {
      await this.prisma.$transaction([
        this.prisma.approvalRequest.update({
          where: { id: approvalRequestId },
          data: { status: 'APPROVED', completedAt: new Date() },
        }),
        updateEntityStatus('ACTIVE'),
      ])
    }

    return approvalDecision
  }

  async getApprovalRequests(organizationId: string, entityType?: ApprovableEntity) {
    return this.prisma.approvalRequest.findMany({
      where: {
        organizationId,
        ...(entityType ? { entityType } : {}),
      },
      include: {
        submittedBy: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        decisions: {
          include: {
            decidedBy: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { decidedAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })
  }

  async getApprovalRequestById(id: string, organizationId: string) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id, organizationId },
      include: {
        submittedBy: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        decisions: {
          include: {
            decidedBy: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { decidedAt: 'asc' },
        },
      },
    })
    if (!request) throw new NotFoundException('Solicitud de aprobación no encontrada')
    return request
  }

  async getPendingForUser(organizationId: string, userId: string) {
    // Obtener OrganizationUser
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId, organizationId },
    })
    if (!orgUser) return []

    // Obtener los QualityRoles del usuario
    const qualityRoles = await this.prisma.qualityRole.findMany({
      where: { organizationUserId: orgUser.id },
      select: { role: true },
    })

    if (qualityRoles.length === 0) return []

    const roleTypes = qualityRoles.map((qr) => qr.role)

    // Buscar requests pendientes que correspondan a los roles del usuario
    const statusFilters: ApprovalStatus[] = []
    if (roleTypes.includes('REVIEWER')) statusFilters.push('PENDING_REVIEW')
    if (roleTypes.includes('APPROVER')) statusFilters.push('PENDING_APPROVAL')

    return this.prisma.approvalRequest.findMany({
      where: {
        organizationId,
        status: { in: statusFilters },
      },
      include: {
        submittedBy: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        decisions: {
          include: {
            decidedBy: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
          orderBy: { decidedAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    })
  }
}
