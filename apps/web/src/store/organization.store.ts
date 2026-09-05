import { create } from 'zustand'
import { clearSession } from '@/lib/session'

interface OrganizationState {
  token: string | null
  organizationId: string | null
  organizationName: string | null
  userId: string | null
  role: string | null
  areaId: string | null
  setAuth: (data: {
    token: string
    organizationId: string
    organizationName: string
    userId: string
    role: string
    areaId: string | null
  }) => void
  clearAuth: () => Promise<void>
}

export const useOrganizationStore = create<OrganizationState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null,
  organizationId: null,
  organizationName: null,
  userId: null,
  role: null,
  areaId: null,
  setAuth: (data) =>
    set({
      token: data.token,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      userId: data.userId,
      role: data.role,
      areaId: data.areaId,
    }),
  /**
   * Devuelve la promesa de `clearSession`: quien cierre sesión tiene que
   * esperarla antes de navegar, o el borrado de las cachés se corta a la mitad.
   */
  clearAuth: () => {
    const borrado = clearSession()
    set({
      token: null,
      organizationId: null,
      organizationName: null,
      userId: null,
      role: null,
      areaId: null,
    })
    return borrado
  },
}))
