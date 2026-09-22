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
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  createDocumentSchema,
  updateDocumentSchema,
  type CreateDocumentInput,
  type UpdateDocumentInput,
} from '@synapse/validators'
import { StorageService } from '../../common/storage/storage.service'
import { assertUploadedPdf, PDF_UPLOAD_OPTIONS } from '../../common/storage/uploaded-pdf'

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
  @ZodBody(createDocumentSchema)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateDocumentInput,
  ) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(updateDocumentSchema)
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateDocumentInput,
  ) {
    return this.service.update(id, user.organizationId, body)
  }

  @Post(':id/upload')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @UseInterceptors(FileInterceptor('file', PDF_UPLOAD_OPTIONS))
  async uploadFile(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Este endpoint no validaba nada: ni tipo ni tamaño. Entraba cualquier
    // archivo y StorageController lo devolvía declarado como application/pdf.
    assertUploadedPdf(file)

    const stored = await this.storage.put('documents', user.organizationId, file)
    const document = await this.service.setFileKey(id, user.organizationId, stored.key)

    return { fileUrl: document.fileUrl, filename: stored.name }
  }

  // Sin `@ZodBody`: es multipart, y ahi el decorador no valida nada. Los
  // interceptores globales corren antes que los de ruta, asi que cuando el
  // interceptor de Zod llega, multer todavia no parseo el body. El propio
  // interceptor devuelve 400 si se lo pone igual, para que no pase inadvertido.
  @Post(':id/version')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @UseInterceptors(FileInterceptor('file', PDF_UPLOAD_OPTIONS))
  async createVersion(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { reason?: string },
  ) {
    // Si no se adjunta archivo, la nueva versión hereda el de la anterior.
    // Si se adjunta, se valida igual que en el upload.
    const stored = file
      ? await this.storage.put('documents', user.organizationId, assertUploadedPdf(file))
      : null

    return this.service.createNewVersion(id, user.organizationId, user.sub, {
      fileKey: stored?.key,
      reason: body.reason,
    })
  }
}
