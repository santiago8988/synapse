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
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { DocumentsService } from './documents.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { DocumentStatus } from '@prisma/client'
import { StorageService } from '../../common/storage/storage.service'

@Controller('documents')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DocumentsController {
  constructor(
    private service: DocumentsService,
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

    const stored = await this.storage.put('documents', user.organizationId, file)
    const document = await this.service.setFileKey(id, user.organizationId, stored.key)

    return { fileUrl: document.fileUrl, filename: stored.name }
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
    // Si no se adjunta archivo, la nueva versión hereda el de la anterior.
    const stored = file
      ? await this.storage.put('documents', user.organizationId, file)
      : null

    return this.service.createNewVersion(id, user.organizationId, user.sub, {
      fileKey: stored?.key,
      reason: body.reason,
    })
  }
}
