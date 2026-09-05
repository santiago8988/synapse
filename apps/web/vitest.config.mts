import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Mismo runner que el backend, por las mismas razones: entiende TypeScript sin
 * capa de transformación extra.
 *
 * `environment: 'jsdom'` porque parte de lo que hay que cubrir toca
 * `localStorage` y `document.cookie` — la sesión y las preferencias de
 * columnas. La lógica pura no lo necesita, pero tener dos entornos según el
 * archivo complica más de lo que ahorra.
 *
 * El alias `@` replica el de tsconfig: sin él, los imports del código bajo
 * prueba no resuelven.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    environment: 'jsdom',
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
