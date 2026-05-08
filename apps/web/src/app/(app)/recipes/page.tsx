'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  FlaskConical,
  Plus,
  Search,
  Trash2,
  Pencil,
  ChevronRight,
  Loader2,
  X,
  Send,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Ingredient {
  name: string
  quantity: number
  unit: string
  order: number
  fromStock?: boolean
  stockRecipeId?: string
  stockRecipe?: { id: string; name: string; code: string | null } | null
}

interface Step {
  order: number
  name: string
  description?: string
  duration?: number
  controls?: string
}

interface RequiredInstrument {
  label: string
  order: number
}

interface Recipe {
  id: string
  name: string
  code: string
  version: number
  status: string
  ingredients: Ingredient[]
  steps: Step[]
  requiredInstruments?: RequiredInstrument[]
  _count?: { batches: number }
  /** PDF con los pasos del proceso (reemplaza la edición textual de Step[]). */
  stepsPdfUrl: string | null
  stepsPdfKey: string | null
  stepsPdfName: string | null
  stepsPdfSize: number | null
  stepsPdfUploadedAt: string | null
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

export default function RecipesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null)

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.recipes.list() as Promise<Recipe[]>,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.recipes.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Fórmula eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.approval.submit({ entityType: 'RECIPE', entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Fórmula enviada a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.code && r.code.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Fórmulas</div>
          <h1>
            Fórmulas de <span className="italic">producción.</span>
          </h1>
          <p className="sub">
            Fórmulas (BOM) y procesos paso a paso. Las usás al crear lotes para consumo automático de stock y trazabilidad de cada producción.
          </p>
        </div>
        <div className="syn-ph-actions">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="syn-btn syn-btn-primary"
          >
            <Plus className="h-3 w-3" /> Nueva fórmula
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
            placeholder="Buscar fórmulas…"
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
          {filtered.length} {filtered.length === 1 ? 'fórmula' : 'fórmulas'}
        </div>
      </div>

      {(showForm || editingRecipe) && (
        <div className="mb-5">
          <RecipeForm
            recipe={editingRecipe}
            onClose={() => {
              setShowForm(false)
              setEditingRecipe(null)
            }}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['recipes'] })
              setShowForm(false)
              setEditingRecipe(null)
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
                  Aún no hay <span className="italic">fórmulas.</span>
                </>
              )}
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {search
                ? 'Probá cambiar la búsqueda.'
                : 'Creá tu primera fórmula para estandarizar la producción.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="syn-card">
          {filtered.map((r, idx) => {
            const chipCls = statusChipCls[r.status] ?? 'syn-chip-draft'
            return (
              <button
                type="button"
                key={r.id}
                onClick={() => setViewingRecipe(r)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--bg-3)]"
                style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--line)' }}
              >
                <FlaskConical className="h-5 w-5" style={{ color: 'var(--ink-3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px] font-medium"
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {r.name}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
                    >
                      {r.code}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 font-mono text-[11px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    v{r.version} · {r.ingredients.length} ingredientes ·{' '}
                    {r.steps.length} pasos
                    {r._count && r._count.batches > 0 && (
                      <> · {r._count.batches} lotes</>
                    )}
                  </div>
                </div>
                <span className={`syn-chip ${chipCls}`}>
                  {statusLabel[r.status] ?? r.status}
                </span>
                <ChevronRight className="h-4 w-4" style={{ color: 'var(--ink-3)' }} />
              </button>
            )
          })}
        </div>
      )}

      {viewingRecipe && (
        <RecipeDetailDialog
          recipe={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          onEdit={() => {
            setEditingRecipe(viewingRecipe)
            setViewingRecipe(null)
          }}
          onSubmit={() => {
            submitMutation.mutate(viewingRecipe.id)
            setViewingRecipe(null)
          }}
          onDelete={() => {
            if (confirm(`¿Eliminar la fórmula "${viewingRecipe.name}"?`)) {
              deleteMutation.mutate(viewingRecipe.id)
              setViewingRecipe(null)
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

function RecipeDetailDialog({
  recipe,
  onClose,
  onEdit,
  onSubmit,
  onDelete,
}: {
  recipe: Recipe
  onClose: () => void
  onEdit: () => void
  onSubmit: () => void
  onDelete: () => void
}) {
  const chipCls = statusChipCls[recipe.status] ?? 'syn-chip-draft'

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
      style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[100dvh] w-full flex-col bg-[var(--bg-1)] shadow-[var(--shadow-lg)] sm:max-w-2xl sm:rounded-[14px]"
        style={{ border: '1px solid var(--line)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="kicker mb-1 flex items-center gap-2">
              <FlaskConical className="h-3 w-3" /> Fórmula
              <span
                className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
              >
                {recipe.code}
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
              {recipe.name}
            </h2>
            <div
              className="mt-2 flex flex-wrap items-center gap-3 text-[12px]"
              style={{ color: 'var(--ink-3)' }}
            >
              <span className={`syn-chip ${chipCls}`}>
                {statusLabel[recipe.status]}
              </span>
              <span className="font-mono">v{recipe.version}</span>
              {recipe._count && recipe._count.batches > 0 && (
                <span>{recipe._count.batches} lotes producidos</span>
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
          {/* Ingredientes (BOM) */}
          {recipe.ingredients.length > 0 && (
            <div>
              <div className="kicker mb-2">· Ingredientes (BOM)</div>
              <div
                className="rounded-[8px] border"
                style={{ borderColor: 'var(--line)' }}
              >
                <table className="syn-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Ingrediente</th>
                      <th style={{ textAlign: 'right' }}>Cantidad</th>
                      <th>Unidad</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipe.ingredients.map((ing, i) => (
                      <tr key={i}>
                        <td
                          data-label="#"
                          className="font-mono"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {ing.order}
                        </td>
                        <td data-label="Ingrediente" data-role="identifier">
                          <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                            {ing.name}
                          </span>
                        </td>
                        <td
                          data-label="Cantidad"
                          className="font-mono"
                          style={{ textAlign: 'right', color: 'var(--ink-1)' }}
                        >
                          {ing.quantity}
                        </td>
                        <td data-label="Unidad" style={{ color: 'var(--ink-2)' }}>
                          {ing.unit}
                        </td>
                        <td data-label="Stock">
                          {ing.fromStock ? (
                            <span
                              className="inline-flex items-center gap-1 font-mono text-[11px]"
                              style={{ color: 'var(--ok)' }}
                            >
                              <Warehouse className="h-3 w-3" />
                              {ing.stockRecipe?.code || 'Sí'}
                            </span>
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

          {/* Pasos del proceso (PDF) */}
          <RecipeStepsPdfSection
            recipeId={recipe.id}
            stepsPdfUrl={recipe.stepsPdfUrl}
            stepsPdfName={recipe.stepsPdfName}
            stepsPdfSize={recipe.stepsPdfSize}
          />

          {/* Instrumentos requeridos */}
          {recipe.requiredInstruments && recipe.requiredInstruments.length > 0 && (
            <div>
              <div className="kicker mb-2">· Instrumentos requeridos</div>
              <div
                className="rounded-[8px] border"
                style={{ borderColor: 'var(--line)' }}
              >
                {recipe.requiredInstruments.map((ri, i) => (
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
          {recipe.status !== 'IN_REVIEW' && (
            <button
              type="button"
              onClick={onEdit}
              className="syn-btn syn-btn-ghost"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          {recipe.status === 'DRAFT' && (
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
          <button type="button" onClick={onClose} className="syn-btn syn-btn-subtle">
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

function RecipeForm({
  recipe,
  onClose,
  onSuccess,
}: {
  recipe?: Recipe | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!recipe
  const isDraft = recipe?.status === 'DRAFT'
  const nameCodeLocked = isEditing && !isDraft
  const [name, setName] = useState(recipe?.name || '')
  const [code, setCode] = useState(recipe?.code || '')
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    recipe?.ingredients || [{ name: '', quantity: 0, unit: 'kg', order: 1 }],
  )
  const [steps, setSteps] = useState<Step[]>(
    recipe?.steps || [
      { order: 1, name: '', description: '', duration: undefined, controls: '' },
    ],
  )
  const [requiredInstruments, setRequiredInstruments] = useState<RequiredInstrument[]>(
    recipe?.requiredInstruments || [],
  )
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    if (!code.trim()) {
      toast.error('El código de producto es obligatorio')
      return
    }
    const validIngredients = ingredients.filter((i) => i.name.trim())
    if (validIngredients.length === 0) {
      toast.error('Agregá al menos un ingrediente')
      return
    }
    setSaving(true)
    try {
      const requiredInstrumentsPayload = requiredInstruments
        .filter((r) => r.label.trim())
        .map((r, i) => ({ label: r.label.trim(), order: i + 1 }))
      if (isEditing) {
        await api.recipes.update(recipe!.id, {
          ...(isDraft ? { name: name.trim(), code: code.trim() } : {}),
          ingredients: validIngredients,
          steps: steps.filter((s) => s.name.trim()),
          requiredInstruments: requiredInstrumentsPayload,
        })
        toast.success(
          isDraft ? 'Fórmula actualizada' : 'Fórmula actualizada (nueva versión)',
        )
      } else {
        await api.recipes.create({
          name: name.trim(),
          code: code.trim(),
          ingredients: validIngredients,
          steps: steps.filter((s) => s.name.trim()),
          requiredInstruments: requiredInstrumentsPayload,
        })
        toast.success('Fórmula creada')
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
            · {isEditing ? 'Editar fórmula' : 'Nueva fórmula'}
          </div>
          <h3 style={{ marginTop: 6 }}>
            {isEditing ? (
              <>
                {isDraft ? 'Edición en ' : 'Nueva versión · '}
                <span className="italic">
                  {isDraft ? 'borrador.' : `v${recipe!.version + 1}.`}
                </span>
              </>
            ) : (
              <>
                Definí ingredientes y <span className="italic">pasos.</span>
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
              placeholder="Ej: Pan integral"
              className="syn-input"
              style={
                nameCodeLocked
                  ? { background: 'var(--bg-3)', cursor: 'not-allowed' }
                  : undefined
              }
            />
          </div>
          <div className="syn-field">
            <span className="syn-field-label">
              Código producto <span className="req">*</span>
            </span>
            <input
              value={code}
              onChange={(e) => !nameCodeLocked && setCode(e.target.value)}
              readOnly={nameCodeLocked}
              placeholder="Ej: PI-001"
              className="syn-input"
              style={
                nameCodeLocked
                  ? { background: 'var(--bg-3)', cursor: 'not-allowed' }
                  : undefined
              }
            />
          </div>
        </div>

        {/* Ingredientes */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="kicker">
              · Ingredientes (BOM) <span className="req">*</span>
            </div>
            <button
              type="button"
              onClick={() =>
                setIngredients([
                  ...ingredients,
                  {
                    name: '',
                    quantity: 0,
                    unit: 'kg',
                    order: ingredients.length + 1,
                  },
                ])
              }
              className="syn-btn syn-btn-ghost"
              style={{ padding: '6px 10px' }}
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div
                key={i}
                className="space-y-2 rounded-[8px] border p-2.5"
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
                    value={ing.name}
                    onChange={(e) => {
                      const updated = [...ingredients]
                      updated[i] = { ...updated[i], name: e.target.value }
                      setIngredients(updated)
                    }}
                    placeholder="Ingrediente"
                    className="syn-input"
                    style={{ flex: 1, minWidth: 160 }}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={ing.quantity || ''}
                    onChange={(e) => {
                      const updated = [...ingredients]
                      updated[i] = {
                        ...updated[i],
                        quantity: parseFloat(e.target.value) || 0,
                      }
                      setIngredients(updated)
                    }}
                    placeholder="Cant."
                    className="syn-input font-mono"
                    style={{ width: 96, minHeight: 32, padding: '6px 10px' }}
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => {
                      const updated = [...ingredients]
                      updated[i] = { ...updated[i], unit: e.target.value }
                      setIngredients(updated)
                    }}
                    className="syn-select"
                    style={{ width: 90, minHeight: 32, padding: '6px 24px 6px 10px' }}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="u">u</option>
                  </select>
                  {ingredients.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients(ingredients.filter((_, j) => j !== i))
                      }
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px', color: 'var(--danger)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="ml-8 flex flex-wrap items-center gap-3">
                  <label
                    className="flex items-center gap-1.5 text-[12px]"
                    style={{ cursor: 'pointer', color: 'var(--ink-1)' }}
                  >
                    <input
                      type="checkbox"
                      checked={ing.fromStock || false}
                      onChange={(e) => {
                        const updated = [...ingredients]
                        updated[i] = {
                          ...updated[i],
                          fromStock: e.target.checked,
                          stockRecipeId: undefined,
                        }
                        setIngredients(updated)
                      }}
                    />
                    De stock
                  </label>
                  {ing.fromStock && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <Warehouse className="h-3 w-3" />
                      Se descontará del stock al producir el batch — el lote se elige ahí.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pasos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="kicker">· Pasos del proceso</div>
            <button
              type="button"
              onClick={() =>
                setSteps([
                  ...steps,
                  {
                    order: steps.length + 1,
                    name: '',
                    description: '',
                    duration: undefined,
                    controls: '',
                  },
                ])
              }
              className="syn-btn syn-btn-ghost"
              style={{ padding: '6px 10px' }}
            >
              <Plus className="h-3 w-3" /> Agregar
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div
                key={i}
                className="space-y-2 rounded-[8px] border p-3"
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
                    {i + 1}
                  </span>
                  <input
                    value={step.name}
                    onChange={(e) => {
                      const updated = [...steps]
                      updated[i] = { ...updated[i], name: e.target.value }
                      setSteps(updated)
                    }}
                    placeholder="Nombre del paso (ej: Mezclado)"
                    className="syn-input"
                    style={{ flex: 1 }}
                  />
                  <div className="syn-unit-input" style={{ width: 110 }}>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={step.duration || ''}
                      onChange={(e) => {
                        const updated = [...steps]
                        updated[i] = {
                          ...updated[i],
                          duration: parseInt(e.target.value) || undefined,
                        }
                        setSteps(updated)
                      }}
                      placeholder="—"
                    />
                    <span className="unit">min</span>
                  </div>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                      className="syn-btn syn-btn-subtle"
                      style={{ padding: '6px 8px', color: 'var(--danger)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <input
                  value={step.description || ''}
                  onChange={(e) => {
                    const updated = [...steps]
                    updated[i] = { ...updated[i], description: e.target.value }
                    setSteps(updated)
                  }}
                  placeholder="Descripción / instrucciones"
                  className="syn-input"
                />
                <input
                  value={step.controls || ''}
                  onChange={(e) => {
                    const updated = [...steps]
                    updated[i] = { ...updated[i], controls: e.target.value }
                    setSteps(updated)
                  }}
                  placeholder="Controles (ej: verificar pH entre 6.5 y 7.5)"
                  className="syn-input"
                  style={{ color: 'var(--info)' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Instrumentos requeridos */}
        <div>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="kicker">· Instrumentos requeridos</div>
              <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Labels de equipos que se van a usar en producción (ej: Balanza, Termómetro). Se asignan al instrumento real en cada lote.
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
                    placeholder="Ej: Balanza"
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
            disabled={saving || !name.trim() || !code.trim()}
            className="syn-btn syn-btn-primary"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isEditing
              ? isDraft
                ? 'Guardar cambios'
                : 'Guardar nueva versión'
              : 'Crear fórmula'}
          </button>
          <button type="button" onClick={onClose} className="syn-btn syn-btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// RecipeStepsPdfSection — sube/visualiza el PDF de pasos del proceso
// ───────────────────────────────────────────────────────────────────────────

const STEPS_PDF_MAX_BYTES = 10 * 1024 * 1024
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function RecipeStepsPdfSection({
  recipeId,
  stepsPdfUrl,
  stepsPdfName,
  stepsPdfSize,
}: {
  recipeId: string
  stepsPdfUrl: string | null
  stepsPdfName: string | null
  stepsPdfSize: number | null
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
    if (file.size > STEPS_PDF_MAX_BYTES) {
      setError('El archivo supera el tamaño máximo (10 MB).')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null
      const res = await fetch(`${apiBase}/recipes/${recipeId}/steps-pdf`, {
        method: 'POST',
        body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Error subiendo el archivo' }))
        throw new Error(body.message || `Error ${res.status}`)
      }
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Pasos del proceso subidos')
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null
      const res = await fetch(`${apiBase}/recipes/${recipeId}/steps-pdf`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('No se pudo eliminar el PDF')
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('PDF eliminado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div>
      <div className="kicker mb-2">· Pasos del proceso</div>
      {stepsPdfUrl ? (
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
            <div className="truncate text-[13px]" style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
              {stepsPdfName || 'pasos.pdf'}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              {stepsPdfSize ? formatBytes(stepsPdfSize) : '—'}
            </div>
          </div>
          <a
            href={`${apiBase}${stepsPdfUrl.replace(/^\/api/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="syn-btn syn-btn-subtle"
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            Ver
          </a>
          <button
            type="button"
            onClick={handleRemove}
            className="syn-btn"
            style={{ padding: '4px 8px', fontSize: 12, color: 'var(--danger)' }}
          >
            Quitar
          </button>
        </div>
      ) : (
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
              : 'Click para adjuntar un PDF con los pasos del proceso (máx. 10 MB)'}
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
      )}
      {error && (
        <div className="text-[11.5px] mt-1" style={{ color: 'var(--danger)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
