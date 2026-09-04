import { defineConfig } from 'vitest/config'

/**
 * Se usa Vitest y no Jest, que es lo que trae NestJS por defecto, porque
 * entiende TypeScript sin ts-jest ni transformaciones extra. En un monorepo
 * pnpm eso evita toda una capa de configuración que no aporta nada a los tests
 * que necesitamos.
 *
 * Los tests van al lado del código como `*.spec.ts`, siguiendo la convención
 * de Nest.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    // Las suites de logica pura no comparten estado; correrlas en paralelo es
    // seguro y mantiene el ciclo corto.
    globals: false,
  },
})
