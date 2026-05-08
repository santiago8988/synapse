// Eventos de dominio para desacoplar side-effects de la lógica principal

export class EntryCreatedEvent {
  static readonly EVENT_NAME = 'entry.created'

  constructor(
    public readonly entryId: string,
    public readonly recordId: string,
    public readonly organizationId: string,
    public readonly createdById: string,
    public readonly data: Record<string, unknown>,
    public readonly comparisonResults: Record<string, { passed: boolean; value: unknown; description: string }>,
    public readonly record: {
      fields: Array<{
        id: string
        label: string
        fieldType: string
        isActive: boolean
      }>
      actionsAsSource: Array<{
        id: string
        targetRecordId: string
        fieldMapping: unknown
        targetRecord: {
          type: string
          periodicity: number | null
          version: number
          recipeId?: string | null
          fields: Array<{ id: string; label: string; fieldType: string; isActive: boolean; isIdentifier: boolean }>
        }
      }>
    },
  ) {}
}

export class EntryCompletedEvent {
  static readonly EVENT_NAME = 'entry.completed'

  constructor(
    public readonly entryId: string,
    public readonly recordId: string,
    public readonly organizationId: string,
    public readonly record: {
      type: string
      periodicity: number | null
    },
  ) {}
}

// InstrumentStatusChangedEvent eliminado en VFE.4 — sin consumers, redundante
// con FIELD_VALUE_CHANGED. El cambio de status del instrumento sigue logueando
// en InstrumentStatusLog (companion ISO) — solo desaparece la emisión vía
// EventEmitter2 del evento legacy.

export class NonConformityCreatedEvent {
  static readonly EVENT_NAME = 'nonConformity.created'

  constructor(
    public readonly nonConformityId: string,
    public readonly organizationId: string,
    public readonly entryId: string | null,
    public readonly title: string,
  ) {}
}

export class DocumentVersionCreatedEvent {
  static readonly EVENT_NAME = 'document.versionCreated'

  constructor(
    public readonly documentId: string,
    public readonly organizationId: string,
    public readonly previousVersion: string,
    public readonly newVersion: string,
  ) {}
}

/**
 * Se emite cuando un field específico de Entry.data cambia de valor en un
 * update. Habilita triggers de RecordAction tipo FIELD_VALUE_CHANGED
 * (ej. "cuando el field 'Estado' cambia a 'CLOSED', crear una NC").
 *
 * Un update puede generar múltiples eventos (uno por field que cambió).
 *
 * `triggeredByCascade` previene loops cuando este cambio fue causado por una
 * acción cascadeada de otra Entry; los listeners pueden filtrar para no
 * recursar salvo que la action declare `allowCascade: true`.
 *
 * `reason` es la justificación opcional del usuario (transitionReason del
 * body del PATCH) — obligatoria cuando la transition declara `requireReason`.
 * El EntryStatusLogListener la persiste para preservar el paper trail ISO.
 */
export class EntryFieldValueChangedEvent {
  static readonly EVENT_NAME = 'entry.fieldValueChanged'

  constructor(
    public readonly entryId: string,
    public readonly recordId: string,
    public readonly organizationId: string,
    public readonly fieldId: string,
    public readonly fromValue: unknown,
    public readonly toValue: unknown,
    public readonly changedById: string,
    public readonly triggeredByCascade: boolean,
    public readonly reason: string | null = null,
  ) {}
}
