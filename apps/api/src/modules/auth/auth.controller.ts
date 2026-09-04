import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ConfigService } from '@nestjs/config'
import { AuthCodeService } from './auth-code.service'

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private authCodes: AuthCodeService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Redirige a Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const { user, memberships } = req.user as {
      user: { id: string }
      memberships: Array<{ organizationId: string }>
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')

    // Nunca se redirige con el JWT en la URL: viajaba a los logs del servidor
    // de Next, al historial del navegador y al header Referer, y dura 7 dias.
    // En su lugar va un codigo opaco de un solo uso que vence en 2 minutos.
    const code = this.authCodes.issue(
      user.id,
      memberships.map((m) => m.organizationId),
    )

    if (memberships.length === 1) {
      res.redirect(`${frontendUrl}/callback?code=${code}`)
    } else {
      res.redirect(`${frontendUrl}/select-org?code=${code}`)
    }
  }

  /**
   * Organizaciones disponibles para un codigo de login. No lo consume: la
   * pantalla de seleccion necesita mostrarlas antes de que el usuario elija.
   */
  @Post('exchange/organizations')
  async exchangeOrganizations(@Body() body: { code?: string }) {
    if (!body?.code) throw new BadRequestException('Falta el código')
    const entry = this.authCodes.peek(body.code)
    if (!entry) {
      throw new UnauthorizedException('El código de acceso venció o ya fue usado')
    }
    return this.authService.listOrganizations(entry.userId, entry.organizationIds)
  }

  /**
   * Canjea el codigo por el JWT. El codigo se consume: un segundo intento
   * falla, asi que aunque quede en un log ya no sirve.
   */
  @Post('exchange')
  async exchange(@Body() body: { code?: string; organizationId?: string }) {
    if (!body?.code) throw new BadRequestException('Falta el código')

    const entry = this.authCodes.consume(body.code)
    if (!entry) {
      throw new UnauthorizedException('El código de acceso venció o ya fue usado')
    }

    // Con una sola organizacion no hace falta elegir; con varias, la elegida
    // tiene que estar entre las que el codigo autoriza. generateToken vuelve a
    // validar la membresia contra la base, asi que esto es defensa en capas.
    const organizationId = body.organizationId ?? entry.organizationIds[0]
    if (!entry.organizationIds.includes(organizationId)) {
      throw new UnauthorizedException('No tenés acceso a esa organización')
    }

    const token = await this.authService.generateToken(entry.userId, organizationId)
    return { token }
  }

  @Post('switch-org')
  @UseGuards(JwtAuthGuard)
  async switchOrg(
    @CurrentUser() user: JwtPayload,
    // Solo organizationId: el usuario sale del JWT. Aceptar un userId por body
    // seria un bypass de autenticacion (cualquiera pediria token de cualquiera).
    @Body() body: { organizationId: string },
  ) {
    const token = await this.authService.generateToken(user.sub, body.organizationId)
    return { token }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub, user.organizationId)
  }
}
