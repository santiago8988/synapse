import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { DocumentsService } from './documents.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { DocumentStatus } from '@prisma/client'
import { Public } from '../../common/decorators/public.decorator'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import * as path from 'path'

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DocumentsController {
  private uploadDir: string

  constructor(
    private service: DocumentsService,
    private configService: ConfigService,
  ) {
    // Directorio local para uploads (en producción se usaría R2)
    this.uploadDir = path.join(process.cwd(), 'uploads', 'documents')
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
    @Body() body: { title: string; code?: string },
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
    @Body() body: { title?: string; code?: string; status?: DocumentStatus },
  ) {
    return this.service.update(id, user.organizationId, body)
  }

  @Post(':id/upload')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      return { error: 'No se adjuntó ningún archivo' }
    }

    // Guardar archivo localmente (en producción → R2)
    const ext = path.extname(file.originalname)
    const filename = `${id}_${Date.now()}${ext}`
    const filepath = path.join(this.uploadDir, filename)
    fs.writeFileSync(filepath, file.buffer)

    const fileUrl = `/api/documents/${id}/file/${filename}`
    await this.service.setFileUrl(id, user.organizationId, fileUrl)

    return { fileUrl, filename: file.originalname }
  }

  @Get(':id/file/:filename')
  @Public()
  async serveFile(
    @Param('id') id: string,
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

    const ext = path.extname(filename).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    const stream = fs.createReadStream(filepath)
    stream.pipe(res)
  }

  @Post(':id/version')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @UseInterceptors(FileInterceptor('file'))
  async createVersion(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { reason?: string },
  ) {
    let fileUrl: string | undefined

    // Si se adjuntó nuevo archivo, guardarlo
    if (file) {
      const ext = path.extname(file.originalname)
      const filename = `${id}_v_${Date.now()}${ext}`
      const filepath = path.join(this.uploadDir, filename)
      fs.writeFileSync(filepath, file.buffer)
      fileUrl = `/api/documents/${id}/file/${filename}`
    }

    return this.service.createNewVersion(id, user.organizationId, user.sub, {
      fileUrl,
      reason: body.reason,
    })
  }
}
