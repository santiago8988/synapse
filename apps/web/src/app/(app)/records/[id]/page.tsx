'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Hash,
  Type,
  Calendar,
  GitCompare,
  Calculator,
  Link2,
  Star,
  Layers,
  Clock,
  Settings,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Zap,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Archive,
  Eye,
  Send,
  TestTube2,
  Microscope,
  ListFilter,
  FlaskConical,
  Scale,
  Package,
  Ruler,
  ScanLine,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const fieldTypeIcons: Record<string, React.ElementType> = {
  NUMBER: Hash,
  TEXT: Type,
  DATE: Calendar,
  COMPARISON: GitCompare,
  FORMULA: Calculator,
  DROPDOWN: ListFilter,
  MATRIX_METHOD: Microscope,
  RECIPE_SELECT: FlaskConical,
  CALIBRATION_TEMPLATE: Ruler,
  QUANTITY: Scale,
  RELATED_ENTRY: Link2,
  MULTIPLE_RELATED_ENTRY: Link2,
}

const fieldTypeLabels: Record<string, string> = {
  NUMBER: 'Número',
  TEXT: 'Texto',
  DATE: 'Fecha',
  COMPARISON: 'Comparación',
  FORMULA: 'Fórmula',
  DROPDOWN: 'Opciones',
  MATRIX_METHOD: 'Matriz y Métodos',
  RECIPE_SELECT: 'Receta',
  CALIBRATION_TEMPLATE: 'Plantilla calibración',
  QUANTITY: 'Cantidad y unidad',
  RELATED_ENTRY: 'Entrada relacionada',
  MULTIPLE_RELATED_ENTRY: 'Múltiples relacionadas',
}

const fieldTypeOptions = [
  { value: 'NUMBER', label: 'Número', icon: Hash },
  { value: 'TEXT', label: 'Texto', icon: Type },
  { value: 'DATE', label: 'Fecha', icon: Calendar },
  { value: 'DROPDOWN', label: 'Opciones', icon: ListFilter },
  { value: 'MATRIX_METHOD', label: 'Matriz y Métodos', icon: Microscope },
  { value: 'RECIPE_SELECT', label: 'Receta', icon: FlaskConical },
  { value: 'CALIBRATION_TEMPLATE', label: 'Plantilla calibración', icon: Ruler },
  { value: 'QUANTITY', label: 'Cantidad y unidad', icon: Scale },
  { value: 'COMPARISON', label: 'Comparación', icon: GitCompare },
  { value: 'FORMULA', label: 'Fórmula', icon: Calculator },
  { value: 'RELATED_ENTRY', label: 'Entrada relacionada', icon: Link2 },
  { value: 'MULTIPLE_RELATED_ENTRY', label: 'Múltiples relacionadas', icon: Link2 },
]

const comparisonOperators = [
  { value: 'LT', label: '< Menor que' },
  { value: 'LTE', label: '<= Menor o igual' },
  { value: 'GT', label: '> Mayor que' },
  { value: 'GTE', label: '>= Mayor o igual' },
  { value: 'EQ', label: '= Igual a' },
  { value: 'BETWEEN', label: 'Entre (rango)' },
]

const typeConfig: Record<string, { label: string; variant: string }> = {
  PERIODIC: { label: 'Periódico', variant: 'info' },
  NOT_PERIODIC: { label: 'No periódico', variant: 'secondary' },
  NOT_PERIODIC_WITH_REVISION: { label: 'Con revisión', variant: 'warning' },
  INSTRUMENTAL: { label: 'Instrumental', variant: 'default' },
  BATCH: { label: 'Lote/Producción', variant: 'success' },
  SAMPLE: { label: 'Muestra', variant: 'info' },
  STOCK: { label: 'Stock', variant: 'warning' },
}

interface FieldDef {
  id: string
  label: string
  fieldType: string
  order: number
  isIdentifier: boolean
  isRequired: boolean
  comparisonConfig: Record<string, unknown> | null
  formulaConfig: { expression: string } | null
  relatedRecordId?: string
  relatedFieldIds?: string[]
  isNew?: boolean
  markedForRemoval?: boolean
}

interface RecordDetail {
  id: string
  name: string
  type: 'PERIODIC' | 'NOT_PERIODIC' | 'NOT_PERIODIC_WITH_REVISION' | 'INSTRUMENTAL'
  version: number
  changeLog: string | null
  periodicity: number | null
  notifyDaysBefore: number | null
  isActive: boolean
  createdAt: string
  area: { id: string; name: string } | null
  document: { id: string; title: string; code: string | null } | null
  fields: FieldDef[]
  actionsAsSource: Array<{ id: string; targetRecord: { id: string; name: string } }>
  actionsAsTarget: Array<{ id: string; sourceRecord: { id: string; name: string } }>
}

interface RecordListItem {
  id: string
  name: string
  type: string
  periodicity: number | null
  fields: Array<{ id: string; label: string; fieldType: string; isIdentifier: boolean }>
}

let tempCounter = 0

