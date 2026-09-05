'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Ruler,
  Plus,
  Search,
  Trash2,
  Pencil,
  ChevronRight,
  Loader2,
  X,
  Send,
  FileText,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface CalibrationPoint {
  name: string
  order: number
  load: number
  unit: string
}

interface CalibrationTest {
  id?: string
  name: string
  description?: string
  order: number
  tolerance: number
  toleranceUnit: string
  readingsPerPoint: number
  formulaError: string
  criteriaOperator: string
  notes?: string
  points: CalibrationPoint[]
}

interface CalibrationTemplate {
  id: string
  name: string
  code: string
  description?: string
  unitMain: string
  unitTolerance: string
  periodicity: number | null
  notifyDaysBefore: number | null
  version: number
  status: string
  tests: CalibrationTest[]
  _count?: { calibrations: number }
  // Manual de verificación interna (PDF). Lo consultan los técnicos al ejecutar
  // la calibración desde /calibrations.
  manualPdfUrl: string | null
  manualPdfKey: string | null
  manualPdfName: string | null
  manualPdfSize: number | null
  manualPdfUploadedAt: string | null
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

export default function CalibrationTemplatesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CalibrationTemplate | null>(null)
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['calibration-templates'],
    queryFn: () => api.calibrationTemplates.list() as Promise<CalibrationTemplate[]>,
  })

  const viewingTemplate = viewingTemplateId
    ? templates.find((t) => t.id === viewingTemplateId) ?? null
    : null

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.calibrationTemplates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
      toast.success('Plantilla eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) =>
      api.approval.submit({ entityType: 'CALIBRATION_TEMPLATE', entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
      toast.success('Plantilla enviada a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.code && t.code.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Plantillas de calibración</div>
          <h1>
            Plantillas de <span className="italic">verificación.</span>
          </h1>
          <p className="sub">
            Templates para calibraciones internas — cada plantilla define ensayos con puntos, tolerancia y fórmula de error.
          </p>
        </div>
        <div className="syn-ph-actions">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="syn-btn syn-btn-primary"
          >
            <Plus className="h-3 w-3" /> Nueva plantilla
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
            placeholder="Buscar plantillas…"
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
          {filtered.length} {filtered.length === 1 ? 'plantilla' : 'plantillas'}
        </div>
      </div>

      {(showForm || editingTemplate) && (
        <div className="mb-5">
          <CalibrationTemplateForm
            template={editingTemplate}
            onClose={() => {
              setShowForm(false)
              setEditingTemplate(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
              setShowForm(false)
              setEditingTemplate(null)
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
            <Ruler className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
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
                  Aún no hay <span className="italic">plantillas.</span>
                </>
              )}
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {search
                ? 'Probá cambiar la búsqueda.'
                : 'Creá tu primera plantilla para estandarizar las verificaciones internas de tus equipos.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="syn-card">
          {filtered.map((t, idx) => {
            const chipCls = statusChipCls[t.status] ?? 'syn-chip-draft'
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setViewingTemplateId(t.id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-3)]"
                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--line)' }}
              >
                <Ruler className="h-5 w-5" style={{ color: 'var(--ink-3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px] font-medium"
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                      style={{
                        background: 'var(--bg-3)',
                        color: 'var(--ink-3)',
                      }}
                    >
                      {t.code}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 font-mono text-[11px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    v{t.version} · {t.tests.length} ensayos
                    {t.periodicity && <> · cada {t.periodicity}d</>}
                    {t._count && t._count.calibrations > 0 && (
                      <> · {t._count.calibrations} calibraciones</>
                    )}
                  </div>
                </div>
                <span className={`syn-chip ${chipCls}`}>
                  {statusLabel[t.status] ?? t.status}
                </span>
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--ink-3)' }} />
              </button>
            )
          })}
        </div>
      )}

      {viewingTemplate && (
        <CalibrationTemplateDetailDialog
          template={viewingTemplate}
          onClose={() => setViewingTemplateId(null)}
          onEdit={() => {
            setEditingTemplate(viewingTemplate)
            setViewingTemplateId(null)
          }}
          onSubmit={() => {
            submitMutation.mutate(viewingTemplate.id)
            setViewingTemplateId(null)
          }}
          onDelete={() => {
            if (confirm(`¿Eliminar la plantilla "${viewingTemplate.name}"?`)) {
              deleteMutation.mutate(viewingTemplate.id)
              setViewingTemplateId(null)
            }
          }}
        />
      )}
    </div>
  )
}

// ============================================================================
// Detail dialog
// ============================================================================

function CalibrationTemplateDetailDialog({
  template,
  onClose,
  onEdit,
  onSubmit,
  onDelete,
}: {
  template: CalibrationTemplate
  onClose: () => void
  onEdit: () => void
  onSubmit: () => void
  onDelete: () => void
}) {
  const chipCls = statusChipCls[template.status] ?? 'syn-chip-draft'

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[100dvh] w-full flex-col bg-[var(--bg-1)] shadow-[var(--shadow-lg)] sm:max-w-3xl sm:rounded-[14px]"
        style={{ border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="kicker mb-1 flex items-center gap-2">
              <Ruler className="h-3 w-3" /> Plantilla
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{
                  background: 'var(--bg-3)',
                  color: 'var(--ink-3)',
                }}
              >
                {template.code}
              </span>
            </div>
            <h2
              className="truncate"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 22,
                color: 'var(--ink-0)',
                marginTop: 2,
              }}
            >
              {template.name}
            </h2>
            <div
              className="mt-2 flex flex-wrap items-center gap-3 text-[12px]"
              style={{ color: 'var(--ink-3)' }}
            >
              <span className={`syn-chip ${chipCls}`}>
                {statusLabel[template.status]}
              </span>
              <span className="font-mono">v{template.version}</span>
              {template.unitMain && <span>Unidad: {template.unitMain}</span>}
              {template.periodicity && <span>Cada {template.periodicity}d</span>}
              {template.notifyDaysBefore && (
                <span>Aviso: {template.notifyDaysBefore}d antes</span>
              )}
            </div>
            {template.description && (
              <p
                className="mt-2 text-[13px]"
                style={{ color: 'var(--ink-2)' }}
              >
                {template.description}
              </p>
            )}
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
          {/* Manual de verificación interna (PDF) */}
          <CalibrationTemplateManualPdfSection
            templateId={template.id}
            manualPdfUrl={template.manualPdfUrl}
            manualPdfName={template.manualPdfName}
            manualPdfSize={template.manualPdfSize}
            canEdit={template.status !== 'IN_REVIEW'}
          />

          {template.tests.length === 0 ? (
            <p
              className="py-4 text-center text-[13px]"
              style={{ color: 'var(--ink-3)' }}
            >
              No hay ensayos definidos
            </p>
          ) : (
            template.tests.map((test, ti) => (
              <div key={ti}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
                    style={{
                      background: 'var(--primary-soft)',
                      color: 'var(--primary-hex)',
                    }}
                  >
                    {test.order}
                  </span>
                  <span
                    className="text-[14px] font-medium"
                    style={{ color: 'var(--ink-0)' }}
                  >
                    {test.name}
                  </span>
                  {test.tolerance > 0 && (
                    <span className="syn-chip syn-chip-draft">
                      Tol: {test.tolerance} {test.toleranceUnit}
                    </span>
                  )}
                </div>
                {test.description && (
                  <p
                    className="mb-2 text-[12px]"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {test.description}
                  </p>
                )}
                <p
                  className="mb-2 text-[11.5px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {test.readingsPerPoint} lecturas/punto · Error:{' '}
                  <code
                    className="font-mono"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {test.formulaError}
                  </code>{' '}
                  · Criterio: {test.criteriaOperator}
                  {test.notes && <> · {test.notes}</>}
                </p>
                {test.points.length > 0 && (
                  <div
                    className="rounded-[8px] border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <div className="syn-table-wrap">
                      <table className="syn-table">
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>Punto</th>
                            <th style={{ textAlign: 'right' }}>Carga</th>
                            <th>Unidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {test.points.map((p, pi) => (
                            <tr key={pi}>
                              <td
                                data-label="#"
                                className="font-mono"
                                style={{ color: 'var(--ink-3)' }}
                              >
                                {p.order}
                              </td>
                              <td data-label="Punto" data-role="identifier">
                                <span
                                  style={{
                                    color: 'var(--ink-0)',
                                    fontWeight: 500,
                                  }}
                                >
                                  {p.name}
                                </span>
                              </td>
                              <td
                                data-label="Carga"
                                className="font-mono"
                                style={{ textAlign: 'right', color: 'var(--ink-1)' }}
                              >
                                {p.load}
                              </td>
                              <td data-label="Unidad" style={{ color: 'var(--ink-2)' }}>
                                {p.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex flex-wrap gap-2 border-t px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          {template.status !== 'IN_REVIEW' && (
            <button
              type="button"
              onClick={onEdit}
              className="syn-btn syn-btn-ghost"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          {template.status === 'DRAFT' && (
            <>
              <button
                type="button"
                onClick={onSubmit}
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
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="syn-btn syn-btn-subtle"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Form
// ============================================================================

function CalibrationTemplateForm({
  template,
  onClose,
  onSuccess,
}: {
  template?: CalibrationTemplate | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!template
  const isDraft = template?.status === 'DRAFT'
  const nameCodeLocked = isEditing && !isDraft

  const [name, setName] = useState(template?.name || '')
  const [code, setCode] = useState(template?.code || '')
  const [description, setDescription] = useState(template?.description || '')
  const [unitMain, setUnitMain] = useState(template?.unitMain || '')
  const [unitTolerance, setUnitTolerance] = useState(template?.unitTolerance || '')
  const [periodicity, setPeriodicity] = useState<number | ''>(
    template?.periodicity ?? '',
  )
  const [notifyDaysBefore, setNotifyDaysBefore] = useState<number | ''>(
    template?.notifyDaysBefore ?? '',
  )
  const [tests, setTests] = useState<CalibrationTest[]>(
    template?.tests?.length
      ? template.tests.map((t) => ({
          ...t,
          points: t.points?.length ? [...t.points] : [],
        }))
      : [],
  )
  const [saving, setSaving] = useState(false)

  const addTest = () => {
    setTests([
      ...tests,
      {
        name: '',
        description: '',
        order: tests.length + 1,
        tolerance: 0,
        toleranceUnit: unitTolerance || '%',
        readingsPerPoint: 3,
        formulaError: '((AVERAGE - LOAD) / LOAD) * 100',
        criteriaOperator: 'LTE',
        notes: '',
        points: [],
      },
    ])
  }

  const updateTest = (index: number, updates: Partial<CalibrationTest>) => {
    const updated = [...tests]
    updated[index] = { ...updated[index], ...updates }
    setTests(updated)
  }

  const removeTest = (index: number) => {
    setTests(tests.filter((_, i) => i !== index))
  }

  const addPoint = (testIndex: number) => {
    const updated = [...tests]
    const points = updated[testIndex].points
    updated[testIndex] = {
      ...updated[testIndex],
      points: [
        ...points,
        { name: '', order: points.length + 1, load: 0, unit: unitMain || '' },
      ],
    }
    setTests(updated)
  }

  const updatePoint = (
    testIndex: number,
    pointIndex: number,
    updates: Partial<CalibrationPoint>,
  ) => {
    const updated = [...tests]
    const points = [...updated[testIndex].points]
    points[pointIndex] = { ...points[pointIndex], ...updates }
    updated[testIndex] = { ...updated[testIndex], points }
    setTests(updated)
  }

  const removePoint = (testIndex: number, pointIndex: number) => {
    const updated = [...tests]
    updated[testIndex] = {
      ...updated[testIndex],
      points: updated[testIndex].points.filter((_, i) => i !== pointIndex),
    }
    setTests(updated)
  }

  const handleSave = async () => {
    if (!name.trim()) return toast.error('El nombre es obligatorio')
    if (!code.trim()) return toast.error('El código es obligatorio')
    if (tests.length === 0) return toast.error('Agregá al menos un ensayo')
    for (const t of tests) {
      if (!t.name.trim()) return toast.error('Todos los ensayos deben tener nombre')
      if (t.points.length === 0)
        return toast.error(`El ensayo "${t.name}" necesita al menos un punto`)
    }

    setSaving(true)
    try {
      const payload = {
        ...(isDraft || !isEditing
          ? {
              name: name.trim().toUpperCase(),
              code: code.trim().toUpperCase(),
            }
          : {}),
        description: description.trim().toUpperCase() || undefined,
        unitMain: unitMain.trim() || undefined,
        unitTolerance: unitTolerance.trim() || undefined,
        periodicity: periodicity === '' ? undefined : periodicity,
        notifyDaysBefore: notifyDaysBefore === '' ? undefined : notifyDaysBefore,
        tests: tests.map((t, ti) => ({
          name: t.name.trim().toUpperCase(),
          description: t.description?.trim().toUpperCase() || undefined,
          order: ti + 1,
          tolerance: t.tolerance,
          toleranceUnit: t.toleranceUnit,
          readingsPerPoint: t.readingsPerPoint,
          formulaError: t.formulaError,
          criteriaOperator: t.criteriaOperator,
          notes: t.notes?.trim().toUpperCase() || undefined,
          points: t.points.map((p, pi) => ({
            name: p.name.trim().toUpperCase(),
            order: pi + 1,
            load: p.load,
            unit: p.unit,
          })),
        })),
      }

      if (isEditing) {
        await api.calibrationTemplates.update(template!.id, payload)
        toast.success(
          isDraft ? 'Plantilla actualizada' : 'Plantilla actualizada (nueva versión)',
        )
      } else {
        await api.calibrationTemplates.create(payload)
        toast.success('Plantilla creada')
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
            · {isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
          </div>
          <h3 style={{ marginTop: 6 }}>
            {isEditing ? (
              <>
                {isDraft ? 'Edición en ' : 'Nueva versión · '}
                <span className="italic">
                  {isDraft ? 'borrador.' : `v${template!.version + 1}.`}
                </span>
              </>
            ) : (
              <>
                Definí ensayos y <span className="italic">puntos.</span>
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="syn-field">
            <span className="syn-field-label">
              Nombre <span className="req">*</span>
            </span>
            <input
              value={name}
              onChange={(e) => !nameCodeLocked && setName(e.target.value)}
              readOnly={nameCodeLocked}
              placeholder="Ej: Balanza analítica"
              className="syn-input"
              style={nameCodeLocked ? { background: 'var(--bg-3)', cursor: 'not-allowed' } : undefined}
            />
          </div>
          <div className="syn-field">
            <span className="syn-field-label">
              Código <span className="req">*</span>
            </span>
            <input
              value={code}
              onChange={(e) => !nameCodeLocked && setCode(e.target.value)}
              readOnly={nameCodeLocked}
              placeholder="Ej: CAL-BAL-001"
              className="syn-input"
              style={nameCodeLocked ? { background: 'var(--bg-3)', cursor: 'not-allowed' } : undefined}
            />
          </div>
        </div>

        <div className="syn-field">
          <span className="syn-field-label">Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción de la plantilla"
            className="syn-input"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="syn-field">
            <span className="syn-field-label">Unidad principal</span>
            <input
              value={unitMain}
              onChange={(e) => setUnitMain(e.target.value)}
              placeholder="Ej: g, kg, mL"
              className="syn-input"
            />
          </div>
          <div className="syn-field">
            <span className="syn-field-label">Unidad tolerancia</span>
            <input
              value={unitTolerance}
              onChange={(e) => setUnitTolerance(e.target.value)}
              placeholder="Ej: %, g"
              className="syn-input"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="syn-field">
            <span className="syn-field-label">
              Periodicidad <span className="hint">días entre recalibraciones</span>
            </span>
            <div className="syn-unit-input">
              <input
                type="number"
                inputMode="numeric"
                value={periodicity}
                onChange={(e) =>
                  setPeriodicity(e.target.value === '' ? '' : Number(e.target.value))
                }
                min={1}
                placeholder="—"
              />
              <span className="unit">días</span>
            </div>
          </div>
          <div className="syn-field">
            <span className="syn-field-label">
              Notificar <span className="hint">días antes</span>
            </span>
            <div className="syn-unit-input">
              <input
                type="number"
                inputMode="numeric"
                value={notifyDaysBefore}
                onChange={(e) =>
                  setNotifyDaysBefore(e.target.value === '' ? '' : Number(e.target.value))
                }
                min={0}
                placeholder="—"
              />
              <span className="unit">día antes</span>
            </div>
          </div>
        </div>

        {/* Ensayos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="kicker">
              · Ensayos <span className="req">*</span>
            </div>
            <button
              type="button"
              onClick={addTest}
              className="syn-btn syn-btn-ghost"
              style={{ padding: '6px 10px' }}
            >
              <Plus className="h-3 w-3" /> Agregar ensayo
            </button>
          </div>
          <div className="space-y-3">
            {tests.map((test, ti) => (
              <div
                key={ti}
                className="space-y-3 rounded-[8px] border p-3"
                style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-semibold"
                    style={{
                      background: 'var(--primary-soft)',
                      color: 'var(--primary-hex)',
                    }}
                  >
                    {ti + 1}
                  </span>
                  <input
                    value={test.name}
                    onChange={(e) => updateTest(ti, { name: e.target.value })}
                    placeholder="Nombre del ensayo (ej: Exactitud)"
                    className="syn-input"
                    style={{ flex: 1 }}
                  />
                  {tests.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTest(ti)}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px', color: 'var(--danger)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <input
                  value={test.description || ''}
                  onChange={(e) => updateTest(ti, { description: e.target.value })}
                  placeholder="Descripción del ensayo"
                  className="syn-input"
                />

                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="syn-field">
                    <span className="syn-field-label" style={{ fontSize: 11 }}>
                      Tolerancia
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={test.tolerance ?? ''}
                      onChange={(e) =>
                        updateTest(ti, {
                          tolerance: e.target.value !== '' ? parseFloat(e.target.value) : 0,
                        })
                      }
                      placeholder="0"
                      className="syn-input font-mono"
                    />
                  </div>
                  <div className="syn-field">
                    <span className="syn-field-label" style={{ fontSize: 11 }}>
                      Unidad tol.
                    </span>
                    <input
                      value={test.toleranceUnit}
                      onChange={(e) => updateTest(ti, { toleranceUnit: e.target.value })}
                      placeholder="%"
                      className="syn-input"
                    />
                  </div>
                  <div className="syn-field">
                    <span className="syn-field-label" style={{ fontSize: 11 }}>
                      Lecturas/punto
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={test.readingsPerPoint || ''}
                      onChange={(e) =>
                        updateTest(ti, {
                          readingsPerPoint: parseInt(e.target.value) || 1,
                        })
                      }
                      min={1}
                      className="syn-input font-mono"
                    />
                  </div>
                  <div className="syn-field">
                    <span className="syn-field-label" style={{ fontSize: 11 }}>
                      Criterio
                    </span>
                    <select
                      value={test.criteriaOperator}
                      onChange={(e) =>
                        updateTest(ti, { criteriaOperator: e.target.value })
                      }
                      className="syn-select"
                    >
                      <option value="LTE">≤ Menor o igual</option>
                      <option value="LT">{'<'} Menor que</option>
                      <option value="GTE">≥ Mayor o igual</option>
                      <option value="GT">{'>'} Mayor que</option>
                      <option value="EQ">= Igual</option>
                    </select>
                  </div>
                </div>

                <div className="syn-field">
                  <span className="syn-field-label">
                    Fórmula de error{' '}
                    <span className="hint">mathjs · LOAD, AVERAGE</span>
                  </span>
                  <input
                    value={test.formulaError}
                    onChange={(e) => updateTest(ti, { formulaError: e.target.value })}
                    placeholder="((AVERAGE - LOAD) / LOAD) * 100"
                    className="syn-input font-mono"
                  />
                </div>

                <input
                  value={test.notes || ''}
                  onChange={(e) => updateTest(ti, { notes: e.target.value })}
                  placeholder="Notas"
                  className="syn-input"
                />

                {/* Puntos */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="kicker" style={{ color: 'var(--ink-2)' }}>
                      · Puntos de calibración
                    </div>
                    <button
                      type="button"
                      onClick={() => addPoint(ti)}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                    >
                      <Plus className="h-3 w-3" /> Punto
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {test.points.map((point, pi) => (
                      <div key={pi} className="flex items-center gap-2">
                        <span
                          className="w-5 text-center font-mono text-[11px]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {pi + 1}
                        </span>
                        <input
                          value={point.name}
                          onChange={(e) =>
                            updatePoint(ti, pi, { name: e.target.value })
                          }
                          placeholder="Nombre del punto"
                          className="syn-input"
                          style={{ flex: 1, minHeight: 32, padding: '6px 10px' }}
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={point.load ?? ''}
                          onChange={(e) =>
                            updatePoint(ti, pi, {
                              load: e.target.value !== '' ? parseFloat(e.target.value) : 0,
                            })
                          }
                          placeholder="Carga"
                          className="syn-input font-mono"
                          style={{ width: 110, minHeight: 32, padding: '6px 10px' }}
                        />
                        <input
                          value={point.unit}
                          onChange={(e) =>
                            updatePoint(ti, pi, { unit: e.target.value })
                          }
                          placeholder="Unidad"
                          className="syn-input"
                          style={{ width: 80, minHeight: 32, padding: '6px 10px' }}
                        />
                        {test.points.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removePoint(ti, pi)}
                            className="syn-btn syn-btn-subtle"
                            style={{ padding: '6px 8px', color: 'var(--danger)' }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {test.points.length === 0 && (
                      <p
                        className="py-2 text-center text-[12px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        Sin puntos — agregá al menos uno
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tests.length === 0 && (
              <div
                className="rounded-[8px] border border-dashed py-6 text-center"
                style={{ borderColor: 'var(--line-2)' }}
              >
                <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                  Agregá ensayos de calibración
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim() || !code.trim()}
            className="syn-btn syn-btn-primary"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEditing
              ? isDraft
                ? 'Guardar cambios'
                : 'Guardar nueva versión'
              : 'Crear plantilla'}
          </button>
          <button type="button" onClick={onClose} className="syn-btn syn-btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// CalibrationTemplateManualPdfSection — manual de verificación interna (PDF)
// ===========================================================================

const MANUAL_PDF_MAX_BYTES = 10 * 1024 * 1024
const apiBaseCT = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function formatBytesCT(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function CalibrationTemplateManualPdfSection({
  templateId,
  manualPdfUrl,
  manualPdfName,
  manualPdfSize,
  canEdit,
}: {
  templateId: string
  manualPdfUrl: string | null
  manualPdfName: string | null
  manualPdfSize: number | null
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (file.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF.')
      return
    }
    if (file.size > MANUAL_PDF_MAX_BYTES) {
      setError('El archivo supera el tamaño máximo (10 MB).')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null
      const res = await fetch(
        `${apiBaseCT}/calibration-templates/${templateId}/manual-pdf`,
        {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ message: 'Error subiendo el archivo' }))
        throw new Error(body.message || `Error ${res.status}`)
      }
      queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
      toast.success('Manual cargado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo el archivo')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleRemove() {
    setError(null)
    try {
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null
      const res = await fetch(
        `${apiBaseCT}/calibration-templates/${templateId}/manual-pdf`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) throw new Error('No se pudo eliminar el PDF')
      queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
      toast.success('Manual eliminado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div>
      <div className="kicker mb-2">· Manual de verificación interna</div>
      {manualPdfUrl ? (
        <div
          className="rounded-[8px] border px-3 py-2.5 flex items-center gap-3"
          style={{ borderColor: 'var(--line)' }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px]"
            style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
          >
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="truncate text-[13px]"
              style={{ color: 'var(--ink-0)', fontWeight: 500 }}
            >
              {manualPdfName || 'manual.pdf'}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {manualPdfSize ? formatBytesCT(manualPdfSize) : '—'}
            </div>
          </div>
          <a
            href={manualPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="syn-btn syn-btn-subtle"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Ver
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={handleRemove}
              className="syn-btn"
              style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)' }}
            >
              Quitar
            </button>
          )}
        </div>
      ) : canEdit ? (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="rounded-[8px] border-2 border-dashed px-3 py-4 text-[12.5px] transition w-full text-left"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--bg-1)',
              color: 'var(--ink-2)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading
              ? 'Subiendo…'
              : 'Click para adjuntar el manual de verificación (PDF, máx. 10 MB)'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </>
      ) : (
        <div
          className="rounded-[8px] border px-3 py-2.5 text-[12.5px]"
          style={{
            borderColor: 'var(--line)',
            background: 'var(--bg-1)',
            color: 'var(--ink-3)',
          }}
        >
          Sin manual cargado.
        </div>
      )}
      {error && (
        <div className="text-[11.5px] mt-1" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
