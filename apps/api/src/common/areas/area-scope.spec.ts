import { describe, it, expect } from 'vitest'
import {
  alcanceDeAreas,
  descendientesDe,
  filtroDeRecordsVisibles,
  type AreaNodo,
} from './area-scope'

/**
 * De esto depende qué ve cada persona. Un error acá no rompe nada visible:
 * simplemente alguien deja de ver trabajo que le corresponde, o empieza a ver
 * el de otra planta. Las dos fallas son silenciosas, y por eso se fijan acá.
 */

//        raiz
//        +-- lab
//        |   +-- fq
//        |   |   +-- crom
//        |   +-- micro
//        +-- planta
const arbol: AreaNodo[] = [
  { id: 'raiz', parentId: null },
  { id: 'lab', parentId: 'raiz' },
  { id: 'fq', parentId: 'lab' },
  { id: 'crom', parentId: 'fq' },
  { id: 'micro', parentId: 'lab' },
  { id: 'planta', parentId: 'raiz' },
]

describe('descendientesDe', () => {
  it('incluye el área propia', () => {
    expect(descendientesDe(arbol, 'crom')).toEqual(['crom'])
  })

  it('baja hasta el fondo del árbol, no un solo nivel', () => {
    // Quien está en Laboratorio ve Cromatografía, que está dos niveles abajo.
    expect(descendientesDe(arbol, 'lab').sort()).toEqual(['crom', 'fq', 'lab', 'micro'])
  })

  it('no sube ni cruza a las hermanas', () => {
    const visibles = descendientesDe(arbol, 'fq')
    expect(visibles).not.toContain('lab')
    expect(visibles).not.toContain('raiz')
    expect(visibles).not.toContain('micro')
    expect(visibles).not.toContain('planta')
  })

  it('desde la raíz alcanza todo', () => {
    expect(descendientesDe(arbol, 'raiz').sort()).toEqual(
      ['crom', 'fq', 'lab', 'micro', 'planta', 'raiz'].sort(),
    )
  })

  it('un área que no existe devuelve solo su propio id', () => {
    expect(descendientesDe(arbol, 'inexistente')).toEqual(['inexistente'])
  })

  it('un ciclo no cuelga el proceso', () => {
    // La interfaz no permite armarlo, pero un UPDATE a mano sí. Una versión
    // ingenua se quedaría recorriendo para siempre.
    const ciclo: AreaNodo[] = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ]
    expect(descendientesDe(ciclo, 'a').sort()).toEqual(['a', 'b'])
  })

  it('sin áreas devuelve solo la propia', () => {
    expect(descendientesDe([], 'lab')).toEqual(['lab'])
  })
})

describe('alcanceDeAreas', () => {
  it('ADMIN y AUDITOR no tienen restricción', () => {
    // `null` significa "todo", y es distinto de `[]`, que significa "nada".
    expect(alcanceDeAreas({ role: 'ADMIN', areaId: 'fq' }, arbol)).toBeNull()
    expect(alcanceDeAreas({ role: 'AUDITOR', areaId: null }, arbol)).toBeNull()
  })

  it('el resto ve su área y las que cuelgan de ella', () => {
    expect(alcanceDeAreas({ role: 'QUALITY_MANAGER', areaId: 'lab' }, arbol)?.sort()).toEqual([
      'crom',
      'fq',
      'lab',
      'micro',
    ])
  })

  it('sin área asignada no ve ninguna', () => {
    // Vacío, no `null`: confundirlos convertiría un tablero vacío en uno
    // completo.
    expect(alcanceDeAreas({ role: 'TECHNICIAN', areaId: null }, arbol)).toEqual([])
    expect(alcanceDeAreas({ role: 'TECHNICIAN' }, arbol)).toEqual([])
  })
})

describe('filtroDeRecordsVisibles', () => {
  it('sin restricción filtra solo por organización', () => {
    expect(filtroDeRecordsVisibles('org-1', null)).toEqual({ organizationId: 'org-1' })
  })

  it('siempre incluye la organización, aun con áreas', () => {
    // Es la regla que impide filtrar entre inquilinos. Nunca puede quedar
    // reemplazada por el filtro de áreas.
    const filtro = filtroDeRecordsVisibles('org-1', ['lab'])
    expect(filtro.organizationId).toBe('org-1')
  })

  it('deja pasar los registros sin área', () => {
    // Un registro sin área no es de otro: está sin clasificar. Esconderlo haría
    // desaparecer trabajo sin que nadie se entere.
    const filtro = filtroDeRecordsVisibles('org-1', ['lab'])
    expect(filtro.OR).toContainEqual({ areas: { none: {} } })
  })

  it('con áreas visibles filtra por ellas', () => {
    const filtro = filtroDeRecordsVisibles('org-1', ['lab', 'fq'])
    expect(filtro.OR).toContainEqual({ areas: { some: { areaId: { in: ['lab', 'fq'] } } } })
  })

  it('sin ninguna área visible quedan solo los no clasificados', () => {
    const filtro = filtroDeRecordsVisibles('org-1', [])
    expect(filtro.OR).toContainEqual({ areas: { some: { areaId: { in: [] } } } })
    expect(filtro.OR).toContainEqual({ areas: { none: {} } })
  })
})
