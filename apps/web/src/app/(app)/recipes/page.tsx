'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Plus, Search, Trash2, Pencil, ChevronRight, ChevronDown, Loader2, X, Send, Package, Warehouse } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface Recipe {
  id: string
  name: string
  code: string
  version: number
  status: string
  ingredients: Ingredient[]
  steps: Step[]
  _count?: { batches: number }
}

const statusLabels: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  IN_REVIEW: { label: 'En revisión', variant: 'warning' },
  ACTIVE: { label: 'Activa', variant: 'success' },
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
      toast.success('Receta eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.approval.submit({ entityType: 'RECIPE', entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success('Receta enviada a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = recipes.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.code && r.code.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recetas</h1>
          <p className="mt-1 text-muted-foreground">Fórmulas y procesos de producción</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva receta
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar recetas..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {(showForm || editingRecipe) && (
        <RecipeForm
          recipe={editingRecipe}
          onClose={() => { setShowForm(false); setEditingRecipe(null) }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] })
            setShowForm(false)
            setEditingRecipe(null)
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
            <FlaskConical className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No se encontraron recetas' : 'No hay recetas creadas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filtered.map((recipe) => {
            const status = statusLabels[recipe.status] || statusLabels.DRAFT
            return (
              <button
                key={recipe.id}
                onClick={() => setViewingRecipe(recipe)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <FlaskConical className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{recipe.name}</p>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{recipe.code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    v{recipe.version} &middot; {recipe.ingredients.length} ingredientes &middot; {recipe.steps.length} pasos
                    {recipe._count && recipe._count.batches > 0 && <> &middot; {recipe._count.batches} lotes</>}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      )}

      {/* Dialog de detalle */}
      {viewingRecipe && (
        <RecipeDetailDialog
          recipe={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
          onEdit={() => { setEditingRecipe(viewingRecipe); setViewingRecipe(null) }}
          onSubmit={() => { submitMutation.mutate(viewingRecipe.id); setViewingRecipe(null) }}
          onDelete={() => {
            if (confirm(`Eliminar la receta "${viewingRecipe.name}"?`)) {
              deleteMutation.mutate(viewingRecipe.id)
              setViewingRecipe(null)
            }
          }}
        />
      )}
    </div>
  )
}

// ─── Dialog de detalle ───────────────────

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
  const status = statusLabels[recipe.status] || statusLabels.DRAFT

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <FlaskConical className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{recipe.name}</h2>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{recipe.code}</span>
              <span>v{recipe.version}</span>
              {recipe._count && recipe._count.batches > 0 && <span>{recipe._count.batches} lotes</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Ingredientes */}
          {recipe.ingredients.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Ingredientes (BOM)</h4>
              <div className="rounded-lg border">
                <div className="grid grid-cols-[2rem_1fr_6rem_4rem_6rem] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                  <span>#</span>
                  <span>Ingrediente</span>
                  <span className="text-right">Cantidad</span>
                  <span>Unidad</span>
                  <span>Stock</span>
                </div>
                <div className="divide-y">
                  {recipe.ingredients.map((ing, i) => (
                    <div key={i} className="grid grid-cols-[2rem_1fr_6rem_4rem_6rem] gap-2 px-3 py-2.5 text-sm items-center">
                      <span className="text-xs text-muted-foreground">{ing.order}</span>
                      <span className="font-medium">{ing.name}</span>
                      <span className="text-right font-mono">{ing.quantity}</span>
                      <span className="text-muted-foreground">{ing.unit}</span>
                      <span>
                        {ing.fromStock ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <Warehouse className="h-3 w-3" />
                            {ing.stockRecipe?.code || 'Si'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pasos */}
          {recipe.steps.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold">Pasos del proceso</h4>
              <div className="rounded-lg border divide-y">
                {recipe.steps.map((step, i) => (
                  <div key={i} className="px-3 py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {step.order}
                      </span>
                      <span className="font-medium flex-1">{step.name}</span>
                      {step.duration && (
                        <Badge variant="secondary" className="text-[10px]">{step.duration} min</Badge>
                      )}
                    </div>
                    {step.description && (
                      <p className="mt-1 ml-9 text-xs text-muted-foreground">{step.description}</p>
                    )}
                    {step.controls && (
                      <p className="mt-1 ml-9 text-xs text-blue-600">Control: {step.controls}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t px-6 py-4">
          {recipe.status !== 'IN_REVIEW' && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3 w-3" />
              Editar
            </Button>
          )}
          {recipe.status === 'DRAFT' && (
            <Button size="sm" onClick={onSubmit}>
              <Send className="mr-1 h-3 w-3" />
              Enviar a revision
            </Button>
          )}
          {recipe.status === 'DRAFT' && (
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

// ─── Formulario de receta ───────────────────

function RecipeForm({ recipe, onClose, onSuccess }: { recipe?: Recipe | null; onClose: () => void; onSuccess: () => void }) {
  const isEditing = !!recipe
  const isDraft = recipe?.status === 'DRAFT'
  const nameCodeLocked = isEditing && !isDraft
  const [name, setName] = useState(recipe?.name || '')
  const [code, setCode] = useState(recipe?.code || '')
  const [ingredients, setIngredients] = useState<Ingredient[]>(recipe?.ingredients || [{ name: '', quantity: 0, unit: 'kg', order: 1 }])
  const [steps, setSteps] = useState<Step[]>(recipe?.steps || [{ order: 1, name: '', description: '', duration: undefined, controls: '' }])
  const [saving, setSaving] = useState(false)

  // Recetas activas para vincular como producto de stock
  const { data: activeRecipes = [] } = useQuery({
    queryKey: ['recipes-active-for-stock'],
    queryFn: () => api.recipes.list() as Promise<Array<{ id: string; name: string; code: string | null; status: string }>>,
  })
  const stockProducts = activeRecipes.filter((r) => r.status === 'ACTIVE')

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
      if (isEditing) {
        await api.recipes.update(recipe!.id, {
          ...(isDraft ? { name: name.trim(), code: code.trim() } : {}),
          ingredients: validIngredients,
          steps: steps.filter((s) => s.name.trim()),
        })
        toast.success(isDraft ? 'Receta actualizada' : 'Receta actualizada (nueva version)')
      } else {
        await api.recipes.create({
          name: name.trim(),
          code: code.trim(),
          ingredients: validIngredients,
          steps: steps.filter((s) => s.name.trim()),
        })
        toast.success('Receta creada')
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
          <CardTitle>{isEditing ? `Editar ${recipe!.name}` : 'Nueva receta'}</CardTitle>
          <CardDescription>
            {isEditing
              ? (isDraft ? 'Edicion directa en borrador' : `Se creara la version v${recipe!.version + 1}`)
              : 'Defini ingredientes y pasos del proceso'}
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
              placeholder="Ej: Pan integral"
              className={`flex h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${nameCodeLocked ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Codigo producto *</label>
            <input
              value={code}
              onChange={(e) => !nameCodeLocked && setCode(e.target.value)}
              readOnly={nameCodeLocked}
              placeholder="Ej: PI-001"
              className={`flex h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${nameCodeLocked ? 'bg-muted cursor-not-allowed' : 'bg-background'}`}
            />
          </div>
        </div>

        {/* Ingredientes */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold">Ingredientes (BOM) *</label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIngredients([...ingredients, { name: '', quantity: 0, unit: 'kg', order: ingredients.length + 1 }])}
            >
              <Plus className="mr-1 h-3 w-3" />
              Agregar
            </Button>
          </div>
          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="rounded-lg border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <input
                    value={ing.name}
                    onChange={(e) => {
                      const updated = [...ingredients]
                      updated[i] = { ...updated[i], name: e.target.value }
                      setIngredients(updated)
                    }}
                    placeholder="Ingrediente"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    value={ing.quantity || ''}
                    onChange={(e) => {
                      const updated = [...ingredients]
                      updated[i] = { ...updated[i], quantity: parseFloat(e.target.value) || 0 }
                      setIngredients(updated)
                    }}
                    placeholder="Cant."
                    className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => {
                      const updated = [...ingredients]
                      updated[i] = { ...updated[i], unit: e.target.value }
                      setIngredients(updated)
                    }}
                    className="w-20 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                    <option value="u">u</option>
                  </select>
                  {ingredients.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-8">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ing.fromStock || false}
                      onChange={(e) => {
                        const updated = [...ingredients]
                        updated[i] = { ...updated[i], fromStock: e.target.checked, stockRecipeId: e.target.checked ? ing.stockRecipeId : undefined }
                        setIngredients(updated)
                      }}
                      className="rounded"
                    />
                    De stock
                  </label>
                  {ing.fromStock && (
                    <select
                      value={ing.stockRecipeId || ''}
                      onChange={(e) => {
                        const updated = [...ingredients]
                        const selected = stockProducts.find((r) => r.id === e.target.value)
                        updated[i] = {
                          ...updated[i],
                          stockRecipeId: e.target.value || undefined,
                          name: selected ? selected.name : updated[i].name,
                        }
                        setIngredients(updated)
                      }}
                      className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Seleccionar producto...</option>
                      {stockProducts.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}{r.code ? ` (${r.code})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pasos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-semibold">Pasos del proceso</label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSteps([...steps, { order: steps.length + 1, name: '', description: '', duration: undefined, controls: '' }])}
            >
              <Plus className="mr-1 h-3 w-3" />
              Agregar
            </Button>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
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
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="number"
                    value={step.duration || ''}
                    onChange={(e) => {
                      const updated = [...steps]
                      updated[i] = { ...updated[i], duration: parseInt(e.target.value) || undefined }
                      setSteps(updated)
                    }}
                    placeholder="min"
                    className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {steps.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  value={step.controls || ''}
                  onChange={(e) => {
                    const updated = [...steps]
                    updated[i] = { ...updated[i], controls: e.target.value }
                    setSteps(updated)
                  }}
                  placeholder="Controles (ej: Verificar pH entre 6.5 y 7.5)"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-blue-600 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !name.trim() || !code.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? (isDraft ? 'Guardar cambios' : 'Guardar nueva version') : 'Crear receta'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}
