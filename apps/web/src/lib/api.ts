const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('synapse_token')
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('synapse_token')
    window.location.href = '/login'
    throw new Error('No autorizado')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Error del servidor' }))
    throw new Error(error.message || `Error ${res.status}`)
  }

  return res.json()
}

export const api = {
  auth: {
    me: () => fetchApi('/auth/me'),
    switchOrg: (organizationId: string) =>
      fetchApi('/auth/switch-org', {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      }),
  },
  organizations: {
    get: <T = unknown>(id: string) => fetchApi<T>(`/organizations/${id}`),
    update: (id: string, data: { name?: string }) =>
      fetchApi(`/organizations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getWhitelist: <T = unknown>(id: string) => fetchApi<T>(`/organizations/${id}/whitelist`),
    addWhitelist: (id: string, data: { email: string; role?: string }) =>
      fetchApi(`/organizations/${id}/whitelist`, { method: 'POST', body: JSON.stringify(data) }),
    removeWhitelist: (id: string, whitelistId: string) =>
      fetchApi(`/organizations/${id}/whitelist/${whitelistId}`, { method: 'DELETE' }),
    getUsers: <T = unknown>(id: string) => fetchApi<T>(`/organizations/${id}/users`),
    updateUser: (id: string, userId: string, data: { role?: string; areaId?: string | null; positionId?: string | null; phone?: string | null }) =>
      fetchApi(`/organizations/${id}/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    getPositions: <T = unknown>(orgId: string) => fetchApi<T>(`/organizations/${orgId}/positions`),
    createPosition: (orgId: string, name: string) =>
      fetchApi(`/organizations/${orgId}/positions`, { method: 'POST', body: JSON.stringify({ name }) }),
    deletePosition: (orgId: string, positionId: string) =>
      fetchApi(`/organizations/${orgId}/positions/${positionId}`, { method: 'DELETE' }),
    setAreaLeader: (orgId: string, areaId: string, leaderId: string | null) =>
      fetchApi(`/organizations/${orgId}/areas/${areaId}/leader`, { method: 'PATCH', body: JSON.stringify({ leaderId }) }),
    getTrainings: <T = unknown>(orgId: string, userId: string) =>
      fetchApi<T>(`/organizations/${orgId}/users/${userId}/trainings`),
    addTraining: (orgId: string, userId: string, data: { name: string; description?: string; provider?: string; completedAt: string; expiresAt?: string }) =>
      fetchApi(`/organizations/${orgId}/users/${userId}/trainings`, { method: 'POST', body: JSON.stringify(data) }),
    removeTraining: (orgId: string, userId: string, trainingId: string) =>
      fetchApi(`/organizations/${orgId}/users/${userId}/trainings/${trainingId}`, { method: 'DELETE' }),
  },
  areas: {
    getTree: (orgId: string) => fetchApi(`/organizations/${orgId}/areas`),
    create: (orgId: string, data: { name: string; parentId?: string }) =>
      fetchApi(`/organizations/${orgId}/areas`, { method: 'POST', body: JSON.stringify(data) }),
    update: (orgId: string, areaId: string, data: { name?: string }) =>
      fetchApi(`/organizations/${orgId}/areas/${areaId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (orgId: string, areaId: string) =>
      fetchApi(`/organizations/${orgId}/areas/${areaId}`, { method: 'DELETE' }),
  },
  documents: {
    list: () => fetchApi('/documents'),
    get: (id: string) => fetchApi(`/documents/${id}`),
    create: (data: { title: string; code?: string; content?: string }) =>
      fetchApi('/documents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { title?: string; code?: string; content?: string; status?: string }) =>
      fetchApi(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createVersion: (id: string) =>
      fetchApi(`/documents/${id}/version`, { method: 'POST' }),
  },
  records: {
    list: (archived = false) => fetchApi(`/records${archived ? '?archived=true' : ''}`),
    get: (id: string) => fetchApi(`/records/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi('/records', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi(`/records/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    archive: (id: string) =>
      fetchApi(`/records/${id}`, { method: 'DELETE' }),
    restore: (id: string) =>
      fetchApi(`/records/${id}/restore`, { method: 'POST' }),
    addField: (recordId: string, data: Record<string, unknown>) =>
      fetchApi(`/records/${recordId}/fields`, { method: 'POST', body: JSON.stringify(data) }),
    updateField: (recordId: string, fieldId: string, data: Record<string, unknown>) =>
      fetchApi(`/records/${recordId}/fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteField: (recordId: string, fieldId: string) =>
      fetchApi(`/records/${recordId}/fields/${fieldId}`, { method: 'DELETE' }),
    /** Mapa global de flujos de la organizacion (todas las RecordAction). */
    flowsOverview: <T = unknown>() => fetchApi<T>('/records/flows/overview'),
    listActions: (recordId: string) =>
      fetchApi(`/records/${recordId}/actions`),
    addAction: (recordId: string, data: Record<string, unknown>) =>
      fetchApi(`/records/${recordId}/actions`, { method: 'POST', body: JSON.stringify(data) }),
    updateAction: (recordId: string, actionId: string, data: Record<string, unknown>) =>
      fetchApi(`/records/${recordId}/actions/${actionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteAction: (recordId: string, actionId: string) =>
      fetchApi(`/records/${recordId}/actions/${actionId}`, { method: 'DELETE' }),
  },
  entries: {
    list: (recordId: string) => fetchApi(`/records/${recordId}/entries`),
    get: (recordId: string, entryId: string) => fetchApi(`/records/${recordId}/entries/${entryId}`),
    create: (recordId: string, body: { data: Record<string, unknown>; revisionDate?: string; lotNumber?: string; sampleCode?: string; client?: string }) =>
      fetchApi(`/records/${recordId}/entries`, { method: 'POST', body: JSON.stringify(body) }),
    update: (recordId: string, entryId: string, data: Record<string, unknown>, transitionReason?: string) =>
      fetchApi(`/records/${recordId}/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(transitionReason ? { data, transitionReason } : { data }),
      }),
    complete: (recordId: string, entryId: string) =>
      fetchApi(`/records/${recordId}/entries/${entryId}/complete`, { method: 'POST' }),
  },
  instruments: {
    list: (filters?: { status?: string; recordId?: string }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.recordId) params.set('recordId', filters.recordId)
      const qs = params.toString()
      return fetchApi(`/instruments${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => fetchApi(`/instruments/${id}`),
    patterns: () => fetchApi('/instruments/patterns'),
    real: () => fetchApi('/instruments/real'),
    changeStatus: (id: string, data: { status: string; reason?: string }) =>
      fetchApi(`/instruments/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
    listCertificates: (id: string) =>
      fetchApi(`/instruments/${id}/certificates`),
  },
  nonConformities: {
    list: (filters?: { status?: string; entryId?: string }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.entryId) params.set('entryId', filters.entryId)
      const qs = params.toString()
      return fetchApi(`/non-conformities${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => fetchApi(`/non-conformities/${id}`),
    create: (data: { title: string; description: string; entryId?: string; assignedToId?: string }) =>
      fetchApi('/non-conformities', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      fetchApi(`/non-conformities/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    addCorrectiveAction: (id: string, data: { description: string; dueDate?: string }) =>
      fetchApi(`/non-conformities/${id}/corrective-actions`, { method: 'POST', body: JSON.stringify(data) }),
    completeCorrectiveAction: (id: string, actionId: string) =>
      fetchApi(`/non-conformities/${id}/corrective-actions/${actionId}/complete`, { method: 'POST' }),
  },
  audit: {
    list: (filters?: Record<string, string | number | undefined>) => {
      const params = new URLSearchParams()
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined) params.set(k, String(v))
        })
      }
      const qs = params.toString()
      return fetchApi(`/audit${qs ? `?${qs}` : ''}`)
    },
  },
  recipes: {
    list: () => fetchApi('/recipes'),
    get: (id: string) => fetchApi(`/recipes/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi('/recipes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi(`/recipes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi(`/recipes/${id}`, { method: 'DELETE' }),
  },
  batches: {
    list: (filters?: { status?: string; recordId?: string }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.recordId) params.set('recordId', filters.recordId)
      const qs = params.toString()
      return fetchApi(`/batches${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => fetchApi(`/batches/${id}`),
    changeStatus: (id: string, data: { status: string; producedQuantity?: number; unit?: string; reason?: string }) =>
      fetchApi(`/batches/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { producedQuantity?: number; unit?: string }) =>
      fetchApi(`/batches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    consumeStock: (id: string, consumptions: Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>) =>
      fetchApi(`/batches/${id}/consume-stock`, { method: 'POST', body: JSON.stringify({ consumptions }) }),
    checkStock: (id: string) => fetchApi(`/batches/${id}/stock-check`),
    start: (id: string) => fetchApi(`/batches/${id}/start`, { method: 'POST' }),
    complete: (id: string, data: { producedQuantity: number; unit: string; consumptions: Array<{ product: string; lotNumber: string; quantity: number; unit: string }> }) =>
      fetchApi(`/batches/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
    assignInstrument: (id: string, data: { label: string; instrumentId: string; order: number }) =>
      fetchApi(`/batches/${id}/instrument-assignments`, { method: 'POST', body: JSON.stringify(data) }),
    unassignInstrument: (id: string, assignmentId: string) =>
      fetchApi(`/batches/${id}/instrument-assignments/${assignmentId}`, { method: 'DELETE' }),
  },
  methods: {
    search: (query?: string) => {
      const qs = query ? `?search=${encodeURIComponent(query)}` : ''
      return fetchApi(`/methods${qs}`)
    },
    create: (data: Record<string, unknown>) =>
      fetchApi('/methods', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi(`/methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi(`/methods/${id}`, { method: 'DELETE' }),
  },
  matrices: {
    list: () => fetchApi('/matrices'),
    get: (id: string) => fetchApi(`/matrices/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi('/matrices', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi(`/matrices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi(`/matrices/${id}`, { method: 'DELETE' }),
  },
  samples: {
    list: (filters?: { status?: string; recordId?: string }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.recordId) params.set('recordId', filters.recordId)
      const qs = params.toString()
      return fetchApi(`/samples${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => fetchApi(`/samples/${id}`),
    changeStatus: (id: string, status: string) =>
      fetchApi(`/samples/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    saveResults: (id: string, results: Record<string, unknown>) =>
      fetchApi(`/samples/${id}/results`, { method: 'POST', body: JSON.stringify({ results }) }),
    saveConditions: (id: string, conditions: Record<string, unknown>) =>
      fetchApi(`/samples/${id}/conditions`, { method: 'POST', body: JSON.stringify({ conditions }) }),
    assignInstrument: (id: string, data: { label: string; instrumentId: string; order: number }) =>
      fetchApi(`/samples/${id}/instrument-assignments`, { method: 'POST', body: JSON.stringify(data) }),
    unassignInstrument: (id: string, assignmentId: string) =>
      fetchApi(`/samples/${id}/instrument-assignments/${assignmentId}`, { method: 'DELETE' }),
  },
  calibrationTemplates: {
    list: () => fetchApi('/calibration-templates'),
    get: (id: string) => fetchApi(`/calibration-templates/${id}`),
    create: (data: Record<string, unknown>) =>
      fetchApi('/calibration-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      fetchApi(`/calibration-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      fetchApi(`/calibration-templates/${id}`, { method: 'DELETE' }),
  },
  calibrations: {
    list: (filters?: { status?: string; entryId?: string }) => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.entryId) params.set('entryId', filters.entryId)
      const qs = params.toString()
      return fetchApi(`/calibrations${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => fetchApi(`/calibrations/${id}`),
    changeStatus: (id: string, status: string) =>
      fetchApi(`/calibrations/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
    saveResults: (id: string, results: Record<string, unknown>) =>
      fetchApi(`/calibrations/${id}/results`, { method: 'POST', body: JSON.stringify({ results }) }),
    addPattern: (id: string, patternEntryId: string) =>
      fetchApi(`/calibrations/${id}/patterns`, { method: 'POST', body: JSON.stringify({ patternEntryId }) }),
    removePattern: (id: string, calibrationPatternId: string) =>
      fetchApi(`/calibrations/${id}/patterns/${calibrationPatternId}`, { method: 'DELETE' }),
  },
  stock: {
    summary: () => fetchApi('/stock'),
    available: (product: string) => fetchApi(`/stock/available?product=${encodeURIComponent(product)}`),
    movements: (filters?: { product?: string; lotNumber?: string }) => {
      const params = new URLSearchParams()
      if (filters?.product) params.set('product', filters.product)
      if (filters?.lotNumber) params.set('lotNumber', filters.lotNumber)
      const qs = params.toString()
      return fetchApi(`/stock/movements${qs ? `?${qs}` : ''}`)
    },
  },
  approval: {
    getQualityRoles: () => fetchApi('/approval/quality-roles'),
    assignQualityRole: (data: { organizationUserId: string; role: string }) =>
      fetchApi('/approval/quality-roles', { method: 'POST', body: JSON.stringify(data) }),
    removeQualityRole: (id: string) =>
      fetchApi(`/approval/quality-roles/${id}`, { method: 'DELETE' }),
    submit: (data: { entityType: string; entityId: string }) =>
      fetchApi('/approval/submit', { method: 'POST', body: JSON.stringify(data) }),
    decide: (requestId: string, data: { decision: string; comments?: string }) =>
      fetchApi(`/approval/requests/${requestId}/decide`, { method: 'POST', body: JSON.stringify(data) }),
    getRequests: (entityType?: string) => {
      const qs = entityType ? `?entityType=${entityType}` : ''
      return fetchApi(`/approval/requests${qs}`)
    },
    getRequest: (id: string) => fetchApi(`/approval/requests/${id}`),
    getPending: () => fetchApi('/approval/pending'),
  },
  dashboard: {
    stats: () => fetchApi('/dashboard/stats'),
  },
}
