/**
 * Abstracción de almacenamiento de archivos.
 *
 * Existen dos implementaciones (ver storage.module.ts, que elige según env):
 *   - LocalStorageService — disco local, para desarrollo.
 *   - R2StorageService    — Cloudflare R2, para producción.
 *
 * Regla importante: la URL de un archivo NUNCA se persiste. Se firma en cada
 * lectura a partir de la `key`, que sí se guarda. Esto permite migrar de
 * backend sin tocar filas existentes — relevante porque InstrumentCertificate
 * es append-only y no admite UPDATE (regla 4 de CLAUDE.md).
 */

export interface UploadedFileLike {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}

export interface StoredObject {
  /** Clave dentro del scope. Es lo único que se persiste en la DB. */
  key: string
  /** Nombre original del archivo, tal como lo subió el usuario. */
  name: string
  size: number
  contentType: string
}

export interface SignedUrlOptions {
  /** Segundos de validez. Default: 900 (15 minutos). */
  expiresIn?: number
  /**
   * Si se pasa, la descarga sugiere este nombre de archivo en vez de la key.
   * Se usa para que el usuario reciba "CERT-2024.pdf" y no un uuid.
   */
  downloadName?: string
}

/**
 * Scopes válidos. Se traducen a un subdirectorio (local) o a un prefijo de
 * key (R2). No aceptar scopes arbitrarios evita que un caller escriba fuera
 * del árbol previsto.
 */
export const STORAGE_SCOPES = [
  'documents',
  'entries',
  'recipes',
  'instrument-certificates',
  'calibration-templates',
] as const

export type StorageScope = (typeof STORAGE_SCOPES)[number]

export function isStorageScope(value: string): value is StorageScope {
  return (STORAGE_SCOPES as readonly string[]).includes(value)
}

export abstract class StorageService {
  /**
   * Guarda el archivo y devuelve la key generada. La key incluye el
   * organizationId como prefijo, así un objeto nunca colisiona entre tenants
   * y el bucket queda navegable por organización.
   */
  abstract put(
    scope: StorageScope,
    organizationId: string,
    file: UploadedFileLike,
  ): Promise<StoredObject>

  /**
   * Devuelve una URL absoluta, firmada y con vencimiento. El frontend la usa
   * tal cual en <a href> o <iframe src>, que no pueden mandar el header
   * Authorization. Es responsabilidad del caller haber verificado antes que
   * el usuario puede ver ese archivo.
   */
  abstract signedUrl(
    scope: StorageScope,
    key: string,
    options?: SignedUrlOptions,
  ): Promise<string>

  /** Borra un objeto. Silencioso si no existe. */
  abstract remove(scope: StorageScope, key: string): Promise<void>
}
