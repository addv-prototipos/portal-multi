import { defineConfig, devices } from '@playwright/test';

// Corre contra el sitio ya levantado con docker-compose (ver README del
// Segmento D). No levanta ni apaga Docker por sí mismo — eso queda a cargo
// de quien ejecuta las pruebas, para no arriesgar estado de contenedores
// que puedan estar en uso.
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
