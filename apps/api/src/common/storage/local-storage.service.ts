import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import {
  SignedUrlOptions,
  StorageScope,
  StorageService,
  StoredObject,
  UploadedFileLike,
} from './storage.service'

/**
 * Backend de desarrollo: guarda en disco bajo apps/api/uploads/<scope>/.
 *
 * Las URLs que emite apuntan a StorageController y llevan firma HMAC con
 * vencimiento, igual que las presigned de R2. Así el control de acceso se
 * comporta igual en dev y en producción, y no queda ningún endpoint que
 * sirva archivos sin credencial.
 *
 * No usar en producción: el filesystem de Vercel/Railway es efímero y los
 * archivos se pierden en cada redeploy.
 */
@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name)
  private readonly rootDir: string
  private readonly apiBaseUrl: string
  private readonly signingSecret: string

  constructor(private config: ConfigService) {
    super()
    this.rootDir = path.join(process.cwd(), 'uploads')
    this.apiBaseUrl = (
      this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001/api'
    ).replace(/\/+$/, '')
    // Secreto propio si existe; si no, se reutiliza el del JWT. Nunca vacío:
    // una firma con secreto vacío es una firma que cualquiera puede fabricar.
    const secret =
      this.config.get<string>('STORAGE_SIGNING_SECRET') ||
      this.config.get<string>('JWT_SECRET')
    if (!secret) {
      throw new Error(
        'Falta STORAGE_SIGNING_SECRET (o JWT_SECRET) — no se pueden firmar URLs de archivos',
      )
    }
    this.signingSecret = secret
  }

  async put(
    scope: StorageScope,
    organizationId: string,
    file: UploadedFileLike,
  ): Promise<StoredObject> {
    const key = buildObjectKey(organizationId, file.originalname)
    const target = this.resolve(scope, key)
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.writeFile(target, file.buffer)
    return {
      key,
      name: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    }
  }

  async signedUrl(
    scope: StorageScope,
    key: string,
    options: SignedUrlOptions = {},
  ): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + (options.expiresIn ?? 900)
    const signature = this.sign(scope, key, expiresAt)
    const params = new URLSearchParams({ exp: String(expiresAt), sig: signature })
    if (options.downloadName) params.set('name', options.downloadName)
    // La key puede tener "/" (prefijo de organización); se codifica segmento a
    // segmento para no romper la ruta.
    const encodedKey = key.split('/').map(encodeURIComponent).join('/')
    return `${this.apiBaseUrl}/storage/${scope}/${encodedKey}?${params.toString()}`
  }

  async remove(scope: StorageScope, key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolve(scope, key))
    } catch (err) {
      // Que el archivo ya no esté no es un error para el caller.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`No se pudo borrar ${scope}/${key}: ${String(err)}`)
      }
    }
  }

  // ─── Usados por StorageController ────────────────────────────────────────

  /**
   * Valida firma y vencimiento. Devuelve la ruta absoluta del archivo o null
   * si la URL no es válida. No distingue entre "firma inválida" y "vencida"
   * hacia afuera: el controller responde 404 en ambos casos.
   */
  verify(
    scope: StorageScope,
    key: string,
    expiresAt: number,
    signature: string,
  ): string | null {
    if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return null
    }
    const expected = this.sign(scope, key, expiresAt)
    const provided = Buffer.from(signature)
    const valid = Buffer.from(expected)
    // Longitudes distintas hacen fallar timingSafeEqual, así que se chequea antes.
    if (provided.length !== valid.length) return null
    if (!crypto.timingSafeEqual(provided, valid)) return null
    return this.resolve(scope, key)
  }

  private sign(scope: StorageScope, key: string, expiresAt: number): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${scope}:${key}:${expiresAt}`)
      .digest('hex')
  }

  /**
   * Resuelve la ruta en disco y verifica que caiga dentro del scope. Las keys
   * las genera este service, pero una key llega desde la DB y desde la URL:
   * validar el path resuelto evita que un valor manipulado escape del árbol.
   */
  private resolve(scope: StorageScope, key: string): string {
    const scopeDir = path.resolve(this.rootDir, scope)
    const target = path.resolve(scopeDir, key)
    if (target !== scopeDir && !target.startsWith(scopeDir + path.sep)) {
      throw new Error(`Key fuera del scope: ${scope}/${key}`)
    }
    return target
  }
}

/**
 * `<organizationId>/<uuid>-<nombre saneado>`.
 *
 * El uuid evita colisiones y hace que la key no sea adivinable; el nombre
 * saneado se conserva solo para poder reconocer el archivo al inspeccionar el
 * bucket. Las keys viejas (planas, sin prefijo de organización) siguen
 * funcionando: se guarda la key tal cual está en la DB y se resuelve igual.
 */
export function buildObjectKey(organizationId: string, originalName: string): string {
  const safeName = path
    .basename(originalName)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80)
  return `${organizationId}/${crypto.randomUUID()}-${safeName}`
}
