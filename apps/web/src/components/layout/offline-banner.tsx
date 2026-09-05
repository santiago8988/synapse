'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * Aviso fijo mientras el dispositivo está sin conexión.
 *
 * No es decoración. Con el service worker activo, una pantalla sin conexión se
 * ve igual que una con conexión, solo que con datos de hace un rato. En un
 * sistema de calidad eso no puede quedar implícito: alguien podría mirar un
 * lote "EN PROCESO" que ya se aprobó, o creer que puede completar un ensayo.
 *
 * Se apoya en `navigator.onLine`, que miente en un sentido conocido: dice que
 * hay conexión cuando hay red pero no internet. O sea que puede tardar en
 * avisar, pero no avisa de más — y avisar de más sería lo dañino acá.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const actualizar = () => setOffline(!navigator.onLine)
    actualizar()
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Sin conexión — estás viendo datos guardados. No se puede cargar ni modificar nada.</span>
    </div>
  )
}
