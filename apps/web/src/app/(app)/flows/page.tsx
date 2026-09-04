'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery } from '@tanstack/react-query'
import { Workflow, Loader2, ArrowUpRight, AlertTriangle } from 'lucide-react'
import { api } from '@/lib/api'

interface FlowRecordRef {
  id: string
  name: string
  type: string
  status: string
}

interface FlowOverviewRow {
  id: string
  trigger: string
  actionType: string
  condition: unknown
  allowCascade: boolean
  sourceRecord: FlowRecordRef
  targetRecord: FlowRecordRef
  /** Si tiene elementos, el flujo esta incompleto y no se ejecuta. */
  configWarnings?: string[]
}

const RELATION_COLORS = [
  'var(--info)',
  '#7C3AED',
  'var(--warn)',
  'var(--ok)',
  'var(--accent-hex)',
  '#DB2777',
]

const typeLabel: Record<string, string> = {
  PERIODIC: 'Periódico',
  NOT_PERIODIC: 'No periódico',
  NOT_PERIODIC_WITH_REVISION: 'Con revisión',
  INSTRUMENTAL: 'Instrumental',
  BATCH: 'Lote',
  SAMPLE: 'Muestra',
  STOCK: 'Stock',
}

export default function FlowsOverviewPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['flows-overview'],
    queryFn: () => api.records.flowsOverview<FlowOverviewRow[]>(),
  })

  const recordCount = useMemo(() => {
    const ids = new Set<string>()
    rows.forEach((r) => {
      ids.add(r.sourceRecord.id)
      ids.add(r.targetRecord.id)
    })
    return ids.size
  }, [rows])

  const sourceCount = useMemo(
    () => new Set(rows.map((r) => r.sourceRecord.id)).size,
    [rows],
  )

  const incompleteCount = useMemo(
    () => rows.filter((r) => (r.configWarnings?.length ?? 0) > 0).length,
    [rows],
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Flujos</div>
          <h1>
            Flujo <span className="italic">global.</span>
          </h1>
          <p className="sub">
            Todas las relaciones configuradas entre registros activos. Cada flecha es una
            acción que, al dispararse en el registro de origen, impacta en el de destino.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div
          className="syn-card flex items-center justify-center gap-2 py-16"
          style={{ color: 'var(--ink-2)' }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Cargando relaciones…</span>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Stat label="Relaciones" value={rows.length} />
            <Stat label="Registros conectados" value={recordCount} />
            <Stat label="Registros con flujos" value={sourceCount} />
            {incompleteCount > 0 && (
              <Stat label="Sin ejecutar" value={incompleteCount} danger />
            )}
          </div>

          <div
            className="syn-card overflow-hidden p-0"
            style={{ height: 'clamp(420px, 60vh, 680px)' }}
          >
            <ReactFlowProvider>
              <GlobalFlowGraph rows={rows} />
            </ReactFlowProvider>
          </div>

          <RelationList rows={rows} />
        </>
      )}
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div
      className="syn-card px-4 py-3"
      style={{
        minWidth: 150,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        borderColor: danger ? 'var(--danger)' : undefined,
        background: danger ? 'var(--danger-soft)' : undefined,
      }}
    >
      <span
        className="font-mono text-[9.5px] uppercase tracking-[0.14em]"
        style={{ color: danger ? 'var(--danger)' : 'var(--ink-3)' }}
      >
        {label}
      </span>
      <span
        className="text-[20px] font-semibold"
        style={{ color: danger ? 'var(--danger)' : 'var(--ink-0)' }}
      >
        {value}
      </span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="syn-card flex flex-col items-center gap-3 py-16 text-center">
      <Workflow className="h-9 w-9" style={{ color: 'var(--ink-4)' }} />
      <div className="text-[14px] font-medium" style={{ color: 'var(--ink-0)' }}>
        Todavía no hay flujos configurados
      </div>
      <p className="max-w-[420px] text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
        Los flujos se arman desde la pestaña <strong>Flujos</strong> de cada registro. Cuando
        existan, acá vas a ver el mapa completo de relaciones.
      </p>
      <Link href="/records" className="syn-btn syn-btn-subtle">
        Ir a registros
      </Link>
    </div>
  )
}

