'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2, Filter, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type {
  ActionType,
  ConditionExpression,
  FieldMappingRow,
  FlowDraft,
  RecordActionRow,
  RecordFieldSummary,
  RecordSummary,
  TriggerType,
  UpdateFieldActionConfig,
} from './types'

// =============================================================================
// FlowEditor — entry-point component
// =============================================================================

interface FlowEditorProps {
  recordId: string
  recordName?: string
  /** Tipo del Record fuente — habilita las opciones $batch.* / $sample.* /
   *  $instrument.* en el selector de fieldMapping cuando aplica. */
  recordType?: string
  recordFields: RecordFieldSummary[]
}

export function FlowEditor({ recordId, recordName, recordType, recordFields }: FlowEditorProps) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner
        recordId={recordId}
        recordName={recordName}
        recordType={recordType}
        recordFields={recordFields}
      />
    </ReactFlowProvider>
  )
}

function FlowEditorInner({ recordId, recordName, recordType, recordFields }: FlowEditorProps) {
  const qc = useQueryClient()
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null)
  const [draft, setDraft] = useState<FlowDraft | null>(null)

  const { data: flows = [], isLoading } = useQuery<RecordActionRow[]>({
    queryKey: ['record-actions', recordId],
    queryFn: () => api.records.listActions(recordId) as Promise<RecordActionRow[]>,
  })

  const { data: orgRecords = [] } = useQuery<RecordSummary[]>({
    queryKey: ['records-summaries'],
    queryFn: async () => {
      const all = (await api.records.list()) as Array<{ id: string; name: string; type: string }>
      return all.map((r) => ({ id: r.id, name: r.name, type: r.type }))
    },
  })

  // Cargar fields de TODOS los records (lazy) para que el editor pueda
  // mapear targetFieldId desde el id del record target. Por simplicidad v1,
  // se fetchea on-demand al cambiar el target del action node.
  const [targetRecordFields, setTargetRecordFields] = useState<RecordFieldSummary[]>([])
  useEffect(() => {
    if (!draft?.targetRecordId || draft.targetRecordId === recordId) {
      setTargetRecordFields(recordFields)
      return
    }
    let cancelled = false
    api.records.get(draft.targetRecordId).then((r) => {
      if (cancelled) return
      const rec = r as { fields?: RecordFieldSummary[] }
      setTargetRecordFields(rec.fields ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [draft?.targetRecordId, recordId, recordFields])

  const createMutation = useMutation({
    mutationFn: (payload: FlowDraft) =>
      api.records.addAction(recordId, draftToPayload(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record-actions', recordId] })
      setDraft(null)
      toast.success('Flujo creado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ actionId, payload }: { actionId: string; payload: FlowDraft }) =>
      api.records.updateAction(recordId, actionId, draftToPayload(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record-actions', recordId] })
      setDraft(null)
      toast.success('Flujo actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (actionId: string) => api.records.deleteAction(recordId, actionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['record-actions', recordId] })
      setSelectedFlowId(null)
      setDraft(null)
      toast.success('Flujo eliminado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  function startNewFlow() {
    setSelectedFlowId(null)
    setDraft({
      trigger: 'ENTRY_COMPLETED',
      condition: null,
      actionType: 'CREATE_ENTRY',
      targetRecordId: recordId,
      fieldMapping: [],
      actionConfig: null,
      allowCascade: false,
    })
  }

  function selectFlow(flow: RecordActionRow) {
    setSelectedFlowId(flow.id)
    setDraft({
      id: flow.id,
      trigger: flow.trigger,
      condition: flow.condition,
      actionType: flow.actionType,
      targetRecordId: flow.targetRecordId,
      fieldMapping: Array.isArray(flow.fieldMapping) ? flow.fieldMapping : [],
      actionConfig: flow.actionConfig,
      allowCascade: flow.allowCascade,
    })
  }

  function saveDraft() {
    if (!draft) return
    if (draft.id) {
      updateMutation.mutate({ actionId: draft.id, payload: draft })
    } else {
      createMutation.mutate(draft)
    }
  }

  function cancelDraft() {
    setDraft(null)
    setSelectedFlowId(null)
  }

  return (
    <div className="flex h-[calc(100vh-200px)] gap-3">
      {/* Canvas unificado: 1 SourceNode + N ramas (una por flow). Click en
          cualquier node de una rama selecciona ese flow para editar. */}
      <main className="relative flex-1 overflow-hidden rounded-[10px] border" style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)' }}>
        {/* Toolbar superior */}
        <div
          className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-[10px] border px-3 py-1.5"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)' }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
            Flujos · {flows.length}
          </span>
          <button
            type="button"
            onClick={startNewFlow}
            className="syn-btn syn-btn-primary"
            style={{ padding: '4px 8px', fontSize: 12 }}
          >
            <Plus className="h-3 w-3" /> Nuevo
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-full items-center justify-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
            Cargando flujos…
          </div>
        ) : flows.length === 0 && !draft ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[13px]" style={{ color: 'var(--ink-3)' }}>
            <span>Sin flujos configurados.</span>
            <button type="button" onClick={startNewFlow} className="syn-btn syn-btn-primary" style={{ padding: '6px 12px' }}>
              <Plus className="h-3 w-3" /> Crear primer flujo
            </button>
          </div>
        ) : (
          <UnifiedFlowCanvas
            sourceRecordId={recordId}
            sourceRecordName={recordName ?? 'Este registro'}
            flows={flows}
            draft={draft}
            selectedFlowId={selectedFlowId}
            orgRecords={orgRecords}
            onSelectFlow={(id) => {
              const f = flows.find((x) => x.id === id)
              if (f) selectFlow(f)
            }}
            onSelectDraft={() => {
              // El draft sin id ya está seleccionado al estar en setDraft.
              setSelectedFlowId(null)
            }}
            onAddFlow={startNewFlow}
          />
        )}
      </main>

      {/* Properties panel */}
      {draft && (
        <aside
          className="flex w-[360px] shrink-0 flex-col gap-3 overflow-y-auto rounded-[10px] border p-4"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)' }}
        >
          <div className="flex items-center justify-between">
            <h3 style={{ margin: 0, fontSize: 14 }}>Propiedades</h3>
            <div className="flex gap-2">
              {draft.id && (
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(draft.id!)}
                  className="syn-btn"
                  style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)' }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                onClick={cancelDraft}
                className="syn-btn"
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveDraft}
                className="syn-btn syn-btn-primary"
                style={{ padding: '4px 8px', fontSize: 12 }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Guardar
              </button>
            </div>
          </div>

          <PropertiesPanel
            draft={draft}
            onChange={setDraft}
            sourceFields={recordFields}
            sourceRecordType={recordType}
            orgRecords={orgRecords.filter((r) => r.id !== recordId).concat(
              orgRecords.find((r) => r.id === recordId) ? [orgRecords.find((r) => r.id === recordId)!] : [],
            )}
            targetRecordFields={targetRecordFields}
          />
        </aside>
      )}
    </div>
  )
}

// =============================================================================
// Canvas (xyflow) — mapa mental horizontal
// =============================================================================

interface UnifiedFlowCanvasProps {
  sourceRecordId: string
  sourceRecordName: string
  flows: RecordActionRow[]
  draft: FlowDraft | null
  selectedFlowId: string | null
  orgRecords: RecordSummary[]
  onSelectFlow: (flowId: string) => void
  onSelectDraft: () => void
  onAddFlow: () => void
}

/**
 * Layout tipo mapa mental, de izquierda a derecha:
 *
 *   [Registro origen] ──┬── (flujo 1)
 *                       ├── (flujo 2)
 *                       └── (+)
 *
 * Cada flujo es UN nodo compacto, no una cadena de nodos. El detalle (trigger,
 * condición, mapeo de campos) vive en el panel de propiedades: el canvas está
 * para leer de un vistazo qué relaciones hay y hacia dónde van. Cada rama
 * tiene su color, que comparten el nodo y su curva.
 */

/** Un color por rama; cicla si hay más flujos que colores. */
const BRANCH_COLORS = [
  'var(--info)',
  '#7C3AED',
  'var(--warn)',
  'var(--ok)',
  'var(--accent-hex)',
  '#DB2777',
]

function branchColor(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length]
}

function UnifiedFlowCanvas({
  sourceRecordName,
  flows,
  draft,
  selectedFlowId,
  orgRecords,
  onSelectFlow,
  onSelectDraft,
  onAddFlow,
}: UnifiedFlowCanvasProps) {
  // Geometría compacta: las ramas se apilan en una columna a la derecha del
  // origen, que queda centrado verticalmente sobre ellas.
  const BRANCH_X = 320
  const ROW_H = 62
  const TOP_Y = 24

  const branches = useMemo(() => {
    const list: Array<{
      flowId: string | 'draft'
      trigger: TriggerType
      condition: ConditionExpression | null
      actionType: ActionType
      targetRecordId: string
      isDraft: boolean
      isSelected: boolean
    }> = flows.map((f) => ({
      flowId: f.id,
      trigger: f.trigger,
      condition: f.condition,
      actionType: f.actionType,
      targetRecordId: f.targetRecordId,
      isDraft: false,
      isSelected: f.id === selectedFlowId,
    }))
    if (draft && !draft.id) {
      list.push({
        flowId: 'draft',
        trigger: draft.trigger,
        condition: draft.condition,
        actionType: draft.actionType,
        targetRecordId: draft.targetRecordId,
        isDraft: true,
        isSelected: true,
      })
    }
    // Si el draft edita un flow existente, la rama refleja los valores en vivo.
    if (draft && draft.id) {
      const idx = list.findIndex((b) => b.flowId === draft.id)
      if (idx >= 0) {
        list[idx] = {
          ...list[idx],
          trigger: draft.trigger,
          condition: draft.condition,
          actionType: draft.actionType,
          targetRecordId: draft.targetRecordId,
        }
      }
    }
    return list
  }, [flows, draft, selectedFlowId])

  // +1 fila para el botón de agregar, que vive al final de la columna.
  const rows = branches.length + 1
  const sourceY = TOP_Y + (rows * ROW_H) / 2 - 26

  const nodes = useMemo<Node[]>(() => {
    const list: Node[] = [
      {
        id: 'source',
        type: 'sourceNode',
        position: { x: 0, y: sourceY },
        data: { recordName: sourceRecordName, branchCount: branches.length },
        draggable: false,
        selectable: false,
      },
    ]

    branches.forEach((b, i) => {
      const targetRecord =
        b.actionType === 'CREATE_ENTRY'
          ? orgRecords.find((r) => r.id === b.targetRecordId)
          : null
      list.push({
        id: `${b.flowId}-branch`,
        type: 'branchNode',
        position: { x: BRANCH_X, y: TOP_Y + i * ROW_H },
        data: {
          flowId: b.flowId,
          selected: b.isSelected,
          isDraft: b.isDraft,
          color: branchColor(i),
          trigger: b.trigger,
          hasCondition: Boolean(b.condition),
          actionType: b.actionType,
          targetRecordName: targetRecord?.name,
        },
        draggable: false,
      })
    })

    list.push({
      id: 'add',
      type: 'addNode',
      position: { x: BRANCH_X, y: TOP_Y + branches.length * ROW_H },
      data: { onAddFlow },
      draggable: false,
      selectable: false,
    })

    return list
  }, [branches, sourceY, orgRecords, sourceRecordName, onAddFlow])

  const edges = useMemo<Edge[]>(() => {
    const list: Edge[] = branches.map((b, i) => {
      const color = branchColor(i)
      return {
        id: `e-${b.flowId}`,
        source: 'source',
        target: `${b.flowId}-branch`,
        type: 'bezier',
        animated: b.isSelected,
        style: {
          stroke: color,
          strokeWidth: b.isSelected ? 2.5 : 1.75,
          strokeDasharray: b.isDraft ? '5 4' : undefined,
          opacity: b.isSelected ? 1 : 0.75,
        },
      }
    })
    // Conector tenue hacia el botón de agregar, para que no quede suelto.
    list.push({
      id: 'e-add',
      source: 'source',
      target: 'add',
      type: 'bezier',
      style: {
        stroke: 'var(--line-strong)',
        strokeWidth: 1,
        strokeDasharray: '3 4',
        opacity: 0.45,
      },
    })
    return list
  }, [branches])

  const [, , onNodesChange] = useNodesState(nodes)
  const [, , onEdgesChange] = useEdgesState(edges)

  function handleNodeClick(_e: React.MouseEvent, node: Node) {
    const flowId = (node.data as { flowId?: string }).flowId
    if (!flowId) return
    if (flowId === 'draft') onSelectDraft()
    else onSelectFlow(flowId)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={NODE_TYPES}
      fitView
      // maxZoom en fitView evita que con un solo flujo el mapa se agrande de
      // forma desproporcionada, que era la queja de "arranca muy grande".
      fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
      minZoom={0.4}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--bg-2)' }}
    >
      <Background gap={18} size={1} color="var(--line)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  )
}

// =============================================================================
// Custom nodes
// =============================================================================

/** Punto de conexión discreto: las curvas nacen del borde del nodo. */
const HANDLE_STYLE = {
  width: 7,
  height: 7,
  border: 'none',
  background: 'var(--line-strong)',
}

function SourceNode({ data }: NodeProps) {
  const { recordName, branchCount } = data as { recordName: string; branchCount: number }
  return (
    <div
      className="rounded-[10px] border px-3.5 py-2.5"
      style={{
        background: 'var(--bg-1)',
        borderColor: 'var(--line-strong)',
        boxShadow: 'var(--shadow-sm)',
        minWidth: 200,
        maxWidth: 260,
      }}
    >
      <div
        className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--ink-3)' }}
      >
        Origen · {branchCount} {branchCount === 1 ? 'flujo' : 'flujos'}
      </div>
      <div
        className="truncate text-[13px] font-semibold"
        style={{ color: 'var(--ink-0)' }}
        title={recordName}
      >
        {recordName}
      </div>
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
    </div>
  )
}

/**
 * Una rama = un flujo. Muestra a dónde va y, en letra chica, cuándo se
 * dispara. El resto se edita en el panel lateral.
 */
function BranchNode({ data }: NodeProps) {
  const d = data as unknown as {
    flowId: string
    selected: boolean
    isDraft: boolean
    color: string
    trigger: TriggerType
    hasCondition: boolean
    actionType: ActionType
    targetRecordName?: string
  }

  const title =
    d.actionType === 'CREATE_ENTRY'
      ? d.targetRecordName ?? 'Sin registro destino'
      : actionLabel(d.actionType)

  return (
    <div
      className="rounded-[9px] border px-3 py-1.5 transition-colors"
      style={{
        background: 'var(--bg-1)',
        borderColor: d.selected ? d.color : 'var(--line)',
        borderStyle: d.isDraft ? 'dashed' : 'solid',
        boxShadow: d.selected
          ? `0 0 0 3px color-mix(in srgb, ${d.color} 18%, transparent)`
          : 'var(--shadow-xs)',
        cursor: 'pointer',
        minWidth: 176,
        maxWidth: 240,
      }}
    >
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: d.color }} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[12.5px] font-medium leading-tight"
            style={{ color: 'var(--ink-0)' }}
            title={title}
          >
            {title}
          </div>
          <div
            className="mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em]"
            style={{ color: 'var(--ink-3)' }}
          >
            <span className="truncate">{triggerLabel(d.trigger)}</span>
            {d.hasCondition && (
              <>
                <span aria-hidden>·</span>
                <Filter className="h-2.5 w-2.5 shrink-0" style={{ color: d.color }} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AddNode({ data }: NodeProps) {
  const { onAddFlow } = data as { onAddFlow: () => void }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onAddFlow()
      }}
      className="flex items-center gap-1.5 rounded-[9px] border border-dashed px-3 py-1.5 text-[11.5px] transition-colors hover:bg-[var(--bg-3)]"
      style={{
        borderColor: 'var(--line-strong)',
        color: 'var(--ink-2)',
        background: 'transparent',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ ...HANDLE_STYLE, opacity: 0 }} />
      <Plus className="h-3 w-3" />
      Agregar flujo
    </button>
  )
}

const NODE_TYPES = {
  sourceNode: SourceNode,
  branchNode: BranchNode,
  addNode: AddNode,
}


// =============================================================================
// Properties panel
// =============================================================================

interface PropertiesPanelProps {
  draft: FlowDraft
  onChange: (next: FlowDraft) => void
  sourceFields: RecordFieldSummary[]
  sourceRecordType?: string
  orgRecords: RecordSummary[]
  targetRecordFields: RecordFieldSummary[]
}

function PropertiesPanel({ draft, onChange, sourceFields, sourceRecordType, orgRecords, targetRecordFields }: PropertiesPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Trigger */}
      <section className="flex flex-col gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
          Trigger
        </label>
        <select
          value={draft.trigger}
          onChange={(e) => onChange({ ...draft, trigger: e.target.value as TriggerType })}
          className="rounded-[8px] border px-2 py-1.5 text-[13px]"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
        >
          <option value="ENTRY_CREATED">Cuando se crea una entrada</option>
          <option value="ENTRY_COMPLETED">Cuando se completa una entrada</option>
          <option value="FIELD_VALUE_CHANGED">Cuando cambia un campo de la entrada</option>
          <option value="COMPARISON_FAILED">Cuando falla una comparación</option>
        </select>
      </section>

      {/* Condition */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
            Condición (opcional)
          </label>
          {draft.condition ? (
            <button
              type="button"
              onClick={() => onChange({ ...draft, condition: null })}
              className="text-[11px]"
              style={{ color: 'var(--danger)' }}
            >
              Quitar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ ...draft, condition: { type: 'EQUALS', field: 'fieldId', value: '' } })}
              className="text-[11px]"
              style={{ color: 'var(--primary-hex)' }}
            >
              Agregar
            </button>
          )}
        </div>
        {draft.condition && (
          <ConditionEditor
            condition={draft.condition}
            sourceFields={sourceFields}
            sourceRecordType={sourceRecordType}
            triggerType={draft.trigger}
            onChange={(condition) => onChange({ ...draft, condition })}
          />
        )}
      </section>

      {/* Action type */}
      <section className="flex flex-col gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
          Acción
        </label>
        <select
          value={draft.actionType}
          onChange={(e) => {
            const actionType = e.target.value as ActionType
            // Reset config al cambiar de action type.
            onChange({
              ...draft,
              actionType,
              actionConfig: actionType === 'UPDATE_FIELD'
                ? { entryIdSource: '$entry.id', fieldId: '', value: '' }
                : null,
              fieldMapping: actionType === 'CREATE_ENTRY' ? draft.fieldMapping : [],
            })
          }}
          className="rounded-[8px] border px-2 py-1.5 text-[13px]"
          style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
        >
          <option value="CREATE_ENTRY">Crear entrada en otro registro</option>
          <option value="UPDATE_FIELD">Actualizar campo de una entrada</option>
          <option value="NOTIFY" disabled>Notificar usuario (próximamente)</option>
          <option value="EMAIL" disabled>Enviar email (próximamente)</option>
          <option value="WEBHOOK" disabled>Webhook (próximamente)</option>
        </select>
      </section>

      {/* Action config — depende del actionType */}
      {draft.actionType === 'CREATE_ENTRY' && (
        <CreateEntryConfig
          draft={draft}
          onChange={onChange}
          sourceFields={sourceFields}
          sourceRecordType={sourceRecordType}
          orgRecords={orgRecords}
          targetRecordFields={targetRecordFields}
        />
      )}

      {draft.actionType === 'UPDATE_FIELD' && (
        <UpdateFieldConfig
          draft={draft}
          onChange={onChange}
          sourceFields={sourceFields}
        />
      )}

      {/* allowCascade */}
      <section className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="allow-cascade"
          checked={draft.allowCascade}
          onChange={(e) => onChange({ ...draft, allowCascade: e.target.checked })}
        />
        <label htmlFor="allow-cascade" className="text-[12.5px]" style={{ color: 'var(--ink-1)' }}>
          Permitir cascada (este flujo puede dispararse cuando otro flujo lo causó)
        </label>
      </section>
    </div>
  )
}

