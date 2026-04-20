import { Module } from '@nestjs/common'
import { CalibrationTemplatesController } from './calibration-templates.controller'
import { CalibrationTemplatesService } from './calibration-templates.service'

@Module({
  controllers: [CalibrationTemplatesController],
  providers: [CalibrationTemplatesService],
  exports: [CalibrationTemplatesService],
})
export class CalibrationTemplatesModule {}
