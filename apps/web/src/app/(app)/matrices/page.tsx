'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Microscope,
  Plus,
  Search,
  Trash2,
  Pencil,
  ChevronRight,
  Loader2,
  X,
  Send,
  Wrench,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Parameter {
  name: string
  method?: string
  unit?: string
  minValue?: number | null
  maxValue?: number | null
  order: number
}

interface Condition {
  label: string
  fieldType: string
  unit?: string
  options?: string[]
  order: number
}

interface RequiredInstrument {
  label: string
  order: number
}

interface Matrix {
  id: string
  name: string
  code: string | null
  description: string | null
  version: number
  status: string
  parameters: Parameter[]
  conditions: Condition[]
  requiredInstruments?: RequiredInstrument[]
  _count?: { samples: number }
}

const statusChipCls: Record<string, string> = {
  DRAFT: 'syn-chip-draft',
  IN_REVIEW: 'syn-chip-warn',
  ACTIVE: 'syn-chip-ok',
}
const statusLabel: Record<string, string> = {
  DRAFT: 'Borrador',
  IN_REVIEW: 'En revisión',
  ACTIVE: 'Activa',
}

export default function MatricesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingMatrix, setEditingMatrix] = useState<Matrix | null>(null)
  const [selectedMatrix, setSelectedMatrix] = useState<Matrix | null>(null)

  const { data: matrices = [], isLoading } = useQuery({
    queryKey: ['matrices'],
    queryFn: () => api.matrices.list() as Promise<Matrix[]>,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.matrices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrices'] })
      toast.success('Matriz eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.approval.submit({ entityType: 'MATRIX', entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrices'] })
      toast.success('Matriz enviada a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = matrices.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.code && m.code.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Matrices</div>
          <h1>
            Matrices <span className="italic">de muestra.</span>
          </h1>
          <p className="sub">
            Tipos de muestra con sus parámetros de análisis y condiciones de muestreo. Las usás al crear muestras o al definir registros tipo Muestra.
          </p>
        </div>
        <div className="syn-ph-actions">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="syn-btn syn-btn-primary"
          >
            <Plus className="h-3 w-3" /> Nueva matriz
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--ink-3)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar matrices…"
            className="h-[38px] w-full rounded-[10px] border pl-10 pr-3 text-[13px] outline-none"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              color: 'var(--ink-0)',
            }}
          />
        </div>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'matriz' : 'matrices'}
        </div>
      </div>

      {(showForm || editingMatrix) && (
        <div className="mb-5">
          <MatrixForm
            matrix={editingMatrix}
            onClose={() => {
              setShowForm(false)
              setEditingMatrix(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['matrices'] })
              setShowForm(false)
              setEditingMatrix(null)
            }}
          />
        </div>
      )}

      {isLoading ? (
        <div
          className="rounded-[14px] border p-8"
          style={{
            background: 'var(--bg-1)',
            borderColor: 'var(--line)',
            color: 'var(--ink-3)',
          }}
        >
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="syn-card">
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <Microscope className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
            <div
              className="text-[24px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              {search ? (
                <>
                  Sin <span className="italic">coincidencias.</span>
                </>
              ) : (
                <>
                  Aún no hay <span className="italic">matrices.</span>
                </>
              )}
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {search
                ? 'Probá cambiar la búsqueda.'
                : 'Creá tu primera matriz para definir los parámetros de análisis por tipo de muestra.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="syn-card">
          {filtered.map((matrix, idx) => {
            const chipCls = statusChipCls[matrix.status] ?? 'syn-chip-draft'
            return (
              <div
                key={matrix.id}
                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--line)' }}
              >
                <div
                  onClick={() => setSelectedMatrix(matrix)}
                  className="flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-3)]"
                >
                  <Microscope
                    className="h-5 w-5"
                    style={{ color: 'var(--ink-3)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="truncate text-[14px] font-medium"
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {matrix.name}
                    </div>
                    <div
                      className="mt-0.5 font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {matrix.code && <>{matrix.code} · </>}v{matrix.version} ·{' '}
                      {matrix.parameters.length} parámetros
                    </div>
                  </div>
                  {matrix._count && matrix._count.samples > 0 && (
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {matrix._count.samples} muestras
                    </span>
                  )}
                  <span className={`syn-chip ${chipCls}`}>
                    {statusLabel[matrix.status] ?? matrix.status}
                  </span>
                  {matrix.status === 'DRAFT' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        submitMutation.mutate(matrix.id)
                      }}
                      disabled={submitMutation.isPending}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      title="Enviar a revisión"
                    >
                      <Send className="h-3 w-3" /> Revisar
                    </button>
                  )}
                  <ChevronRight
                    className="h-4 w-4"
                    style={{ color: 'var(--ink-3)' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedMatrix && (
        <MatrixDetailModal
          matrix={selectedMatrix}
          onClose={() => setSelectedMatrix(null)}
          onEdit={() => {
            setEditingMatrix(selectedMatrix)
            setSelectedMatrix(null)
          }}
          onSubmit={() => {
            submitMutation.mutate(selectedMatrix.id)
            setSelectedMatrix(null)
          }}
          onDelete={() => {
            if (confirm(`¿Eliminar la matriz "${selectedMatrix.name}"?`)) {
              deleteMutation.mutate(selectedMatrix.id)
              setSelectedMatrix(null)
            }
          }}
          isSubmitting={submitMutation.isPending}
        />
      )}
    </div>
  )
}

// ============================================================================
// MatrixDetailModal
// ============================================================================

function MatrixDetailModal({
  matrix,
  onClose,
  onEdit,
  onSubmit,
  onDelete,
  isSubmitting,
}: {
  matrix: Matrix
  onClose: () => void
  onEdit: () => void
  onSubmit: () => void
  onDelete: () => void
  isSubmitting: boolean
}) {
  const chipCls = statusChipCls[matrix.status] ?? 'syn-chip-draft'
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[14px] border"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start gap-4 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <div className="flex-1 min-w-0">
            <div className="kicker mb-1">· Matriz</div>
            <h2
              className="truncate text-[20px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              {matrix.name}
            </h2>
            <div
              className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px]"
              style={{ color: 'var(--ink-3)' }}
            >
              {matrix.code && <span>{matrix.code}</span>}
              <span className={`syn-chip ${chipCls}`}>
                {statusLabel[matrix.status] ?? matrix.status}
              </span>
              <span className="font-mono">v{matrix.version}</span>
              {matrix._count && matrix._count.samples > 0 && (
                <span>{matrix._count.samples} muestras</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {matrix.description && (
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {matrix.description}
            </p>
          )}

          {matrix.parameters.length > 0 && (
            <div>
              <div className="kicker mb-2">· Parámetros de análisis</div>
              <div
                className="rounded-[8px] border overflow-x-auto"
                style={{ borderColor: 'var(--line)' }}
              >
                <table className="syn-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Parámetro</th>
                      <th>Método</th>
                      <th>Unidad</th>
                      <th style={{ textAlign: 'right' }}>Min</th>
                      <th style={{ textAlign: 'right' }}>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.parameters.map((p, i) => (
                      <tr key={i}>
                        <td
                          data-label="#"
                          className="font-mono"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {p.order}
                        </td>
                        <td data-label="Parámetro" data-role="identifier">
                          <span
                            style={{ color: 'var(--ink-0)', fontWeight: 500 }}
                          >
                            {p.name}
                          </span>
                        </td>
                        <td
                          data-label="Método"
                          className="font-mono"
                          style={{ color: 'var(--ink-2)', fontSize: 12 }}
                        >
                          {p.method || '—'}
                        </td>
                        <td data-label="Unidad" style={{ color: 'var(--ink-2)' }}>
                          {p.unit || '—'}
                        </td>
                        <td
                          data-label="Min"
                          className="font-mono"
                          style={{ textAlign: 'right', color: 'var(--ink-2)' }}
                        >
                          {p.minValue != null ? p.minValue : '—'}
                        </td>
                        <td
                          data-label="Max"
                          className="font-mono"
                          style={{ textAlign: 'right', color: 'var(--ink-2)' }}
                        >
                          {p.maxValue != null ? p.maxValue : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {matrix.conditions?.length > 0 && (
            <div>
              <div className="kicker mb-2">· Condiciones de muestreo</div>
              <div
                className="rounded-[8px] border"
                style={{ borderColor: 'var(--line)' }}
              >
                {matrix.conditions.map((c, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <span
                      className="w-6 font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {c.order}
                    </span>
                    <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                      {c.label}
                    </span>
                    <span className="syn-chip syn-chip-draft">{c.fieldType}</span>
                    {c.unit && (
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {c.unit}
                      </span>
                    )}
                    {c.options && c.options.length > 0 && (
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        {c.options.join(' · ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {matrix.requiredInstruments && matrix.requiredInstruments.length > 0 && (
            <div>
              <div className="kicker mb-2">· Instrumentos requeridos</div>
              <div
                className="rounded-[8px] border"
                style={{ borderColor: 'var(--line)' }}
              >
                {matrix.requiredInstruments.map((ri, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 text-[13px]"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: 'var(--primary-soft)',
                        color: 'var(--primary-hex)',
                      }}
                    >
                      <Wrench className="h-3 w-3" />
                    </span>
                    <span
                      className="flex-1 font-medium"
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {ri.label}
                    </span>
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      #{ri.order}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex flex-wrap gap-2 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          {matrix.status !== 'IN_REVIEW' && (
            <button type="button" onClick={onEdit} className="syn-btn syn-btn-ghost">
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          {matrix.status === 'DRAFT' && (
            <>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="syn-btn syn-btn-primary"
              >
                <Send className="h-3 w-3" /> Enviar a revisión
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="syn-btn syn-btn-ghost"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="syn-btn syn-btn-ghost ml-auto"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MethodSelector (sin cambios funcionales, restyle)
// ============================================================================

interface OrgMethod {
  id: string
  orgId: string | null
  code: string
  name: string
  parameter: string
  unit: string | null
  isGlobal: boolean
  sourceRef: string | null
}

function MethodSelector({ onSelect }: { onSelect: (method: OrgMethod) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: methods = [] } = useQuery({
    queryKey: ['methods', query],
    queryFn: () => api.methods.search(query || undefined) as Promise<OrgMethod[]>,
  })

  const globals = methods.filter((m) => m.orgId === null)
  const own = methods.filter((m) => m.orgId !== null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: 'var(--ink-3)' }}
        />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar método (ej: pH, APHA…)"
          className="syn-input"
          style={{ paddingLeft: 40 }}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border"
          style={{
            background: 'var(--bg-1)',
            borderColor: 'var(--line-2)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {globals.length > 0 && (
            <>
              <div
                className="sticky top-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
              >
                Globales
              </div>
              {globals.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    onSelect(m)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors"
                  style={{ color: 'var(--ink-1)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div className="flex-1">
                    <span
                      style={{ color: 'var(--ink-0)', fontWeight: 500 }}
                    >
                      {m.code}
                    </span>
                    <span className="ml-2" style={{ color: 'var(--ink-3)' }}>
                      {m.parameter}
                    </span>
                  </div>
                  {m.unit && (
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {m.unit}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
          {own.length > 0 && (
            <>
              <div
                className="sticky top-0 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
                style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
              >
                Tu organización
              </div>
              {own.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    onSelect(m)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] transition-colors"
                  style={{ color: 'var(--ink-1)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div className="flex-1">
                    <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                      {m.code}
                    </span>
                    <span className="ml-2" style={{ color: 'var(--ink-3)' }}>
                      {m.parameter}
                    </span>
                  </div>
                  {m.unit && (
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {m.unit}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
          {methods.length === 0 && (
            <div
              className="px-3 py-4 text-center text-[13px]"
              style={{ color: 'var(--ink-3)' }}
            >
              No se encontraron métodos
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              onClick={() => {
                setShowCreate(true)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] transition-colors"
              style={{ color: 'var(--primary-hex)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Crear nuevo método
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateMethodModal
          onClose={() => setShowCreate(false)}
          onCreated={(method) => {
            onSelect(method)
            setShowCreate(false)
          }}
          initialQuery={query}
        />
      )}
    </div>
  )
}

// ============================================================================
// CreateMethodModal
// ============================================================================

function CreateMethodModal({
  onClose,
  onCreated,
  initialQuery,
}: {
  onClose: () => void
  onCreated: (method: OrgMethod) => void
  initialQuery: string
}) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState(initialQuery)
  const [methodName, setMethodName] = useState('')
  const [parameter, setParameter] = useState('')
  const [unit, setUnit] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!code.trim() || !methodName.trim() || !parameter.trim()) return
    setSaving(true)
    try {
      const created = (await api.methods.create({
        code: code.trim(),
        name: methodName.trim(),
        parameter: parameter.trim(),
        unit: unit.trim() || undefined,
        sourceRef: sourceRef.trim() || undefined,
      })) as OrgMethod
      queryClient.invalidateQueries({ queryKey: ['methods'] })
      toast.success('Método creado')
      onCreated(created)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(3px)' }}
    >
      <div
        className="flex w-full flex-col bg-[var(--bg-1)] shadow-[var(--shadow-lg)] sm:max-w-lg sm:rounded-[14px]"
        style={{ border: '1px solid var(--line)' }}
      >
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--line)' }}
        >
          <div>
            <div className="kicker">· Nuevo método analítico</div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 20,
                color: 'var(--ink-0)',
                marginTop: 2,
              }}
            >
              Agregar al <span className="italic">catálogo.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="syn-field">
              <span className="syn-field-label">
                Código <span className="req">*</span>
              </span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: APHA 4500-H"
                className="syn-input"
              />
            </div>
            <div className="syn-field">
              <span className="syn-field-label">
                Parámetro <span className="req">*</span>
              </span>
              <input
                value={parameter}
                onChange={(e) => setParameter(e.target.value)}
                placeholder="Ej: pH"
                className="syn-input"
              />
            </div>
          </div>
          <div className="syn-field">
            <span className="syn-field-label">
              Nombre del método <span className="req">*</span>
            </span>
            <input
              value={methodName}
              onChange={(e) => setMethodName(e.target.value)}
              placeholder="Ej: Potencial de Hidrógeno — Electrométrico"
              className="syn-input"
            />
          </div>
          <div className="syn-field">
            <span className="syn-field-label">Unidad</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="mg/L"
              className="syn-input"
            />
            <p
              className="mt-1 text-[11px]"
              style={{ color: 'var(--ink-3)' }}
            >
              Las tolerancias (min/max) se definen en cada matriz que use este método.
            </p>
          </div>
          <div className="syn-field">
            <span className="syn-field-label">Referencia</span>
            <input
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              placeholder="Ej: APHA Standard Methods 24th Ed."
              className="syn-input"
            />
          </div>
        </div>
        <div
          className="flex gap-2 border-t px-5 py-4"
          style={{ borderColor: 'var(--line)' }}
        >
          <button
            type="button"
            onClick={handleCreate}
            disabled={
              saving || !code.trim() || !methodName.trim() || !parameter.trim()
            }
            className="syn-btn syn-btn-primary"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Crear método
          </button>
          <button type="button" onClick={onClose} className="syn-btn syn-btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MatrixForm
// ============================================================================

function MatrixForm({
  matrix,
  onClose,
  onSuccess,
}: {
  matrix?: Matrix | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!matrix
  const [name, setName] = useState(matrix?.name || '')
  const [code, setCode] = useState(matrix?.code || '')
  const [description, setDescription] = useState(matrix?.description || '')
  const [parameters, setParameters] = useState<Parameter[]>(matrix?.parameters || [])
  const [conditions, setConditions] = useState<Condition[]>(matrix?.conditions || [])
  const [requiredInstruments, setRequiredInstruments] = useState<RequiredInstrument[]>(
    matrix?.requiredInstruments || [],
  )
  const [saving, setSaving] = useState(false)

  const addFromMethod = (method: OrgMethod) => {
    setParameters((prev) => [
      ...prev,
      {
        name: method.parameter,
        method: method.code,
        unit: method.unit || '',
        // Las tolerancias son específicas de esta matriz — el usuario las define acá.
        minValue: null,
        maxValue: null,
        order: prev.length + 1,
      },
    ])
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (parameters.length === 0) {
      toast.error('Agregá al menos un parámetro')
      return
    }
    const emptyNames = parameters.filter((p) => !p.name.trim())
    if (emptyNames.length > 0) {
      toast.error('Todos los parámetros deben tener nombre')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        parameters: parameters.map((p, i) => ({
          name: p.name.trim(),
          method: p.method?.trim() || undefined,
          unit: p.unit?.trim() || undefined,
          minValue: p.minValue ?? undefined,
          maxValue: p.maxValue ?? undefined,
          order: i + 1,
        })),
        conditions: conditions
          .filter((c) => c.label.trim())
          .map((c, i) => ({
            label: c.label.trim(),
            fieldType: c.fieldType,
            unit: c.unit?.trim() || undefined,
            options: c.options?.filter((o) => o.trim()) || undefined,
            order: i + 1,
          })),
        requiredInstruments: requiredInstruments
          .filter((r) => r.label.trim())
          .map((r, i) => ({ label: r.label.trim(), order: i + 1 })),
      }
      if (isEditing) {
        await api.matrices.update(matrix!.id, payload)
        toast.success('Matriz actualizada')
      } else {
        await api.matrices.create(payload)
        toast.success('Matriz creada')
      }
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="syn-card">
      <div className="syn-card-head">
        <div>
          <div className="eyebrow">
            · {isEditing ? 'Editar matriz' : 'Nueva matriz'}
          </div>
          <h3 style={{ marginTop: 6 }}>
            {isEditing ? (
              <>
                Modificá <span className="italic">parámetros + condiciones.</span>
              </>
            ) : (
              <>
                Definí el tipo de <span className="italic">muestra.</span>
              </>
            )}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
        </button>
      </div>
      <div style={{ padding: '16px 20px 18px' }} className="space-y-5">
        {/* Datos básicos */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="syn-field">
            <span className="syn-field-label">
              Nombre <span className="req">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Agua potable"
              className="syn-input"
            />
          </div>
          <div className="syn-field">
            <span className="syn-field-label">Código</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: MAT-AP"
              className="syn-input"
            />
          </div>
          <div className="syn-field">
            <span className="syn-field-label">Descripción</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Agua para consumo humano"
              className="syn-input"
            />
          </div>
        </div>

        {/* Agregar parámetro desde catálogo */}
        <div>
          <div className="kicker mb-1">· Agregar parámetro desde catálogo</div>
          <p
            className="mb-2 text-[12px]"
            style={{ color: 'var(--ink-3)' }}
          >
            Buscá un método y se agrega como parámetro con sus valores por defecto
          </p>
          <MethodSelector onSelect={addFromMethod} />
        </div>

        {/* Parámetros agregados */}
        {parameters.length > 0 && (
          <div>
            <div className="kicker mb-2">· Parámetros · {parameters.length}</div>
            <div className="space-y-2">
              {parameters.map((param, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-[8px] border p-3"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-6 text-center font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {i + 1}
                    </span>
                    <input
                      value={param.name}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setParameters(updated)
                      }}
                      placeholder="Parámetro"
                      className="syn-input"
                      style={{ flex: 1 }}
                    />
                    {param.method && (
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        {param.method}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setParameters(parameters.filter((_, j) => j !== i))
                      }
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px', color: 'var(--danger)' }}
                      title="Eliminar"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-8">
                    <input
                      value={param.unit || ''}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = { ...updated[i], unit: e.target.value }
                        setParameters(updated)
                      }}
                      placeholder="Unidad"
                      className="syn-input"
                      style={{ width: 120, minHeight: 32, padding: '6px 10px' }}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={param.minValue ?? ''}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = {
                          ...updated[i],
                          minValue: e.target.value ? parseFloat(e.target.value) : null,
                        }
                        setParameters(updated)
                      }}
                      placeholder="Min"
                      className="syn-input font-mono"
                      style={{ width: 96, minHeight: 32, padding: '6px 10px' }}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={param.maxValue ?? ''}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = {
                          ...updated[i],
                          maxValue: e.target.value ? parseFloat(e.target.value) : null,
                        }
                        setParameters(updated)
                      }}
                      placeholder="Max"
                      className="syn-input font-mono"
                      style={{ width: 96, minHeight: 32, padding: '6px 10px' }}
                    />
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      Límites
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Condiciones de muestreo */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="kicker">· Condiciones de muestreo</div>
              <p
                className="mt-1 text-[12px]"
                style={{ color: 'var(--ink-3)' }}
              >
                Campos que se completan al tomar la muestra (opcional)
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setConditions([
                  ...conditions,
                  {
                    label: '',
                    fieldType: 'TEXT',
                    unit: '',
                    options: [],
                    order: conditions.length + 1,
                  },
                ])
              }
              className="syn-btn syn-btn-ghost"
              style={{ padding: '6px 10px' }}
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
          {conditions.length > 0 && (
            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-[8px] border p-3"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="w-6 text-center font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {i + 1}
                    </span>
                    <input
                      value={cond.label}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[i] = { ...updated[i], label: e.target.value }
                        setConditions(updated)
                      }}
                      placeholder="Ej: Punto de muestreo"
                      className="syn-input"
                      style={{ flex: 1, minWidth: 200 }}
                    />
                    <select
                      value={cond.fieldType}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[i] = {
                          ...updated[i],
                          fieldType: e.target.value,
                          options: e.target.value === 'DROPDOWN' ? [''] : [],
                        }
                        setConditions(updated)
                      }}
                      className="syn-select"
                      style={{ width: 140 }}
                    >
                      <option value="TEXT">Texto</option>
                      <option value="NUMBER">Número</option>
                      <option value="DATE">Fecha</option>
                      <option value="DROPDOWN">Opciones</option>
                    </select>
                    {cond.fieldType === 'NUMBER' && (
                      <input
                        value={cond.unit || ''}
                        onChange={(e) => {
                          const updated = [...conditions]
                          updated[i] = { ...updated[i], unit: e.target.value }
                          setConditions(updated)
                        }}
                        placeholder="Unidad"
                        className="syn-input"
                        style={{ width: 100, minHeight: 32, padding: '6px 10px' }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setConditions(conditions.filter((_, j) => j !== i))
                      }
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px', color: 'var(--danger)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {cond.fieldType === 'DROPDOWN' && (
                    <div className="pl-8 space-y-1">
                      {(cond.options || ['']).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            value={opt}
                            onChange={(e) => {
                              const updated = [...conditions]
                              const opts = [...(updated[i].options || [])]
                              opts[oi] = e.target.value
                              updated[i] = { ...updated[i], options: opts }
                              setConditions(updated)
                            }}
                            placeholder={`Opción ${oi + 1}`}
                            className="syn-input"
                            style={{ flex: 1, minHeight: 30, padding: '4px 8px', fontSize: 12 }}
                          />
                          {(cond.options || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...conditions]
                                updated[i] = {
                                  ...updated[i],
                                  options: (updated[i].options || []).filter(
                                    (_, j) => j !== oi,
                                  ),
                                }
                                setConditions(updated)
                              }}
                              style={{ color: 'var(--danger)' }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...conditions]
                          updated[i] = {
                            ...updated[i],
                            options: [...(updated[i].options || []), ''],
                          }
                          setConditions(updated)
                        }}
                        className="text-[12px]"
                        style={{ color: 'var(--primary-hex)' }}
                      >
                        + Agregar opción
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instrumentos requeridos */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="kicker">· Instrumentos requeridos</div>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Labels de equipos que se van a usar en el ensayo (ej: Termómetro, pHmetro). Se asignan al instrumento real en cada muestra.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setRequiredInstruments([
                  ...requiredInstruments,
                  { label: '', order: requiredInstruments.length + 1 },
                ])
              }
              className="syn-btn syn-btn-ghost"
              style={{ padding: '6px 10px' }}
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
          {requiredInstruments.length > 0 && (
            <div className="space-y-2">
              {requiredInstruments.map((ri, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-[8px] border p-2.5"
                  style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
                >
                  <span
                    className="w-6 text-center font-mono text-[11px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {i + 1}
                  </span>
                  <input
                    value={ri.label}
                    onChange={(e) => {
                      const updated = [...requiredInstruments]
                      updated[i] = { ...updated[i], label: e.target.value }
                      setRequiredInstruments(updated)
                    }}
                    placeholder="Ej: Termómetro"
                    className="syn-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRequiredInstruments(requiredInstruments.filter((_, j) => j !== i))
                    }
                    className="syn-btn syn-btn-ghost"
                    style={{ padding: '4px 8px', color: 'var(--danger)' }}
                    aria-label="Eliminar"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim() || parameters.length === 0}
            className="syn-btn syn-btn-primary"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear matriz'}
          </button>
          <button type="button" onClick={onClose} className="syn-btn syn-btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
