'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type UserRole = 'ADMIN' | 'QUALITY_MANAGER' | 'TECHNICIAN' | 'AUDITOR'

export interface MeData {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  organizationId?: string
  organizationName?: string
  role?: UserRole
  areaId?: string | null
  areaName?: string | null
  positionId?: string | null
  positionName?: string | null
}

export const roleLabel: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  QUALITY_MANAGER: 'Quality Manager',
  TECHNICIAN: 'Técnico',
  AUDITOR: 'Auditor',
}

/** Hook global para el perfil del usuario autenticado. Cachea 5 min. */
export function useMe() {
  return useQuery<MeData>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me() as Promise<MeData>,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

/** Iniciales a partir del nombre completo: "Sofía Domínguez" → "SD" */
export function initials(name: string | undefined | null): string {
  if (!name) return '··'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '··'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Primer nombre para saludos */
export function firstName(name: string | undefined | null): string {
  if (!name) return ''
  return name.trim().split(/\s+/)[0] ?? ''
}

/** Saludo según hora local */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
