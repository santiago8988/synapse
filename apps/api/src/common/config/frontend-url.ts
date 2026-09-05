/**
 * Normaliza `FRONTEND_URL`.
 *
 * La variable la carga una persona copiando y pegando, y la barra de
 * direcciones del navegador muestra la URL **con** barra final. Pegada tal cual
 * rompe el CORS de una forma particularmente confusa: el redirect después del
 * login sigue funcionando —queda `.../ /callback`, doble barra, y el navegador
 * la normaliza— pero el header `Access-Control-Allow-Origin` sale con la barra
 * y ya no coincide con el `Origin` que manda el navegador, que nunca la lleva.
 *
 * El síntoma es un "Failed to fetch" en el último paso del login, con todo lo
 * difícil funcionando. Costó una tarde encontrarlo; normalizar acá cuesta tres
 * líneas.
 */

const POR_DEFECTO = 'http://localhost:3000'

export function normalizeFrontendUrl(raw: string | undefined | null): string {
  const valor = raw?.trim()
  if (!valor) return POR_DEFECTO

  // Solo se recortan barras finales. Todo lo demás se deja como está: si
  // alguien puso una URL inválida, es mejor que falle de forma visible a que
  // esta función invente una que "parece" correcta.
  const sinBarras = valor.replace(/\/+$/, '')
  return sinBarras || POR_DEFECTO
}
