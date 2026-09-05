import { describe, it, expect } from 'vitest'
import { normalizeFrontendUrl } from './frontend-url'

/**
 * El caso que motivó esto: `FRONTEND_URL` cargada con barra final —copiada de
 * la barra de direcciones del navegador, que siempre la muestra— hacía que el
 * header `Access-Control-Allow-Origin` saliera con barra y no coincidiera con
 * el `Origin` del navegador, que nunca la lleva.
 *
 * Lo insidioso es que el resto seguía funcionando: el redirect después del
 * login quedaba con doble barra y el navegador la normalizaba. Fallaba solo el
 * canje del código, con un "Failed to fetch" que no señala a ningún lado.
 */

describe('normalizeFrontendUrl', () => {
  it('recorta la barra final', () => {
    expect(normalizeFrontendUrl('https://synapse.vercel.app/')).toBe(
      'https://synapse.vercel.app',
    )
  })

  it('recorta varias barras finales', () => {
    expect(normalizeFrontendUrl('https://synapse.vercel.app///')).toBe(
      'https://synapse.vercel.app',
    )
  })

  it('deja intacta una URL que ya está bien', () => {
    expect(normalizeFrontendUrl('https://synapse.vercel.app')).toBe(
      'https://synapse.vercel.app',
    )
  })

  it('recorta espacios alrededor', () => {
    // Copiar y pegar arrastra espacios con más frecuencia de la que uno cree.
    expect(normalizeFrontendUrl('  https://synapse.vercel.app/  ')).toBe(
      'https://synapse.vercel.app',
    )
  })

  it('no toca las barras del medio', () => {
    // Un origen no debería tener path, pero si alguien lo puso, recortarlo
    // seria inventar una URL distinta de la que se configuró.
    expect(normalizeFrontendUrl('https://ejemplo.com/app/')).toBe('https://ejemplo.com/app')
  })

  it('sin valor cae al default de desarrollo', () => {
    expect(normalizeFrontendUrl(undefined)).toBe('http://localhost:3000')
    expect(normalizeFrontendUrl(null)).toBe('http://localhost:3000')
    expect(normalizeFrontendUrl('')).toBe('http://localhost:3000')
    expect(normalizeFrontendUrl('   ')).toBe('http://localhost:3000')
  })

  it('un valor que es solo barras cae al default', () => {
    // Recortarlas dejaría una cadena vacía, y `origin: ''` en el CORS deshabilita
    // silenciosamente el acceso desde cualquier origen.
    expect(normalizeFrontendUrl('/')).toBe('http://localhost:3000')
    expect(normalizeFrontendUrl('///')).toBe('http://localhost:3000')
  })

  it('no valida ni corrige el resto', () => {
    // Si la URL está mal, es mejor que falle de forma visible a que esta
    // función invente una que "parece" correcta.
    expect(normalizeFrontendUrl('no-es-una-url')).toBe('no-es-una-url')
  })
})
