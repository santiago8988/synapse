import { Module } from '@nestjs/common'
import { EntriesController } from './entries.controller'
import { EntriesService } from './entries.service'
import { ComparisonEvaluatorService } from './services/comparison-evaluator.service'
import { FormulaEvaluatorService } from './services/formula-evaluator.service'
import { TransitionValidatorService } from './services/transition-validator.service'
import { NonConformityListener } from './listeners/non-conformity.listener'
import { RecordActionListener } from './listeners/record-action.listener'
import { DueDateListener } from './listeners/due-date.listener'
import { InstrumentListener } from './listeners/instrument.listener'
import { EntryStatusLogListener } from './listeners/entry-status-log.listener'

@Module({
  controllers: [EntriesController],
  providers: [
    EntriesService,
    ComparisonEvaluatorService,
    FormulaEvaluatorService,
    TransitionValidatorService,
    NonConformityListener,
    RecordActionListener,
    DueDateListener,
    InstrumentListener,
    EntryStatusLogListener,
  ],
  exports: [EntriesService],
})
export class EntriesModule {}
