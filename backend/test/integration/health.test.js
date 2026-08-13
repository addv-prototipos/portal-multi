const request = require('supertest');

jest.mock('../../db', () => ({
  pool: { query: jest.fn(), getConnection: jest.fn() },
  ensureSchema: jest.fn(),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) })),
}));

const { pool } = require('../../db');
const app = require('../../server');

describe('GET /api/health', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('responde 200 y "ok" cuando MySQL responde', async () => {
    pool.query.mockResolvedValueOnce([[{ 1: 1 }]]);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.maxFileSizeMb).toBe('number');
  });

  test('responde 503 cuando MySQL no responde', async () => {
    pool.query.mockRejectedValueOnce(new Error('conexión rechazada'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
  });
});
