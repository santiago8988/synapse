'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ruler, Plus, Search, Trash2, Pencil, ChevronRight, Loader2, X, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
}

const statusLabels: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  IN_REVIEW: { label: 'En revisión', variant: 'warning' },
  ACTIVE: { label: 'Activa', variant: 'success' },
}

export default function CalibrationTemplatesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CalibrationTemplate | null>(null)
  const [viewingTemplate, setViewingTemplate] = useState<CalibrationTemplate | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['calibration-templates'],
    queryFn: () => api.calibrationTemplates.list() as Promise<CalibrationTemplate[]>,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.calibrationTemplates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
      toast.success('Plantilla eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.approval.submit({ entityType: 'CALIBRATION_TEMPLATE', entityId: id }),
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de calibración</h1>
          <p className="mt-1 text-muted-foreground">Templates para verificaciones internas de equipos</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar plantillas..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {(showForm || editingTemplate) && (
        <CalibrationTemplateForm
          template={editingTemplate}
          onClose={() => { setShowForm(false); setEditingTemplate(null) }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['calibration-templates'] })
            setShowForm(false)
            setEditingTemplate(null)
          }}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Ruler className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No se encontraron plantillas' : 'No hay plantillas creadas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filtered.map((template) => {
            const status = statusLabels[template.status] || statusLabels.DRAFT
            return (
              <button
                key={template.id}
                onClick={() => setViewingTemplate(template)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <Ruler className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{template.name}</p>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{template.code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    v{template.version} &middot; {template.tests.length} ensayos
                    {template.periodicity && <> &middot; cada {template.periodicity}d</>}
                    {template._count && template._count.calibrations > 0 && <> &middot; {template._count.calibrations} calibraciones</>}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      )}

      {viewingTemplate && (
        <CalibrationTemplateDetailDialog
          template={viewingTemplate}
          onClose={() => setViewingTemplate(null)}
          onEdit={() => { setEditingTemplate(viewingTemplate); setViewingTemplate(null) }}
          onSubmit={() => { submitMutation.mutate(viewingTemplate.id); setViewingTemplate(null) }}
          onDelete={() => {
            if (confirm(`Eliminar la plantilla "${viewingTemplate.name}"?`)) {
              deleteMutation.mutate(viewingTemplate.id)
              setViewingTemplate(null)
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Dialog de detalle ───────────────────

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
  const status = statusLabels[template.status] || statusLabels.DRAFT

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-lg border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <Ruler className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{template.name}</h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{template.code}</span>
              <span>v{template.version}</span>
              {template.description && <span>{template.description}</span>}
              {template.unitMain && <span>Unidad: {template.unitMain}</span>}
              {template.periodicity && <span>Cada {template.periodicity} dias</span>}
              {template.notifyDaysBefore && <span>Aviso: {template.notifyDaysBefore}d</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {template.tests.length > 0 && template.tests.map((test, ti) => (
            <div key={ti}>
              <h4 className="mb-2 text-sm font-semibold flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {test.order}
                </span>
                {test.name}
                {test.tolerance > 0 && (
                  <Badge variant="secondary" className="text-[10px]">Tolerancia: {test.tolerance} {test.toleranceUnit}</Badge>
                )}
              </h4>
              {test.description && (
                <p className="mb-2 text-xs text-muted-foreground">{test.description}</p>
              )}
              <div className="text-xs text-muted-foreground mb-2">
                {test.readingsPerPoint} lecturas por punto &middot; Error: {test.formulaError} &middot; Criterio: {test.criteriaOperator}
                {test.notes && <> &middot; {test.notes}</>}
              </div>
              {test.points.length > 0 && (
                <div className="rounded-lg border">
                  <div className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                    <span>#</span>
                    <span>Punto</span>
                    <span className="text-right">Carga</span>
                    <span>Unidad</span>
                  </div>
                  <div className="divide-y">
                    {test.points.map((point, pi) => (
                      <div key={pi} className="grid grid-cols-[2rem_1fr_6rem_4rem] gap-2 px-3 py-2.5 text-sm items-center">
                        <span className="text-xs text-muted-foreground">{point.order}</span>
                        <span className="font-medium">{point.name}</span>
                        <span className="text-right font-mono">{point.load}</span>
                        <span className="text-muted-foreground">{point.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {template.tests.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No hay ensayos definidos</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t px-6 py-4">
          {template.status !== 'IN_REVIEW' && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3 w-3" />
              Editar
            </Button>
          )}
          {template.status === 'DRAFT' && (
            <Button size="sm" onClick={onSubmit}>
              <Send className="mr-1 h-3 w-3" />
              Enviar a revision
            </Button>
          )}
          {template.status === 'DRAFT' && (
            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              Eliminar
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Formulario de plantilla ───────────────────

function CalibrationTemplateForm({ template, onClose, onSuccess }: { template?: CalibrationTemplate | null; onClose: () => void; onSuccess: () => void }) {
  const isEditing = !!template
  const isDraft = template?.status === 'DRAFT'
  const nameCodeLocked = isEditing && !isDraft

  const [name, setName] = useState(template?.name || '')
  const [code, setCode] = useState(template?.code || '')
  const [description, setDescription] = useState(template?.description || '')
  const [unitMain, setUnitMain] = useState(template?.unitMain || '')
  const [unitTolerance, setUnitTolerance] = useState(template?.unitTolerance || '')
  const [periodicity, setPeriodicity] = useState<number>(template?.periodicity || 365)
  const [notifyDaysBefore, setNotifyDaysBefore] = useState<number>(template?.notifyDaysBefore || 30)
  const [tests, setTests] = useState<CalibrationTest[]>(
    template?.tests?.length
      ? template.tests.map((t) => ({ ...t, points: t.points?.length ? [...t.points] : [] }))
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
      points: [...points, { name: '', order: points.length + 1, load: 0, unit: unitMain || '' }],
    }
    setTests(updated)
  }

  const updatePoint = (testIndex: number, pointIndex: number, updates: Partial<CalibrationPoint>) => {
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
    if (tests.length === 0) return toast.error('Agrega al menos un ensayo')
    for (const t of tests) {
      if (!t.name.trim()) return toast.error('Todos los ensayos deben tener nombre')
      if (t.points.length === 0) return toast.error(`El ensayo "${t.name}" necesita al menos un punto`)
    }

    setSaving(true)
    try {
      const payload = {
        ...(isDraft || !isEditing ? { name: name.trim().toUpperCase(), code: code.trim().toUpperCase() } : {}),
        description: description.trim().toUpperCase() || undefined,
        unitMain: unitMain.trim() || undefined,
        unitTolerance: unitTolerance.trim() || undefined,
        periodicity: periodicity || undefined,
        notifyDaysBefore: notifyDaysBefore || undefined,
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
        toast.success(isDraft ? 'Plantilla actualizada' : 'Plantilla actualizada (nueva version)')
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{isEditing ? `Editar ${template!.name}` : 'Nueva plantilla de calibración'}</CardTitle>
          <CardDescription>
            {isEditing
              ? (isDraft ? 'Edicion directa en borrador' : `Se creara la version v${template!.version + 1}`)
              : 'Defini ensayos y puntos de calibración'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Datos básicos */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre *</label>
            <input
              value={name}
              onChange={(e) => !nameCodeLocked && setName(e.target.value)}
              readOnly={nameCodeLocked}
              placeholder="Ej: Balanza analítica"
              className={`uppercase flex h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${nameCodeLocked ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Código *</label>
            <input
              value={code}
              onChange={(e) => !nameCodeLocked && setCode(e.target.value)}
              readOnly={nameCodeLocked}
              placeholder="Ej: CAL-BAL-001"
              className={`uppercase flex h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${nameCodeLocked ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción de la plantilla"
            className="uppercase flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Unidad principal</label>
            <input
              value={unitMain}
              onChange={(e) => setUnitMain(e.target.value)}
              placeholder="Ej: g, kg, mL"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Unidad tolerancia</label>
            <input
              value={unitTolerance}
              onChange={(e) => setUnitTolerance(e.target.value)}
              placeholder="Ej: %, g"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Periodicidad (dias) *</label>
            <input
              type="number"
              value={periodicity}
              onChange={(e) => setPeriodicity(Number(e.target.value))}
              min={1}
              placeholder="Ej: 365"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">Cada cuantos dias se debe recalibrar</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Notificar dias antes</label>
            <input
              type="number"
              value={notifyDaysBefore}
              onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
              min={0}
              placeholder="Ej: 30"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground">Dias de aviso previo a la calibracion</p>
          </div>
        </div>

        {/* Ensayos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold">Ensayos *</label>
            <Button size="sm" variant="outline" onClick={addTest}>
              <Plus className="mr-1 h-3 w-3" />
              Agregar ensayo
            </Button>
          </div>
          <div className="space-y-4">
            {tests.map((test, ti) => (
              <div key={ti} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {ti + 1}
                  </span>
                  <input
                    value={test.name}
                    onChange={(e) => updateTest(ti, { name: e.target.value })}
                    placeholder="Nombre del ensayo (ej: Exactitud)"
                    className="uppercase flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {tests.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeTest(ti)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                <input
                  value={test.description || ''}
                  onChange={(e) => updateTest(ti, { description: e.target.value })}
                  placeholder="Descripción del ensayo"
                  className="uppercase w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Tolerancia</label>
                    <input
                      type="number"
                      step="any"
                      value={test.tolerance ?? ''}
                      onChange={(e) => updateTest(ti, { tolerance: e.target.value !== '' ? parseFloat(e.target.value) : 0 })}
                      placeholder="0"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Unidad tol.</label>
                    <input
                      value={test.toleranceUnit}
                      onChange={(e) => updateTest(ti, { toleranceUnit: e.target.value })}
                      placeholder="%"
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Lecturas/punto</label>
                    <input
                      type="number"
                      value={test.readingsPerPoint || ''}
                      onChange={(e) => updateTest(ti, { readingsPerPoint: parseInt(e.target.value) || 1 })}
                      min={1}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Criterio</label>
                    <select
                      value={test.criteriaOperator}
                      onChange={(e) => updateTest(ti, { criteriaOperator: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="LTE">{'<='} Menor o igual</option>
                      <option value="LT">{'<'} Menor que</option>
                      <option value="GTE">{'>='} Mayor o igual</option>
                      <option value="GT">{'>'} Mayor que</option>
                      <option value="EQ">= Igual</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Fórmula de error</label>
                  <input
                    value={test.formulaError}
                    onChange={(e) => updateTest(ti, { formulaError: e.target.value })}
                    placeholder="((AVERAGE - LOAD) / LOAD) * 100"
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <input
                  value={test.notes || ''}
                  onChange={(e) => updateTest(ti, { notes: e.target.value })}
                  placeholder="Notas"
                  className="uppercase w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                {/* Puntos */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold">Puntos de calibración</label>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addPoint(ti)}>
                      <Plus className="mr-1 h-3 w-3" />
                      Punto
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {test.points.map((point, pi) => (
                      <div key={pi} className="flex items-center gap-2">
                        <span className="w-5 text-center text-xs text-muted-foreground">{pi + 1}</span>
                        <input
                          value={point.name}
                          onChange={(e) => updatePoint(ti, pi, { name: e.target.value })}
                          placeholder="Nombre del punto"
                          className="uppercase flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          type="number"
                          step="any"
                          value={point.load ?? ''}
                          onChange={(e) => updatePoint(ti, pi, { load: e.target.value !== '' ? parseFloat(e.target.value) : 0 })}
                          placeholder="Carga"
                          className="w-24 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <input
                          value={point.unit}
                          onChange={(e) => updatePoint(ti, pi, { unit: e.target.value })}
                          placeholder="Unidad"
                          className="w-16 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        {test.points.length > 1 && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePoint(ti, pi)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {test.points.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">Sin puntos — agrega al menos uno</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tests.length === 0 && (
              <div className="rounded-lg border border-dashed py-6 text-center">
                <p className="text-sm text-muted-foreground">Agrega ensayos de calibración</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !name.trim() || !code.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? (isDraft ? 'Guardar cambios' : 'Guardar nueva version') : 'Crear plantilla'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}
