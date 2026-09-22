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
import { RecipesService } from './recipes.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  createRecipeSchema,
  updateRecipeSchema,
  type CreateRecipeInput,
  type UpdateRecipeInput,
} from '@synapse/validators'
import { StorageService } from '../../common/storage/storage.service'
import { assertUploadedPdf, PDF_UPLOAD_OPTIONS } from '../../common/storage/uploaded-pdf'

const STEPS_PDF_MAX_BYTES = 10 * 1024 * 1024

@Controller('recipes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RecipesController {
  constructor(
    private service: RecipesService,
    private storage: StorageService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(createRecipeSchema)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateRecipeInput,
  ) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(updateRecipeSchema)
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateRecipeInput,
  ) {
    return this.service.update(id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, user.organizationId)
  }

  // ─── PDF de pasos del proceso ─────────────────────────────────────────────

  @Post(':id/steps-pdf')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @UseInterceptors(FileInterceptor('file', PDF_UPLOAD_OPTIONS))
  async uploadStepsPdf(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertUploadedPdf(file, STEPS_PDF_MAX_BYTES)

    // Una sola versión vigente del PDF de pasos: el anterior se borra.
    const previous = await this.service.getStepsPdf(id, user.organizationId)
    if (previous?.stepsPdfKey) {
      await this.storage.remove('recipes', previous.stepsPdfKey)
    }

    const stored = await this.storage.put('recipes', user.organizationId, file)

    return this.service.setStepsPdf(id, user.organizationId, {
      stepsPdfKey: stored.key,
      stepsPdfName: stored.name,
      stepsPdfSize: stored.size,
    })
  }

  @Delete(':id/steps-pdf')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  async deleteStepsPdf(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const previous = await this.service.getStepsPdf(id, user.organizationId)
    if (previous?.stepsPdfKey) {
      await this.storage.remove('recipes', previous.stepsPdfKey)
    }
    return this.service.clearStepsPdf(id, user.organizationId)
  }
}