// =============================================================================
// Grafo
// =============================================================================

/**
 * Ubica los registros en columnas según su profundidad en la cadena de flujos:
 * los que no reciben ninguna acción quedan a la izquierda, y cada destino se
 * empuja a la derecha de su origen.
 *
 * La relajación tiene un tope de iteraciones porque el grafo puede tener
 * ciclos (A dispara B y B dispara A es una configuración válida gracias a
 * allowCascade). Al cortar, un ciclo queda en columnas contiguas en vez de
 * colgar el layout.
 */
function computeLevels(
  recordIds: string[],
  links: Array<{ from: string; to: string }>,
): Map<string, number> {
  const level = new Map<string, number>(recordIds.map((id) => [id, 0]))
  const maxPasses = Math.min(recordIds.length, 12)

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false
    for (const link of links) {
      if (link.from === link.to) continue // autorreferencia: no empuja columna
      const next = (level.get(link.from) ?? 0) + 1
      if (next > (level.get(link.to) ?? 0)) {
        level.set(link.to, next)
        changed = true
      }
    }
    if (!changed) break
  }
  return level
}

function GlobalFlowGraph({ rows }: { rows: FlowOverviewRow[] }) {
  const { nodes, edges } = useMemo(() => {
    const records = new Map<string, FlowRecordRef>()
    rows.forEach((r) => {
      records.set(r.sourceRecord.id, r.sourceRecord)
      records.set(r.targetRecord.id, r.targetRecord)
    })

    const outgoing = new Map<string, number>()
    rows.forEach((r) => {
      outgoing.set(r.sourceRecord.id, (outgoing.get(r.sourceRecord.id) ?? 0) + 1)
    })

    const ids = Array.from(records.keys())
    const levels = computeLevels(
      ids,
      rows.map((r) => ({ from: r.sourceRecord.id, to: r.targetRecord.id })),
    )

    // Agrupamos por columna para repartir verticalmente dentro de cada una.
    const byLevel = new Map<number, string[]>()
    ids.forEach((id) => {
      const lvl = levels.get(id) ?? 0
      const bucket = byLevel.get(lvl) ?? []
      bucket.push(id)
      byLevel.set(lvl, bucket)
    })

    const COL_W = 300
    const ROW_H = 86
    const tallest = Math.max(...Array.from(byLevel.values(), (b) => b.length), 1)

    const nodeList: Node[] = []
    byLevel.forEach((bucket, lvl) => {
      // Centrado vertical de cada columna respecto de la más alta.
      const offset = ((tallest - bucket.length) * ROW_H) / 2
      bucket.forEach((id, i) => {
        const rec = records.get(id)!
        nodeList.push({
          id,
          type: 'recordNode',
          position: { x: lvl * COL_W, y: offset + i * ROW_H },
          data: {
            name: rec.name,
            type: rec.type,
            status: rec.status,
            outgoing: outgoing.get(id) ?? 0,
          },
          draggable: true,
        })
      })
    })

    // El color lo define el registro de origen: así todas las flechas que
    // salen del mismo registro se leen como un grupo.
    const sourceOrder = Array.from(new Set(rows.map((r) => r.sourceRecord.id)))
    const edgeList: Edge[] = rows.map((r) => {
      const colorIdx = sourceOrder.indexOf(r.sourceRecord.id)
      const incomplete = (r.configWarnings?.length ?? 0) > 0
      // Una relacion incompleta se dibuja punteada y en rojo: existe como
      // configuracion pero no ocurre.
      const color = incomplete
        ? 'var(--danger)'
        : RELATION_COLORS[colorIdx % RELATION_COLORS.length]
      return {
        id: r.id,
        source: r.sourceRecord.id,
        target: r.targetRecord.id,
        type: 'bezier',
        style: {
          stroke: color,
          strokeWidth: 1.75,
          opacity: incomplete ? 0.9 : 0.8,
          strokeDasharray: incomplete ? '5 4' : undefined,
        },
      }
    })

    return { nodes: nodeList, edges: edgeList }
  }, [rows])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={GLOBAL_NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      minZoom={0.3}
      maxZoom={1.5}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'var(--bg-2)' }}
    >
      <Background gap={18} size={1} color="var(--line)" />
      <Controls showInteractive={false} position="bottom-left" />
    </ReactFlow>
  )
}

