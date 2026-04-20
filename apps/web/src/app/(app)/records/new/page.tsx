'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'

interface RecordListItem {
  id: string
  name: string
  type: string
  fields: Array<{ id: string; label: string; fieldType: string; isIdentifier: boolean }>
}
import {
  Plus,
  GripVertical,
  Trash2,
  ArrowLeft,
  Hash,
  Type,
  Calendar,
  Link2,
  GitCompare,
  Calculator,
  ListFilter,
  Microscope,
  FlaskConical,
  Scale,
  ChevronDown,
  ChevronUp,
  Star,
  Ruler,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'

type FieldType = 'NUMBER' | 'TEXT' | 'DATE' | 'DROPDOWN' | 'MATRIX_METHOD' | 'RECIPE_SELECT' | 'QUANTITY' | 'RELATED_ENTRY' | 'MULTIPLE_RELATED_ENTRY' | 'COMPARISON' | 'FORMULA' | 'CALIBRATION_TEMPLATE'
type RecordType = 'PERIODIC' | 'NOT_PERIODIC' | 'NOT_PERIODIC_WITH_REVISION' | 'INSTRUMENTAL' | 'BATCH' | 'SAMPLE' | 'STOCK'

interface FieldDef {
  id: string // temporal para el builder
  label: string
  fieldType: FieldType
  isIdentifier: boolean
  isRequired: boolean
  comparisonConfig?: {
    operator: string
    compareAgainst: 'CONSTANT' | 'FIELD'
    constantValue?: number
    fieldId?: string         // campo que se evalúa (ej: ERROR)
    compareFieldId?: string  // campo contra el que se compara (cuando compareAgainst === 'FIELD')
    secondValue?: number     // para BETWEEN
  }
  formulaConfig?: { expression: string }
  dropdownOptions?: string[]
  relatedRecordId?: string
  relatedFieldIds?: string[]
  expanded: boolean
}

const fieldTypeOptions: { value: FieldType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'NUMBER', label: 'Número', icon: Hash, description: 'Valor numérico' },
  { value: 'TEXT', label: 'Texto', icon: Type, description: 'Texto libre' },
  { value: 'DATE', label: 'Fecha', icon: Calendar, description: 'Selector de fecha' },
  { value: 'DROPDOWN', label: 'Opciones', icon: ListFilter, description: 'Selección de una opción predefinida' },
  { value: 'MATRIX_METHOD', label: 'Matriz y Métodos', icon: Microscope, description: 'Selección de matriz y/o métodos analíticos' },
  { value: 'RECIPE_SELECT', label: 'Receta', icon: FlaskConical, description: 'Selección de receta de producción' },
  { value: 'QUANTITY', label: 'Cantidad y unidad', icon: Scale, description: 'Valor numérico con unidad de medida' },
  { value: 'COMPARISON', label: 'Comparación', icon: GitCompare, description: 'Valor con validación' },
  { value: 'FORMULA', label: 'Fórmula', icon: Calculator, description: 'Cálculo automático' },
  { value: 'RELATED_ENTRY', label: 'Entrada relacionada', icon: Link2, description: 'Referencia a una entrada de otro registro' },
  { value: 'MULTIPLE_RELATED_ENTRY', label: 'Múltiples relacionadas', icon: Link2, description: 'Referencia a varias entradas de otro registro' },
  { value: 'CALIBRATION_TEMPLATE', label: 'Plantilla calibración', icon: Ruler, description: 'Selección de plantilla de calibración' },
]

const comparisonOperators = [
  { value: 'LT', label: '< Menor que' },
  { value: 'LTE', label: '<= Menor o igual' },
  { value: 'GT', label: '> Mayor que' },
  { value: 'GTE', label: '>= Mayor o igual' },
  { value: 'EQ', label: '= Igual a' },
  { value: 'BETWEEN', label: 'Entre (rango)' },
]

