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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { InstrumentsService } from './instruments.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { StorageService } from '../../common/storage/storage.service'

const CERT_PDF_MAX_BYTES = 10 * 1024 * 1024

@Controller('instruments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InstrumentsController {
  constructor(
    private service: InstrumentsService,
    private storage: StorageService,
  ) {}

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

    const stored = await this.storage.put('instrument-certificates', user.organizationId, file)

    let calibrationDate: Date | null = null
    if (body.calibrationDate) {
      // Forzar UTC midnight: el input HTML manda "YYYY-MM-DD" sin TZ,
      // y `new Date("YYYY-MM-DD")` ya devuelve UTC, pero hacemos el sufijo
      // explícito para que sea claro y evitar drift en el server según TZ.
      const parsed = new Date(`${body.calibrationDate}T00:00:00.000Z`)
      if (!Number.isNaN(parsed.getTime())) calibrationDate = parsed
    }

    return this.service.addCertificate(id, user.organizationId, user.sub, {
      pdfKey: stored.key,
      pdfName: stored.name,
      pdfSize: stored.size,
      result,
      calibrationDate,
      notes: body.notes?.trim() || null,
    })
  }
}
