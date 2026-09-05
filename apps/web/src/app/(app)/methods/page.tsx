'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FlaskConical,
  Plus,
  Search,
  Trash2,
  Pencil,
  Loader2,
  X,
  Globe,
  Building2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

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

export default function MethodsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<OrgMethod | null>(null)
  const [filter, setFilter] = useState<'all' | 'global' | 'own'>('all')

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['methods', search],
    queryFn: () => api.methods.search(search || undefined) as Promise<OrgMethod[]>,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.methods.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['methods'] })
      toast.success('Método eliminado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = methods.filter((m) => {
    if (filter === 'global') return m.orgId === null
    if (filter === 'own') return m.orgId !== null
    return true
  })

  const globals = filtered.filter((m) => m.orgId === null)
  const own = filtered.filter((m) => m.orgId !== null)

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Métodos</div>
          <h1>
            Métodos <span className="italic">analíticos.</span>
          </h1>
          <p className="sub">
            Catálogo de tu organización + métodos globales compartidos. Los usás al configurar matrices de muestra.
          </p>
        </div>
        <div className="syn-ph-actions">
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
            className="syn-btn syn-btn-primary"
          >
            <Plus className="h-3 w-3" /> Nuevo método
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
            placeholder="Buscar por código, nombre o parámetro…"
            className="h-[38px] w-full rounded-[10px] border pl-10 pr-3 text-[13px] outline-none"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              color: 'var(--ink-0)',
            }}
          />
        </div>
        <div
          className="inline-flex rounded-[10px] p-1"
          style={{ background: 'var(--bg-3)' }}
        >
          {(
            [
              ['all', 'Todos'],
              ['own', 'Propios'],
              ['global', 'Globales'],
            ] as const
          ).map(([k, label]) => (
            <button
              type="button"
              key={k}
              onClick={() => setFilter(k)}
              className="rounded-[7px] px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: filter === k ? 'var(--bg-1)' : 'transparent',
                boxShadow: filter === k ? 'var(--shadow-xs)' : undefined,
                color: filter === k ? 'var(--ink-0)' : 'var(--ink-2)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'método' : 'métodos'}
        </div>
      </div>

      {(showForm || editing) && (
        <div className="mb-5">
          <MethodForm
            method={editing}
            onClose={() => {
              setShowForm(false)
              setEditing(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['methods'] })
              setShowForm(false)
              setEditing(null)
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
            <FlaskConical className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
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
                  Catálogo <span className="italic">vacío.</span>
                </>
              )}
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {search
                ? 'Probá cambiar los filtros o la búsqueda.'
                : 'Agregá métodos propios o importá del catálogo global.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {own.length > 0 && (
            <div className="syn-card">
              <div className="syn-card-head">
                <div>
                  <div className="eyebrow flex items-center gap-1.5">
                    <Building2 className="h-3 w-3" /> Tu organización · {own.length}
                  </div>
                  <h3 style={{ marginTop: 6 }}>
                    Métodos <span className="italic">propios.</span>
                  </h3>
                </div>
              </div>
              <div className="syn-table-wrap">
                <table className="syn-table">
                  <thead>
                    <tr>
                      <th>Código · Nombre</th>
                      <th>Parámetro</th>
                      <th>Unidad</th>
                      <th>Referencia</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {own.map((m) => (
                      <tr key={m.id}>
                        <td data-label="Código · Nombre" data-role="identifier">
                          <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                            {m.code}
                          </span>
                          <div
                            className="mt-0.5 text-[11.5px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {m.name}
                          </div>
                        </td>
                        <td data-label="Parámetro" style={{ color: 'var(--ink-1)' }}>
                          {m.parameter}
                        </td>
                        <td data-label="Unidad" style={{ color: 'var(--ink-2)' }}>
                          {m.unit || <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td data-label="Referencia">
                          {m.sourceRef ? (
                            <span className="syn-chip syn-chip-draft">{m.sourceRef}</span>
                          ) : (
                            <span style={{ color: 'var(--ink-4)' }}>—</span>
                          )}
                        </td>
                        <td data-label="" style={{ textAlign: 'right' }}>
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(m)
                                setShowForm(false)
                              }}
                              className="syn-btn syn-btn-subtle"
                              style={{ padding: '6px 8px' }}
                              title="Editar"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`¿Eliminar el método "${m.code}"?`)) {
                                  deleteMutation.mutate(m.id)
                                }
                              }}
                              className="syn-btn syn-btn-subtle"
                              style={{ padding: '6px 8px', color: 'var(--danger)' }}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {globals.length > 0 && (
            <div className="syn-card">
              <div className="syn-card-head">
                <div>
                  <div className="eyebrow flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> Globales · {globals.length}
                  </div>
                  <h3 style={{ marginTop: 6 }}>
                    Métodos <span className="italic">compartidos.</span>
                  </h3>
                </div>
              </div>
              <div className="syn-table-wrap">
                <table className="syn-table">
                  <thead>
                    <tr>
                      <th>Código · Nombre</th>
                      <th>Parámetro</th>
                      <th>Unidad</th>
                      <th style={{ textAlign: 'right' }}>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globals.map((m) => (
                      <tr key={m.id}>
                        <td data-label="Código · Nombre" data-role="identifier">
                          <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                            {m.code}
                          </span>
                          <div
                            className="mt-0.5 text-[11.5px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {m.name}
                          </div>
                        </td>
                        <td data-label="Parámetro" style={{ color: 'var(--ink-1)' }}>
                          {m.parameter}
                        </td>
                        <td data-label="Unidad" style={{ color: 'var(--ink-2)' }}>
                          {m.unit || <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td data-label="Referencia" style={{ textAlign: 'right' }}>
                          {m.sourceRef ? (
                            <span className="syn-chip syn-chip-draft">{m.sourceRef}</span>
                          ) : (
                            <span style={{ color: 'var(--ink-4)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MethodForm
// ============================================================================

function MethodForm({
  method,
  onClose,
  onSuccess,
}: {
  method: OrgMethod | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!method
  const [code, setCode] = useState(method?.code || '')
  const [methodName, setMethodName] = useState(method?.name || '')
  const [parameter, setParameter] = useState(method?.parameter || '')
  const [unit, setUnit] = useState(method?.unit || '')
  const [sourceRef, setSourceRef] = useState(method?.sourceRef || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!code.trim() || !methodName.trim() || !parameter.trim()) return
    setSaving(true)
    try {
      const data = {
        code: code.trim(),
        name: methodName.trim(),
        parameter: parameter.trim(),
        unit: unit.trim() || undefined,
        sourceRef: sourceRef.trim() || undefined,
      }
      if (isEditing) {
        await api.methods.update(method!.id, data)
        toast.success('Método actualizado')
      } else {
        await api.methods.create(data)
        toast.success('Método creado')
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
            · {isEditing ? 'Editar método' : 'Nuevo método'}
          </div>
          <h3 style={{ marginTop: 6 }}>
            {isEditing ? (
              <>
                Modificá <span className="italic">los datos.</span>
              </>
            ) : (
              <>
                Agregar al <span className="italic">catálogo propio.</span>
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
      <div style={{ padding: '16px 20px 18px' }} className="space-y-4">
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
            placeholder="Ej: mg/L"
            className="syn-input"
          />
          <p
            className="mt-1 text-[11px]"
            style={{ color: 'var(--ink-3)' }}
          >
            Las tolerancias (min/max) no se definen acá — viven en cada matriz que use este método.
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
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={
              saving || !code.trim() || !methodName.trim() || !parameter.trim()
            }
            className="syn-btn syn-btn-primary"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear método'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="syn-btn syn-btn-ghost"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
