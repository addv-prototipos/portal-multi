module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/unit/**/*.test.js', '**/test/integration/**/*.test.js'],
  collectCoverageFrom: [
    'utils/**/*.js',
    'scripts/**/*.js',
    'server.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  // GET /health corre un setTimeout de 2s en una carrera con la consulta
  // a MySQL (ver server.js) que nunca se cancela explícitamente — mismo
  // motivo que backend/jest.config.js.
  forceExit: true,
};