function RecordNode({ data }: NodeProps) {
  const d = data as unknown as {
    name: string
    type: string
    status: string
    outgoing: number
  }
  return (
    <div
      className="rounded-[10px] border px-3.5 py-2"
      style={{
        background: 'var(--bg-1)',
        borderColor: d.outgoing > 0 ? 'var(--line-strong)' : 'var(--line)',
        boxShadow: 'var(--shadow-xs)',
        minWidth: 190,
        maxWidth: 240,
        // Estos nodos si se pueden arrastrar para reacomodar el mapa.
        cursor: 'move',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 7, height: 7, border: 'none', background: 'var(--line-strong)' }} />
      <div
        className="font-mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: 'var(--ink-3)' }}
      >
        {typeLabel[d.type] ?? d.type}
        {d.outgoing > 0 && ` · ${d.outgoing} ${d.outgoing === 1 ? 'flujo' : 'flujos'}`}
      </div>
      <div
        className="truncate text-[12.5px] font-medium"
        style={{ color: 'var(--ink-0)' }}
        title={d.name}
      >
        {d.name}
      </div>
      <Handle type="source" position={Position.Right} style={{ width: 7, height: 7, border: 'none', background: 'var(--line-strong)' }} />
    </div>
  )
}

const GLOBAL_NODE_TYPES = { recordNode: RecordNode }

// =============================================================================
// Listado textual — el grafo muestra la forma, la tabla permite navegar
// =============================================================================

function RelationList({ rows }: { rows: FlowOverviewRow[] }) {
  // Agrupamos por registro de origen para que se lea como "qué dispara cada uno".
  const grouped = useMemo(() => {
    const map = new Map<string, { record: FlowRecordRef; targets: FlowOverviewRow[] }>()
    rows.forEach((r) => {
      const entry = map.get(r.sourceRecord.id) ?? { record: r.sourceRecord, targets: [] }
      entry.targets.push(r)
      map.set(r.sourceRecord.id, entry)
    })
    return Array.from(map.values()).sort((a, b) => a.record.name.localeCompare(b.record.name))
  }, [rows])

  return (
    <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
      {grouped.map(({ record, targets }) => (
        <div key={record.id} className="syn-card px-4 py-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div
                className="font-mono text-[9px] uppercase tracking-[0.14em]"
                style={{ color: 'var(--ink-3)' }}
              >
                {typeLabel[record.type] ?? record.type}
              </div>
              <div className="truncate text-[13px] font-semibold" style={{ color: 'var(--ink-0)' }}>
                {record.name}
              </div>
            </div>
            <Link
              href={`/records/${record.id}`}
              className="shrink-0 inline-flex items-center gap-1 text-[11.5px] hover:underline"
              style={{ color: 'var(--primary-hex)' }}
              title="Abrir el registro"
            >
              Ver <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            {targets.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-[12px]">
                <span style={{ color: 'var(--ink-3)' }}>→</span>
                <Link
                  href={`/records/${t.targetRecord.id}`}
                  className="truncate hover:underline"
                  style={{ color: 'var(--ink-0)' }}
                >
                  {t.targetRecord.name}
                </Link>
                {(t.configWarnings?.length ?? 0) > 0 && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em]"
                    style={{ color: 'var(--danger)' }}
                    title={t.configWarnings?.join(' ')}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    No corre
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
