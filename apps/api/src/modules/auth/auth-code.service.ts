import { Injectable, Logger } from '@nestjs/common'
import * as crypto from 'crypto'

/**
 * Códigos de un solo uso para el intercambio post-OAuth.
 *
 * Antes el callback de Google redirigía a `/callback?token=<JWT>`. Ese JWT dura
 * 7 días y viajaba en la query string, así que quedaba escrito en los logs del
 * servidor de Next, en el historial del navegador y en el header Referer de
 * cualquier recurso externo que la página cargara. Cualquiera con acceso a esos
 * logs podía hacerse pasar por el usuario durante una semana.
 *
 * Ahora se redirige con un código opaco que:
 *   - no sirve para autenticar nada por sí mismo,
 *   - se canjea una sola vez (el segundo intento falla),
 *   - vence en 2 minutos.
 *
 * Aunque quede en un log, para cuando alguien lo lea ya no vale.
 *
 * LIMITACIÓN CONOCIDA: el almacén es en memoria del proceso. Alcanza para una
 * sola instancia de la API, que es el caso hoy. Con más de una instancia detrás
 * de un balanceador, el canje puede caer en un proceso distinto al que emitió
 * el código y fallar. Cuando se escale, esto va a Redis — el resto del flujo no
 * cambia. No se usa Redis ahora porque no está cableado en el proyecto.
 */

interface AuthCodeEntry {
  userId: string
  /** Organizaciones que el usuario puede elegir al canjear. */
  organizationIds: string[]
  expiresAt: number
}

const CODE_TTL_MS = 2 * 60 * 1000
const SWEEP_INTERVAL_MS = 60 * 1000

@Injectable()
export class AuthCodeService {
  private readonly logger = new Logger(AuthCodeService.name)
  private readonly codes = new Map<string, AuthCodeEntry>()

  constructor() {
    // Los códigos canjeados se borran solos; esto limpia los que nunca se
    // usaron, para que el Map no crezca sin límite.
    const timer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS)
    timer.unref?.()
  }

  /** Emite un código para el usuario y las organizaciones que puede elegir. */
  issue(userId: string, organizationIds: string[]): string {
    const code = crypto.randomBytes(32).toString('base64url')
    this.codes.set(code, {
      userId,
      organizationIds,
      expiresAt: Date.now() + CODE_TTL_MS,
    })
    return code
  }

  /**
   * Lee un código sin consumirlo. Lo usa la pantalla de selección de
   * organización para mostrar las opciones antes de que el usuario elija.
   */
  peek(code: string): AuthCodeEntry | null {
    const entry = this.codes.get(code)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.codes.delete(code)
      return null
    }
    return entry
  }

  /**
   * Consume el código. Devuelve null si no existe, si venció o si ya se usó:
   * el caller responde lo mismo en los tres casos para no filtrar cuál fue.
   */
  consume(code: string): AuthCodeEntry | null {
    const entry = this.peek(code)
    if (!entry) return null
    this.codes.delete(code)
    return entry
  }

  private sweep() {
    const now = Date.now()
    let removed = 0
    for (const [code, entry] of this.codes) {
      if (entry.expiresAt < now) {
        this.codes.delete(code)
        removed++
      }
    }
    if (removed > 0) {
      this.logger.debug(`Códigos de login vencidos descartados: ${removed}`)
    }
  }
}
