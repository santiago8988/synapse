import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { ApprovalModule } from '../approval/approval.module'

@Module({
  // Las aprobaciones del tablero son las que le tocan al usuario, y quien sabe
  // eso es ApprovalService: depende de los QualityRole, no del arbol de areas.
  imports: [ApprovalModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
