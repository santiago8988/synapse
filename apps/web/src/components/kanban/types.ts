import type { ReactNode } from 'react'

export type KanbanColor = 'gray' | 'slate' | 'blue' | 'green' | 'amber' | 'red'

export interface KanbanColumn {
  id: string
  label: string
  color: KanbanColor
  description?: string
}

export interface KanbanCard {
  id: string
  columnId: string
  title: string
  subtitle?: string
  metadata?: ReactNode
  href?: string
}

export interface KanbanTransition {
  /** id de columna origen, o "*" para cualquiera */
  from: string
  /** id de columna destino */
  to: string
  /** si true, exige reason no vacío al confirmar */
  requireReason?: boolean
}

export interface KanbanBoardProps {
  columns: KanbanColumn[]
  cards: KanbanCard[]
  /** transiciones permitidas entre columnas; si vacío, todas permitidas */
  allowedTransitions?: KanbanTransition[]
  /** se invoca al soltar la card en otra columna; si rechaza la promesa, la card vuelve */
  onCardMove: (
    cardId: string,
    fromColumnId: string,
    toColumnId: string,
    reason?: string,
  ) => Promise<void>
  isLoading?: boolean
  emptyState?: ReactNode
}
