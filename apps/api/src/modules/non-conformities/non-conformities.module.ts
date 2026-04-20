import { Module } from '@nestjs/common'
import { NonConformitiesController } from './non-conformities.controller'
import { NonConformitiesService } from './non-conformities.service'

@Module({
  controllers: [NonConformitiesController],
  providers: [NonConformitiesService],
  exports: [NonConformitiesService],
})
export class NonConformitiesModule {}
