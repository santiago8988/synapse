import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export interface JwtPayload {
  sub: string
  email: string
  organizationId: string
  role: string
  areaId: string | null
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext): JwtPayload | string | null => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as JwtPayload
    return data ? user[data] : user
  },
)
