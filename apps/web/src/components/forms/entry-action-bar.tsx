'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Action bar que se usa debajo de un DynamicRecordForm.
 * En mobile (≤767px) se vuelve sticky-bottom con shadow elevada.
 * En desktop queda inline (flujo normal) como un footer del card.
 */
export function EntryActionBar({
  primary,
  secondary,
  danger,
  ghost,
  status,
  className,
}: {
  primary?: React.ReactNode
  secondary?: React.ReactNode
  danger?: React.ReactNode
  ghost?: React.ReactNode
  status?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('syn-entry-action-bar', className)}>
      {status && <div className="syn-eab-status">{status}</div>}
      <div className="syn-eab-buttons">
        {ghost}
        {danger}
        {secondary}
        {primary}
      </div>
    </div>
  )
}
