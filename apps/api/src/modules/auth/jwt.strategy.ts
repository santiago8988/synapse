import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtPayload } from '../../common/decorators/current-user.decorator'

/**
 * Valida el JWT y —esto es lo importante— vuelve a leer la membresia de la base
 * en cada request.
 *
 * Antes `validate` devolvia el payload tal cual, sin tocar la base. El token dura
 * 7 dias y no habia forma de revocarlo: desactivar a alguien con
 * `isActive: false` no lo echaba, bajarle el rol de ADMIN no le quitaba ADMIN, y
 * el logout solo borraba el token del navegador mientras seguia siendo valido
 * contra la API. El rol y la organizacion viajaban congelados en el token.
 *
 * Con la consulta, un cambio en OrganizationUser tiene efecto en la request
 * siguiente. El costo es una query por request; a cambio `isActive: false` pasa a
 * ser una revocacion real e inmediata.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload?.sub || !payload?.organizationId) {
      throw new UnauthorizedException('Token invalido')
    }

    const membership = await this.prisma.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: payload.sub,
          organizationId: payload.organizationId,
        },
      },
      select: { role: true, areaId: true, isActive: true },
    })

    if (!membership || !membership.isActive) {
      throw new UnauthorizedException('Tu acceso a esta organizacion ya no esta vigente')
    }

    // El rol y el area salen de la base, no del token: a quien le cambiaron el
    // rol, el token viejo ya no le sirve para seguir actuando con el anterior.
    return {
      ...payload,
      role: membership.role,
      areaId: membership.areaId,
    }
  }
}
