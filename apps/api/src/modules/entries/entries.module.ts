import { Module } from '@nestjs/common'
import { EntriesController } from './entries.controller'
import { EntriesService } from './entries.service'
import { ComparisonEvaluatorService } from './services/comparison-evaluator.service'
import { FormulaEvaluatorService } from './services/formula-evaluator.service'
import { NonConformityListener } from './listeners/non-conformity.listener'
import { RecordActionListener } from './listeners/record-action.listener'
import { DueDateListener } from './listeners/due-date.listener'
import { InstrumentListener } from './listeners/instrument.listener'

@Module({
  controllers: [EntriesController],
  providers: [
    EntriesService,
    ComparisonEvaluatorService,
    FormulaEvaluatorService,
    NonConformityListener,
    RecordActionListener,
    DueDateListener,
    InstrumentListener,
  ],
  exports: [EntriesService],
})
export class EntriesModule {}
