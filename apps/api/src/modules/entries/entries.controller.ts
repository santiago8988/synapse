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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { EntriesService } from './entries.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { StorageService } from '../../common/storage/storage.service'
import type { UserRole } from '@synapse/types'

const FILE_PDF_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

@Controller('records/:recordId/entries')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EntriesController {
  constructor(
    private service: EntriesService,
    private storage: StorageService,
  ) {}

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

    const stored = await this.storage.put('entries', user.organizationId, file)

    // `url` no se persiste: la firma se calcula en cada lectura desde `key`.
    const value = {
      key: stored.key,
      name: stored.name,
      size: stored.size,
      uploadedAt: new Date().toISOString(),
      uploadedById: user.sub,
    }

    await this.service.setFieldValue(id, recordId, fieldId, value, user.sub, user.role as UserRole)
    return {
      ...value,
      url: await this.storage.signedUrl('entries', stored.key, { downloadName: stored.name }),
    }
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

    // Leer el value actual para borrar el archivo del storage.
    const current = await this.service.getFieldValue(id, recordId, fieldId)
    if (current && typeof current === 'object' && 'key' in current) {
      await this.storage.remove('entries', (current as { key: string }).key)
    }

    await this.service.setFieldValue(id, recordId, fieldId, null, user.sub, user.role as UserRole)
    return { ok: true }
  }
}
