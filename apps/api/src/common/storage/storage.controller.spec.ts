import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import type { Response } from 'express'
import type { ConfigService } from '@nestjs/config'
import type { LocalStorageService } from './local-storage.service'

vi.mock('fs', () => ({
  existsSync: vi.fn(() => true),
  createReadStream: vi.fn(() => ({ pipe: vi.fn() })),
}))

import * as fs from 'fs'
import { StorageController } from './storage.controller'

/**
 * Headers de la respuesta que sirve los PDF del backend de disco.
 *
 * El caso que motiva el spec: `main.ts` manda `X-Frame-Options: DENY`,
 * `frame-ancestors 'none'` y `Cross-Origin-Resource-Policy: same-site` a toda
 * la API. Correcto para JSON, pero el visor de documentos embebe **este**
 * endpoint en un <iframe> desde otro origen, asi que con los headers globales
 * el preview queda en blanco — sin error en consola del lado del servidor y sin
 * nada que apunte a la causa. Es exactamente el modo silencioso en que una
 * politica rompe una feature, y por eso se testea en vez de confiar en que
 * alguien se acuerde.
 *
 * Lo que protege el archivo es la firma con vencimiento de la URL, no la
 * imposibilidad de embeberlo: relajar el framing hacia el frontend propio no
 * afloja el control de acceso.
 */

function armarControlador(frontendUrl = 'https://app.synapse.test') {
  const verify = vi.fn(() => 'C:/uploads/documents/org-1/manual.pdf')
  const storage = { verify } as unknown as LocalStorageService
  const config = { get: vi.fn(() => frontendUrl) } as unknown as ConfigService

  const headers = new Map<string, string>()
  const res = {
    setHeader: vi.fn((name: string, value: string) => headers.set(name, value)),
    removeHeader: vi.fn((name: string) => headers.delete(name)),
  } as unknown as Response

  return { controller: new StorageController(storage, config), verify, headers, res }
}

describe('StorageController — headers', () => {
  let ctx: ReturnType<typeof armarControlador>

  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    ctx = armarControlador()
  })

  function servir() {
    // El header global ya esta puesto cuando entra el handler: el middleware de
    // main.ts corre antes. Se simula para poder verificar que se saca.
    ctx.headers.set('X-Frame-Options', 'DENY')
    ctx.controller.serve('documents', 'org-1/manual.pdf', '999', 'firma', undefined, ctx.res)
  }

  it('saca el X-Frame-Options global para que el iframe del visor cargue', () => {
    servir()

    // Con DENY, el <iframe> de documents/page.tsx no renderiza nada.
    expect(ctx.headers.has('X-Frame-Options')).toBe(false)
  })

  it('permite al frontend propio embeber el PDF, y solo a el', () => {
    servir()

    const csp = ctx.headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("frame-ancestors 'self' https://app.synapse.test")
    // Cualquier otro sitio sigue sin poder embeberlo.
    expect(csp).not.toContain('frame-ancestors *')
  })

  it('abre el CORP: frontend y API no estan en el mismo site', () => {
    servir()

    // `same-site` —el valor global— bloquea la carga cuando el frontend vive en
    // otro dominio, que es el caso normal de deploy.
    expect(ctx.headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin')
  })

  it('no afloja lo que si protege: nosniff y sandbox siguen puestos', () => {
    servir()

    expect(ctx.headers.get('X-Content-Type-Options')).toBe('nosniff')
    const csp = ctx.headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain('sandbox')
    expect(csp).toContain("default-src 'none'")
  })

  it('una firma invalida no llega a mandar ningun header', () => {
    ctx.verify.mockReturnValue(null as unknown as string)

    expect(() =>
      ctx.controller.serve('documents', 'org-1/manual.pdf', '999', 'mala', undefined, ctx.res),
    ).toThrow(NotFoundException)
    expect(ctx.res.setHeader).not.toHaveBeenCalled()
  })

  it('un scope que no existe es 404 sin tocar el storage', () => {
    expect(() =>
      ctx.controller.serve('inventado', 'x.pdf', '999', 'firma', undefined, ctx.res),
    ).toThrow(NotFoundException)
    expect(ctx.verify).not.toHaveBeenCalled()
  })
})
