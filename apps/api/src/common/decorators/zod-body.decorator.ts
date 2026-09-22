import { SetMetadata } from '@nestjs/common'
import type { ZodSchema } from 'zod'

export const ZOD_BODY_KEY = 'zodBody'

/**
 * Declara con que schema se valida el body de un endpoint.
 *
 * El schema no se aplica aca: lo lee `ZodValidationInterceptor`, que corre
 * global. Este decorador solo deja la metadata, igual que `@Roles()` o
 * `@Public()`.
 *
 *     @Patch(':areaId')
 *     @Roles('ADMIN', 'QUALITY_MANAGER')
 *     @ZodBody(updateAreaSchema)
 *     update(@Body() body: UpdateAreaInput) { ... }
 *
 * Por que un interceptor y no un pipe global, que seria lo obvio: un
 * `PipeTransform` global recibe solo `ArgumentMetadata` —el tipo del parametro
 * y poco mas— y **no** el `ExecutionContext`, asi que no tiene forma de leer la
 * metadata del handler para saber que schema le toca. Un interceptor si lo
 * recibe. La alternativa era `@Body(new ZodValidationPipe(schema))` en cada
 * firma, que funciona pero repite el ruido en cada endpoint y no deja
 * inspeccionar despues que endpoints quedaron sin cubrir.
 */
export const ZodBody = (schema: ZodSchema) => SetMetadata(ZOD_BODY_KEY, schema)
