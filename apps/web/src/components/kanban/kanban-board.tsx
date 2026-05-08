'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type {
  KanbanBoardProps,
  KanbanCard,
  KanbanColor,
  KanbanColumn,
  KanbanTransition,
} from './types'

const columnHeaderColors: Record<KanbanColor, string> = {
  gray: 'border-slate-300 bg-slate-100/70 text-slate-700 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200',
  slate: 'border-slate-400 bg-slate-100/70 text-slate-800 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-100',
  blue: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200',
  green: 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200',
  amber: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200',
  red: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200',
}

const columnBodyColors: Record<KanbanColor, string> = {
  gray: 'bg-slate-50/40 dark:bg-slate-900/20',
  slate: 'bg-slate-50/40 dark:bg-slate-900/20',
  blue: 'bg-blue-50/30 dark:bg-blue-950/10',
  green: 'bg-green-50/30 dark:bg-green-950/10',
  amber: 'bg-amber-50/30 dark:bg-amber-950/10',
  red: 'bg-red-50/30 dark:bg-red-950/10',
}

function isTransitionAllowed(
  transitions: KanbanTransition[] | undefined,
  fromId: string,
  toId: string,
): { allowed: boolean; requireReason: boolean } {
  if (fromId === toId) return { allowed: false, requireReason: false }
  if (!transitions || transitions.length === 0) {
    return { allowed: true, requireReason: false }
  }
  const match = transitions.find(
    (t) => (t.from === fromId || t.from === '*') && t.to === toId,
  )
  return {
    allowed: !!match,
    requireReason: !!match?.requireReason,
  }
}

interface DraggableCardProps {
  card: KanbanCard
  isDragging: boolean
}

