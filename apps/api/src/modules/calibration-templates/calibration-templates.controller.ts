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
  Res,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { CalibrationTemplatesService } from './calibration-templates.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

const MANUAL_PDF_MAX_BYTES = 10 * 1024 * 1024

@Controller('calibration-templates')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CalibrationTemplatesController {
  private uploadDir: string

  constructor(private service: CalibrationTemplatesService) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'calibration-templates')
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

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

    // Si había un PDF previo, intentamos borrarlo del disco antes de sobrescribir.
    const previous = await this.service.getManualPdf(id, user.organizationId)
    if (previous?.manualPdfKey) {
      const prevPath = path.join(this.uploadDir, previous.manualPdfKey)
      if (fs.existsSync(prevPath)) {
        try { fs.unlinkSync(prevPath) } catch { /* mejor esfuerzo */ }
      }
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${id}_${Date.now()}_${safeName}`
    const filepath = path.join(this.uploadDir, filename)
    fs.writeFileSync(filepath, file.buffer)

    return this.service.setManualPdf(id, user.organizationId, {
      manualPdfUrl: `/api/calibration-templates/${id}/manual-pdf/file/${filename}`,
      manualPdfKey: filename,
      manualPdfName: file.originalname,
      manualPdfSize: file.size,
    })
  }

  @Delete(':id/manual-pdf')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  async deleteManualPdf(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const previous = await this.service.getManualPdf(id, user.organizationId)
    if (previous?.manualPdfKey) {
      const prevPath = path.join(this.uploadDir, previous.manualPdfKey)
      if (fs.existsSync(prevPath)) {
        try { fs.unlinkSync(prevPath) } catch { /* mejor esfuerzo */ }
      }
    }
    return this.service.clearManualPdf(id, user.organizationId)
  }

  @Get(':id/manual-pdf/file/:filename')
  @Public()
  async serveManualPdf(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Anti path-traversal: los uploads se guardan con nombre plano sanitizado.
    // Cualquier separador o ".." en el param (p. ej. %2e%2e%2f decodificado) → 404.
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      return res.status(404).json({ message: 'Archivo no encontrado' })
    }
    const filepath = path.join(this.uploadDir, filename)
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Archivo no encontrado' })
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    fs.createReadStream(filepath).pipe(res)
  }
}
