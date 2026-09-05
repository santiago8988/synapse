import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Con `globals: false` la limpieza automatica de Testing Library no se
// engancha sola: sin esto, cada test renderiza sobre el DOM del anterior y las
// consultas encuentran elementos duplicados.
afterEach(cleanup)
