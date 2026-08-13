module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/unit/**/*.test.js', '**/test/integration/**/*.test.js'],
  collectCoverageFrom: [
    'utils/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // GET /api/health corre un setTimeout de 2s en una carrera con la
  // consulta a MySQL (ver server.js) que nunca se cancela explícitamente
  // — inofensivo en producción (se autorresuelve solo), pero deja un
  // temporizador pendiente que impide que el proceso de Jest cierre
  // limpio de inmediato después de cada corrida.
  forceExit: true,
};
