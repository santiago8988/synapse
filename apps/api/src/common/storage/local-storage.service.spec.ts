import { describe, it, expect, beforeEach } from 'vitest'
import type { ConfigService } from '@nestjs/config'
import { LocalStorageService, buildObjectKey } from './local-storage.service'

/**
 * La firma HMAC es lo único que separa un PDF privado de una descarga abierta
 * cuando se sirve desde disco. Antes de esto los cinco endpoints de archivos
 * eran @Public() sin verificación alguna, así que conviene que la validación
 * esté cubierta: firma alterada, vencimiento y escape del directorio.
 */

function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService
}

describe('LocalStorageService · firma de URLs', () => {
  let storage: LocalStorageService

  beforeEach(() => {
    storage = new LocalStorageService(
      fakeConfig({
        JWT_SECRET: 'secreto-de-prueba',
        API_PUBLIC_URL: 'http://localhost:3001/api',
      }),
    )
  })

  it('exige un secreto: sin JWT_SECRET no se puede firmar nada', () => {
    // Firmar con secreto vacío es una firma que cualquiera puede fabricar, así
    // que el service tiene que negarse a construirse.
    expect(() => new LocalStorageService(fakeConfig({}))).toThrow()
  })

  it('emite una URL absoluta con vencimiento y firma', async () => {
    const url = await storage.signedUrl('documents', 'org-1/archivo.pdf')
    const parsed = new URL(url)

    expect(parsed.origin).toBe('http://localhost:3001')
    expect(parsed.pathname).toBe('/api/storage/documents/org-1/archivo.pdf')
    expect(parsed.searchParams.get('sig')).toBeTruthy()
    expect(Number(parsed.searchParams.get('exp'))).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    )
  })

  it('acepta la firma que emitió', async () => {
    const url = await storage.signedUrl('documents', 'org-1/archivo.pdf')
    const p = new URL(url).searchParams

    const resuelto = storage.verify(
      'documents',
      'org-1/archivo.pdf',
      Number(p.get('exp')),
      p.get('sig')!,
    )
    expect(resuelto).toContain('archivo.pdf')
  })

  it('rechaza una firma alterada', async () => {
    const url = await storage.signedUrl('documents', 'org-1/archivo.pdf')
    const p = new URL(url).searchParams
    const alterada = p.get('sig')!.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))

    expect(
      storage.verify('documents', 'org-1/archivo.pdf', Number(p.get('exp')), alterada),
    ).toBeNull()
  })

  it('rechaza una firma de longitud distinta sin romperse', () => {
    // timingSafeEqual explota si los buffers no miden igual; tiene que
    // devolver null, no lanzar.
    expect(() =>
      storage.verify('documents', 'k', Math.floor(Date.now() / 1000) + 60, 'corta'),
    ).not.toThrow()
    expect(
      storage.verify('documents', 'k', Math.floor(Date.now() / 1000) + 60, 'corta'),
    ).toBeNull()
  })

  it('rechaza una URL vencida aunque la firma sea válida', async () => {
    const url = await storage.signedUrl('documents', 'k', { expiresIn: -10 })
    const p = new URL(url).searchParams

    expect(
      storage.verify('documents', 'k', Number(p.get('exp')), p.get('sig')!),
    ).toBeNull()
  })

  it('no acepta una firma emitida para otro scope', async () => {
    const url = await storage.signedUrl('documents', 'k')
    const p = new URL(url).searchParams

    // Reusar la firma en otro scope permitiría cruzar entre tipos de archivo.
    expect(
      storage.verify('recipes', 'k', Number(p.get('exp')), p.get('sig')!),
    ).toBeNull()
  })

  it('no acepta una firma emitida para otra key', async () => {
    const url = await storage.signedUrl('documents', 'k1')
    const p = new URL(url).searchParams

    expect(
      storage.verify('documents', 'k2', Number(p.get('exp')), p.get('sig')!),
    ).toBeNull()
  })

  it('rechaza una key que escapa del scope antes de tocar el disco', () => {
    // Con firma invalida ni siquiera se llega a resolver el path: la
    // comparacion de longitud corta primero.
    const exp = Math.floor(Date.now() / 1000) + 60
    expect(storage.verify('documents', '../../.env', exp, 'x')).toBeNull()
  })

  it('bloquea el escape del scope incluso con una firma legitima', async () => {
    // Defensa en capas: si alguna vez se firmara una key con "..", resolve
    // tiene que negarse igual. StorageController lo atrapa y devuelve 404.
    const url = await storage.signedUrl('documents', '../../.env')
    const p = new URL(url).searchParams

    expect(() =>
      storage.verify('documents', '../../.env', Number(p.get('exp')), p.get('sig')!),
    ).toThrow()
  })
})

describe('buildObjectKey', () => {
  it('prefija con la organización para que no colisione entre tenants', () => {
    const key = buildObjectKey('org-1', 'informe.pdf')
    expect(key.startsWith('org-1/')).toBe(true)
  })

  it('sanea el nombre y descarta cualquier ruta que venga en él', () => {
    const key = buildObjectKey('org-1', '../../etc/passwd')
    expect(key).not.toContain('..')
    expect(key).not.toContain('etc/')
  })

  it('no repite la clave para el mismo archivo', () => {
    expect(buildObjectKey('org-1', 'a.pdf')).not.toBe(buildObjectKey('org-1', 'a.pdf'))
  })
})
