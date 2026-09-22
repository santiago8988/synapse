import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  NotFoundException,
} from '@nestjs/common'
import { Response } from 'express'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'
import { normalizeFrontendUrl } from '../config/frontend-url'
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
  private readonly frontendUrl: string

  constructor(
    private storage: LocalStorageService,
    config: ConfigService,
  ) {
    this.frontendUrl = normalizeFrontendUrl(config.get<string>('FRONTEND_URL'))
  }

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
    // El tipo se declara fijo, así que hay que impedir que el navegador lo
    // adivine: sin nosniff, un archivo que no sea realmente un PDF podía
    // interpretarse como otra cosa y ejecutarse con el origen de la API. El
    // sandbox y el CSP son el segundo cinturón por si algo pasa la validación
    // de subida.
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // El visor de documentos embebe este PDF en un <iframe> (documents/page.tsx)
    // y el frontend esta en otro origen, asi que los headers globales de
    // main.ts —`X-Frame-Options: DENY`, `frame-ancestors 'none'` y
    // `Cross-Origin-Resource-Policy: same-site`— dejarian el preview en blanco.
    // Se relajan solo para esta respuesta y solo hacia el frontend propio.
    //
    // No afloja el control de acceso: lo que protege el archivo es la firma con
    // vencimiento de la URL, no el hecho de que no se pueda embeber. El
    // `sandbox` sigue impidiendo que el PDF ejecute nada.
    //
    // Solo aplica al backend de disco (desarrollo). En produccion sirve R2 y
    // este controller no interviene.
    res.removeHeader('X-Frame-Options')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; object-src 'none'; frame-ancestors 'self' ${this.frontendUrl}; sandbox`,
    )
    if (name) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${name.replace(/[^a-zA-Z0-9._ -]/g, '_')}"`,
      )
    }
    fs.createReadStream(filepath).pipe(res)
  }
}
