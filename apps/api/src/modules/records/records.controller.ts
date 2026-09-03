import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { RecordsService } from './records.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { Prisma, RecordType, FieldType } from '@prisma/client'

@Controller('records')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RecordsController {
  constructor(private service: RecordsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('archived') archived?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user.organizationId, archived === 'true', status)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name: string
      type: RecordType
      areaIds?: string[]
      documentId?: string
      periodicity?: number
      notifyDaysBefore?: number
      fields: Array<{
        label: string
        fieldType: FieldType
        order: number
        isIdentifier?: boolean
        isRequired?: boolean
        relatedRecordId?: string
        relatedFieldIds?: string[]
        comparisonConfig?: Prisma.InputJsonValue
        formulaConfig?: Prisma.InputJsonValue
      }>
    },
  ) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  /**
   * Mapa global de flujos de la organizacion: todas las RecordAction con sus
   * registros origen y destino. Se declara antes de @Get(':id') para que la
   * ruta no la capture el parametro.
   */
  @Get('flows/overview')
  flowsOverview(@CurrentUser() user: JwtPayload) {
    return this.service.listAllActions(user.organizationId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  editWithVersion(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      name?: string
      areaIds?: string[]
      periodicity?: number
      notifyDaysBefore?: number
      changeReason: string
      addFields?: Array<{
        label: string
        fieldType: FieldType
        order: number
        isIdentifier?: boolean
        isRequired?: boolean
        comparisonConfig?: Prisma.InputJsonValue
        formulaConfig?: Prisma.InputJsonValue
      }>
      removeFieldIds?: string[]
      updateFields?: Array<{
        id: string
        label?: string
        order?: number
        isRequired?: boolean
        comparisonConfig?: Prisma.InputJsonValue
        formulaConfig?: Prisma.InputJsonValue
      }>
    },
  ) {
    return this.service.editWithVersion(id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user.organizationId)
  }

  @Post(':id/restore')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  restore(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.restore(id, user.organizationId)
  }

  // ─── Actions (RecordAction / Visual Flow Editor) ──────────────────────────

  @Get(':id/actions')
  listActions(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listActions(id, user.organizationId)
  }

  @Post(':id/actions')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  addAction(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      targetRecordId: string
      fieldMapping: Array<{ sourceFieldId: string; targetFieldId: string }>
      trigger?: 'ENTRY_CREATED' | 'ENTRY_COMPLETED' | 'FIELD_VALUE_CHANGED' | 'COMPARISON_FAILED'
      condition?: Prisma.InputJsonValue | null
      allowCascade?: boolean
      actionType?: 'CREATE_ENTRY' | 'UPDATE_FIELD' | 'NOTIFY' | 'EMAIL' | 'WEBHOOK'
      actionConfig?: Prisma.InputJsonValue | null
    },
  ) {
    return this.service.addAction(id, user.organizationId, body)
  }

  @Patch(':id/actions/:actionId')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  updateAction(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      targetRecordId?: string
      fieldMapping?: Array<{ sourceFieldId: string; targetFieldId: string }>
      trigger?: 'ENTRY_CREATED' | 'ENTRY_COMPLETED' | 'FIELD_VALUE_CHANGED' | 'COMPARISON_FAILED'
      condition?: Prisma.InputJsonValue | null
      allowCascade?: boolean
      actionType?: 'CREATE_ENTRY' | 'UPDATE_FIELD' | 'NOTIFY' | 'EMAIL' | 'WEBHOOK'
      actionConfig?: Prisma.InputJsonValue | null
    },
  ) {
    return this.service.updateAction(id, actionId, user.organizationId, body)
  }

  @Delete(':id/actions/:actionId')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  deleteAction(@Param('actionId') actionId: string) {
    return this.service.deleteAction(actionId)
  }
}