// =============================================================================
// Sub-editores
// =============================================================================

function ConditionEditor({
  condition,
  sourceFields,
  sourceRecordType,
  triggerType,
  onChange,
}: {
  condition: ConditionExpression
  sourceFields: RecordFieldSummary[]
  sourceRecordType?: string
  triggerType: TriggerType
  onChange: (next: ConditionExpression) => void
}) {
  if ('conditions' in condition) {
    // Composite — v1 muestra un mensaje sin editor anidado completo.
    return (
      <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
        Condiciones compuestas (AND/OR) — editor pendiente. Editá manualmente vía API por ahora.
      </div>
    )
  }
  const c = condition

  // Opciones companion del Record fuente — se muestran solo si el record es
  // BATCH/SAMPLE/INSTRUMENTAL. Permiten condiciones tipo "si el batch.status
  // es REJECTED, disparar acción". Las comparaciones EQUALS / NOT_EQUALS / IN
  // / NOT_IN soportan strings y enums, no son solo numéricas.
  const companionOptions: Array<{ value: string; label: string }> =
    sourceRecordType === 'BATCH'
      ? [
          { value: '$batch.status', label: 'Lote · estado' },
          { value: '$batch.lotNumber', label: 'Lote · número' },
          { value: '$batch.producedQuantity', label: 'Lote · cantidad producida' },
          { value: '$batch.unit', label: 'Lote · unidad' },
        ]
      : sourceRecordType === 'SAMPLE'
        ? [
            { value: '$sample.status', label: 'Muestra · estado' },
            { value: '$sample.sampleCode', label: 'Muestra · código' },
            { value: '$sample.client', label: 'Muestra · cliente' },
          ]
        : sourceRecordType === 'INSTRUMENTAL'
          ? [
              { value: '$instrument.status', label: 'Instrumento · estado' },
              { value: '$instrument.nextCalibrationAt', label: 'Instrumento · próx. cal.' },
            ]
          : []
  const companionGroupLabel =
    sourceRecordType === 'BATCH'
      ? 'Lote (companion)'
      : sourceRecordType === 'SAMPLE'
        ? 'Muestra (companion)'
        : sourceRecordType === 'INSTRUMENTAL'
          ? 'Instrumento (companion)'
          : null

  // Enums conocidos del backend — se ofrecen como <select> en lugar de input
  // texto libre cuando el field elegido coincide. Sincronizado con
  // packages/types/src/enums.ts y schema.prisma.
  const KNOWN_ENUMS: Record<string, Array<{ value: string; label: string }>> = {
    '$batch.status': [
      { value: 'PLANNED', label: 'PLANNED · Planificado' },
      { value: 'IN_PROGRESS', label: 'IN_PROGRESS · En progreso' },
      { value: 'COMPLETED', label: 'COMPLETED · Finalizado' },
      { value: 'APPROVED', label: 'APPROVED · Aprobado' },
      { value: 'REJECTED', label: 'REJECTED · Rechazado (fallido)' },
      { value: 'CANCELLED', label: 'CANCELLED · Cancelado' },
    ],
    '$sample.status': [
      { value: 'RECEIVED', label: 'RECEIVED · Recibida' },
      { value: 'IN_TESTING', label: 'IN_TESTING · En ensayo' },
      { value: 'COMPLETED', label: 'COMPLETED · Completada' },
      { value: 'CANCELLED', label: 'CANCELLED · Cancelada' },
    ],
    '$instrument.status': [
      { value: 'ACTIVE', label: 'ACTIVE · Activo' },
      { value: 'IN_CALIBRATION', label: 'IN_CALIBRATION · En calibración' },
      { value: 'IN_REPAIR', label: 'IN_REPAIR · En reparación' },
      { value: 'DECOMMISSIONED', label: 'DECOMMISSIONED · Dado de baja' },
    ],
  }

  // Si el field seleccionado es un DROPDOWN del propio record, sus options
  // (incluso las del workflow engine v2 con label/color/isStatus) se exponen
  // también — el técnico no tiene que adivinar.
  function getDropdownOptions(fieldId: string): Array<{ value: string; label: string }> | null {
    const f = sourceFields.find((sf) => sf.id === fieldId)
    if (!f || f.fieldType !== 'DROPDOWN') return null
    const cfg = f.comparisonConfig as { options?: unknown } | null
    const opts = cfg?.options
    if (!Array.isArray(opts) || opts.length === 0) return null
    if (typeof opts[0] === 'string') {
      return (opts as string[]).map((v) => ({ value: v, label: v }))
    }
    if (typeof opts[0] === 'object' && opts[0] !== null) {
      return (opts as Array<{ value: string; label?: string }>).map((o) => ({
        value: o.value,
        label: o.label ? `${o.value} · ${o.label}` : o.value,
      }))
    }
    return null
  }

  // Para `fieldId` (qué field cambió) en FIELD_VALUE_CHANGED, las options
  // útiles son los IDs de los fields del record.
  const fieldIdOptions: Array<{ value: string; label: string }> | null =
    c.field === 'fieldId'
      ? sourceFields.map((f) => ({ value: f.id, label: f.label }))
      : null

  // Para `toValue`/`fromValue` en FIELD_VALUE_CHANGED, no sabemos a priori
  // qué field cambió, así que dejamos el input libre. Excepción: si en la
  // misma condición ya hay un AND con `fieldId EQUALS X` podríamos deducir,
  // pero el editor actual solo soporta primitivas — futura iteración.
  const knownValueOptions = KNOWN_ENUMS[c.field] ?? getDropdownOptions(c.field)

  return (
    <div className="flex flex-col gap-2 rounded-[8px] border p-2" style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)' }}>
      <select
        value={c.field}
        onChange={(e) => onChange({ ...c, field: e.target.value, value: '' })}
        className="rounded-[6px] border px-2 py-1 text-[12.5px]"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
      >
        <option value="" disabled>Elegí un campo</option>
        {triggerType === 'FIELD_VALUE_CHANGED' && (
          <optgroup label="Del evento (qué cambió)">
            <option value="fieldId">¿Qué campo cambió? (fieldId)</option>
            <option value="toValue">Valor nuevo (toValue)</option>
            <option value="fromValue">Valor anterior (fromValue)</option>
          </optgroup>
        )}
        {sourceFields.length > 0 && (
          <optgroup label="Campos del registro">
            {sourceFields.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </optgroup>
        )}
        {companionGroupLabel && companionOptions.length > 0 && (
          <optgroup label={companionGroupLabel}>
            {companionOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
        )}
      </select>
      <select
        value={c.type}
        onChange={(e) => onChange({ ...c, type: e.target.value as PrimitiveCondition['type'] })}
        className="rounded-[6px] border px-2 py-1 text-[12.5px]"
        style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
      >
        <option value="EQUALS">Igual a</option>
        <option value="NOT_EQUALS">Distinto de</option>
        <option value="IN">Está en (lista)</option>
        <option value="NOT_IN">No está en (lista)</option>
        <option value="LT">&lt; Menor que</option>
        <option value="LTE">&le; Menor o igual</option>
        <option value="GT">&gt; Mayor que</option>
        <option value="GTE">&ge; Mayor o igual</option>
        <option value="BETWEEN">Entre (rango)</option>
      </select>
      {(() => {
        // Determinar qué render usar para el "valor":
        //   - Si el field elegido es `fieldId` → select con los fields del record.
        //   - Si el field es un enum conocido (companion status / DROPDOWN del
        //     record) y la operación es EQUALS/NOT_EQUALS → <select> simple.
        //   - Si es IN/NOT_IN sobre enum conocido → checkboxes multi-select.
        //   - Caso contrario → input texto libre (con parsing por type).
        const enumOpts = fieldIdOptions ?? knownValueOptions
        const useSelect =
          enumOpts && (c.type === 'EQUALS' || c.type === 'NOT_EQUALS')
        const useChecklist =
          enumOpts && (c.type === 'IN' || c.type === 'NOT_IN')

        if (useSelect && enumOpts) {
          return (
            <select
              value={typeof c.value === 'string' ? c.value : ''}
              onChange={(e) => onChange({ ...c, value: e.target.value })}
              className="rounded-[6px] border px-2 py-1 text-[12.5px]"
              style={{
                background: 'var(--bg-1)',
                borderColor: 'var(--line-2)',
                color: 'var(--ink-0)',
              }}
            >
              <option value="" disabled>Elegí un valor</option>
              {enumOpts.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )
        }

        if (useChecklist && enumOpts) {
          const selected = Array.isArray(c.value)
            ? (c.value as unknown[]).map(String)
            : []
          return (
            <div
              className="flex flex-col gap-1 rounded-[6px] border px-2 py-2 text-[12.5px]"
              style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)' }}
            >
              {enumOpts.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ color: 'var(--ink-0)' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...selected, o.value]
                        : selected.filter((v) => v !== o.value)
                      onChange({ ...c, value: next })
                    }}
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          )
        }

        return (
          <input
            type="text"
            value={Array.isArray(c.value) ? c.value.join(',') : String(c.value)}
            onChange={(e) => {
              const raw = e.target.value
              let v: PrimitiveCondition['value'] = raw
              if (['IN', 'NOT_IN'].includes(c.type)) {
                v = raw.split(',').map((s) => s.trim()).filter(Boolean)
              } else if (c.type === 'BETWEEN') {
                v = raw.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
              } else if (['LT', 'LTE', 'GT', 'GTE'].includes(c.type)) {
                v = Number(raw)
              }
              onChange({ ...c, value: v })
            }}
            placeholder={
              ['IN', 'NOT_IN'].includes(c.type)
                ? 'valor1, valor2, valor3'
                : c.type === 'BETWEEN'
                  ? 'min, max'
                  : 'valor'
            }
            className="rounded-[6px] border px-2 py-1 text-[12.5px]"
            style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
          />
        )
      })()}
    </div>
  )
}

