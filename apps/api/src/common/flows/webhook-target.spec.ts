import { describe, it, expect } from 'vitest'
import { sanitizeWebhookHeaders, validateWebhookUrl } from './webhook-target'

/**
 * Un webhook hace que el servidor emita el pedido, así que la URL la elige un
 * usuario y la ejecuta la infraestructura. Si esta validación falla, un ADMIN
 * puede leer los metadatos de la instancia o alcanzar servicios internos que
 * nunca se expusieron a internet.
 */

describe('validateWebhookUrl · protocolo y forma', () => {
  it('acepta https hacia un host público', async () => {
    const r = await validateWebhookUrl('https://example.com/hook')
    expect(r.ok).toBe(true)
  })

  it('rechaza http en producción', async () => {
    const r = await validateWebhookUrl('http://example.com/hook')
    expect(r).toMatchObject({ ok: false })
  })

  it('rechaza protocolos que no son http(s)', async () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com', 'gopher://x']) {
      expect(await validateWebhookUrl(url)).toMatchObject({ ok: false })
    }
  })

  it('rechaza una URL malformada', async () => {
    expect(await validateWebhookUrl('no soy una url')).toMatchObject({ ok: false })
  })

  it('rechaza credenciales embebidas en la URL', async () => {
    // Terminarían escritas en los logs del servidor.
    const r = await validateWebhookUrl('https://user:pass@example.com/hook')
    expect(r).toMatchObject({ ok: false })
  })
})

describe('validateWebhookUrl · direcciones internas', () => {
  it('rechaza el endpoint de metadatos del cloud', async () => {
    // 169.254.169.254 devuelve credenciales de la instancia en AWS y GCP.
    const r = await validateWebhookUrl('https://169.254.169.254/latest/meta-data/')
    expect(r).toMatchObject({ ok: false })
  })

  it('rechaza loopback y localhost', async () => {
    for (const url of [
      'https://127.0.0.1/hook',
      'https://localhost/hook',
      'https://algo.localhost/hook',
      'https://[::1]/hook',
    ]) {
      expect(await validateWebhookUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('rechaza los rangos privados de IPv4', async () => {
    for (const url of [
      'https://10.0.0.5/hook',
      'https://172.16.0.1/hook',
      'https://172.31.255.254/hook',
      'https://192.168.1.1/hook',
      'https://100.64.0.1/hook',
      'https://0.0.0.0/hook',
    ]) {
      expect(await validateWebhookUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('acepta IPs públicas cercanas a los rangos privados', async () => {
    // 172.15 y 172.32 quedan fuera de 172.16.0.0/12: el chequeo no puede ser
    // "empieza con 172".
    for (const url of ['https://172.15.0.1/hook', 'https://172.32.0.1/hook', 'https://11.0.0.1/hook']) {
      expect(await validateWebhookUrl(url), url).toMatchObject({ ok: true })
    }
  })

  it('rechaza IPv6 interna y IPv4 mapeada en IPv6', async () => {
    for (const url of ['https://[fd00::1]/hook', 'https://[fe80::1]/hook', 'https://[::ffff:10.0.0.1]/hook']) {
      expect(await validateWebhookUrl(url), url).toMatchObject({ ok: false })
    }
  })

  it('rechaza un nombre que resuelve a loopback', async () => {
    // El nombre no delata nada; solo la resolución lo revela.
    const r = await validateWebhookUrl('https://localtest.me/hook')
    expect(r).toMatchObject({ ok: false })
  })

  it('en desarrollo se permite apuntar a la propia máquina', async () => {
    const r = await validateWebhookUrl('http://localhost:4000/hook', { allowInternal: true })
    expect(r.ok).toBe(true)
  })
})

describe('sanitizeWebhookHeaders', () => {
  it('conserva los headers propios del usuario', () => {
    expect(sanitizeWebhookHeaders({ 'X-Api-Key': 'abc', Authorization: 'Bearer x' })).toEqual({
      'X-Api-Key': 'abc',
      Authorization: 'Bearer x',
    })
  })

  it('descarta los headers que administra el cliente HTTP', () => {
    const out = sanitizeWebhookHeaders({
      Host: 'otro.com',
      'Content-Length': '0',
      'content-type': 'text/plain',
      Connection: 'close',
      'X-Propio': 'ok',
    })
    expect(out).toEqual({ 'X-Propio': 'ok' })
  })

  it('descarta valores con saltos de línea', () => {
    // Permitirían inyectar headers adicionales en el pedido.
    const out = sanitizeWebhookHeaders({ 'X-Malo': 'a\r\nX-Otro: b', 'X-Bueno': 'c' })
    expect(out).toEqual({ 'X-Bueno': 'c' })
  })

  it('ignora lo que no sea un objeto de strings', () => {
    expect(sanitizeWebhookHeaders(null)).toEqual({})
    expect(sanitizeWebhookHeaders('x')).toEqual({})
    expect(sanitizeWebhookHeaders({ a: 1, b: 'ok' })).toEqual({ b: 'ok' })
  })
})
