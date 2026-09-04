import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, from, switchMap, tap } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { AUDIT_IGNORE_KEY } from '../decorators/audit-ignore.decorator'
import { JwtPayload } from '../decorators/current-user.decorator'
import {
  AUDITABLE_ENTITIES,
  buildTenantWhere,
  redactSensitive,
} from './audit-entities'

// Mapeo de nombre de controller a entityType
function extractEntityType(controllerName: string): string {
  return controllerName
    .replace('Controller', '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toUpperCase()
}

// Mapeo de método HTTP a acción
function methodToAction(method: string, path: string): string {
  const entity = path.split('/')[1] || 'unknown'
  switch (method) {
    case 'POST':
      return path.includes('complete')
        ? `${entity}.completed`
        : path.includes('status')
          ? `${entity}.status_changed`
          : `${entity}.created`
    case 'PATCH':
    case 'PUT':
      return `${entity}.updated`
    case 'DELETE':
      return `${entity}.deleted`
    default:
      return `${entity}.${method.toLowerCase()}`
  }
}

/** Forma mínima de un delegate de Prisma para leer una fila. */
interface ReadableDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<unknown>
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name)

  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()
    const method: string = request.method

    // Solo loguear operaciones de escritura
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle()
    }

    // Verificar si el endpoint tiene @AuditIgnore()
    const isIgnored = this.reflector.getAllAndOverride<boolean>(AUDIT_IGNORE_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isIgnored) return next.handle()

    const user = request.user as JwtPayload | undefined
    if (!user) return next.handle()

    const controllerName = context.getClass().name
    const entityType = extractEntityType(controllerName)
    const entityId = request.params?.id || request.params?.entryId || null
    const action = methodToAction(method, request.path)
    const ip = request.ip || request.headers['x-forwarded-for'] || null

    // El estado previo hay que leerlo ANTES de que el handler mute la fila.
    // Sin `before`, el AuditLog cuenta que algo cambió pero no desde qué, que
    // es justo lo que una auditoría ISO necesita reconstruir.
    return from(this.captureBefore(entityType, entityId, user.organizationId)).pipe(
      switchMap((before) =>
        next.handle().pipe(
          tap(async (responseBody) => {
            try {
              await this.prisma.auditLog.create({
                data: {
                  organizationId: user.organizationId,
                  userId: user.sub,
                  action,
                  entityType,
                  entityId:
                    entityId || (responseBody as { id?: string })?.id || 'unknown',
                  before: before ?? undefined,
                  after: responseBody
                    ? (redactSensitive(
                        JSON.parse(JSON.stringify(responseBody)),
                      ) as object)
                    : undefined,
                  ip,
                },
              })
            } catch {
              // No bloquear la respuesta si falla el audit log
            }
          }),
        ),
      ),
    )
  }

  /**
   * Lee la fila tal como está antes de la mutación.
   *
   * Devuelve null —y el log simplemente queda sin `before`— cuando la entidad
   * no está mapeada, cuando no hay id (una creación no tiene estado previo) o
   * cuando la fila no pertenece a la organización del usuario. Nunca lanza: un
   * problema acá no puede tumbar la operación que el usuario pidió.
   */
  private async captureBefore(
    entityType: string,
    entityId: string | null,
    organizationId: string,
  ): Promise<object | null> {
    if (!entityId) return null

    const entity = AUDITABLE_ENTITIES[entityType]
    if (!entity) return null

    try {
      const delegate = (this.prisma as unknown as Record<string, ReadableDelegate>)[
        entity.model
      ]
      if (!delegate?.findFirst) return null

      const row = await delegate.findFirst({
        where: buildTenantWhere(entity, entityId, organizationId),
      })
      if (!row) return null

      return redactSensitive(JSON.parse(JSON.stringify(row))) as object
    } catch (err) {
      this.logger.warn(
        `No se pudo capturar el estado previo de ${entityType}/${entityId}: ${String(err)}`,
      )
      return null
    }
  }
}
