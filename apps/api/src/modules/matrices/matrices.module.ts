import { Module } from '@nestjs/common'
import { MatricesController } from './matrices.controller'
import { MatricesService } from './matrices.service'

@Module({
  controllers: [MatricesController],
  providers: [MatricesService],
  exports: [MatricesService],
})
export class MatricesModule {}
