'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Qué columnas ve cada usuario en la tabla de entradas de un registro.
 *
 * Se guarda en `localStorage`, con el id del usuario en la clave. Eso último no
 * es un detalle: en planta las tablets se comparten, y sin el id el técnico del
 * turno tarde heredaría las columnas que eligió el de la mañana.
 *
 * Se guardan los campos **ocultos**, no los visibles. Si se guardaran los
 * visibles, el día que alguien agregue un campo al registro quedaría oculto
 * para siempre —no estaba en la lista— y nadie entendería por qué no aparece.
 * Guardando los ocultos, todo lo nuevo se muestra por defecto.
 *
 * Limitación asumida: la preferencia no viaja entre dispositivos. Configurar en
 * la computadora no se refleja en la tablet. Llevarlo al servidor es una tabla
 * de preferencias y un endpoint, y se puede hacer después sin tirar esto.
 */

function storageKey(userId: string, recordId: string): string {
  return `synapse_cols_${userId}_${recordId}`
}

export interface ColumnPreferences {
  /** Ids de campos que el usuario decidió ocultar. */
  hidden: Set<string>
  isHidden: (fieldId: string) => boolean
  toggle: (fieldId: string) => void
  /** Vuelve a mostrar todo. */
  reset: () => void
  /** Deja solo los campos indicados; el resto se oculta. */
  showOnly: (fieldIds: string[], allFieldIds: string[]) => void
  /** Si es false, todavía no se leyó localStorage y conviene no pintar. */
  ready: boolean
}

export function useColumnPreferences(
  userId: string | undefined,
  recordId: string,
): ColumnPreferences {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(storageKey(userId, recordId))
      setHidden(new Set(raw ? (JSON.parse(raw) as string[]) : []))
    } catch {
      // Modo privado, almacenamiento lleno o un valor corrupto: se muestran
      // todas las columnas, que es el comportamiento de siempre.
      setHidden(new Set())
    }
    setReady(true)
  }, [userId, recordId])

  const persist = useCallback(
    (next: Set<string>) => {
      setHidden(next)
      if (!userId) return
      try {
        localStorage.setItem(
          storageKey(userId, recordId),
          JSON.stringify(Array.from(next)),
        )
      } catch {
        // No poder guardar la preferencia no puede romper la pantalla.
      }
    },
    [userId, recordId],
  )

  return {
    hidden,
    ready,
    isHidden: (fieldId: string) => hidden.has(fieldId),
    toggle: (fieldId: string) => {
      const next = new Set(hidden)
      if (next.has(fieldId)) next.delete(fieldId)
      else next.add(fieldId)
      persist(next)
    },
    reset: () => persist(new Set()),
    showOnly: (fieldIds: string[], allFieldIds: string[]) => {
      const visibles = new Set(fieldIds)
      persist(new Set(allFieldIds.filter((id) => !visibles.has(id))))
    },
  }
}
