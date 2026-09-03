import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
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
import { InstrumentsService } from './instruments.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

const CERT_PDF_MAX_BYTES = 10 * 1024 * 1024

@Controller('instruments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InstrumentsController {
  private uploadDir: string

  constructor(private service: InstrumentsService) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'instrument-certificates')
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.service.findAll(user.organizationId, { status, recordId })
  }

  @Get('patterns')
  findPatterns(@CurrentUser() user: JwtPayload) {
    return this.service.findPatterns(user.organizationId)
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findById(id, user.organizationId)
  }

  // No hay POST crear ni PATCH editar — los instruments se crean automáticamente
  // vía listener cuando se crea una entry en un record INSTRUMENTAL.
  // Los datos descriptivos se editan desde la entry del registro.

  @Post(':id/status')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.service.changeStatus(id, user.organizationId, body.status, body.reason || null, user.sub)
  }

  // ─── Certificados de calibración externa (append-only) ───────────────────

  @Get(':id/certificates')
  listCertificates(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.listCertificates(id, user.organizationId)
  }

  @Post(':id/certificates')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCertificate(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { result?: string; calibrationDate?: string; notes?: string },
  ) {
    if (!file) throw new BadRequestException('No se adjuntó ningún archivo')
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF (application/pdf)')
    }
    if (file.size > CERT_PDF_MAX_BYTES) {
      throw new BadRequestException('El archivo supera el tamaño máximo permitido (10 MB)')
    }

    if (body.result !== 'PASSED' && body.result !== 'FAILED') {
      throw new BadRequestException(
        'Indicá el resultado del certificado (conforme o no conforme).',
      )
    }
    const result: 'PASSED' | 'FAILED' = body.result

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${id}_${Date.now()}_${safeName}`
    const filepath = path.join(this.uploadDir, filename)
    fs.writeFileSync(filepath, file.buffer)

    let calibrationDate: Date | null = null
    if (body.calibrationDate) {
      // Forzar UTC midnight: el input HTML manda "YYYY-MM-DD" sin TZ,
      // y `new Date("YYYY-MM-DD")` ya devuelve UTC, pero hacemos el sufijo
      // explícito para que sea claro y evitar drift en el server según TZ.
      const parsed = new Date(`${body.calibrationDate}T00:00:00.000Z`)
      if (!Number.isNaN(parsed.getTime())) calibrationDate = parsed
    }

    return this.service.addCertificate(id, user.organizationId, user.sub, {
      pdfUrl: `/api/instruments/${id}/certificates/file/${filename}`,
      pdfKey: filename,
      pdfName: file.originalname,
      pdfSize: file.size,
      result,
      calibrationDate,
      notes: body.notes?.trim() || null,
    })
  }

  @Get(':id/certificates/file/:filename')
  @Public()
  async serveCertificate(
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
