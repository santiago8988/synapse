import {
  Injectable,
  Inject,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable } from 'rxjs'
import { ZodError, ZodSchema } from 'zod'
import { ZOD_BODY_KEY } from '../decorators/zod-body.decorator'

/**
 * Valida el body contra el schema declarado con `@ZodBody()` y **reemplaza**
 * `request.body` por el resultado del parseo.
 *
 * El reemplazo es el punto, no la validacion. Un `z.object()` descarta las
 * claves que no declara, asi que lo que llega al handler —y de ahi a Prisma— ya
 * no puede traer campos de mas. Eso cierra por construccion la clase de
 * mass assignment que aparecio tres veces en la auditoria de seguridad:
 * `areas.update`, `organizations.update` y `documents.update` pasaban el body
 * entero a Prisma, y como el tipo TS se borra en runtime, un `organizationId`
 * en el body movia el recurso a otro tenant.
 *
 * Las listas blancas a mano que hay en esos tres services quedan redundantes
 * cuando el endpoint declara su schema. Se dejan igual: defensa en capas, y el
 * service no deberia depender de que alguien se haya acordado del decorador.
 *
 * Corre antes que `AuditInterceptor` (orden de registro en `app.module.ts`),
 * asi que lo que se escribe en el `AuditLog` es el body ya limpio y no el
 * crudo.
 *
 * Por ahora valida solo donde hay schema declarado. La migracion es endpoint
 * por endpoint; el objetivo es que quedarse sin declarar sea la excepcion
 * visible, igual que paso con `@Public()` cuando los guards se volvieron
 * globales.
 */
@Injectable()
export class ZodValidationInterceptor implements NestInterceptor {
  // `@Inject` explicito y no inyeccion por tipo: la inyeccion implicita depende
  // de `design:paramtypes`, que emite tsc con `emitDecoratorMetadata`. Vitest
  // transpila con esbuild, que no lo soporta, asi que bajo test el Reflector
  // llegaba `undefined` y todo endpoint validado respondia 500. En produccion
  // andaba —compila `nest build`—, que es la peor version del problema: verde
  // en los tests unitarios y roto solo donde no se mira.
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const schema = this.reflector.getAllAndOverride<ZodSchema | undefined>(ZOD_BODY_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!schema) return next.handle()

    const request = context.switchToHttp().getRequest()

    // Multipart no se puede validar desde aca, y es importante que se note.
    //
    // Los interceptores globales corren ANTES que los de ruta, asi que cuando
    // este llega, el `FileInterceptor` todavia no paso y multer no parseo nada:
    // `request.body` esta vacio. Se validaria un objeto vacio y despues multer
    // lo pisaria con los campos reales, sin filtrar. Verificado: un campo no
    // declarado llega intacto al handler.
    //
    // O sea que poner `@ZodBody` en un endpoint de subida no valida: no falla,
    // no avisa, simplemente no hace nada. Un 400 explicito convierte eso en un
    // error que se ve en la primera prueba. Los endpoints multipart validan su
    // parte en el handler (`assertUploadedPdf`).
    const contentType = String(request.headers?.['content-type'] ?? '')
    if (contentType.startsWith('multipart/')) {
      throw new BadRequestException(
        'Este endpoint no acepta multipart/form-data',
      )
    }

    try {
      // Un body ausente se valida como objeto vacio: si el schema exige algo,
      // que lo diga el schema y no un TypeError.
      request.body = schema.parse(request.body ?? {})
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Error de validación',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        })
      }
      throw error
    }

    return next.handle()
  }
}
