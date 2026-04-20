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
      areaId?: string
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
      areaId?: string | null
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

  // ─── Actions ──────────────────────────────────

  @Post(':id/actions')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  addAction(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      targetRecordId: string
      fieldMapping: Array<{ sourceFieldId: string; targetFieldId: string }>
    },
  ) {
    return this.service.addAction(id, user.organizationId, body)
  }

  @Delete(':id/actions/:actionId')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  deleteAction(@Param('actionId') actionId: string) {
    return this.service.deleteAction(actionId)
  }
}