type PrimitiveCondition = Extract<ConditionExpression, { field: string }>

function CreateEntryConfig({
  draft,
  onChange,
  sourceFields,
  sourceRecordType,
  orgRecords,
  targetRecordFields,
}: {
  draft: FlowDraft
  onChange: (n: FlowDraft) => void
  sourceFields: RecordFieldSummary[]
  sourceRecordType?: string
  orgRecords: RecordSummary[]
  targetRecordFields: RecordFieldSummary[]
}) {
  // Opciones companion del Record fuente. Solo se exponen si el record es
  // BATCH/SAMPLE/INSTRUMENTAL — el backend (resolveSource) las resuelve
  // contra la entry source cargada con sus relaciones companion.
  const companionOptions: Array<{ value: string; label: string }> =
    sourceRecordType === 'BATCH'
      ? [
          { value: '$batch.lotNumber', label: 'Lote · número' },
          { value: '$batch.status', label: 'Lote · estado' },
          // Combinado para mapear a un field tipo QUANTITY del target.
          // Devuelve { value, unit } compatible con QUANTITY.
          { value: '$batch.quantity', label: 'Lote · cantidad + unidad (QUANTITY)' },
          // Sueltos por si el target tiene NUMBER o TEXT por separado.
          { value: '$batch.producedQuantity', label: 'Lote · cantidad producida (solo número)' },
          { value: '$batch.unit', label: 'Lote · unidad (solo texto)' },
        ]
      : sourceRecordType === 'SAMPLE'
        ? [
            { value: '$sample.sampleCode', label: 'Muestra · código' },
            { value: '$sample.status', label: 'Muestra · estado' },
            { value: '$sample.client', label: 'Muestra · cliente' },
            { value: '$sample.matrixId', label: 'Muestra · matriz' },
          ]
        : sourceRecordType === 'INSTRUMENTAL'
          ? [
              { value: '$instrument.status', label: 'Instrumento · estado' },
              { value: '$instrument.nextCalibrationAt', label: 'Instrumento · próx. cal.' },
            ]
          : []
  const companionGroupLabel =
    sourceRecordType === 'BATCH'
      ? 'Lote (companion)'
      : sourceRecordType === 'SAMPLE'
        ? 'Muestra (companion)'
        : sourceRecordType === 'INSTRUMENTAL'
          ? 'Instrumento (companion)'
          : null

  return (
    <section className="flex flex-col gap-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
        Registro destino
      </label>
      <select
        value={draft.targetRecordId}
        onChange={(e) => onChange({ ...draft, targetRecordId: e.target.value, fieldMapping: [] })}
        className="rounded-[8px] border px-2 py-1.5 text-[13px]"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
      >
        <option value="" disabled>Elegí un registro</option>
        {orgRecords.map((r) => (
          <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
        ))}
      </select>

      <label className="font-mono text-[10px] uppercase tracking-[0.14em] mt-2" style={{ color: 'var(--ink-3)' }}>
        Mapeo de campos (source → target)
      </label>
      <div className="flex flex-col gap-1.5">
        {draft.fieldMapping.map((m, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select
              value={m.sourceFieldId}
              onChange={(e) => {
                const next = [...draft.fieldMapping]
                next[i] = { ...next[i], sourceFieldId: e.target.value }
                onChange({ ...draft, fieldMapping: next })
              }}
              className="flex-1 rounded-[6px] border px-2 py-1 text-[12px]"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
            >
              <option value="" disabled>—</option>
              <option
                value="$entry.id"
                title="ID de la entry padre — útil cuando el target tiene un field RELATED_ENTRY que debe apuntar de vuelta a esta entry"
              >
                ID de esta entrada (para campo RELATED_ENTRY del target)
              </option>
              <optgroup label="Campos del registro">
                {sourceFields.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </optgroup>
              {companionGroupLabel && companionOptions.length > 0 && (
                <optgroup label={companionGroupLabel}>
                  {companionOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <span style={{ color: 'var(--ink-3)' }}>→</span>
            <select
              value={m.targetFieldId}
              onChange={(e) => {
                const next = [...draft.fieldMapping]
                next[i] = { ...next[i], targetFieldId: e.target.value }
                onChange({ ...draft, fieldMapping: next })
              }}
              className="flex-1 rounded-[6px] border px-2 py-1 text-[12px]"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
            >
              <option value="" disabled>—</option>
              {targetRecordFields.map((f) => (
                <option key={f.id} value={f.id}>{f.label}{f.isIdentifier ? ' (id)' : ''}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const next = draft.fieldMapping.filter((_, j) => j !== i)
                onChange({ ...draft, fieldMapping: next })
              }}
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange({ ...draft, fieldMapping: [...draft.fieldMapping, { sourceFieldId: '', targetFieldId: '' }] })}
          className="self-start text-[11.5px]"
          style={{ color: 'var(--primary-hex)' }}
        >
          + Agregar mapeo
        </button>
      </div>
    </section>
  )
}

function UpdateFieldConfig({
  draft,
  onChange,
  sourceFields,
}: {
  draft: FlowDraft
  onChange: (n: FlowDraft) => void
  sourceFields: RecordFieldSummary[]
}) {
  const cfg = (draft.actionConfig as UpdateFieldActionConfig | null) ?? {
    entryIdSource: '$entry.id',
    fieldId: '',
    value: '',
  }

  function patch(partial: Partial<UpdateFieldActionConfig>) {
    onChange({ ...draft, actionConfig: { ...cfg, ...partial } })
  }

  return (
    <section className="flex flex-col gap-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--ink-3)' }}>
        Entrada destino
      </label>
      <select
        value={cfg.entryIdSource}
        onChange={(e) => patch({ entryIdSource: e.target.value })}
        className="rounded-[8px] border px-2 py-1.5 text-[13px]"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
      >
        <option value="$entry.id">La misma entrada que disparó (self)</option>
        {sourceFields
          .filter((f) => f.fieldType === 'RELATED_ENTRY')
          .map((f) => (
            <option key={f.id} value={f.id}>data.{f.label} (entrada relacionada)</option>
          ))}
      </select>

      <label className="font-mono text-[10px] uppercase tracking-[0.14em] mt-2" style={{ color: 'var(--ink-3)' }}>
        Campo a actualizar
      </label>
      <select
        value={cfg.fieldId}
        onChange={(e) => patch({ fieldId: e.target.value })}
        className="rounded-[8px] border px-2 py-1.5 text-[13px]"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
      >
        <option value="" disabled>Elegí un campo</option>
        {sourceFields.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      <label className="font-mono text-[10px] uppercase tracking-[0.14em] mt-2" style={{ color: 'var(--ink-3)' }}>
        Nuevo valor
      </label>
      <input
        type="text"
        value={cfg.value === null ? '' : String(cfg.value)}
        onChange={(e) => {
          const raw = e.target.value
          let v: UpdateFieldActionConfig['value'] = raw
          if (raw === 'true') v = true
          else if (raw === 'false') v = false
          else if (raw === '') v = ''
          else if (!isNaN(Number(raw)) && raw.trim() !== '') v = Number(raw)
          patch({ value: v })
        }}
        placeholder="texto, número, true/false"
        className="rounded-[8px] border px-2 py-1.5 text-[13px]"
        style={{ background: 'var(--bg-2)', borderColor: 'var(--line-2)', color: 'var(--ink-0)' }}
      />
    </section>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function triggerLabel(t: TriggerType): string {
  return {
    ENTRY_CREATED: 'Se crea una entrada',
    ENTRY_COMPLETED: 'Se completa una entrada',
    FIELD_VALUE_CHANGED: 'Cambia un campo',
    COMPARISON_FAILED: 'Falla una comparación',
  }[t]
}

function actionLabel(a: ActionType): string {
  return {
    CREATE_ENTRY: 'Crear entrada en otro registro',
    UPDATE_FIELD: 'Actualizar un campo',
    NOTIFY: 'Notificar usuario',
    EMAIL: 'Enviar email',
    WEBHOOK: 'Llamar webhook',
  }[a]
}

function conditionPreview(c: ConditionExpression | null): string {
  if (!c) return 'Sin condición'
  if ('conditions' in c) return `${c.type} (${c.conditions.length} condiciones)`
  return `${c.field} ${c.type} ${JSON.stringify(c.value)}`
}

function draftToPayload(d: FlowDraft): Record<string, unknown> {
  return {
    targetRecordId: d.targetRecordId,
    fieldMapping: d.fieldMapping,
    trigger: d.trigger,
    condition: d.condition,
    actionType: d.actionType,
    actionConfig: d.actionConfig,
    allowCascade: d.allowCascade,
  }
}
