const request = require('supertest');

// Verifica que Supertest puede levantar un servidor Express mínimo.
// Las pruebas de integración reales de las rutas de server.js van en el Segmento C.
describe('smoke: harness de integration tests', () => {
  test('Supertest puede hacer una petición HTTP', async () => {
    const express = require('express');
    const app = express();
    app.get('/ping', (req, res) => res.status(200).json({ ok: true }));

    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
