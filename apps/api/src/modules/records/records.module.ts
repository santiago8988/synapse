import { Module } from '@nestjs/common'
import { RecordsController } from './records.controller'
import { RecordActionsController } from './record-actions.controller'
import { RecordsService } from './records.service'

@Module({
  controllers: [RecordsController, RecordActionsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
