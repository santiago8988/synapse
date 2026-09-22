import { Injectable, ExecutionContext } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

/**
 * Se registra como guard global en `app.module.ts`, así que el default de la API
 * es "requiere JWT" y no "abierto": un controller nuevo nace protegido y hay que
 * marcarlo con `@Public()` a propósito para abrirlo. Antes los guards se
 * aplicaban controller por controller con `@UseGuards`, y olvidarse en uno solo
 * lo dejaba sin autenticación.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    // Los controllers siguen declarando `@UseGuards(JwtAuthGuard, ...)`. Como el
    // guard global ya corrió y dejó el usuario en la request, volver a pasar por
    // passport repetiría la verificación del token y —lo caro— la consulta de
    // revocación de `JwtStrategy.validate` una segunda vez por request.
    // `request.user` solo lo escribe passport del lado del servidor; no hay
    // header ni body que lo pueda plantar desde afuera.
    const request = context.switchToHttp().getRequest()
    if (request.user) return true

    return super.canActivate(context)
  }
}