function DraggableCard({ card, isDragging }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
    data: { columnId: card.columnId },
  })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  }

  const inner = (
    <Card className="cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md">
      <CardContent className="space-y-2 p-3">
        <p className="font-medium leading-snug text-sm">{card.title}</p>
        {card.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-2">{card.subtitle}</p>
        )}
        {card.metadata && (
          <div className="pt-1 text-xs text-muted-foreground">{card.metadata}</div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {card.href && !isDragging ? (
        <Link href={card.href} onClick={(e) => e.stopPropagation()}>
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  )
}

interface DroppableColumnProps {
  column: KanbanColumn
  cards: KanbanCard[]
  activeCardId: string | null
  isOverColumn: boolean
}

function DroppableColumn({ column, cards, activeCardId }: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id })

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl border bg-card sm:w-80">
      <div
        className={`flex items-center justify-between rounded-t-xl border-b px-3 py-2 ${columnHeaderColors[column.color]}`}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{column.label}</span>
          <span className="rounded-full bg-background/60 px-2 py-0.5 text-xs font-medium">
            {cards.length}
          </span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 rounded-b-xl p-3 transition-colors ${columnBodyColors[column.color]} ${
          isOver ? 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : ''
        }`}
        style={{ minHeight: 120 }}
      >
        {cards.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">
            Sin tarjetas
          </p>
        )}
        {cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            isDragging={activeCardId === card.id}
          />
        ))}
      </div>
    </div>
  )
}

interface ReasonDialogState {
  cardId: string
  fromColumnId: string
  toColumnId: string
}

interface ReasonDialogProps {
  state: ReasonDialogState
  onConfirm: (reason: string) => Promise<void>
  onCancel: () => void
  fromLabel: string
  toLabel: string
}

function ReasonDialog({ onConfirm, onCancel, fromLabel, toLabel }: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await onConfirm(reason.trim())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Confirmar transición</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          De <span className="font-medium text-foreground">{fromLabel}</span> a{' '}
          <span className="font-medium text-foreground">{toLabel}</span>. Indicá el motivo del cambio.
        </p>
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Motivo *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: acción correctiva ejecutada y verificada"
            rows={3}
            autoFocus
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!reason.trim() || submitting}>
            {submitting ? 'Aplicando...' : 'Confirmar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function KanbanBoard({
  columns,
  cards,
  allowedTransitions,
  onCardMove,
  isLoading,
  emptyState,
}: KanbanBoardProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<string, string>>({})
  const [reasonDialog, setReasonDialog] = useState<ReasonDialogState | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const cardsWithOverrides = useMemo(
    () =>
      cards.map((c) =>
        optimisticOverrides[c.id] ? { ...c, columnId: optimisticOverrides[c.id] } : c,
      ),
    [cards, optimisticOverrides],
  )

  const cardsByColumn = useMemo(() => {
    const map = new Map<string, KanbanCard[]>()
    for (const col of columns) map.set(col.id, [])
    for (const card of cardsWithOverrides) {
      const list = map.get(card.columnId)
      if (list) list.push(card)
    }
    return map
  }, [columns, cardsWithOverrides])

  const activeCard = useMemo(
    () => (activeCardId ? cardsWithOverrides.find((c) => c.id === activeCardId) : null),
    [activeCardId, cardsWithOverrides],
  )

  // Limpiar overrides cuando la data real ya refleja el cambio.
  // Evita el flicker entre "API respondió OK" y "el refetch trajo el dato nuevo".
  useEffect(() => {
    setOptimisticOverrides((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [cardId, override] of Object.entries(prev)) {
        const card = cards.find((c) => c.id === cardId)
        // si la card real ya está en la columna del override, o si la card desapareció
        if (!card || card.columnId === override) {
          delete next[cardId]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [cards])

  const applyMove = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string, reason?: string) => {
      // optimista: mover ya
      setOptimisticOverrides((prev) => ({ ...prev, [cardId]: toColumnId }))
      try {
        await onCardMove(cardId, fromColumnId, toColumnId, reason)
        // NO removemos el override acá; el useEffect lo hace cuando la data real
        // (props.cards) ya refleja el cambio. Eso evita el flicker.
      } catch {
        // revertir inmediato si falla
        setOptimisticOverrides((prev) => {
          const next = { ...prev }
          delete next[cardId]
          return next
        })
      }
    },
    [onCardMove],
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null)
    const cardId = String(event.active.id)
    const overId = event.over?.id ? String(event.over.id) : null
    if (!overId) return

    const card = cardsWithOverrides.find((c) => c.id === cardId)
    if (!card) return
    const fromColumnId = card.columnId
    const toColumnId = overId
    if (fromColumnId === toColumnId) return

    const { allowed, requireReason } = isTransitionAllowed(
      allowedTransitions,
      fromColumnId,
      toColumnId,
    )
    if (!allowed) return

    if (requireReason) {
      setReasonDialog({ cardId, fromColumnId, toColumnId })
      return
    }

    void applyMove(cardId, fromColumnId, toColumnId)
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 w-72 shrink-0 animate-pulse rounded-xl border bg-muted/50 sm:w-80"
          />
        ))}
      </div>
    )
  }

  if (cards.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  const reasonDialogColumns = reasonDialog
    ? {
        from: columns.find((c) => c.id === reasonDialog.fromColumnId)?.label ?? '',
        to: columns.find((c) => c.id === reasonDialog.toColumnId)?.label ?? '',
      }
    : null

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              cards={cardsByColumn.get(column.id) ?? []}
              activeCardId={activeCardId}
              isOverColumn={false}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard && (
            <Card className="w-72 shadow-lg sm:w-80">
              <CardContent className="space-y-2 p-3">
                <p className="font-medium leading-snug text-sm">{activeCard.title}</p>
                {activeCard.subtitle && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {activeCard.subtitle}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </DragOverlay>
      </DndContext>
      {reasonDialog && reasonDialogColumns && (
        <ReasonDialog
          state={reasonDialog}
          fromLabel={reasonDialogColumns.from}
          toLabel={reasonDialogColumns.to}
          onCancel={() => setReasonDialog(null)}
          onConfirm={async (reason) => {
            await applyMove(
              reasonDialog.cardId,
              reasonDialog.fromColumnId,
              reasonDialog.toColumnId,
              reason,
            )
            setReasonDialog(null)
          }}
        />
      )}
    </>
  )
}
