import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, tap } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { AUDIT_IGNORE_KEY } from '../decorators/audit-ignore.decorator'
import { JwtPayload } from '../decorators/current-user.decorator'

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

@Injectable()
export class AuditInterceptor implements NestInterceptor {
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

    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          await this.prisma.auditLog.create({
            data: {
              organizationId: user.organizationId,
              userId: user.sub,
              action,
              entityType,
              entityId: entityId || (responseBody as { id?: string })?.id || 'unknown',
              before: method === 'POST' ? undefined : undefined, // TODO: capturar before state
              after: responseBody ? JSON.parse(JSON.stringify(responseBody)) : undefined,
              ip,
            },
          })
        } catch {
          // No bloquear la respuesta si falla el audit log
        }
      }),
    )
  }
}