export default function NewRecordPage() {
  const router = useRouter()
  const fieldCounterRef = React.useRef(0)

  const [name, setName] = useState('')
  const [type, setType] = useState<RecordType>('NOT_PERIODIC')
  const [areaId, setAreaId] = useState<string>('')
  const [periodicity, setPeriodicity] = useState<number>(30)
  const [notifyDaysBefore, setNotifyDaysBefore] = useState<number>(3)
  const [fields, setFields] = useState<FieldDef[]>([])

  // Traer otros registros para campos RELATED_ENTRY
  const { data: allRecords = [] } = useQuery<RecordListItem[]>({
    queryKey: ['records'],
    queryFn: () => api.records.list() as Promise<RecordListItem[]>,
  })

  // Traer áreas para selector de visibilidad
  const { data: meData } = useQuery<{ organizationId: string }>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me() as Promise<{ organizationId: string }>,
  })
  const { data: orgData } = useQuery<{ areas: Array<{ id: string; name: string; children: Array<{ id: string; name: string; children: Array<{ id: string; name: string }> }> }> }>({
    queryKey: ['org', meData?.organizationId],
    queryFn: () => api.organizations.get(meData!.organizationId) as Promise<{ areas: Array<{ id: string; name: string; children: Array<{ id: string; name: string; children: Array<{ id: string; name: string }> }> }> }>,
    enabled: !!meData?.organizationId,
  })
  const flatAreas = React.useMemo(() => {
    const result: Array<{ id: string; name: string; depth: number }> = []
    const walk = (nodes: Array<{ id: string; name: string; children?: Array<{ id: string; name: string; children?: unknown[] }> }>, depth: number) => {
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, depth })
        if (n.children && Array.isArray(n.children)) walk(n.children as typeof nodes, depth + 1)
      }
    }
    walk(orgData?.areas || [], 0)
    return result
  }, [orgData])

  const handleTypeChange = (newType: RecordType) => {
    setType(newType)
  }

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.records.create(data) as Promise<{ id: string }>,
    onSuccess: (record) => {
      toast.success('Registro creado — envialo a revisión para activarlo')
      router.push(`/records/${record.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addField = (fieldType: FieldType) => {
    fieldCounterRef.current++
    const newField: FieldDef = {
      id: `temp_${Date.now()}_${fieldCounterRef.current}`,
      label: '',
      fieldType,
      isIdentifier: false,
      isRequired: true,
      expanded: true,
    }
    if (fieldType === 'COMPARISON') {
      newField.comparisonConfig = {
        operator: 'GTE',
        compareAgainst: 'CONSTANT',
        constantValue: 0,
      }
    }
    if (fieldType === 'FORMULA') {
      newField.formulaConfig = { expression: '' }
    }
    if (fieldType === 'DROPDOWN') {
      newField.dropdownOptions = ['']
    }
    if (fieldType === 'QUANTITY') {
      newField.dropdownOptions = ['kg', 'g']
    }
    setFields([...fields, newField])
  }

  const updateField = (id: string, updates: Partial<FieldDef>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= newFields.length) return
    ;[newFields[index], newFields[target]] = [newFields[target], newFields[index]]
    setFields(newFields)
  }

  const handleSubmit = () => {
    if (!name.trim()) return toast.error('El nombre es obligatorio')
    if (fields.length === 0) return toast.error('Agrega al menos un campo')
    if (!fields.some((f) => f.isIdentifier)) return toast.error('Al menos un campo debe ser identificador')

    const emptyLabels = fields.filter((f) => !f.label.trim())
    if (emptyLabels.length > 0) return toast.error('Todos los campos deben tener nombre')

    // Validar forma mínima según tipo
    const labels = fields.map((f) => f.label.toUpperCase())
    if (type === 'INSTRUMENTAL' && !labels.includes('CODIGO')) {
      return toast.error('El registro Instrumental requiere un campo con label "CODIGO"')
    }
    if (type === 'BATCH' && !labels.includes('LOTE')) {
      return toast.error('El registro Lote/Produccion requiere un campo con label "LOTE"')
    }
    if (type === 'SAMPLE') {
      if (!labels.includes('CODIGO MUESTRA')) return toast.error('El registro Muestra requiere un campo con label "CODIGO MUESTRA"')
      const mmField = fields.find((f) => f.label.toUpperCase() === 'MATRIZ Y METODOS')
      if (!mmField || mmField.fieldType !== 'MATRIX_METHOD') return toast.error('El registro Muestra requiere un campo "MATRIZ Y METODOS" de tipo Matriz y Metodos')
    }
    if (type === 'STOCK') {
      const missing = ['LOTE', 'PRODUCTO', 'TIPO MOVIMIENTO', 'CANTIDAD'].filter((l) => !labels.includes(l))
      if (missing.length > 0) return toast.error(`El registro Stock requiere los campos: ${missing.join(', ')}`);
    }

    // Mapear IDs temporales en comparisonConfig a labels para que el backend los resuelva
    const resolveComparisonConfig = (config: FieldDef['comparisonConfig']) => {
      if (!config) return undefined
      const resolved = { ...config }
      // Reemplazar fieldId temporal por label del campo referenciado
      if (resolved.fieldId) {
        const refField = fields.find((f) => f.id === resolved.fieldId)
        if (refField) {
          resolved.fieldId = refField.label // el backend lo resolverá por label
        }
      }
      if (resolved.compareFieldId) {
        const refField = fields.find((f) => f.id === resolved.compareFieldId)
        if (refField) {
          resolved.compareFieldId = refField.label
        }
      }
      return resolved
    }

    createMutation.mutate({
      name,
      type,
      areaId: areaId || undefined,
      periodicity: (type === 'PERIODIC' || type === 'INSTRUMENTAL') ? periodicity : undefined,
      notifyDaysBefore: (type === 'PERIODIC' || type === 'INSTRUMENTAL') ? notifyDaysBefore : undefined,
      fields: fields.map((f, i) => ({
        label: f.label,
        fieldType: f.fieldType,
        order: i,
        isIdentifier: f.isIdentifier,
        isRequired: f.isRequired,
        comparisonConfig: f.fieldType === 'DROPDOWN'
          ? { options: f.dropdownOptions?.filter((o) => o.trim()).map((o) => o.toUpperCase()) }
          : f.fieldType === 'QUANTITY'
          ? { units: f.dropdownOptions?.filter((o) => o.trim()).map((o) => o.toUpperCase()) }
          : resolveComparisonConfig(f.comparisonConfig),
        formulaConfig: f.formulaConfig || undefined,
        relatedRecordId: f.relatedRecordId || undefined,
        relatedFieldIds: f.relatedFieldIds || undefined,
      })),
    })
  }

  // Campos disponibles para fórmulas/comparaciones: NUMBER, FORMULA, y RELATED_ENTRY que traen campos numéricos
  const numericFields = fields.filter((f) => {
    if (!f.label) return false
    if (f.fieldType === 'NUMBER' || f.fieldType === 'FORMULA') return true
    if ((f.fieldType === 'RELATED_ENTRY' || f.fieldType === 'MULTIPLE_RELATED_ENTRY') && f.relatedRecordId && f.relatedFieldIds?.length) {
      const relRecord = allRecords.find((r) => r.id === f.relatedRecordId)
      if (!relRecord) return false
      return f.relatedFieldIds.some((fid) => {
        const rf = relRecord.fields.find((rf) => rf.id === fid)
        return rf?.fieldType === 'NUMBER'
      })
    }
    return false
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/records">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo registro</h1>
          <p className="mt-1 text-muted-foreground">
            Definí el template con los campos que tendrá cada entrada
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Info básica */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información del registro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Control de pH - Agua potable"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Área</label>
                  <select
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Toda la organización</option>
                    {flatAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {'—'.repeat(a.depth)} {a.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Solo usuarios de esta área y sub-áreas podrán ver el registro
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium">Tipo *</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {([
                    { value: 'NOT_PERIODIC', label: 'No periodico', desc: 'Se crea manualmente' },
                    { value: 'PERIODIC', label: 'Periodico', desc: 'Se repite cada N dias' },
                    { value: 'NOT_PERIODIC_WITH_REVISION', label: 'Con revision', desc: 'Fecha de revision' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleTypeChange(opt.value)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        type === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-primary/30'
                      }`}
                    >
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium">Con seguimiento</label>
                    <span className="relative group">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded cursor-help">?</span>
                      <span className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-64 rounded-md border bg-popover p-2 text-xs text-popover-foreground shadow-md z-50">
                        Al crear una entrada en estos registros se crea una entidad asociada para su seguimiento (instrumental, lote, muestra o movimiento de stock).
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      { value: 'INSTRUMENTAL', label: 'Instrumental', desc: 'Equipos con calibracion' },
                      { value: 'BATCH', label: 'Lote/Produccion', desc: 'Lotes de produccion' },
                      { value: 'SAMPLE', label: 'Muestra', desc: 'Muestras de laboratorio' },
                      { value: 'STOCK', label: 'Stock', desc: 'Movimientos de inventario' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => handleTypeChange(opt.value)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          type === opt.value
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'hover:border-primary/30'
                        }`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Info de campos obligatorios según tipo */}
              {['INSTRUMENTAL', 'BATCH', 'SAMPLE', 'STOCK'].includes(type) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                    Campos obligatorios para este tipo de registro
                  </p>
                  <div className="space-y-1">
                    {type === 'INSTRUMENTAL' && (
                      <p className="text-xs text-blue-600 dark:text-blue-300">
                        &bull; <strong>CODIGO</strong> — cualquier tipo, marcado como identificador
                      </p>
                    )}
                    {type === 'BATCH' && (
                      <>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>LOTE</strong> — cualquier tipo, marcado como identificador
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>RECETA</strong> — tipo <em>Receta</em> (opcional pero recomendado)
                        </p>
                      </>
                    )}
                    {type === 'SAMPLE' && (
                      <>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>CODIGO MUESTRA</strong> — cualquier tipo, marcado como identificador
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>MATRIZ Y METODOS</strong> — tipo <em>Matriz y Metodos</em>
                        </p>
                      </>
                    )}
                    {type === 'STOCK' && (
                      <>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>LOTE</strong> — cualquier tipo, marcado como identificador
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>PRODUCTO</strong> — cualquier tipo
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>TIPO MOVIMIENTO</strong> — cualquier tipo (debe incluir INGRESO/EGRESO)
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          &bull; <strong>CANTIDAD</strong> — cualquier tipo numerico (recomendado tipo <em>Cantidad y unidad</em>)
                        </p>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Agrega estos campos con los labels exactos. Se validan al crear y al aprobar el registro.
                  </p>
                </div>
              )}

              {(type === 'PERIODIC' || type === 'INSTRUMENTAL') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {type === 'INSTRUMENTAL' ? 'Periodicidad de calibración (días) *' : 'Periodicidad (días) *'}
                    </label>
                    <input
                      type="number"
                      value={periodicity}
                      onChange={(e) => setPeriodicity(Number(e.target.value))}
                      min={1}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notificar días antes</label>
                    <input
                      type="number"
                      value={notifyDaysBefore}
                      onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
                      min={0}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Campos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Campos del registro</CardTitle>
                <CardDescription>
                  Definí los campos que tendrá cada entrada de este registro
                </CardDescription>
              </div>
              <Badge variant="secondary">{fields.length} campos</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Agregá campos usando los botones de abajo
                  </p>
                </div>
              ) : (
                fields.map((field, index) => {
                  const typeOpt = fieldTypeOptions.find((t) => t.value === field.fieldType)!
                  const Icon = typeOpt.icon
                  const isCodigoField = false
                  return (
                    <div
                      key={field.id}
                      className="rounded-lg border bg-card transition-shadow hover:shadow-sm"
                    >
                      {/* Header del campo */}
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveField(index, 'up')}
                            disabled={index === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => moveField(index, 'down')}
                            disabled={index === fields.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => updateField(field.id, { label: e.target.value })}
                          placeholder="Nombre del campo..."
                          readOnly={isCodigoField}
                          className={`flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50 ${isCodigoField ? 'cursor-default' : ''}`}
                        />

                        <Badge variant="outline" className="text-xs shrink-0">
                          {typeOpt.label}
                        </Badge>

                        <button
                          onClick={() => !isCodigoField && updateField(field.id, { isIdentifier: !field.isIdentifier })}
                          className={`rounded p-1.5 transition-colors ${
                            field.isIdentifier
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/30'
                              : 'text-muted-foreground/30 hover:text-muted-foreground'
                          } ${isCodigoField ? 'cursor-not-allowed' : ''}`}
                          title={isCodigoField ? 'Identificador obligatorio' : field.isIdentifier ? 'Es identificador' : 'Marcar como identificador'}
                        >
                          <Star className="h-3.5 w-3.5" fill={field.isIdentifier ? 'currentColor' : 'none'} />
                        </button>

                        <button
                          onClick={() => updateField(field.id, { expanded: !field.expanded })}
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          {field.expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          onClick={() => removeField(field.id)}
                          disabled={isCodigoField}
                          className={`rounded p-1.5 ${isCodigoField ? 'text-muted-foreground/20 cursor-not-allowed' : 'text-muted-foreground hover:text-destructive'}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Config expandida */}
                      {field.expanded && (
                        <div className="border-t px-4 py-3 space-y-3">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={field.isRequired}
                              onChange={(e) => updateField(field.id, { isRequired: e.target.checked })}
                              className="rounded"
                            />
                            Campo obligatorio
                          </label>

                          {/* Config COMPARISON */}
                          {field.fieldType === 'COMPARISON' && field.comparisonConfig && (
                            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Configuración de comparación
                              </p>

                              {/* 1. Campo a comparar */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Campo a comparar</label>
                                <select
                                  value={field.comparisonConfig.fieldId ?? ''}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      comparisonConfig: { ...field.comparisonConfig!, fieldId: e.target.value },
                                    })
                                  }
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                >
                                  <option value="">Seleccionar campo...</option>
                                  {numericFields
                                    .filter((nf) => nf.id !== field.id)
                                    .map((nf) => (
                                      <option key={nf.id} value={nf.id}>
                                        {nf.label}
                                      </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">
                                  El valor de este campo se evaluará contra la condición
                                </p>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-2">
                                {/* 2. Operador */}
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">Operador</label>
                                  <select
                                    value={field.comparisonConfig.operator}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        comparisonConfig: { ...field.comparisonConfig!, operator: e.target.value },
                                      })
                                    }
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  >
                                    {comparisonOperators.map((op) => (
                                      <option key={op.value} value={op.value}>
                                        {op.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* 3. Comparar contra */}
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">Comparar contra</label>
                                  <select
                                    value={field.comparisonConfig.compareAgainst}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        comparisonConfig: {
                                          ...field.comparisonConfig!,
                                          compareAgainst: e.target.value as 'CONSTANT' | 'FIELD',
                                          // Limpiar valores al cambiar tipo
                                          ...(e.target.value === 'CONSTANT' ? { compareFieldId: undefined } : { constantValue: undefined, secondValue: undefined }),
                                        },
                                      })
                                    }
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  >
                                    <option value="CONSTANT">Valor constante</option>
                                    <option value="FIELD">Otro campo</option>
                                  </select>
                                </div>
                              </div>

                              {/* 4a. Valor constante */}
                              {field.comparisonConfig.compareAgainst === 'CONSTANT' && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium">
                                      {field.comparisonConfig.operator === 'BETWEEN' ? 'Valor mínimo' : 'Valor'}
                                    </label>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={field.comparisonConfig.constantValue ?? ''}
                                      onChange={(e) => {
                                        const v = e.target.value
                                        if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
                                          updateField(field.id, {
                                            comparisonConfig: {
                                              ...field.comparisonConfig!,
                                              constantValue: v as unknown as number,
                                            },
                                          })
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const n = parseFloat(e.target.value)
                                        updateField(field.id, {
                                          comparisonConfig: {
                                            ...field.comparisonConfig!,
                                            constantValue: isNaN(n) ? undefined : n,
                                          },
                                        })
                                      }}
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                    />
                                  </div>
                                  {field.comparisonConfig.operator === 'BETWEEN' && (
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium">Valor máximo</label>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={field.comparisonConfig.secondValue ?? ''}
                                        onChange={(e) => {
                                          const v = e.target.value
                                          if (v === '' || /^-?\d*\.?\d*$/.test(v)) {
                                            updateField(field.id, {
                                              comparisonConfig: {
                                                ...field.comparisonConfig!,
                                                secondValue: v as unknown as number,
                                              },
                                            })
                                          }
                                        }}
                                        onBlur={(e) => {
                                          const n = parseFloat(e.target.value)
                                          updateField(field.id, {
                                            comparisonConfig: {
                                              ...field.comparisonConfig!,
                                              secondValue: isNaN(n) ? undefined : n,
                                            },
                                          })
                                        }}
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 4b. Comparar contra otro campo */}
                              {field.comparisonConfig.compareAgainst === 'FIELD' && (
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">Campo contra el que se compara</label>
                                  <select
                                    value={field.comparisonConfig.compareFieldId ?? ''}
                                    onChange={(e) =>
                                      updateField(field.id, {
                                        comparisonConfig: {
                                          ...field.comparisonConfig!,
                                          compareFieldId: e.target.value,
                                        },
                                      })
                                    }
                                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  >
                                    <option value="">Seleccionar campo...</option>
                                    {numericFields
                                      .filter((nf) => nf.id !== field.id && nf.id !== field.comparisonConfig?.fieldId)
                                      .map((nf) => (
                                        <option key={nf.id} value={nf.id}>
                                          {nf.label}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}

                              {/* Resumen visual */}
                              {field.comparisonConfig.fieldId && (
                                <div className="rounded-md bg-background border p-2 text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {numericFields.find((f) => f.id === field.comparisonConfig?.fieldId)?.label || '?'}
                                  </span>
                                  {' '}debe ser{' '}
                                  <span className="font-mono font-medium text-foreground">
                                    {comparisonOperators.find((o) => o.value === field.comparisonConfig?.operator)?.label || '?'}
                                  </span>
                                  {' '}
                                  {field.comparisonConfig.compareAgainst === 'CONSTANT' ? (
                                    <span className="font-medium text-foreground">
                                      {field.comparisonConfig.constantValue ?? '?'}
                                      {field.comparisonConfig.operator === 'BETWEEN' && ` y ${field.comparisonConfig.secondValue ?? '?'}`}
                                    </span>
                                  ) : (
                                    <span className="font-medium text-foreground">
                                      {numericFields.find((f) => f.id === field.comparisonConfig?.compareFieldId)?.label || '?'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Config DROPDOWN */}
                          {field.fieldType === 'DROPDOWN' && field.dropdownOptions && (
                            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Opciones del desplegable
                              </p>
                              <div className="space-y-2">
                                {field.dropdownOptions.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <span className="w-5 text-center text-xs text-muted-foreground">{oi + 1}</span>
                                    <input
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...field.dropdownOptions!]
                                        newOpts[oi] = e.target.value
                                        updateField(field.id, { dropdownOptions: newOpts })
                                      }}
                                      placeholder={`Opción ${oi + 1}`}
                                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    {field.dropdownOptions!.length > 1 && (
                                      <button
                                        onClick={() => updateField(field.id, { dropdownOptions: field.dropdownOptions!.filter((_, j) => j !== oi) })}
                                        className="text-destructive hover:text-destructive/80"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => updateField(field.id, { dropdownOptions: [...field.dropdownOptions!, ''] })}
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Plus className="h-3 w-3" />
                                Agregar opción
                              </button>
                            </div>
                          )}

                          {/* Config RELATED_ENTRY */}
                          {/* Config QUANTITY */}
                          {field.fieldType === 'QUANTITY' && field.dropdownOptions && (
                            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Unidades disponibles
                              </p>
                              <div className="space-y-2">
                                {field.dropdownOptions.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input
                                      value={opt}
                                      onChange={(e) => {
                                        const newOpts = [...field.dropdownOptions!]
                                        newOpts[oi] = e.target.value
                                        updateField(field.id, { dropdownOptions: newOpts })
                                      }}
                                      placeholder={`Unidad ${oi + 1}`}
                                      className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                    {field.dropdownOptions!.length > 1 && (
                                      <button
                                        onClick={() => updateField(field.id, { dropdownOptions: field.dropdownOptions!.filter((_, j) => j !== oi) })}
                                        className="text-destructive hover:text-destructive/80"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <button
                                onClick={() => updateField(field.id, { dropdownOptions: [...field.dropdownOptions!, ''] })}
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Plus className="h-3 w-3" />
                                Agregar unidad
                              </button>
                            </div>
                          )}

                          {(field.fieldType === 'RELATED_ENTRY' || field.fieldType === 'MULTIPLE_RELATED_ENTRY') && (
                            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Configuración de entrada relacionada
                              </p>

                              {/* Seleccionar registro */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Registro de origen</label>
                                <select
                                  value={field.relatedRecordId ?? ''}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      relatedRecordId: e.target.value || undefined,
                                      relatedFieldIds: [], // Limpiar campos al cambiar registro
                                    })
                                  }
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                                >
                                  <option value="">Seleccionar registro...</option>
                                  {allRecords.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name} ({r.type === 'PERIODIC' ? 'Periódico' : r.type === 'INSTRUMENTAL' ? 'Instrumental' : 'No periódico'})
                                    </option>
                                  ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">
                                  De qué registro se traen los datos
                                </p>
                              </div>

                              {/* Seleccionar campos a transcribir */}
                              {field.relatedRecordId && (() => {
                                const relRecord = allRecords.find((r) => r.id === field.relatedRecordId)
                                if (!relRecord) return null
                                const selectedIds = field.relatedFieldIds || []

                                return (
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Campos a transcribir</label>
                                    <div className="space-y-1">
                                      {relRecord.fields.map((rf) => (
                                        <label
                                          key={rf.id}
                                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer transition-colors"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={selectedIds.includes(rf.id)}
                                            onChange={(e) => {
                                              const newIds = e.target.checked
                                                ? [...selectedIds, rf.id]
                                                : selectedIds.filter((id) => id !== rf.id)
                                              updateField(field.id, { relatedFieldIds: newIds })
                                            }}
                                            className="rounded"
                                          />
                                          <span className="flex-1">{rf.label}</span>
                                          <Badge variant="outline" className="text-[10px]">
                                            {rf.fieldType === 'NUMBER' ? 'Número' : rf.fieldType === 'TEXT' ? 'Texto' : rf.fieldType === 'DATE' ? 'Fecha' : rf.fieldType}
                                          </Badge>
                                          {rf.isIdentifier && (
                                            <Star className="h-3 w-3 text-amber-500" fill="currentColor" />
                                          )}
                                        </label>
                                      ))}
                                    </div>
                                    {selectedIds.length > 0 && (
                                      <p className="text-[11px] text-muted-foreground">
                                        {selectedIds.length} campo{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}.
                                        {selectedIds.some((id) => relRecord.fields.find((f) => f.id === id)?.fieldType === 'NUMBER') && (
                                          <span className="text-primary"> Los campos numéricos estarán disponibles para fórmulas y comparaciones.</span>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}

                          {/* Config FORMULA */}
                          {field.fieldType === 'FORMULA' && field.formulaConfig && (
                            <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Configuración de fórmula
                              </p>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Expresión</label>
                                <input
                                  type="text"
                                  value={field.formulaConfig.expression}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      formulaConfig: { expression: e.target.value },
                                    })
                                  }
                                  placeholder="Ej: campo1 * 100 / campo2"
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm font-mono"
                                />
                              </div>
                              {numericFields.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1.5">
                                    Campos disponibles (click para insertar):
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {numericFields
                                      .filter((nf) => nf.id !== field.id)
                                      .map((nf) => (
                                        <button
                                          key={nf.id}
                                          onClick={() =>
                                            updateField(field.id, {
                                              formulaConfig: {
                                                expression:
                                                  (field.formulaConfig?.expression || '') + ` ${nf.label}`,
                                              },
                                            })
                                          }
                                          className="rounded-md bg-background border px-2 py-1 text-xs font-mono hover:border-primary/50 transition-colors"
                                        >
                                          {nf.label}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}

              {/* Botones para agregar campos */}
              <Separator />
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Agregar campo:</p>
                <div className="flex flex-wrap gap-2">
                  {fieldTypeOptions.map((opt) => (
                    <Button
                      key={opt.value}
                      variant="outline"
                      size="sm"
                      onClick={() => addField(opt.value)}
                      className="gap-1.5"
                    >
                      <opt.icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral — resumen */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre</span>
                  <span className="font-medium">{name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium">
                    {type === 'PERIODIC' ? 'Periódico' : type === 'NOT_PERIODIC_WITH_REVISION' ? 'Con revisión' : type === 'INSTRUMENTAL' ? 'Instrumental' : 'No periódico'}
                  </span>
                </div>
                {(type === 'PERIODIC' || type === 'INSTRUMENTAL') && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{type === 'INSTRUMENTAL' ? 'Calibración cada' : 'Cada'}</span>
                    <span className="font-medium">{periodicity} días</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campos</span>
                  <span className="font-medium">{fields.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Identificadores</span>
                  <span className="font-medium">{fields.filter((f) => f.isIdentifier).length}</span>
                </div>
              </div>

              {fields.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Campos definidos:</p>
                    {fields.map((f) => {
                      const opt = fieldTypeOptions.find((t) => t.value === f.fieldType)!
                      return (
                        <div key={f.id} className="flex items-center gap-2 text-sm">
                          <opt.icon className="h-3 w-3 text-muted-foreground" />
                          <span className={f.label ? '' : 'text-muted-foreground italic'}>
                            {f.label || 'Sin nombre'}
                          </span>
                          {f.isIdentifier && <Star className="h-3 w-3 text-amber-500" fill="currentColor" />}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <Separator />

              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? 'Creando...' : 'Crear registro'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
