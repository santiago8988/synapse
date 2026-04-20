import { create } from 'zustand'

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
  clearAuth: () => void
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
  clearAuth: () => {
    localStorage.removeItem('synapse_token')
    set({
      token: null,
      organizationId: null,
      organizationName: null,
      userId: null,
      role: null,
      areaId: null,
    })
  },
}))