// --- Sub-component for related entry fetching ---
function RelatedEntryField({
  field,
  entryData,
  setEntryData,
}: {
  field: FieldDef
  entryData: Record<string, unknown>
  setEntryData: (data: Record<string, unknown>) => void
}) {
  const { data: relatedEntries = [] } = useQuery<Array<{ id: string; data: Record<string, unknown>; status: string }>>({
    queryKey: ['entries', field.relatedRecordId],
    queryFn: () => api.entries.list(field.relatedRecordId!) as Promise<Array<{ id: string; data: Record<string, unknown>; status: string }>>,
    enabled: !!field.relatedRecordId,
  })

  const { data: relatedRecord } = useQuery<RecordDetail>({
    queryKey: ['record', field.relatedRecordId],
    queryFn: () => api.records.get(field.relatedRecordId!) as Promise<RecordDetail>,
    enabled: !!field.relatedRecordId,
  })

  const identifierFields = relatedRecord?.fields.filter((f) => f.isIdentifier) || []
  const relatedFieldDefs = relatedRecord?.fields.filter((f) => field.relatedFieldIds?.includes(f.id)) || []
  const selectedEntryId = entryData[field.id] as string | undefined
  const selectedEntry = relatedEntries.find((e) => e.id === selectedEntryId)

  const buildLabel = (entry: { id: string; data: Record<string, unknown> }) => {
    if (identifierFields.length === 0) return entry.id.slice(0, 8)
    return identifierFields.map((f) => entry.data[f.id] ?? '—').join(' | ')
  }

  const handleSelect = (entryId: string) => {
    const entry = relatedEntries.find((e) => e.id === entryId)
    const newData: Record<string, unknown> = { ...entryData, [field.id]: entryId || undefined }
    // Clear previous transcribed values
    if (field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        delete newData[`${field.id}_${relFieldId}`]
      }
    }
    // Transcribe values from selected entry
    if (entry && field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        const val = entry.data[relFieldId]
        if (val !== undefined) {
          newData[`${field.id}_${relFieldId}`] = val
          // Guardar también con el label del campo relacionado para que las fórmulas lo encuentren
          const relField = relatedRecord?.fields.find((f) => f.id === relFieldId)
          if (relField) {
            newData[`__label_${relField.label}`] = val
          }
        }
      }
    }
    setEntryData(newData)
  }

  const Icon = fieldTypeIcons[field.fieldType] || Hash

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {field.label}
        {field.isRequired && <span className="text-destructive">*</span>}
        {field.isIdentifier && <Star className="h-3 w-3 text-amber-500" fill="currentColor" />}
        <Badge variant="outline" className="text-[10px]">Entrada relacionada</Badge>
      </label>
      <select
        value={selectedEntryId || ''}
        onChange={(e) => handleSelect(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Seleccionar entrada...</option>
        {relatedEntries.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {buildLabel(entry)}
          </option>
        ))}
      </select>
      {selectedEntry && relatedFieldDefs.length > 0 && (
        <div className="mt-2 space-y-1.5 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Valores transcriptos</p>
          {relatedFieldDefs.map((relField) => {
            const val = selectedEntry.data[relField.id]
            return (
              <div key={relField.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{relField.label}</span>
                <span className="font-mono">{val !== undefined && val !== null ? String(val) : '—'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Sub-component for MULTIPLE related entries ---
function MultiRelatedEntryField({
  field,
  entryData,
  setEntryData,
}: {
  field: FieldDef
  entryData: Record<string, unknown>
  setEntryData: (data: Record<string, unknown>) => void
}) {
  const { data: relatedEntries = [] } = useQuery<Array<{ id: string; data: Record<string, unknown>; status: string }>>({
    queryKey: ['entries', field.relatedRecordId],
    queryFn: () => api.entries.list(field.relatedRecordId!) as Promise<Array<{ id: string; data: Record<string, unknown>; status: string }>>,
    enabled: !!field.relatedRecordId,
  })

  const { data: relatedRecord } = useQuery<RecordDetail>({
    queryKey: ['record', field.relatedRecordId],
    queryFn: () => api.records.get(field.relatedRecordId!) as Promise<RecordDetail>,
    enabled: !!field.relatedRecordId,
  })

  const identifierFields = relatedRecord?.fields.filter((f) => f.isIdentifier) || []
  const relatedFieldDefs = relatedRecord?.fields.filter((f) => field.relatedFieldIds?.includes(f.id)) || []

  // Selected entry IDs stored as array
  const selectedIds: string[] = Array.isArray(entryData[field.id]) ? (entryData[field.id] as string[]) : []

  const buildLabel = (entry: { id: string; data: Record<string, unknown> }) => {
    if (identifierFields.length === 0) return entry.id.slice(0, 8)
    return identifierFields.map((f) => entry.data[f.id] ?? '—').join(' | ')
  }

  const handleToggle = (entryId: string) => {
    const newIds = selectedIds.includes(entryId)
      ? selectedIds.filter((id) => id !== entryId)
      : [...selectedIds, entryId]

    const newData: Record<string, unknown> = { ...entryData, [field.id]: newIds }

    // Clear previous transcribed values
    if (field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        delete newData[`${field.id}_${relFieldId}`]
      }
    }

    // Transcribe values from ALL selected entries (aggregate)
    if (field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        const values: unknown[] = []
        for (const eid of newIds) {
          const entry = relatedEntries.find((e) => e.id === eid)
          if (entry && entry.data[relFieldId] !== undefined) {
            values.push(entry.data[relFieldId])
          }
        }
        if (values.length > 0) {
          newData[`${field.id}_${relFieldId}`] = values
        }
      }
    }
    setEntryData(newData)
  }

  const Icon = fieldTypeIcons[field.fieldType] || Hash

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {field.label}
        {field.isRequired && <span className="text-destructive">*</span>}
        {field.isIdentifier && <Star className="h-3 w-3 text-amber-500" fill="currentColor" />}
        <Badge variant="outline" className="text-[10px]">Múltiples relacionadas</Badge>
      </label>
      <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
        {relatedEntries.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">No hay entradas disponibles</p>
        ) : (
          relatedEntries.map((entry) => {
            const isSelected = selectedIds.includes(entry.id)
            return (
              <label
                key={entry.id}
                className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(entry.id)}
                  className="rounded"
                />
                <span className={isSelected ? 'font-medium' : ''}>{buildLabel(entry)}</span>
              </label>
            )
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedIds.length} entrada{selectedIds.length > 1 ? 's' : ''} seleccionada{selectedIds.length > 1 ? 's' : ''}
        </p>
      )}
      {selectedIds.length > 0 && relatedFieldDefs.length > 0 && (
        <div className="mt-2 space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Valores transcriptos</p>
          {selectedIds.map((eid) => {
            const entry = relatedEntries.find((e) => e.id === eid)
            if (!entry) return null
            return (
              <div key={eid} className="space-y-1">
                <p className="text-xs font-semibold">{buildLabel(entry)}</p>
                {relatedFieldDefs.map((relField) => {
                  const val = entry.data[relField.id]
                  return (
                    <div key={relField.id} className="flex items-center justify-between text-sm pl-3">
                      <span className="text-muted-foreground">{relField.label}</span>
                      <span className="font-mono">{val !== undefined && val !== null ? String(val) : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Sub-component for the entry form fields ---
// --- RECIPE_SELECT field component ---
function RecipeSelectField({
  field,
  entryData,
  setEntryData,
}: {
  field: { id: string; label: string }
  entryData: Record<string, unknown>
  setEntryData: (data: Record<string, unknown>) => void
}) {
  const currentValue = (entryData[field.id] || '') as string

  const { data: recipesList = [] } = useQuery({
    queryKey: ['recipes-for-select'],
    queryFn: () => api.recipes.list() as Promise<Array<{ id: string; name: string; code: string | null; status: string }>>,
  })

  const activeRecipes = recipesList.filter((r) => r.status === 'ACTIVE')

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        {field.label}
      </label>
      <select
        value={currentValue}
        onChange={(e) => setEntryData({ ...entryData, [field.id]: e.target.value || null })}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Sin receta</option>
        {activeRecipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}{r.code ? ` (${r.code})` : ''}
          </option>
        ))}
      </select>
      {activeRecipes.length === 0 && (
        <p className="text-xs text-amber-600">No hay recetas activas — crea una en Recetas y aprobala.</p>
      )}
    </div>
  )
}

// --- CALIBRATION_TEMPLATE field component ---
function CalibrationTemplateSelectField({
  field,
  entryData,
  setEntryData,
}: {
  field: { id: string; label: string }
  entryData: Record<string, unknown>
  setEntryData: (data: Record<string, unknown>) => void
}) {
  const currentValue = (entryData[field.id] || '') as string

  const { data: templatesList = [] } = useQuery({
    queryKey: ['calibration-templates-for-select'],
    queryFn: () => api.calibrationTemplates.list() as Promise<Array<{ id: string; name: string; code: string | null; status: string }>>,
  })

  const activeTemplates = templatesList.filter((t) => t.status === 'ACTIVE')

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Ruler className="h-4 w-4 text-muted-foreground" />
        {field.label}
      </label>
      <select
        value={currentValue}
        onChange={(e) => setEntryData({ ...entryData, [field.id]: e.target.value || null })}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Sin plantilla</option>
        {activeTemplates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}{t.code ? ` (${t.code})` : ''}
          </option>
        ))}
      </select>
      {activeTemplates.length === 0 && (
        <p className="text-xs text-amber-600">No hay plantillas activas — crea una en Plantillas Cal. y aprobala.</p>
      )}
    </div>
  )
}

// --- MATRIX_METHOD field component ---
function MatrixMethodField({
  field,
  entryData,
  setEntryData,
}: {
  field: { id: string; label: string }
  entryData: Record<string, unknown>
  setEntryData: (data: Record<string, unknown>) => void
}) {
  const currentValue = (entryData[field.id] || { matrixId: null, methodIds: [] }) as {
    matrixId: string | null
    methodIds: string[]
  }

  const { data: matricesList = [] } = useQuery({
    queryKey: ['matrices-for-select'],
    queryFn: () => api.matrices.list() as Promise<Array<{ id: string; name: string; code: string | null; status: string; parameters: Array<{ method: string | null }> }>>,
  })

  const { data: methods = [] } = useQuery({
    queryKey: ['methods-for-select', currentValue.matrixId],
    queryFn: () => api.methods.search() as Promise<Array<{ id: string; code: string; name: string; parameter: string; unit: string | null; orgId: string | null }>>,
  })

  const activeMatrices = matricesList.filter((m) => m.status === 'ACTIVE')

  // Filter methods: if matrix is selected, show methods whose code matches matrix parameters' method field
  const filteredMethods = currentValue.matrixId
    ? (() => {
        const matrix = matricesList.find((m) => m.id === currentValue.matrixId)
        if (!matrix) return methods
        const matrixMethodCodes = matrix.parameters?.map((p: { method: string | null }) => p.method).filter(Boolean) || []
        const related = methods.filter((m) => matrixMethodCodes.includes(m.code))
        return related.length > 0 ? related : methods
      })()
    : methods

  const updateValue = (updates: Partial<typeof currentValue>) => {
    setEntryData({ ...entryData, [field.id]: { ...currentValue, ...updates } })
  }

  const toggleMethod = (methodId: string) => {
    const ids = currentValue.methodIds.includes(methodId)
      ? currentValue.methodIds.filter((id) => id !== methodId)
      : [...currentValue.methodIds, methodId]
    updateValue({ methodIds: ids })
  }

  const Icon = fieldTypeIcons[field.id] || Microscope

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
      <label className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
        <Microscope className="h-4 w-4" />
        {field.label}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Matriz select */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Matriz</label>
          <select
            value={currentValue.matrixId || ''}
            onChange={(e) => updateValue({ matrixId: e.target.value || null, methodIds: [] })}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Sin matriz</option>
            {activeMatrices.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}{m.code ? ` (${m.code})` : ''}
              </option>
            ))}
          </select>
        </div>
        {/* Metodos count */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Metodos seleccionados: {currentValue.methodIds.length}
          </label>
          <p className="text-xs text-muted-foreground">
            {currentValue.matrixId && currentValue.methodIds.length === 0
              ? 'Se usaran todos los parametros de la matriz'
              : currentValue.methodIds.length > 0
              ? 'Se usaran solo los metodos seleccionados'
              : 'Selecciona una matriz o metodos'}
          </p>
        </div>
      </div>
      {/* Methods multi-select */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Metodos (opcional — selecciona para usar solo algunos)</label>
        <div className="max-h-40 overflow-y-auto rounded-md border bg-background divide-y">
          {filteredMethods.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No hay metodos disponibles</p>
          ) : (
            filteredMethods.map((m) => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentValue.methodIds.includes(m.id)}
                  onChange={() => toggleMethod(m.id)}
                  className="rounded"
                />
                <span className="font-medium">{m.code}</span>
                <span className="text-muted-foreground">{m.parameter}</span>
                {m.unit && <span className="text-xs text-muted-foreground">({m.unit})</span>}
                {m.orgId === null && <span className="text-[10px] text-muted-foreground bg-muted rounded px-1">Global</span>}
              </label>
            ))
          )}
        </div>
      </div>
      {!currentValue.matrixId && currentValue.methodIds.length === 0 && (
        <p className="text-xs text-amber-600">Debes seleccionar al menos una matriz o un metodo</p>
      )}
    </div>
  )
}

function EntryFormFields({
  record,
  entryData,
  setEntryData,
  formulaResults,
  resolveFieldValue,
  isEditing,
}: {
  record: RecordDetail
  entryData: Record<string, unknown>
  setEntryData: (data: Record<string, unknown>) => void
  formulaResults: Record<string, number>
  resolveFieldValue: (fieldId: string, data: Record<string, unknown>, formulaResults: Record<string, number>) => number | undefined
  isEditing: boolean
}) {
  return (
    <>
      {record.fields.map((field) => {
        const Icon = fieldTypeIcons[field.fieldType] || Hash
        const value = entryData[field.id]

        // --- RELATED_ENTRY (single select) ---
        if (field.fieldType === 'RELATED_ENTRY' && field.relatedRecordId) {
          return (
            <RelatedEntryField
              key={field.id}
              field={field}
              entryData={entryData}
              setEntryData={setEntryData}
            />
          )
        }

        // --- MULTIPLE_RELATED_ENTRY (multi select) ---
        if (field.fieldType === 'MULTIPLE_RELATED_ENTRY' && field.relatedRecordId) {
          return (
            <MultiRelatedEntryField
              key={field.id}
              field={field}
              entryData={entryData}
              setEntryData={setEntryData}
            />
          )
        }

        // --- FORMULA: solo lectura, chain-aware ---
        if (field.fieldType === 'FORMULA') {
          const result = formulaResults[field.id]
          return (
            <div key={field.id} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {field.label}
                <Badge variant="outline" className="text-[10px]">Fórmula</Badge>
              </label>
              <div className="flex h-10 items-center rounded-md border bg-muted/50 px-3 text-sm font-mono">
                = {result !== undefined ? result.toFixed(4) : '—'}
              </div>
            </div>
          )
        }

        // --- COMPARISON ---
        if (field.fieldType === 'COMPARISON') {
          const config = field.comparisonConfig as {
            fieldId?: string
            operator: string
            compareAgainst: 'CONSTANT' | 'FIELD'
            constantValue?: number
            compareFieldId?: string
            secondValue?: number
          } | null

          let passed: boolean | null = null
          let desc = ''
          let evaluatedValue: number | undefined

          if (config) {
            // Obtener el valor a comparar: del fieldId referenciado, o del propio campo
            if (config.fieldId) {
              evaluatedValue = resolveFieldValue(config.fieldId, entryData, formulaResults)
            } else {
              // Legacy: el valor viene del propio campo comparison (input manual)
              const rawVal = entryData[field.id]
              evaluatedValue = rawVal !== undefined && rawVal !== '' ? Number(rawVal) : undefined
            }

            const target = config.compareAgainst === 'FIELD' && config.compareFieldId
              ? resolveFieldValue(config.compareFieldId, entryData, formulaResults)
              : (config.constantValue ?? 0)

            if (evaluatedValue !== undefined && target !== undefined) {
              switch (config.operator) {
                case 'GT': passed = evaluatedValue > target; desc = `> ${target}`; break
                case 'GTE': passed = evaluatedValue >= target; desc = `>= ${target}`; break
                case 'LT': passed = evaluatedValue < target; desc = `< ${target}`; break
                case 'LTE': passed = evaluatedValue <= target; desc = `<= ${target}`; break
                case 'EQ': passed = evaluatedValue === target; desc = `= ${target}`; break
                case 'BETWEEN':
                  passed = evaluatedValue >= target && evaluatedValue <= (config.secondValue ?? target)
                  desc = `${target} — ${config.secondValue}`
                  break
              }
            }

            // Build description
            if (config.fieldId) {
              const evaluatedField = record.fields.find((f) => f.id === config.fieldId || f.label.toUpperCase() === config.fieldId!.toUpperCase())
              if (evaluatedField) {
                desc = `${evaluatedField.label} (${evaluatedValue !== undefined ? evaluatedValue.toFixed(4) : '?'}): ${desc}`
              }
            }
          }

          // If no fieldId, show an input for manual entry (legacy mode)
          if (!config?.fieldId) {
            return (
              <div key={field.id} className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {field.label}
                  {field.isRequired && <span className="text-destructive">*</span>}
                  <Badge variant="outline" className="text-[10px]">Comparación</Badge>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={entryData[field.id] as string ?? ''}
                    onChange={(e) => setEntryData({ ...entryData, [field.id]: e.target.value ? Number(e.target.value) : '' })}
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder={desc || 'Ingresar valor'}
                  />
                  {passed !== null && (
                    <div className={`flex items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
                      passed
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
                    }`}>
                      {passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {passed ? 'Cumple' : 'No cumple'}
                    </div>
                  )}
                </div>
                {desc && <p className="text-xs text-muted-foreground">Condición: {desc}</p>}
              </div>
            )
          }

          // With fieldId: read-only display
          return (
            <div key={field.id} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {field.label}
                <Badge variant="outline" className="text-[10px]">Comparación</Badge>
              </label>
              <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm">
                {passed !== null ? (
                  <div className={`flex items-center gap-1.5 font-medium ${
                    passed
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    {passed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {passed ? 'Cumple' : 'No cumple'}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Pendiente de evaluación</span>
                )}
              </div>
              {desc && <p className="text-xs text-muted-foreground">Condición: {desc}</p>}
            </div>
          )
        }

        // --- RECIPE_SELECT ---
        if (field.fieldType === 'RECIPE_SELECT') {
          return (
            <RecipeSelectField
              key={field.id}
              field={field}
              entryData={entryData}
              setEntryData={setEntryData}
            />
          )
        }

        // --- CALIBRATION_TEMPLATE ---
        if (field.fieldType === 'CALIBRATION_TEMPLATE') {
          return (
            <CalibrationTemplateSelectField
              key={field.id}
              field={field}
              entryData={entryData}
              setEntryData={setEntryData}
            />
          )
        }

        // --- MATRIX_METHOD ---
        if (field.fieldType === 'MATRIX_METHOD') {
          return (
            <MatrixMethodField
              key={field.id}
              field={field}
              entryData={entryData}
              setEntryData={setEntryData}
            />
          )
        }

        // --- QUANTITY ---
        if (field.fieldType === 'QUANTITY') {
          const qtyValue = (value || { value: null, unit: '' }) as { value: number | null; unit: string }
          const units = (field.comparisonConfig as { units?: string[] })?.units || []
          return (
            <div key={field.id} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {field.label}
                {field.isRequired && <span className="text-destructive">*</span>}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={qtyValue.value ?? ''}
                  onChange={(e) => setEntryData({
                    ...entryData,
                    [field.id]: { ...qtyValue, value: e.target.value ? parseFloat(e.target.value) : null },
                  })}
                  placeholder="Cantidad"
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <select
                  value={qtyValue.unit || ''}
                  onChange={(e) => setEntryData({
                    ...entryData,
                    [field.id]: { ...qtyValue, unit: e.target.value },
                  })}
                  className="w-24 h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">—</option>
                  {units.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          )
        }

        // --- DROPDOWN ---
        if (field.fieldType === 'DROPDOWN') {
          const config = field.comparisonConfig as { options?: string[] } | null
          const options = config?.options || []
          return (
            <div key={field.id} className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {field.label}
                {field.isRequired && <span className="text-destructive">*</span>}
              </label>
              <select
                value={(value as string) ?? ''}
                onChange={(e) => setEntryData({ ...entryData, [field.id]: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Seleccionar...</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )
        }

        // --- NUMBER / TEXT / DATE ---
        const isIdentifierLocked = field.isIdentifier && isEditing
        return (
          <div key={field.id} className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {field.label}
              {field.isRequired && <span className="text-destructive">*</span>}
              {field.isIdentifier && <Star className="h-3 w-3 text-amber-500" fill="currentColor" />}
              {isIdentifierLocked && <span className="text-xs text-muted-foreground">(no editable)</span>}
            </label>
            <input
              type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
              value={value as string ?? ''}
              readOnly={isIdentifierLocked}
              onChange={(e) => {
                if (isIdentifierLocked) return
                setEntryData({
                  ...entryData,
                  [field.id]: field.fieldType === 'NUMBER' ? (e.target.value ? Number(e.target.value) : '') : e.target.value,
                })
              }}
              className={`flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isIdentifierLocked ? 'bg-muted cursor-not-allowed' : 'bg-background'
              }`}
            />
          </div>
        )
      })}
    </>
  )
}

export default function RecordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const recordId = params.id as string

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editFields, setEditFields] = useState<FieldDef[]>([])
  const [removeFieldIds, setRemoveFieldIds] = useState<string[]>([])
  const [changeReason, setChangeReason] = useState('')

  // Actions
  const [showAddAction, setShowAddAction] = useState(false)
  const [actionTargetId, setActionTargetId] = useState('')
  const [fieldMapping, setFieldMapping] = useState<Array<{ sourceFieldId: string; targetFieldId: string }>>([])
  const [actionStep, setActionStep] = useState<'select' | 'map'>('select')

  // Entries
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [entryData, setEntryData] = useState<Record<string, unknown>>({})
  const [entryMeta, setEntryMeta] = useState<{ lotNumber?: string; sampleCode?: string; client?: string }>({})
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [viewingEntry, setViewingEntry] = useState<boolean>(false)

  const { data: record, isLoading } = useQuery<RecordDetail>({
    queryKey: ['record', recordId],
    queryFn: () => api.records.get(recordId) as Promise<RecordDetail>,
  })

  // Lista de registros para el selector de acciones
  const { data: allRecords = [] } = useQuery<RecordListItem[]>({
    queryKey: ['records'],
    queryFn: () => api.records.list() as Promise<RecordListItem[]>,
  })

  interface EntryItem {
    id: string
    status: 'DRAFT' | 'COMPLETED'
    data: Record<string, unknown>
    comparisonResults: Record<string, { passed: boolean; value: unknown; description: string }> | null
    formulaResults: Record<string, number> | null
    dueDate: string | null
    completedAt: string | null
    createdAt: string
    triggeredById: string | null
    instrument?: { id: string; status: string; nextCalibrationAt: string | null } | null
    batch?: { id: string; lotNumber: string; status: string; producedQuantity: number | null; unit: string | null } | null
    sample?: { id: string; sampleCode: string; status: string; client: string | null; results: Record<string, { value: number | null; observations?: string }> | null; matrixId: string | null; matrix: { id: string; name: string; code: string | null; parameters: Array<{ id: string; name: string; unit: string | null; minValue: number | null; maxValue: number | null; order: number }> } | null } | null
  }

  const { data: entries = [] } = useQuery<EntryItem[]>({
    queryKey: ['entries', recordId],
    queryFn: () => api.entries.list(recordId) as Promise<EntryItem[]>,
  })

  // Matrices y métodos para resolver nombres en campos MATRIX_METHOD
  const hasMatrixMethodField = record?.fields.some((f) => f.fieldType === 'MATRIX_METHOD')
  const { data: matricesMap = {} } = useQuery({
    queryKey: ['matrices-map'],
    queryFn: async () => {
      const list = await api.matrices.list() as Array<{ id: string; name: string; code: string | null; parameters: Array<{ name: string; method: string | null; unit: string | null }> }>
      const map: Record<string, { name: string; code: string | null; parameters: Array<{ name: string; method: string | null; unit: string | null }> }> = {}
      for (const m of list) map[m.id] = { name: m.name, code: m.code, parameters: m.parameters }
      return map
    },
    enabled: !!hasMatrixMethodField,
  })
  const { data: methodsMap = {} } = useQuery({
    queryKey: ['methods-map'],
    queryFn: async () => {
      const list = await api.methods.search() as Array<{ id: string; code: string; parameter: string; unit: string | null }>
      const map: Record<string, { code: string; parameter: string; unit: string | null }> = {}
      for (const m of list) map[m.id] = { code: m.code, parameter: m.parameter, unit: m.unit }
      return map
    },
    enabled: !!hasMatrixMethodField,
  })
  const hasRecipeSelectField = record?.fields.some((f) => f.fieldType === 'RECIPE_SELECT')
  const { data: recipesMap = {} } = useQuery({
    queryKey: ['recipes-map'],
    queryFn: async () => {
      const list = await api.recipes.list() as Array<{ id: string; name: string; code: string | null; ingredients: Array<{ name: string; quantity: number; unit: string }>; steps: Array<{ name: string; duration: number | null }> }>
      const map: Record<string, { name: string; code: string | null; ingredients: Array<{ name: string; quantity: number; unit: string }>; steps: Array<{ name: string; duration: number | null }> }> = {}
      for (const r of list) map[r.id] = { name: r.name, code: r.code, ingredients: r.ingredients, steps: r.steps }
      return map
    },
    enabled: !!hasRecipeSelectField,
  })
  const hasCalibrationTemplateField = record?.fields.some((f) => f.fieldType === 'CALIBRATION_TEMPLATE')
  const { data: calibrationTemplatesMap = {} } = useQuery({
    queryKey: ['calibration-templates-map'],
    queryFn: async () => {
      const list = await api.calibrationTemplates.list() as Array<{ id: string; name: string; code: string | null }>
      const map: Record<string, { name: string; code: string | null }> = {}
      for (const t of list) map[t.id] = { name: t.name, code: t.code }
      return map
    },
    enabled: !!hasCalibrationTemplateField,
  })

  const createEntryMutation = useMutation({
    mutationFn: (body: { data: Record<string, unknown>; lotNumber?: string; sampleCode?: string; client?: string }) =>
      api.entries.create(recordId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', recordId] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['calibrations'] })
      setShowNewEntry(false)
      setEntryData({})
      setEntryMeta({})
      toast.success('Entrada creada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Refetch entries con retry para esperar que el listener del backend cree la siguiente entry
  const refetchEntries = async () => {
    await new Promise((r) => setTimeout(r, 300))
    await queryClient.refetchQueries({ queryKey: ['entries', recordId] })
    // Segundo refetch para asegurar que el listener terminó
    await new Promise((r) => setTimeout(r, 700))
    await queryClient.refetchQueries({ queryKey: ['entries', recordId] })
  }

  const updateEntryMutation = useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: Record<string, unknown> }) => {
      await api.entries.update(recordId, entryId, data)
      await api.entries.complete(recordId, entryId)
    },
    onSuccess: () => {
      setShowNewEntry(false)
      setEntryData({})
      setEditingEntryId(null)
      setViewingEntry(false)
      toast.success('Entrada completada')
      refetchEntries()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const completeEntryMutation = useMutation({
    mutationFn: (entryId: string) => api.entries.complete(recordId, entryId),
    onSuccess: () => {
      toast.success('Entrada completada')
      refetchEntries()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.records.update(recordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', recordId] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      setEditing(false)
      setChangeReason('')
      setRemoveFieldIds([])
      toast.success('Registro actualizado (nueva versión)')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.records.archive(recordId),
    onSuccess: () => {
      toast.success('Registro archivado')
      router.push('/records')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addActionMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.records.addAction(recordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', recordId] })
      setShowAddAction(false)
      setActionTargetId('')
      setFieldMapping([])
      setActionStep('select')
      toast.success('Acción agregada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteActionMutation = useMutation({
    mutationFn: (actionId: string) => api.records.deleteAction(recordId, actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', recordId] })
      toast.success('Acción eliminada')
    },
  })

  const submitForApprovalMutation = useMutation({
    mutationFn: () => api.approval.submit({ entityType: 'RECORD', entityId: recordId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', recordId] })
      toast.success('Registro enviado a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const startEditing = () => {
    if (!record) return
    setEditing(true)
    setEditName(record.name)
    setEditFields(record.fields.map((f) => ({ ...f })))
    setRemoveFieldIds([])
    setChangeReason('')
  }

  const addNewField = (fieldType: string) => {
    tempCounter++
    const newField: FieldDef = {
      id: `new_${tempCounter}`,
      label: '',
      fieldType,
      order: editFields.length,
      isIdentifier: false,
      isRequired: true,
      comparisonConfig: fieldType === 'COMPARISON'
        ? { operator: 'GTE', compareAgainst: 'CONSTANT', constantValue: 0 }
        : fieldType === 'DROPDOWN'
        ? { options: [''] }
        : fieldType === 'QUANTITY'
        ? { units: ['kg', 'g'] }
        : null,
      formulaConfig: fieldType === 'FORMULA' ? { expression: '' } : null,
      isNew: true,
    }
    setEditFields([...editFields, newField])
  }

  const updateEditField = (id: string, updates: Partial<FieldDef>) => {
    setEditFields(editFields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  const markFieldForRemoval = (id: string) => {
    if (id.startsWith('new_')) {
      setEditFields(editFields.filter((f) => f.id !== id))
    } else {
      setRemoveFieldIds([...removeFieldIds, id])
      setEditFields(editFields.map((f) => (f.id === id ? { ...f, markedForRemoval: true } : f)))
    }
  }

  const unmarkFieldForRemoval = (id: string) => {
    setRemoveFieldIds(removeFieldIds.filter((fid) => fid !== id))
    setEditFields(editFields.map((f) => (f.id === id ? { ...f, markedForRemoval: false } : f)))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...editFields]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newFields.length) return
    ;[newFields[index], newFields[target]] = [newFields[target], newFields[index]]
    setEditFields(newFields.map((f, i) => ({ ...f, order: i })))
  }

  const handleSaveEdit = () => {
    if (!changeReason.trim()) return toast.error('El motivo del cambio es obligatorio')

    const activeFields = editFields.filter((f) => !f.markedForRemoval)
    if (!activeFields.some((f) => f.isIdentifier)) return toast.error('Al menos un campo debe ser identificador')

    const newFields = editFields
      .filter((f) => f.isNew && !f.markedForRemoval)
      .map((f, i) => ({
        label: f.label,
        fieldType: f.fieldType,
        order: f.order,
        isIdentifier: f.isIdentifier,
        isRequired: f.isRequired,
        comparisonConfig: f.comparisonConfig || undefined,
        formulaConfig: f.formulaConfig || undefined,
      }))

    const updatedFields = editFields
      .filter((f) => !f.isNew && !f.markedForRemoval)
      .map((f) => ({
        id: f.id,
        label: f.label,
        order: f.order,
        isRequired: f.isRequired,
      }))

    editMutation.mutate({
      name: editName !== record?.name ? editName : undefined,
      changeReason,
      addFields: newFields.length > 0 ? newFields : undefined,
      removeFieldIds: removeFieldIds.length > 0 ? removeFieldIds : undefined,
      updateFields: updatedFields.length > 0 ? updatedFields : undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!record) return null
  const type = typeConfig[record.type]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/records">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{record.name}</h1>
              <Badge variant={type.variant}>{type.label}</Badge>
              <Badge variant="outline">v{record.version}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              {record.area && <span>{record.area.name}</span>}
              {(record.type === 'PERIODIC' || record.type === 'INSTRUMENTAL') && record.periodicity && (
                <>
                  <span>&middot;</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Cada {record.periodicity} días
                  </span>
                </>
              )}
              {(record as Record<string, unknown>).recipe && (
                <>
                  <span>&middot;</span>
                  <span className="flex items-center gap-1">
                    Receta: {((record as Record<string, unknown>).recipe as { name: string }).name}
                  </span>
                </>
              )}
              {record.changeLog && (
                <>
                  <span>&middot;</span>
                  <span className="flex items-center gap-1 italic">
                    <History className="h-3 w-3" />
                    {record.changeLog}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Guardando...' : 'Guardar versión'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => {
                  if (confirm('¿Archivar este registro? Podés restaurarlo después desde la pestaña Archivados.')) {
                    archiveMutation.mutate()
                  }
                }}
                disabled={archiveMutation.isPending}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archivar
              </Button>
              <Button variant="outline" onClick={startEditing}>
                <Settings className="mr-2 h-4 w-4" />
                Editar
              </Button>
              {!(record.type === 'PERIODIC' && record.actionsAsTarget.length > 0) && (
                <Button onClick={() => { setShowNewEntry(true); setEntryData({}); setEditingEntryId(null); setViewingEntry(false) }}>
                  <Layers className="mr-2 h-4 w-4" />
                  Nueva entrada
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Motivo del cambio (solo en edición) */}
      {editing && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motivo del cambio *
                <span className="ml-2 font-normal text-muted-foreground">
                  (esto crea la versión {record.version + 1})
                </span>
              </label>
              <input
                type="text"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Ej: Se agrega campo de temperatura ambiente por requisito de norma..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info de campos obligatorios */}
      {['INSTRUMENTAL', 'BATCH', 'SAMPLE', 'STOCK'].includes(record.type) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            <span className="font-semibold">Campos obligatorios: </span>
            {record.type === 'INSTRUMENTAL' && 'CODIGO (identificador)'}
            {record.type === 'BATCH' && 'LOTE (identificador), RECETA (tipo Receta, opcional)'}
            {record.type === 'SAMPLE' && 'CODIGO MUESTRA (identificador), MATRIZ Y METODOS (tipo Matriz y Metodos)'}
            {record.type === 'STOCK' && 'LOTE (identificador), PRODUCTO, TIPO MOVIMIENTO, CANTIDAD'}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Campos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Campos ({editing ? editFields.filter((f) => !f.markedForRemoval).length : record.fields.length})
              </CardTitle>
              <CardDescription>Estructura de datos de cada entrada</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-lg border">
              {(editing ? editFields : record.fields).map((field, index) => {
                const Icon = fieldTypeIcons[field.fieldType] || Hash
                const isRemoved = 'markedForRemoval' in field && field.markedForRemoval
                return (
                  <div key={field.id}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      isRemoved ? 'bg-red-50/50 opacity-50 line-through dark:bg-red-950/10' : ''
                    }`}
                  >
                    {editing && !isRemoved && (
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveField(index, 'up')} disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button onClick={() => moveField(index, 'down')} disabled={index === editFields.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {editing && !isRemoved ? (
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateEditField(field.id, { label: e.target.value })}
                            className="bg-transparent text-sm font-medium outline-none border-b border-transparent focus:border-primary"
                            placeholder="Nombre del campo..."
                          />
                        ) : (
                          <span className="text-sm font-medium">{field.label}</span>
                        )}
                        {field.isIdentifier && (
                          <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
                        )}
                        {'isNew' in field && field.isNew && (
                          <Badge variant="success" className="text-[10px]">Nuevo</Badge>
                        )}
                      </div>
                      {field.fieldType === 'COMPARISON' && field.comparisonConfig && (
                        <p className="text-xs text-muted-foreground">
                          {(field.comparisonConfig as Record<string, unknown>).operator}{' '}
                          {(field.comparisonConfig as Record<string, unknown>).constantValue}
                          {(field.comparisonConfig as Record<string, unknown>).operator === 'BETWEEN' &&
                            ` - ${(field.comparisonConfig as Record<string, unknown>).secondValue}`}
                        </p>
                      )}
                      {field.fieldType === 'FORMULA' && field.formulaConfig && (
                        <p className="text-xs font-mono text-muted-foreground">= {field.formulaConfig.expression}</p>
                      )}
                    </div>
                    {editing && !isRemoved && (
                      <button
                        onClick={() => updateEditField(field.id, { isIdentifier: !field.isIdentifier })}
                        className={`rounded p-1.5 transition-colors ${
                          field.isIdentifier
                            ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30'
                            : 'text-muted-foreground/30 hover:text-muted-foreground'
                        }`}
                        title={field.isIdentifier ? 'Quitar identificador' : 'Marcar como identificador'}
                      >
                        <Star className="h-3.5 w-3.5" fill={field.isIdentifier ? 'currentColor' : 'none'} />
                      </button>
                    )}
                    {editing && !isRemoved ? (
                      <select
                        value={field.fieldType}
                        onChange={(e) => updateEditField(field.id, { fieldType: e.target.value })}
                        className="h-7 rounded-md border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {fieldTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <Badge variant="outline" className="text-xs">{fieldTypeLabels[field.fieldType]}</Badge>
                    )}
                    {editing && (
                      isRemoved ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => unmarkFieldForRemoval(field.id)}>
                          <Plus className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markFieldForRemoval(field.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )
                    )}
                  </div>
                  {/* Config panel para campos en edición */}
                  {editing && !isRemoved && (field.fieldType === 'DROPDOWN' || field.fieldType === 'QUANTITY' || field.fieldType === 'FORMULA' || field.fieldType === 'COMPARISON') && (
                    <div className="border-t px-4 py-3 space-y-3">
                      {/* DROPDOWN opciones */}
                      {field.fieldType === 'DROPDOWN' && (
                        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Opciones del desplegable</p>
                          {((field.comparisonConfig as { options?: string[] })?.options || ['']).map((opt: string, oi: number) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="w-5 text-center text-xs text-muted-foreground">{oi + 1}</span>
                              <input
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...((field.comparisonConfig as { options?: string[] })?.options || [''])]
                                  opts[oi] = e.target.value
                                  updateEditField(field.id, { comparisonConfig: { options: opts } })
                                }}
                                placeholder={`Opcion ${oi + 1}`}
                                className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                              {((field.comparisonConfig as { options?: string[] })?.options || []).length > 1 && (
                                <button onClick={() => {
                                  const opts = ((field.comparisonConfig as { options?: string[] })?.options || []).filter((_: string, j: number) => j !== oi)
                                  updateEditField(field.id, { comparisonConfig: { options: opts } })
                                }} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => {
                            const opts = [...((field.comparisonConfig as { options?: string[] })?.options || []), '']
                            updateEditField(field.id, { comparisonConfig: { options: opts } })
                          }} className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Plus className="h-3 w-3" /> Agregar opcion
                          </button>
                        </div>
                      )}

                      {/* QUANTITY unidades */}
                      {field.fieldType === 'QUANTITY' && (
                        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Unidades disponibles</p>
                          {((field.comparisonConfig as { units?: string[] })?.units || ['KG', 'G']).map((u: string, ui: number) => (
                            <div key={ui} className="flex items-center gap-2">
                              <input
                                value={u}
                                onChange={(e) => {
                                  const units = [...((field.comparisonConfig as { units?: string[] })?.units || ['KG', 'G'])]
                                  units[ui] = e.target.value
                                  updateEditField(field.id, { comparisonConfig: { units } })
                                }}
                                placeholder={`Unidad ${ui + 1}`}
                                className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                              {((field.comparisonConfig as { units?: string[] })?.units || []).length > 1 && (
                                <button onClick={() => {
                                  const units = ((field.comparisonConfig as { units?: string[] })?.units || []).filter((_: string, j: number) => j !== ui)
                                  updateEditField(field.id, { comparisonConfig: { units } })
                                }} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                              )}
                            </div>
                          ))}
                          <button onClick={() => {
                            const units = [...((field.comparisonConfig as { units?: string[] })?.units || []), '']
                            updateEditField(field.id, { comparisonConfig: { units } })
                          }} className="flex items-center gap-1 text-xs text-primary hover:underline">
                            <Plus className="h-3 w-3" /> Agregar unidad
                          </button>
                        </div>
                      )}

                      {/* FORMULA expresion */}
                      {field.fieldType === 'FORMULA' && (
                        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Expresion de formula</p>
                          <input
                            value={field.formulaConfig?.expression || ''}
                            onChange={(e) => updateEditField(field.id, { formulaConfig: { expression: e.target.value } })}
                            placeholder="Ej: CAMPO1 + CAMPO2"
                            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          {editFields.filter((f) => !f.markedForRemoval && (f.fieldType === 'NUMBER' || f.fieldType === 'FORMULA' || f.fieldType === 'QUANTITY') && f.label && f.id !== field.id).length > 0 && (
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-1">Campos disponibles:</p>
                              <div className="flex flex-wrap gap-1">
                                {editFields.filter((f) => !f.markedForRemoval && (f.fieldType === 'NUMBER' || f.fieldType === 'FORMULA' || f.fieldType === 'QUANTITY') && f.label && f.id !== field.id).map((f) => (
                                  <button
                                    key={f.id}
                                    onClick={() => updateEditField(field.id, { formulaConfig: { expression: (field.formulaConfig?.expression || '') + f.label } })}
                                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono hover:bg-primary/10"
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* COMPARISON config */}
                      {field.fieldType === 'COMPARISON' && (() => {
                        const config = (field.comparisonConfig || { operator: 'GTE', compareAgainst: 'CONSTANT', constantValue: 0 }) as {
                          operator: string; compareAgainst: string; constantValue?: number; fieldId?: string; compareFieldId?: string; secondValue?: number
                        }
                        const numericFields = editFields.filter((f) => !f.markedForRemoval && (f.fieldType === 'NUMBER' || f.fieldType === 'FORMULA' || f.fieldType === 'QUANTITY') && f.label && f.id !== field.id)
                        return (
                          <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground">Configuracion de comparacion</p>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">Campo a comparar</label>
                              <select
                                value={config.fieldId ?? ''}
                                onChange={(e) => updateEditField(field.id, { comparisonConfig: { ...config, fieldId: e.target.value } })}
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                              >
                                <option value="">Seleccionar campo...</option>
                                {numericFields.map((nf) => (
                                  <option key={nf.id} value={nf.id}>{nf.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Operador</label>
                                <select
                                  value={config.operator}
                                  onChange={(e) => updateEditField(field.id, { comparisonConfig: { ...config, operator: e.target.value } })}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  {comparisonOperators.map((op) => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Comparar contra</label>
                                <select
                                  value={config.compareAgainst}
                                  onChange={(e) => updateEditField(field.id, { comparisonConfig: { ...config, compareAgainst: e.target.value } })}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="CONSTANT">Valor constante</option>
                                  <option value="FIELD">Otro campo</option>
                                </select>
                              </div>
                            </div>
                            {config.compareAgainst === 'CONSTANT' && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">Valor</label>
                                  <input type="number" value={config.constantValue ?? ''} onChange={(e) => updateEditField(field.id, { comparisonConfig: { ...config, constantValue: parseFloat(e.target.value) || 0 } })} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                                </div>
                                {config.operator === 'BETWEEN' && (
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Segundo valor</label>
                                    <input type="number" value={config.secondValue ?? ''} onChange={(e) => updateEditField(field.id, { comparisonConfig: { ...config, secondValue: parseFloat(e.target.value) || 0 } })} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs" />
                                  </div>
                                )}
                              </div>
                            )}
                            {config.compareAgainst === 'FIELD' && (
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Campo de comparacion</label>
                                <select
                                  value={config.compareFieldId ?? ''}
                                  onChange={(e) => updateEditField(field.id, { comparisonConfig: { ...config, compareFieldId: e.target.value } })}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                                >
                                  <option value="">Seleccionar...</option>
                                  {numericFields.map((nf) => (
                                    <option key={nf.id} value={nf.id}>{nf.label}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* Required checkbox */}
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={field.isRequired}
                          onChange={(e) => updateEditField(field.id, { isRequired: e.target.checked })}
                          className="rounded"
                        />
                        Campo obligatorio
                      </label>
                    </div>
                  )}
                  </div>
                )
              })}
            </div>

            {/* Agregar campos en edición */}
            {editing && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Agregar campo:</p>
                <div className="flex flex-wrap gap-2">
                  {fieldTypeOptions.map((opt) => (
                    <Button key={opt.value} variant="outline" size="sm" onClick={() => addNewField(opt.value)} className="gap-1.5">
                      <opt.icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel lateral */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={
                  (record as Record<string, unknown>).status === 'ACTIVE' ? 'success'
                    : (record as Record<string, unknown>).status === 'IN_REVIEW' ? 'warning'
                    : 'secondary'
                }>
                  {(record as Record<string, unknown>).status === 'ACTIVE' ? 'Activo'
                    : (record as Record<string, unknown>).status === 'IN_REVIEW' ? 'En revisión'
                    : 'Borrador'}
                </Badge>
              </div>
              {(record as Record<string, unknown>).status === 'DRAFT' && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => submitForApprovalMutation.mutate()}
                  disabled={submitForApprovalMutation.isPending}
                >
                  <Send className="mr-2 h-3 w-3" />
                  Enviar a revisión
                </Button>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versión</span>
                <span className="font-medium">{record.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creado</span>
                <span>{new Date(record.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Campos activos</span>
                <span>{record.fields.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Identificadores</span>
                <span>{record.fields.filter((f) => f.isIdentifier).length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Acciones automáticas */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Acciones automáticas</CardTitle>
              {!editing && !showAddAction && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowAddAction(true); setActionStep('select') }}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {record.actionsAsSource.length === 0 && record.actionsAsTarget.length === 0 && !showAddAction ? (
                <p className="text-sm text-muted-foreground">
                  Sin acciones. Permiten crear entradas automáticamente en otro registro al completar una entrada acá.
                </p>
              ) : (
                <div className="space-y-2">
                  {record.actionsAsSource.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">Dispara → </span>
                        <Link href={`/records/${a.targetRecord.id}`} className="font-medium text-primary hover:underline">
                          {a.targetRecord.name}
                        </Link>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => deleteActionMutation.mutate(a.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  {record.actionsAsTarget.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <div className="flex-1 text-sm">
                        <span className="text-muted-foreground">Disparado por ← </span>
                        <Link href={`/records/${a.sourceRecord.id}`} className="font-medium text-primary hover:underline">
                          {a.sourceRecord.name}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar acción — Paso 1: seleccionar registro */}
              {showAddAction && actionStep === 'select' && (
                <div className="mt-3 space-y-3 rounded-lg border border-primary/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Paso 1: Seleccionar registro destino
                  </p>
                  <select
                    value={actionTargetId}
                    onChange={(e) => setActionTargetId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Seleccionar registro...</option>
                    {allRecords
                      .filter((r) => r.id !== recordId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>{r.name} {r.type === 'PERIODIC' ? '(periódico)' : ''}</option>
                      ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!actionTargetId}
                      onClick={() => {
                        setFieldMapping([])
                        setActionStep('map')
                      }}
                    >
                      Siguiente: Mapear campos
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowAddAction(false); setActionTargetId(''); setFieldMapping([]) }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}

              {/* Agregar acción — Paso 2: mapear campos */}
              {showAddAction && actionStep === 'map' && (() => {
                const targetRecord = allRecords.find((r) => r.id === actionTargetId)
                if (!targetRecord) return null
                const sourceFields = record.fields
                const targetFields = targetRecord.fields

                const getMapping = (targetFieldId: string) =>
                  fieldMapping.find((m) => m.targetFieldId === targetFieldId)?.sourceFieldId || ''

                const setMappingForTarget = (targetFieldId: string, sourceFieldId: string) => {
                  const existing = fieldMapping.filter((m) => m.targetFieldId !== targetFieldId)
                  if (sourceFieldId) {
                    existing.push({ sourceFieldId, targetFieldId })
                  }
                  setFieldMapping(existing)
                }

                // Campos identifier del target que deben estar mapeados
                const targetIdentifiers = targetFields.filter((f) => f.isIdentifier)
                const allIdentifiersMapped = targetIdentifiers.every(
                  (tf) => fieldMapping.some((m) => m.targetFieldId === tf.id),
                )

                return (
                  <div className="mt-3 space-y-3 rounded-lg border border-primary/20 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Paso 2: Mapear campos
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        {record.name} → {targetRecord.name}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Para cada campo del registro destino, elegí qué campo de este registro se copia.
                      Los campos identificadores (<Star className="inline h-3 w-3 text-amber-500" fill="currentColor" />) son obligatorios.
                    </p>

                    <div className="space-y-2">
                      {targetFields.map((tf) => {
                        const TargetIcon = fieldTypeIcons[tf.fieldType] || Hash
                        const isIdentifier = tf.isIdentifier
                        const currentSource = getMapping(tf.id)
                        // Filtrar source fields por tipo compatible
                        const compatibleSources = sourceFields.filter((sf) => sf.fieldType === tf.fieldType)

                        return (
                          <div
                            key={tf.id}
                            className={`flex items-center gap-2 rounded-lg border p-2.5 ${
                              isIdentifier && !currentSource ? 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <TargetIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-sm font-medium truncate">{tf.label}</span>
                              {isIdentifier && <Star className="h-3 w-3 shrink-0 text-amber-500" fill="currentColor" />}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">←</span>
                            <select
                              value={currentSource}
                              onChange={(e) => setMappingForTarget(tf.id, e.target.value)}
                              className={`h-8 w-40 shrink-0 rounded-md border border-input bg-background px-2 text-xs ${
                                isIdentifier && !currentSource ? 'border-amber-400' : ''
                              }`}
                            >
                              <option value="">{isIdentifier ? '⚠ Obligatorio' : '— Sin mapear —'}</option>
                              {compatibleSources.map((sf) => (
                                <option key={sf.id} value={sf.id}>{sf.label}</option>
                              ))}
                              {compatibleSources.length === 0 && (
                                <option disabled>No hay campos compatibles ({tf.fieldType})</option>
                              )}
                            </select>
                          </div>
                        )
                      })}
                    </div>

                    {targetRecord.type === 'PERIODIC' && (
                      <div className="rounded-lg bg-blue-50 p-2.5 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                        <Clock className="inline h-3 w-3 mr-1" />
                        La entrada creada tendrá fecha de vencimiento = fecha actual + {targetRecord.periodicity || '?'} días (periodicidad del registro destino).
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!allIdentifiersMapped || addActionMutation.isPending}
                        onClick={() => addActionMutation.mutate({
                          targetRecordId: actionTargetId,
                          fieldMapping,
                        })}
                      >
                        {addActionMutation.isPending ? 'Creando...' : 'Crear acción'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setActionStep('select')}>
                        Atrás
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowAddAction(false); setActionTargetId(''); setFieldMapping([]) }}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal nueva entrada */}
      {showNewEntry && record && (() => {
        // --- Helpers for formula chain evaluation ---
        const computeFormulaResults = (data: Record<string, unknown>): Record<string, number> => {
          const results: Record<string, number> = {}
          const formulaFields = record.fields.filter((f) => f.fieldType === 'FORMULA' && f.formulaConfig)

          // Multi-pass evaluation to resolve formula chains
          let changed = true
          let passes = 0
          const maxPasses = 10

          while (changed && passes < maxPasses) {
            changed = false
            passes++
            for (const field of formulaFields) {
              if (results[field.id] !== undefined) continue
              try {
                let expr = (field.formulaConfig as { expression: string }).expression

                // Replace NUMBER field values (by id and label)
                for (const f of record.fields) {
                  if (f.fieldType === 'NUMBER' && data[f.id] !== undefined && data[f.id] !== '') {
                    expr = expr.replace(new RegExp(f.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(data[f.id]))
                    expr = expr.replace(new RegExp(f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(data[f.id]))
                  }
                }


                // Replace RELATED_ENTRY transcribed values:
                // 1. By transcribed key (technical)
                // 2. By label of the related field (e.g. MASA)
                // 3. By label of the RELATED_ENTRY field itself (e.g. PATRON) when it transcribes exactly 1 numeric field
                for (const f of record.fields) {
                  if ((f.fieldType === 'RELATED_ENTRY' || f.fieldType === 'MULTIPLE_RELATED_ENTRY') && f.relatedFieldIds && f.relatedRecordId) {
                    const relRecord = allRecords.find((r: RecordListItem) => r.id === f.relatedRecordId)
                    let singleNumericVal: string | null = null
                    let numericCount = 0

                    for (const relFieldId of f.relatedFieldIds) {
                      const transcribedKey = `${f.id}_${relFieldId}`
                      const val = data[transcribedKey]
                      if (val !== undefined && val !== '') {
                        const valStr = String(val)
                        // Replace by technical key
                        expr = expr.replace(new RegExp(transcribedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), valStr)
                        // Replace by related field label (e.g. MASA)
                        if (relRecord) {
                          const relField = relRecord.fields.find((rf) => rf.id === relFieldId)
                          if (relField) {
                            expr = expr.replace(new RegExp(relField.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), valStr)
                          }
                          // Track if it's a numeric value
                          if (relField && (relField.fieldType === 'NUMBER' || !isNaN(Number(val)))) {
                            singleNumericVal = valStr
                            numericCount++
                          }
                        }
                      }
                    }

                    // If the RELATED_ENTRY transcribes a numeric value, also replace by its own label (e.g. PATRON -> 100)
                    if (singleNumericVal !== null && f.label) {
                      expr = expr.replace(new RegExp(f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), singleNumericVal)
                    }
                  }
                }

                // Replace by __label_ keys (fallback for transcribed field labels)
                for (const key of Object.keys(data)) {
                  if (key.startsWith('__label_') && data[key] !== undefined && data[key] !== '') {
                    const labelName = key.replace('__label_', '')
                    expr = expr.replace(new RegExp(labelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(data[key]))
                  }
                }

                // Replace already-resolved FORMULA results (by id and label)
                for (const fId of Object.keys(results)) {
                  const formulaField = record.fields.find((f) => f.id === fId)
                  expr = expr.replace(new RegExp(fId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(results[fId]))
                  if (formulaField) {
                    expr = expr.replace(new RegExp(formulaField.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(results[fId]))
                  }
                }


                const sanitized = expr.replace(/[^0-9+\-*/().  ]/g, '')

                const calc = Function(`"use strict"; return (${sanitized})`)()

                if (typeof calc === 'number' && !isNaN(calc)) {
                  results[field.id] = calc
                  changed = true
                }
              } catch (err) {

              }
            }
          }

          return results
        }

        // Resolve a field value for comparison (supports NUMBER, FORMULA, and transcribed fields)
        const resolveFieldValue = (fieldIdOrLabel: string, data: Record<string, unknown>, formulaResults: Record<string, number>): number | undefined => {
          // Buscar directamente por ID
          if (formulaResults[fieldIdOrLabel] !== undefined) return formulaResults[fieldIdOrLabel]
          if (data[fieldIdOrLabel] !== undefined && data[fieldIdOrLabel] !== '') return Number(data[fieldIdOrLabel])
          // Fallback: buscar por label (cuando el config guarda labels en vez de IDs)
          const fieldByLabel = record.fields.find((f) => f.label.toUpperCase() === fieldIdOrLabel.toUpperCase())
          if (fieldByLabel) {
            if (formulaResults[fieldByLabel.id] !== undefined) return formulaResults[fieldByLabel.id]
            if (data[fieldByLabel.id] !== undefined && data[fieldByLabel.id] !== '') return Number(data[fieldByLabel.id])
          }
          return undefined
        }

        const formulaResults = computeFormulaResults(entryData)

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl rounded-xl bg-background shadow-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h2 className="font-semibold">
                    {viewingEntry ? 'Detalle de entrada' : editingEntryId ? 'Completar entrada' : 'Nueva entrada'}
                  </h2>
                  <p className="text-sm text-muted-foreground">{record.name} — v{record.version}</p>
                </div>
                <button
                  onClick={() => { setShowNewEntry(false); setEntryData({}); setEntryMeta({}); setEditingEntryId(null); setViewingEntry(false) }}
                  className="rounded-lg p-2 hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Campo meta para SAMPLE: cliente */}
                {record.type === 'SAMPLE' && !editingEntryId && !viewingEntry && (
                  <div className="space-y-2 rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-900 dark:bg-green-950/30">
                    <p className="text-xs font-semibold text-green-700 dark:text-green-400">Datos de la muestra</p>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Cliente</label>
                      <input
                        value={entryMeta.client || ''}
                        onChange={(e) => setEntryMeta({ ...entryMeta, client: e.target.value })}
                        placeholder="Nombre del cliente"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
                <div className={viewingEntry ? 'pointer-events-none' : ''}>
                  <EntryFormFields
                    record={record}
                    entryData={entryData}
                    setEntryData={viewingEntry ? () => {} : setEntryData}
                    formulaResults={formulaResults}
                    resolveFieldValue={resolveFieldValue}
                    isEditing={!!editingEntryId}
                  />
                </div>
                {/* Resultados del sample asociado */}
                {viewingEntry && record.type === 'SAMPLE' && editingEntryId && (() => {
                  const entry = entries.find((e) => e.id === editingEntryId)
                  const s = entry?.sample
                  if (!s?.matrix?.parameters?.length) return null
                  const sampleResults = s.results || {}
                  return (
                    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                          <Microscope className="h-3.5 w-3.5" />
                          Resultados de laboratorio — {s.matrix.name}
                        </p>
                        <Link href={`/samples/${s.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Ver muestra
                          </Button>
                        </Link>
                      </div>
                      <div className="rounded-lg border divide-y bg-background">
                        {s.matrix.parameters.map((p) => {
                          const r = sampleResults[p.id] as { value: number | null; observations?: string } | undefined
                          const val = r?.value
                          const hasMin = p.minValue !== null && p.minValue !== undefined
                          const hasMax = p.maxValue !== null && p.maxValue !== undefined
                          let statusColor = ''
                          let statusLabel = ''
                          if (val !== null && val !== undefined) {
                            if ((hasMin && val < p.minValue!) || (hasMax && val > p.maxValue!)) {
                              statusColor = 'text-red-600'
                              statusLabel = 'No conforme'
                            } else if (hasMin || hasMax) {
                              statusColor = 'text-green-600'
                              statusLabel = 'Conforme'
                            }
                          }
                          return (
                            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                              <div className="flex-1">
                                <span className="text-muted-foreground">{p.name}</span>
                                {p.unit && <span className="ml-1 text-xs text-muted-foreground/60">({p.unit})</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`font-mono font-medium ${statusColor}`}>
                                  {val !== null && val !== undefined ? val : '—'}
                                </span>
                                {statusLabel && (
                                  <Badge variant={statusLabel === 'Conforme' ? 'success' : 'destructive'} className="text-[10px]">
                                    {statusLabel}
                                  </Badge>
                                )}
                                {hasMin || hasMax ? (
                                  <span className="text-[10px] text-muted-foreground">
                                    {hasMin && hasMax ? `${p.minValue} - ${p.maxValue}` : hasMin ? `≥ ${p.minValue}` : `≤ ${p.maxValue}`}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {Object.values(sampleResults).some((r: unknown) => (r as { observations?: string })?.observations) && (
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          {s.matrix.parameters.map((p) => {
                            const obs = (sampleResults[p.id] as { observations?: string })?.observations
                            return obs ? <p key={p.id}><strong>{p.name}:</strong> {obs}</p> : null
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="border-t px-6 py-4 flex gap-2">
                {viewingEntry ? (
                  <Button className="flex-1" onClick={() => { setShowNewEntry(false); setEntryData({}); setEntryMeta({}); setEditingEntryId(null); setViewingEntry(false) }}>
                    Cerrar
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        if (editingEntryId) {
                          updateEntryMutation.mutate({ entryId: editingEntryId, data: entryData })
                        } else {
                          // Extraer lotNumber/sampleCode del campo identificador
                          const identifierField = record.fields.find((f) => f.isIdentifier)
                          const identifierValue = identifierField ? String(entryData[identifierField.id] || '') : ''
                          const meta: Record<string, unknown> = { ...entryMeta }
                          if (record.type === 'BATCH') meta.lotNumber = identifierValue
                          if (record.type === 'SAMPLE') meta.sampleCode = identifierValue
                          createEntryMutation.mutate({ data: entryData, ...meta })
                        }
                      }}
                      disabled={createEntryMutation.isPending || updateEntryMutation.isPending}
                      className="flex-1"
                    >
                      {(createEntryMutation.isPending || updateEntryMutation.isPending)
                        ? (editingEntryId ? 'Guardando...' : 'Creando...')
                        : (editingEntryId ? 'Guardar y completar' : 'Crear entrada')}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowNewEntry(false); setEntryData({}); setEntryMeta({}); setEditingEntryId(null); setViewingEntry(false) }}>
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Tabla de entradas */}
      {!editing && record && (() => {
        const isInstrumental = record.type === 'INSTRUMENTAL'
        // Columnas: campos OWN visibles (no FORMULA ni COMPARISON para mantener la tabla limpia)
        const visibleFields = record.fields.filter(
          (f) => f.fieldType !== 'FORMULA' && f.fieldType !== 'COMPARISON',
        )

        const statusStyles: Record<string, { label: string; variant: 'secondary' | 'success' | 'warning' | 'info' }> = {
          DRAFT: { label: 'Borrador', variant: 'secondary' },
          COMPLETED: { label: 'Completada', variant: 'success' },
        }

        const instrumentStatusStyles: Record<string, { label: string; cls: string }> = {
          ACTIVE: { label: 'Activo', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
          IN_CALIBRATION: { label: 'En calibración', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
          IN_REPAIR: { label: 'En reparación', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
          DECOMMISSIONED: { label: 'Dado de baja', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
        }

        const formatCellValue = (value: unknown, fieldType: string): string => {
          if (value === undefined || value === null || value === '') return '—'
          if (fieldType === 'DATE' && typeof value === 'string') {
            return new Date(value).toLocaleDateString('es-AR')
          }
          return String(value)
        }

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Entradas ({entries.length})</CardTitle>
                <CardDescription>
                  {isInstrumental ? 'Instrumental dado de alta' : 'Instancias de este registro'}
                </CardDescription>
              </div>
              {/* Ocultar botón si es PERIODIC y recibe acciones (las entries se crean automáticamente) */}
              {!(record.type === 'PERIODIC' && record.actionsAsTarget.length > 0) && (
                <Button size="sm" onClick={() => { setShowNewEntry(true); setEntryData({}); setEditingEntryId(null); setViewingEntry(false) }}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isInstrumental ? 'Alta instrumental' : record.type === 'BATCH' ? 'Nuevo lote' : record.type === 'SAMPLE' ? 'Nueva muestra' : 'Nueva entrada'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Layers className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm font-medium">Sin entradas</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isInstrumental ? 'Dá de alta el primer instrumento' : 'Creá la primera entrada'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {visibleFields.map((f) => (
                          <th key={f.id} className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              {f.isIdentifier && <Star className="h-3 w-3 text-amber-500" fill="currentColor" />}
                              {f.label}
                            </span>
                          </th>
                        ))}
                        {isInstrumental && (
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado</th>
                        )}
                        {record.type === 'BATCH' && (
                          <>
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado lote</th>
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Producido</th>
                          </>
                        )}
                        {record.type === 'SAMPLE' && (
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado muestra</th>
                        )}
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                          {record.type === 'PERIODIC' ? 'Vencimiento' : 'Fecha'}
                        </th>
                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Estado entrada</th>
                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {entries.map((entry) => {
                        const data = entry.data as Record<string, unknown>
                        const st = statusStyles[entry.status]
                        const hasFailedComparisons = entry.comparisonResults
                          ? Object.values(entry.comparisonResults).some((r) => !r.passed)
                          : false
                        const instrStatus = entry.instrument ? instrumentStatusStyles[entry.instrument.status] : null

                        return (
                          <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                            {visibleFields.map((f) => {
                              // Para RELATED_ENTRY, mostrar valores transcriptos como link
                              if ((f.fieldType === 'RELATED_ENTRY' || f.fieldType === 'MULTIPLE_RELATED_ENTRY') && f.relatedRecordId && data[f.id]) {
                                // Buscar valores transcriptos para mostrar algo legible
                                const transcribedValues = (f.relatedFieldIds || [])
                                  .map((rfId) => data[`${f.id}_${rfId}`])
                                  .filter((v) => v !== undefined && v !== null)
                                const displayText = transcribedValues.length > 0
                                  ? transcribedValues.join(' | ')
                                  : String(data[f.id]).slice(0, 8) + '...'
                                return (
                                  <td key={f.id} className="px-3 py-2.5 max-w-[200px] truncate">
                                    <Link
                                      href={`/records/${f.relatedRecordId}`}
                                      className="text-primary hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {displayText}
                                    </Link>
                                  </td>
                                )
                              }
                              // Para MATRIX_METHOD, mostrar resumen + tooltip con detalle
                              if (f.fieldType === 'MATRIX_METHOD' && data[f.id] && typeof data[f.id] === 'object') {
                                const mm = data[f.id] as { matrixId?: string; methodIds?: string[] }
                                const matrixInfo = mm.matrixId ? matricesMap[mm.matrixId] : null
                                const selectedMethods = (mm.methodIds || []).map((mid) => methodsMap[mid]).filter(Boolean)
                                // Si hay matriz sin métodos específicos, usar los parámetros de la matriz
                                const useMatrixParams = matrixInfo && selectedMethods.length === 0
                                const paramCount = useMatrixParams ? matrixInfo.parameters.length : selectedMethods.length
                                const parts: string[] = []
                                if (matrixInfo) parts.push(matrixInfo.name)
                                if (paramCount > 0 && !useMatrixParams) parts.push(`${paramCount} mét.`)
                                if (useMatrixParams && paramCount > 0) parts.push(`${paramCount} param.`)
                                const summary = parts.length > 0 ? parts.join(' · ') : '—'

                                return (
                                  <td key={f.id} className="px-3 py-2.5 max-w-[200px]">
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-xs cursor-default truncate block">{summary}</span>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" align="start" className="max-w-xs p-3 space-y-2">
                                          {matrixInfo && (
                                            <div>
                                              <p className="text-xs font-semibold">Matriz</p>
                                              <p className="text-xs">{matrixInfo.name}{matrixInfo.code ? ` (${matrixInfo.code})` : ''}</p>
                                            </div>
                                          )}
                                          {selectedMethods.length > 0 && (
                                            <div>
                                              <p className="text-xs font-semibold">Métodos ({selectedMethods.length})</p>
                                              {selectedMethods.map((m, i) => (
                                                <p key={i} className="text-xs text-muted-foreground">
                                                  {m.code} — {m.parameter}{m.unit ? ` (${m.unit})` : ''}
                                                </p>
                                              ))}
                                            </div>
                                          )}
                                          {useMatrixParams && (
                                            <div>
                                              <p className="text-xs font-semibold">Parámetros ({matrixInfo.parameters.length})</p>
                                              {matrixInfo.parameters.map((p, i) => (
                                                <p key={i} className="text-xs text-muted-foreground">
                                                  {p.name}{p.method ? ` — ${p.method}` : ''}{p.unit ? ` (${p.unit})` : ''}
                                                </p>
                                              ))}
                                            </div>
                                          )}
                                          {!matrixInfo && selectedMethods.length === 0 && (
                                            <p className="text-xs text-muted-foreground">Sin matriz ni métodos</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                )
                              }
                              // Para QUANTITY, mostrar valor + unidad
                              if (f.fieldType === 'QUANTITY' && data[f.id] && typeof data[f.id] === 'object') {
                                const qty = data[f.id] as { value: number | null; unit: string }
                                return (
                                  <td key={f.id} className="px-3 py-2.5 font-mono text-sm">
                                    {qty.value != null ? `${qty.value} ${qty.unit || ''}` : '—'}
                                  </td>
                                )
                              }
                              // Para RECIPE_SELECT, mostrar nombre de receta con tooltip
                              if (f.fieldType === 'RECIPE_SELECT' && data[f.id]) {
                                const recipeInfo = recipesMap[String(data[f.id])]
                                return (
                                  <td key={f.id} className="px-3 py-2.5 max-w-[200px]">
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-xs cursor-default truncate block">
                                            {recipeInfo ? recipeInfo.name : '—'}
                                          </span>
                                        </TooltipTrigger>
                                        {recipeInfo && (
                                          <TooltipContent side="bottom" align="start" className="max-w-xs p-3 space-y-2">
                                            <p className="text-xs font-semibold">{recipeInfo.name}{recipeInfo.code ? ` (${recipeInfo.code})` : ''}</p>
                                            {recipeInfo.ingredients.length > 0 && (
                                              <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground">Ingredientes</p>
                                                {recipeInfo.ingredients.map((ing, i) => (
                                                  <p key={i} className="text-xs text-muted-foreground">{ing.name} — {ing.quantity} {ing.unit}</p>
                                                ))}
                                              </div>
                                            )}
                                            {recipeInfo.steps.length > 0 && (
                                              <div>
                                                <p className="text-[10px] font-semibold text-muted-foreground">Pasos ({recipeInfo.steps.length})</p>
                                                {recipeInfo.steps.map((s, i) => (
                                                  <p key={i} className="text-xs text-muted-foreground">{i + 1}. {s.name}{s.duration ? ` (${s.duration} min)` : ''}</p>
                                                ))}
                                              </div>
                                            )}
                                          </TooltipContent>
                                        )}
                                      </Tooltip>
                                    </TooltipProvider>
                                  </td>
                                )
                              }
                              // Para CALIBRATION_TEMPLATE, mostrar nombre de plantilla
                              if (f.fieldType === 'CALIBRATION_TEMPLATE' && data[f.id]) {
                                const ctInfo = calibrationTemplatesMap[String(data[f.id])]
                                return (
                                  <td key={f.id} className="px-3 py-2.5 max-w-[200px]">
                                    <span className="text-xs truncate block">
                                      {ctInfo ? `${ctInfo.name}${ctInfo.code ? ` (${ctInfo.code})` : ''}` : '—'}
                                    </span>
                                  </td>
                                )
                              }
                              return (
                                <td key={f.id} className="px-3 py-2.5 max-w-[200px] truncate">
                                  {formatCellValue(data[f.id], f.fieldType)}
                                </td>
                              )
                            })}
                            {isInstrumental && (
                              <td className="px-3 py-2.5">
                                {instrStatus ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${instrStatus.cls}`}>
                                    {instrStatus.label}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            )}
                            {record.type === 'BATCH' && (() => {
                              const b = entry.batch
                              const batchStyles: Record<string, { label: string; variant: 'secondary' | 'info' | 'success' | 'warning' | 'destructive' }> = {
                                PLANNED: { label: 'Planificado', variant: 'secondary' },
                                IN_PROGRESS: { label: 'En producción', variant: 'info' },
                                COMPLETED: { label: 'Completado', variant: 'warning' },
                                APPROVED: { label: 'Aprobado', variant: 'success' },
                                REJECTED: { label: 'Rechazado', variant: 'destructive' },
                              }
                              const bst = b ? batchStyles[b.status] : null
                              return (
                                <>
                                  <td className="px-3 py-2.5">
                                    {bst ? (
                                      <Link href={`/batches/${b!.id}`} className="hover:opacity-80">
                                        <Badge variant={bst.variant}>{bst.label}</Badge>
                                      </Link>
                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    {b?.producedQuantity != null
                                      ? <span className="font-mono">{b.producedQuantity} {b.unit || ''}</span>
                                      : <span className="text-xs text-muted-foreground">—</span>}
                                  </td>
                                </>
                              )
                            })()}
                            {record.type === 'SAMPLE' && (() => {
                              const s = entry.sample
                              const sampleStyles: Record<string, { label: string; variant: 'secondary' | 'info' | 'success' }> = {
                                RECEIVED: { label: 'Recibida', variant: 'secondary' },
                                IN_TESTING: { label: 'En ensayo', variant: 'info' },
                                COMPLETED: { label: 'Completada', variant: 'success' },
                              }
                              const sst = s ? sampleStyles[s.status] : null
                              return (
                                <td className="px-3 py-2.5">
                                  {sst ? (
                                    <Link href={`/samples/${s!.id}`}>
                                      <Badge variant={sst.variant} className="cursor-pointer hover:opacity-80">{sst.label}</Badge>
                                    </Link>
                                  ) : <span className="text-xs text-muted-foreground">—</span>}
                                </td>
                              )
                            })()}
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {entry.dueDate ? (
                                <span className={
                                  new Date(entry.dueDate) < new Date() && entry.status === 'DRAFT'
                                    ? 'text-red-600 font-medium'
                                    : 'text-muted-foreground'
                                }>
                                  {new Date(entry.dueDate).toLocaleDateString('es-AR')}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  {new Date(entry.createdAt).toLocaleDateString('es-AR')}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <Badge variant={st.variant}>{st.label}</Badge>
                                {hasFailedComparisons && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                )}
                                {entry.triggeredById && (
                                  <Badge variant="outline" className="text-[10px]">Auto</Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {entry.status !== 'DRAFT' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    title="Ver detalle"
                                    onClick={() => {
                                      setEditingEntryId(entry.id)
                                      setEntryData(data || {})
                                      setViewingEntry(true)
                                      setShowNewEntry(true)
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                {entry.status === 'DRAFT' && record.type !== 'SAMPLE' && record.type !== 'BATCH' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingEntryId(entry.id)
                                      setEntryData(data || {})
                                      setViewingEntry(false)
                                      setShowNewEntry(true)
                                    }}
                                  >
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                    Completar
                                  </Button>
                                )}
                                {entry.status === 'DRAFT' && record.type === 'BATCH' && entry.batch && (
                                  <Link href={`/batches/${entry.batch.id}`}>
                                    <Button variant="outline" size="sm">
                                      <Package className="mr-1.5 h-3.5 w-3.5" />
                                      Ver lote
                                    </Button>
                                  </Link>
                                )}
                                {entry.status === 'DRAFT' && record.type === 'SAMPLE' && entry.sample && (
                                  <Link href={`/samples/${entry.sample.id}`}>
                                    <Button variant="outline" size="sm">
                                      <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
                                      Ver muestra
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })()}
    </div>
  )
}
