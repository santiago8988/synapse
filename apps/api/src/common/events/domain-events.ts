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

export class InstrumentStatusChangedEvent {
  static readonly EVENT_NAME = 'instrument.statusChanged'

  constructor(
    public readonly instrumentId: string,
    public readonly organizationId: string,
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly reason: string | null,
    public readonly changedById: string,
  ) {}
}

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
