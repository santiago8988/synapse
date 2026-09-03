import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CalibrationTemplatesService } from './calibration-templates.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { StorageService } from '../../common/storage/storage.service'

const MANUAL_PDF_MAX_BYTES = 10 * 1024 * 1024

@Controller('calibration-templates')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CalibrationTemplatesController {
  constructor(
    private service: CalibrationTemplatesService,
    private storage: StorageService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      name: string
      code?: string
      description?: string
      unitMain?: string
      unitTolerance?: string
      periodicity?: number
      notifyDaysBefore?: number
      tests: Array<{
        name: string
        description?: string
        order: number
        tolerance?: number
        toleranceUnit?: string
        readingsPerPoint?: number
        formulaError?: string
        criteriaOperator?: string
        notes?: string
        points: Array<{ name: string; order: number; load?: number; unit?: string }>
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
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      name?: string
      code?: string
      description?: string
      unitMain?: string
      unitTolerance?: string
      tests?: Array<{
        name: string
        description?: string
        order: number
        tolerance?: number
        toleranceUnit?: string
        readingsPerPoint?: number
        formulaError?: string
        criteriaOperator?: string
        notes?: string
        points: Array<{ name: string; order: number; load?: number; unit?: string }>
      }>
    },
  ) {
    return this.service.update(id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, user.organizationId)
  }

  // ─── Manual de verificación interna (PDF) ─────────────────────────────────

  @Post(':id/manual-pdf')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadManualPdf(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se adjuntó ningún archivo')
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF (application/pdf)')
    }
    if (file.size > MANUAL_PDF_MAX_BYTES) {
      throw new BadRequestException('El archivo supera el tamaño máximo permitido (10 MB)')
    }

    // El manual no es append-only: hay una sola versión vigente, así que el
    // anterior se borra del storage al reemplazarlo.
    const previous = await this.service.getManualPdf(id, user.organizationId)
    if (previous?.manualPdfKey) {
      await this.storage.remove('calibration-templates', previous.manualPdfKey)
    }

    const stored = await this.storage.put('calibration-templates', user.organizationId, file)

    return this.service.setManualPdf(id, user.organizationId, {
      manualPdfKey: stored.key,
      manualPdfName: stored.name,
      manualPdfSize: stored.size,
    })
  }

  @Delete(':id/manual-pdf')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  async deleteManualPdf(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const previous = await this.service.getManualPdf(id, user.organizationId)
    if (previous?.manualPdfKey) {
      await this.storage.remove('calibration-templates', previous.manualPdfKey)
    }
    return this.service.clearManualPdf(id, user.organizationId)
  }
}
