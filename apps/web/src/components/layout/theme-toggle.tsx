'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

/**
 * Alterna claro y oscuro desde la barra superior.
 *
 * Reemplaza al panel "Tweaks", que envolvía este único control útil en un panel
 * con título, dos clics y un ajuste de densidad que casi no se notaba.
 *
 * El icono muestra **a dónde vas**, no dónde estás: en claro se ve la luna
 * porque es lo que va a pasar si lo apretás.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)

  // El tema real solo se conoce en el navegador. Sin esta guarda, el servidor
  // dibuja un icono y el cliente el otro, y React avisa por la diferencia.
  useEffect(() => setMontado(true), [])

  const esOscuro = resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(esOscuro ? 'light' : 'dark')}
      aria-label={esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      title={esOscuro ? 'Tema claro' : 'Tema oscuro'}
      className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-transparent text-ink-2 transition-colors hover:bg-[var(--bg-3)] hover:text-ink-0"
    >
      {/* Antes de montar no se sabe el tema: se reserva el lugar sin dibujar
          nada, para que la barra no salte cuando aparece el icono. */}
      {montado ? (
        esOscuro ? (
          <Sun className="h-[18px] w-[18px]" />
        ) : (
          <Moon className="h-[18px] w-[18px]" />
        )
      ) : (
        <span className="h-[18px] w-[18px]" aria-hidden />
      )}
    </button>
  )
}
