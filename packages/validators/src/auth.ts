import { z } from 'zod'

/**
 * Codigo de login de un solo uso, el que emite `auth-code.service` al volver de
 * Google. Se acota el largo y se exige que sea string; **no** se valida el
 * formato a proposito.
 *
 * Un regex de base64url de 43 caracteres seria mas ajustado y no compraria
 * nada: el codigo se busca en un Map, la busqueda es O(1) y el codigo es de un
 * solo uso. Lo que si costaria es el mensaje de error. Hoy un codigo roto
 * —un link cortado al copiarlo, por ejemplo— responde "El código de acceso
 * venció o ya fue usado", que le dice al usuario qué hacer. Validado por forma,
 * pasaria a ser un "Error de validación" generico en la unica pantalla donde la
 * persona todavia no entro y no tiene a donde ir.
 *
 * El largo si importa: es superficie publica, sin rate limiting todavia
 * (Fase 1.2).
 */
const codigoDeLogin = z.string().min(1).max(200)

export const exchangeOrganizationsSchema = z.object({
  code: codigoDeLogin,
})

export const exchangeSchema = z.object({
  code: codigoDeLogin,
  // Con una sola organizacion no viaja; con varias, la elegida tiene que estar
  // entre las que el codigo autoriza, y eso lo revalida el handler contra la
  // lista del codigo y despues `generateToken` contra la base.
  organizationId: z.string().cuid().optional(),
})

/**
 * Solo `organizationId`. El usuario sale del JWT: aceptar un `userId` por body
 * seria un bypass de autenticacion, y que el schema no lo declare significa que
 * ahora tampoco llega al handler si alguien lo manda.
 */
export const switchOrgSchema = z.object({
  organizationId: z.string().cuid(),
})

export type ExchangeOrganizationsInput = z.infer<typeof exchangeOrganizationsSchema>
export type ExchangeInput = z.infer<typeof exchangeSchema>
export type SwitchOrgInput = z.infer<typeof switchOrgSchema>
