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
import { StorageService } from '../../common/storage/storage.service'

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
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      name: string
      code: string
      ingredients: Array<{ name: string; quantity: number; unit: string; order: number; fromStock?: boolean; stockRecipeId?: string }>
      steps: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
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
      ingredients?: Array<{ name: string; quantity: number; unit: string; order: number }>
      steps?: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
    },
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadStepsPdf(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No se adjuntó ningún archivo')
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF (application/pdf)')
    }
    if (file.size > STEPS_PDF_MAX_BYTES) {
      throw new BadRequestException('El archivo supera el tamaño máximo permitido (10 MB)')
    }

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
