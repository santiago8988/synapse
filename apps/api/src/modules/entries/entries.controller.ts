import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { EntriesService } from './entries.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import type { UserRole } from '@synapse/types'

const FILE_PDF_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

@Controller('records/:recordId/entries')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EntriesController {
  private uploadDir: string

  constructor(private service: EntriesService) {
    // Almacenamiento local para uploads de FILE_PDF (en producción → R2,
    // mismo patrón que documents.controller).
    this.uploadDir = path.join(process.cwd(), 'uploads', 'entries')
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  @Get()
  findAll(
    @Param('recordId') recordId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(recordId, user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  create(
    @Param('recordId') recordId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      data: Record<string, unknown>
      revisionDate?: string
      lotNumber?: string
      sampleCode?: string
      client?: string
    },
  ) {
    return this.service.create(
      recordId,
      user.organizationId,
      user.sub,
      body.data,
      body.revisionDate,
      body.lotNumber ? { lotNumber: body.lotNumber } : undefined,
      body.sampleCode ? { sampleCode: body.sampleCode, client: body.client } : undefined,
    )
  }

  @Get(':id')
  findOne(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
  ) {
    return this.service.findById(id, recordId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  update(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { data: Record<string, unknown>; transitionReason?: string },
  ) {
    return this.service.update(id, recordId, body.data, user.sub, user.role as UserRole, body.transitionReason)
  }

  @Post(':id/complete')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  complete(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
  ) {
    return this.service.complete(id, recordId)
  }

  // ─── FILE_PDF uploads ─────────────────────────────────────────────────────

  /**
   * Sube un PDF y lo asigna al field `?field=<fieldId>` en `Entry.data`.
   * Body: multipart/form-data con `file` (max 10 MB, mime application/pdf).
   * Devuelve el value persistido en data[fieldId].
   */
  @Post(':id/files')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
    @Query('field') fieldId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!fieldId) throw new BadRequestException('Falta el query param `field` (id del field FILE_PDF)')
    if (!file) throw new BadRequestException('No se adjuntó ningún archivo')
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF (application/pdf)')
    }
    if (file.size > FILE_PDF_MAX_BYTES) {
      throw new BadRequestException('El archivo supera el tamaño máximo permitido (10 MB)')
    }

    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${id}_${fieldId}_${Date.now()}_${safeName}`
    const filepath = path.join(this.uploadDir, filename)
    fs.writeFileSync(filepath, file.buffer)

    const url = `/api/records/${recordId}/entries/${id}/files/${filename}`
    const value = {
      url,
      key: filename,
      name: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedById: user.sub,
    }

    await this.service.setFieldValue(id, recordId, fieldId, value, user.sub, user.role as UserRole)
    return value
  }

  @Delete(':id/files')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  async deleteFile(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
    @Query('field') fieldId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!fieldId) throw new BadRequestException('Falta el query param `field`')

    // Leer el value actual para borrar el archivo físico.
    const current = await this.service.getFieldValue(id, recordId, fieldId)
    if (current && typeof current === 'object' && 'key' in current) {
      const key = (current as { key: string }).key
      const filepath = path.join(this.uploadDir, key)
      if (fs.existsSync(filepath)) {
        try { fs.unlinkSync(filepath) } catch { /* mejor esfuerzo */ }
      }
    }

    await this.service.setFieldValue(id, recordId, fieldId, null, user.sub, user.role as UserRole)
    return { ok: true }
  }

  @Get(':id/files/:filename')
  @Public()
  async serveFile(
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
