import { Controller, Get, Post, Body, UseGuards, Req, Res } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ConfigService } from '@nestjs/config'

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
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

    if (memberships.length === 1) {
      // Una sola org → generar token directo
      const token = await this.authService.generateToken(user.id, memberships[0].organizationId)
      res.redirect(`${frontendUrl}/callback?token=${token}`)
    } else {
      // Múltiples orgs → redirigir a selector
      const orgs = memberships.map((m) => m.organizationId).join(',')
      res.redirect(`${frontendUrl}/select-org?userId=${user.id}&orgs=${orgs}`)
    }
  }

  @Post('switch-org')
  @UseGuards(JwtAuthGuard)
  async switchOrg(
    @CurrentUser() user: JwtPayload,
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
