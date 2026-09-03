import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common'
import { Response } from 'express'
import * as fs from 'fs'
import { Public } from '../decorators/public.decorator'
import { AuditIgnore } from '../decorators/audit-ignore.decorator'
import { LocalStorageService } from './local-storage.service'
import { isStorageScope } from './storage.service'

/**
 * Sirve los archivos del backend local. Reemplaza a los cinco endpoints
 * `.../file/:filename` que había en documents, entries, recipes, instruments y
 * calibration-templates, que eran @Public() sin ninguna verificación: bastaba
 * conocer la URL para descargar el PDF de cualquier organización.
 *
 * Acá el endpoint sigue siendo @Public() —un <iframe> o un <a href> no puede
 * mandar el header Authorization— pero la URL solo sirve si viene firmada y
 * sin vencer. Las firma StorageService.signedUrl, que únicamente se llama
 * desde services que ya filtraron por organizationId.
 *
 * En producción (R2) este controller no interviene: las presigned URLs las
 * resuelve Cloudflare directamente.
 */
@Controller('storage')
export class StorageController {
  constructor(private storage: LocalStorageService) {}

  @Get(':scope/*')
  @Public()
  @AuditIgnore() // Lectura de archivo: no es una mutación, no va al AuditLog.
  serve(
    @Param('scope') scope: string,
    @Param('0') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('name') name: string | undefined,
    @Res() res: Response,
  ) {
    if (!isStorageScope(scope) || !exp || !sig) {
      throw new NotFoundException('Archivo no encontrado')
    }

    const decodedKey = key
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/')

    // verify() devuelve null si la firma no coincide, si venció, o si la key
    // resuelve fuera del scope. Todos los casos son 404: no se le confirma a
    // quien prueba URLs que el archivo existe.
    let filepath: string | null
    try {
      filepath = this.storage.verify(scope, decodedKey, Number(exp), sig)
    } catch {
      filepath = null
    }
    if (!filepath || !fs.existsSync(filepath)) {
      throw new NotFoundException('Archivo no encontrado')
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Cache-Control', 'private, no-store')
    if (name) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${name.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`,
      )
    }
    fs.createReadStream(filepath).pipe(res)
  }
}
