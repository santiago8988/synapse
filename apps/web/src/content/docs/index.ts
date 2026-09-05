/**
 * Índice de la guía de usuario.
 *
 * El contenido vive en los `.md` de esta misma carpeta y es la **única** copia:
 * antes había una en `docs/user-guide/` y otra embebida en la página, y
 * divergieron. Agregar una sección es crear el markdown y sumar una línea acá.
 *
 * Los grupos siguen los del menú lateral a propósito: quien busca ayuda sobre
 * Lotes espera encontrarla donde encuentra Lotes.
 *
 * El ícono se declara por nombre y no como componente para que este archivo lo
 * pueda importar el servidor —que arma el índice y renderiza el markdown— sin
 * arrastrar `lucide-react` al bundle del cliente por dos etiquetas.
 */

export interface DocSection {
  /** Slug del archivo y de la URL: `<slug>.md` → `/docs/<slug>`. */
  slug: string
  title: string
  /** Se muestra bajo el título y alimenta la búsqueda. */
  summary: string
  /** Clave de `iconosDocs` en `doc-nav.tsx`. */
  icon: string
}

export interface DocGroup {
  label: string
  sections: DocSection[]
}

export const docGroups: DocGroup[] = [
  {
    label: 'Empezar',
    sections: [
      {
        slug: 'conceptos-generales',
        title: 'Conceptos generales',
        summary: 'Qué es Synapse, cómo se estructura y qué significa cada pieza.',
        icon: 'building',
      },
      {
        slug: 'organizacion-y-accesos',
        title: 'Organización y accesos',
        summary: 'Usuarios, roles, áreas, puestos y whitelist. Quién entra y qué ve.',
        icon: 'users',
      },
    ],
  },
  {
    label: 'Datos y automatización',
    sections: [
      {
        slug: 'documentos',
        title: 'Documentos',
        summary: 'Documentos controlados: versionado, estados y aprobación.',
        icon: 'file',
      },
      {
        slug: 'registros',
        title: 'Registros',
        summary: 'Las plantillas que definen qué datos se recopilan.',
        icon: 'clipboard',
      },
      {
        slug: 'entradas',
        title: 'Entradas',
        summary: 'La carga de datos: comparaciones, fórmulas y entidades compañeras.',
        icon: 'list',
      },
      {
        slug: 'flujos',
        title: 'Flujos',
        summary: 'Automatizaciones, campo de estado y Kanban.',
        icon: 'workflow',
      },
    ],
  },
  {
    label: 'Operación',
    sections: [
      {
        slug: 'recetas',
        title: 'Fórmulas',
        summary: 'Ingredientes y pasos de producción, vinculados al stock.',
        icon: 'flask',
      },
      {
        slug: 'lotes',
        title: 'Lotes',
        summary: 'Producción por lotes y consumo de insumos.',
        icon: 'package',
      },
      {
        slug: 'muestras',
        title: 'Muestras',
        summary: 'Recepción, matriz, métodos y resultados.',
        icon: 'tube',
      },
      {
        slug: 'instrumental',
        title: 'Instrumental',
        summary: 'Equipos, estados y validación de uso.',
        icon: 'wrench',
      },
      {
        slug: 'calibraciones',
        title: 'Calibraciones',
        summary: 'Certificados externos, plantillas y verificación interna.',
        icon: 'ruler',
      },
      {
        slug: 'matrices-metodos',
        title: 'Matrices y métodos',
        summary: 'Matrices de ensayo, condiciones de muestreo y catálogo de métodos.',
        icon: 'microscope',
      },
      {
        slug: 'stock',
        title: 'Stock',
        summary: 'Movimientos de inventario y existencias por producto y lote.',
        icon: 'warehouse',
      },
    ],
  },
  {
    label: 'Calidad',
    sections: [
      {
        slug: 'circuito-aprobacion',
        title: 'Circuito de aprobación',
        summary: 'Elaborador, revisor y aprobador. Qué entidades lo usan.',
        icon: 'check',
      },
      {
        slug: 'no-conformidades',
        title: 'No conformidades',
        summary: 'Detección automática y manual, acciones correctivas y cierre.',
        icon: 'alert',
      },
      {
        slug: 'auditoria',
        title: 'Auditoría',
        summary: 'Qué se registra, quién lo ve y por qué no se puede modificar.',
        icon: 'shield',
      },
    ],
  },
  {
    label: 'La aplicación',
    sections: [
      {
        slug: 'notificaciones',
        title: 'Notificaciones',
        summary: 'De dónde salen los avisos, a quién llegan y webhooks.',
        icon: 'bell',
      },
      {
        slug: 'uso-sin-conexion',
        title: 'Instalación y uso sin conexión',
        summary: 'Instalar la app en el celular y qué funciona sin señal.',
        icon: 'wifi',
      },
    ],
  },
]

/** Todas las secciones en orden, sin agrupar. */
export const docSections: DocSection[] = docGroups.flatMap((g) => g.sections)

export function findSection(slug: string): DocSection | undefined {
  return docSections.find((s) => s.slug === slug)
}

/** La sección que se muestra al entrar a `/docs` sin más. */
export const DEFAULT_DOC_SLUG = docSections[0].slug
