'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowRight, Camera, Monitor, Paperclip, Smartphone } from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { DynamicRecordForm } from '@/components/forms/dynamic-record-form'
import {
  RecordFieldsEditor,
  type FieldDef,
  type RecordListItem,
} from '@/components/forms/record-fields-editor'

type RecordType =
  | 'PERIODIC'
  | 'NOT_PERIODIC'
  | 'NOT_PERIODIC_WITH_REVISION'
  | 'INSTRUMENTAL'
  | 'BATCH'
  | 'SAMPLE'
  | 'STOCK'

// ===== Page =====

export default function NewRecordPage() {
  const router = useRouter()

  const [name, setName] = useState('')
  const [type, setType] = useState<RecordType>('PERIODIC')
  const [areaIds, setAreaIds] = useState<string[]>([])
  const [periodicity, setPeriodicity] = useState<number | ''>('')
  const [notifyDaysBefore, setNotifyDaysBefore] = useState<number | ''>('')
  const [fields, setFields] = useState<FieldDef[]>([])

  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('mobile')

  // Queries
  const { data: allRecords = [] } = useQuery<RecordListItem[]>({
    queryKey: ['records'],
    queryFn: () => api.records.list() as Promise<RecordListItem[]>,
  })
  const { data: meData } = useQuery<{ organizationId: string }>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me() as Promise<{ organizationId: string }>,
  })
  const { data: orgData } = useQuery<{
    areas: Array<{
      id: string
      name: string
      children: Array<{ id: string; name: string; children: Array<{ id: string; name: string }> }>
    }>
  }>({
    queryKey: ['org', meData?.organizationId],
    queryFn: () =>
      api.organizations.get(meData!.organizationId) as Promise<{
        areas: Array<{
          id: string
          name: string
          children: Array<{
            id: string
            name: string
            children: Array<{ id: string; name: string }>
          }>
        }>
      }>,
    enabled: !!meData?.organizationId,
  })
  const flatAreas = useMemo(() => {
    const result: Array<{ id: string; name: string; depth: number }> = []
    const walk = (
      nodes: Array<{
        id: string
        name: string
        children?: Array<{ id: string; name: string; children?: unknown[] }>
      }>,
      depth: number,
    ) => {
      for (const n of nodes) {
        result.push({ id: n.id, name: n.name, depth })
        if (n.children && Array.isArray(n.children)) walk(n.children as typeof nodes, depth + 1)
      }
    }
    walk(orgData?.areas || [], 0)
    return result
  }, [orgData])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.records.create(data) as Promise<{ id: string }>,
    onSuccess: (record) => {
      toast.success('Registro creado — envialo a revisión para activarlo')
      router.push(`/records/${record.id}`)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleSubmit = () => {
    if (!name.trim()) return toast.error('El nombre es obligatorio')
    if ((type === 'PERIODIC' || type === 'INSTRUMENTAL') && periodicity === '')
      return toast.error('La periodicidad es obligatoria')
    if ((type === 'PERIODIC' || type === 'INSTRUMENTAL') && notifyDaysBefore === '')
      return toast.error('Los días de notificación previa son obligatorios')
    if (fields.length === 0) return toast.error('Agregá al menos un campo')
    if (!fields.some((f) => f.isIdentifier))
      return toast.error('Al menos un campo debe ser identificador')
    const emptyLabels = fields.filter((f) => !f.label.trim())
    if (emptyLabels.length > 0) return toast.error('Todos los campos deben tener nombre')

    const labels = fields.map((f) => f.label.toUpperCase())
    if (type === 'INSTRUMENTAL' && !labels.includes('CODIGO'))
      return toast.error('El registro Instrumental requiere un campo "CODIGO"')
    if (type === 'BATCH' && !labels.includes('LOTE'))
      return toast.error('El registro Lote/Producción requiere un campo "LOTE"')
    if (type === 'SAMPLE') {
      if (!labels.includes('CODIGO MUESTRA'))
        return toast.error('El registro Muestra requiere un campo "CODIGO MUESTRA"')
      const mm = fields.find((f) => f.label.toUpperCase() === 'MATRIZ Y METODOS')
      if (!mm || mm.fieldType !== 'MATRIX_METHOD')
        return toast.error('El registro Muestra requiere un campo "MATRIZ Y METODOS" de tipo Matriz y Métodos')
    }
    if (type === 'STOCK') {
      const missing = ['LOTE', 'PRODUCTO', 'TIPO MOVIMIENTO', 'CANTIDAD'].filter(
        (l) => !labels.includes(l),
      )
      if (missing.length > 0) return toast.error(`Stock requiere: ${missing.join(', ')}`)
    }

    const resolveComparisonConfig = (config: FieldDef['comparisonConfig']) => {
      if (!config) return undefined
      const resolved = { ...config }
      if (resolved.fieldId) {
        const ref = fields.find((f) => f.id === resolved.fieldId)
        if (ref) resolved.fieldId = ref.label
      }
      if (resolved.compareFieldId) {
        const ref = fields.find((f) => f.id === resolved.compareFieldId)
        if (ref) resolved.compareFieldId = ref.label
      }
      return resolved
    }

    createMutation.mutate({
      name,
      type,
      areaIds: areaIds.length > 0 ? areaIds : undefined,
      periodicity:
        (type === 'PERIODIC' || type === 'INSTRUMENTAL') && periodicity !== ''
          ? periodicity
          : undefined,
      notifyDaysBefore:
        (type === 'PERIODIC' || type === 'INSTRUMENTAL') && notifyDaysBefore !== ''
          ? notifyDaysBefore
          : undefined,
      fields: fields.map((f, i) => ({
        label: f.label,
        fieldType: f.fieldType,
        order: i,
        isIdentifier: f.isIdentifier,
        isRequired: f.isRequired,
        comparisonConfig:
          f.fieldType === 'DROPDOWN'
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

  const requiresPeriodicity = type === 'PERIODIC' || type === 'INSTRUMENTAL'
  const canSubmit =
    name.trim().length > 0 &&
    fields.length > 0 &&
    fields.some((f) => f.isIdentifier) &&
    fields.every((f) => f.label.trim().length > 0) &&
    (!requiresPeriodicity || (periodicity !== '' && notifyDaysBefore !== ''))

  // ===== Render =====

  const visibleTypes: Array<[RecordType, string]> = [
    ['PERIODIC', 'Periódico'],
    ['NOT_PERIODIC', 'No periódico'],
    ['NOT_PERIODIC_WITH_REVISION', 'Con revisión'],
    ['INSTRUMENTAL', 'Instrumental'],
    ['BATCH', 'Lote'],
    ['SAMPLE', 'Muestra'],
    ['STOCK', 'Stock'],
  ]

  return (
    <div className="fade-in flex h-full min-h-0 flex-col">
      <div className="syn-builder">
        {/* =========================== LEFT =========================== */}
        <div className="syn-builder-col">
          <div style={{ marginBottom: 22 }}>
            <div className="kicker">· Record Builder</div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 36,
                fontWeight: 400,
                margin: '8px 0 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: 'var(--ink-0)',
              }}
            >
              Diseñá un{' '}
              <span style={{ fontStyle: 'italic', color: 'var(--primary-hex)' }}>registro.</span>
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: 'var(--ink-2)',
                marginTop: 6,
                maxWidth: 520,
              }}
            >
              Definí los datos, campos dinámicos, cascadas automáticas y publicación. El preview muestra cómo se verá cuando un técnico cargue una entrada.
            </p>
          </div>

          {/* === SECCIÓN 1 — Datos === */}
          <section className="syn-builder-section">
            <div className="syn-bs-head">
              <span className="syn-bs-num">1</span>
              <span className="syn-bs-title">Datos del registro</span>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div className="syn-field">
                <span className="syn-field-label">
                  Nombre <span className="req">*</span>
                </span>
                <input
                  className="syn-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Verificación diaria balanza"
                />
              </div>

              <div className="syn-field">
                <span className="syn-field-label">Tipo de registro</span>
                <div className="syn-radio-group">
                  {visibleTypes.map(([k, v]) => (
                    <span
                      key={k}
                      className={'syn-radio-opt ' + (type === k ? 'on' : '')}
                      onClick={() => setType(k)}
                    >
                      <span className="dot" />
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              {['INSTRUMENTAL', 'BATCH', 'SAMPLE', 'STOCK'].includes(type) && (
                <div
                  className="rounded-[10px] border px-4 py-3 text-[12.5px]"
                  style={{
                    background: 'var(--info-soft)',
                    borderColor: 'var(--info)',
                    color: 'var(--info)',
                  }}
                >
                  <span
                    className="kicker"
                    style={{ color: 'var(--info)', marginRight: 8 }}
                  >
                    · Obligatorios
                  </span>
                  {type === 'INSTRUMENTAL' && 'CODIGO (identificador)'}
                  {type === 'BATCH' && 'LOTE (identificador), FÓRMULA (opcional)'}
                  {type === 'SAMPLE' &&
                    'CODIGO MUESTRA (identificador), MATRIZ Y METODOS (tipo Matriz · Métodos)'}
                  {type === 'STOCK' &&
                    'LOTE (identificador), PRODUCTO, TIPO MOVIMIENTO, CANTIDAD'}
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                }}
              >
                {(type === 'PERIODIC' || type === 'INSTRUMENTAL') && (
                  <>
                    <div className="syn-field">
                      <span className="syn-field-label">Periodicidad</span>
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
                      <span className="syn-field-label">Notificar</span>
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
                  </>
                )}
                <div className="syn-field">
                  <span className="syn-field-label">
                    Áreas <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>(múltiple — ctrl/cmd+click)</span>
                  </span>
                  <select
                    className="syn-select"
                    multiple
                    size={Math.min(6, Math.max(3, flatAreas.length))}
                    value={areaIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions).map((o) => o.value)
                      setAreaIds(selected)
                    }}
                  >
                    {flatAreas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {'—'.repeat(a.depth)} {a.name}
                      </option>
                    ))}
                  </select>
                  <span className="syn-field-hint" style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                    {areaIds.length === 0
                      ? 'Sin selección — el registro queda visible para toda la organización'
                      : `${areaIds.length} ${areaIds.length === 1 ? 'área seleccionada' : 'áreas seleccionadas'}`}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* === SECCIÓN 2 — Campos === */}
          <section className="syn-builder-section">
            <div className="syn-bs-head">
              <span className="syn-bs-num">2</span>
              <span className="syn-bs-title">Campos</span>
              <span className="syn-bs-sub">
                {fields.length} {fields.length === 1 ? 'campo' : 'campos'}
                {fields.length > 1 ? ' · ordenalos con las flechas' : ''}
              </span>
            </div>
            <RecordFieldsEditor
              fields={fields}
              onChange={setFields}
              allRecords={allRecords}
              mode="create"
            />
          </section>

          {/* === SECCIÓN 3 — Acciones cascada (placeholder) === */}
          <section className="syn-builder-section">
            <div className="syn-bs-head">
              <span className="syn-bs-num">3</span>
              <span className="syn-bs-title">Acciones en cascada</span>
            </div>
            <div
              className="syn-cascade-card"
              style={{ background: 'var(--bg-2)', padding: '14px 16px' }}
            >
              <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>
                Las cascadas se configuran desde el detalle del registro después de publicarlo. Así podés mapear los campos source → target con tipos ya resueltos.
              </p>
            </div>
          </section>

          {/* === SECCIÓN 4 — Publicación === */}
          <section className="syn-builder-section">
            <div className="syn-bs-head">
              <span className="syn-bs-num">4</span>
              <span className="syn-bs-title">Publicación</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span className="syn-chip syn-chip-draft">DRAFT</span>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                Se crea en borrador. Envialo a revisión desde la pantalla de detalle.
              </span>
            </div>
          </section>
        </div>

        {/* =========================== RIGHT — PREVIEW =========================== */}
        <div className="syn-builder-col right">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div>
              <div className="kicker">· Preview en vivo</div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 22,
                  letterSpacing: '-0.01em',
                  marginTop: 4,
                }}
              >
                Como lo{' '}
                <span style={{ fontStyle: 'italic', color: 'var(--primary-hex)' }}>
                  ven los técnicos.
                </span>
              </div>
            </div>
            <div className="syn-preview-tabs">
              <button
                className={'syn-preview-tab ' + (previewDevice === 'desktop' ? 'active' : '')}
                onClick={() => setPreviewDevice('desktop')}
              >
                <Monitor
                  className="mr-1 inline h-3 w-3"
                  style={{ verticalAlign: 'middle' }}
                />
                DESKTOP
              </button>
              <button
                className={'syn-preview-tab ' + (previewDevice === 'mobile' ? 'active' : '')}
                onClick={() => setPreviewDevice('mobile')}
              >
                <Smartphone
                  className="mr-1 inline h-3 w-3"
                  style={{ verticalAlign: 'middle' }}
                />
                MOBILE
              </button>
            </div>
          </div>

          <div className={'syn-preview-frame ' + previewDevice} style={{ marginTop: 18 }}>
            <div style={{ padding: previewDevice === 'mobile' ? '18px 16px' : '24px 28px' }}>
              <DynamicRecordForm
                mode="preview"
                record={{
                  id: 'preview',
                  name: name || 'Nombre del registro',
                  type,
                  fields: fields.map((f) => ({
                    id: f.id,
                    label: f.label,
                    fieldType: f.fieldType,
                    isIdentifier: f.isIdentifier,
                    isRequired: f.isRequired,
                    comparisonConfig: f.fieldType === 'DROPDOWN'
                      ? { options: f.dropdownOptions ?? [] }
                      : f.fieldType === 'QUANTITY'
                        ? { units: f.dropdownOptions ?? [] }
                        : f.comparisonConfig,
                    formulaConfig: f.formulaConfig,
                    relatedRecordId: f.relatedRecordId,
                    relatedFieldIds: f.relatedFieldIds,
                  })),
                }}
                title={name || 'Nombre del registro'}
                metaBar="DRAFT · vence — · creado por s.d."
              />
              {fields.length === 0 && (
                <div
                  className="mt-3 flex flex-col items-center gap-2 rounded-[10px] border border-dashed py-10 text-center"
                  style={{ borderColor: 'var(--line-2)', color: 'var(--ink-3)' }}
                >
                  <div className="kicker">· Sin campos</div>
                  <p className="text-[12.5px]">Agregá campos a la izquierda para ver el preview.</p>
                </div>
              )}
              {fields.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <label
                    className="syn-btn syn-btn-ghost"
                    style={{ justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Camera className="h-3.5 w-3.5" /> Foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={() => toast.info('Adjuntos disponibles al crear la entrada real')}
                    />
                  </label>
                  <label
                    className="syn-btn syn-btn-ghost"
                    style={{ justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Paperclip className="h-3.5 w-3.5" /> Archivo
                    <input
                      type="file"
                      className="sr-only"
                      onChange={() => toast.info('Adjuntos disponibles al crear la entrada real')}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================== FOOTER =========================== */}
      <div className="syn-builder-foot">
        <div className="st">
          <span className="syn-chip syn-chip-draft">DRAFT · no publicado</span>
          <span>
            {fields.length} {fields.length === 1 ? 'campo' : 'campos'} ·{' '}
            {fields.filter((f) => f.isIdentifier).length} identificador(es)
          </span>
        </div>
        <div className="actions">
          <Link href="/records" className="syn-btn syn-btn-ghost">
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || createMutation.isPending}
            className="syn-btn syn-btn-primary"
            style={!canSubmit ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {createMutation.isPending ? 'Creando…' : (
              <>
                Crear registro <ArrowRight className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

