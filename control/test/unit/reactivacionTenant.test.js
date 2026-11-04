// Pruebas de utils/reactivacionTenant.js — flujo completo de "trial
// manual vencido sin pago": generación/validación de token público,
// Checkout Session de reactivación, webhook de confirmación, y el job
// automático de archivado. Mismo patrón de mock que
// tenantLifecycle.test.js: se mockean todas las dependencias externas
// (db, stripePagos, tenantLifecycle, notificarBackend, tenantSuscripcion)
// para probar solo que este módulo arma las queries/llamadas correctas.

jest.mock('../../db', () => ({
  obtenerPool: jest.fn(),
}));
jest.mock('../../utils/stripePagos', () => ({
  obtenerStripe: jest.fn(),
  montoCentavos: jest.fn((precio) => Math.round(Number(precio) * 100)),
  APP_BASE_URL: 'https://clarvo.mx',
}));
jest.mock('../../utils/tenantLifecycle', () => ({
  reactivarTenant: jest.fn().mockResolvedValue(undefined),
  darDeBajaTenant: jest.fn().mockResolvedValue(undefined),
  MOTIVO_BAJA_TRIAL_VENCIDO: 'trial_vencido_sin_pago',
}));
jest.mock('../../utils/notificarBackend', () => ({
  enviarCorreoBase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../utils/tenantSuscripcion', () => ({
  sumarCiclo: jest.fn().mockReturnValue('2026-12-01'),
}));

const { obtenerPool } = require('../../db');
const { obtenerStripe } = require('../../utils/stripePagos');
const { reactivarTenant, darDeBajaTenant } = require('../../utils/tenantLifecycle');
const { enviarCorreoBase } = require('../../utils/notificarBackend');
const { sumarCiclo } = require('../../utils/tenantSuscripcion');
const {
  ErrorReactivacion,
  crearCheckoutSessionReactivacion,
  crearCheckoutSessionDesdeToken,
  manejarReactivacionConfirmada,
  archivarTrialsVencidosSinPago,
  validarToken,
  DIAS_VIGENCIA_TOKEN,
} = require('../../utils/reactivacionTenant');

function mockPool() {
  const pool = { query: jest.fn().mockResolvedValue([[]]) };
  obtenerPool.mockReturnValue(pool);
  return pool;
}

describe('utils/reactivacionTenant.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validarToken', () => {
    test('token inexistente -> ErrorReactivacion "token_invalido"', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const error = await validarToken('nope', pool).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('token_invalido');
    });

    test('token ya usado -> ErrorReactivacion "token_invalido"', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[
        { id: 1, tenant_id: 7, expira_en: '2099-01-01 00:00:00', usado_en: '2026-01-01 00:00:00', slug: 'cliente1', nombre_empresa: 'Empresa Uno' },
      ]]);

      const error = await validarToken('usado', pool).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('token_invalido');
    });

    test('token vencido -> ErrorReactivacion "token_invalido"', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[
        { id: 1, tenant_id: 7, expira_en: '2020-01-01 00:00:00', usado_en: null, slug: 'cliente1', nombre_empresa: 'Empresa Uno' },
      ]]);

      const error = await validarToken('vencido', pool).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('token_invalido');
    });

    test('token vigente y sin usar -> devuelve la fila', async () => {
      const pool = mockPool();
      const filaEsperada = { id: 1, tenant_id: 7, expira_en: '2099-01-01 00:00:00', usado_en: null, slug: 'cliente1', nombre_empresa: 'Empresa Uno' };
      pool.query.mockResolvedValueOnce([[filaEsperada]]);

      const fila = await validarToken('vigente', pool);

      expect(fila).toEqual(filaEsperada);
    });
  });

  describe('crearCheckoutSessionReactivacion', () => {
    function mockStripeSession(url = 'https://checkout.stripe.com/pay/cs_test_123') {
      const create = jest.fn().mockResolvedValue({ id: 'cs_test_123', url });
      obtenerStripe.mockReturnValue({ checkout: { sessions: { create } } });
      return create;
    }

    test('tenant sin plan_id -> ErrorReactivacion "validacion", nunca llama a Stripe', async () => {
      const pool = mockPool();
      const create = mockStripeSession();
      pool.query.mockResolvedValueOnce([[
        { id: 7, slug: 'cliente1', nombre_empresa: 'Empresa Uno', plan_id: null, suscripcion_ciclo: 'mensual', plan_nombre: null, precio_mensual: null, precio_anual: null },
      ]]);

      const error = await crearCheckoutSessionReactivacion(7, { db: pool }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('validacion');
      expect(create).not.toHaveBeenCalled();
    });

    test('plan sin precio configurado -> ErrorReactivacion "validacion"', async () => {
      const pool = mockPool();
      mockStripeSession();
      pool.query.mockResolvedValueOnce([[
        { id: 7, slug: 'cliente1', nombre_empresa: 'Empresa Uno', plan_id: 3, suscripcion_ciclo: 'mensual', plan_nombre: 'Crece', precio_mensual: null, precio_anual: null },
      ]]);

      const error = await crearCheckoutSessionReactivacion(7, { db: pool }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('validacion');
    });

    test('tenant inexistente -> ErrorReactivacion "no_encontrado"', async () => {
      const pool = mockPool();
      mockStripeSession();
      pool.query.mockResolvedValueOnce([[]]);

      const error = await crearCheckoutSessionReactivacion(999, { db: pool }).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('no_encontrado');
    });

    test('ciclo mensual: arma Checkout Session con price_data ad-hoc (nunca un Price fijo en Stripe)', async () => {
      const pool = mockPool();
      const create = mockStripeSession('https://checkout.stripe.com/pay/cs_test_mensual');
      pool.query.mockResolvedValueOnce([[
        { id: 7, slug: 'cliente1', nombre_empresa: 'Empresa Uno', plan_id: 3, suscripcion_ciclo: 'mensual', plan_nombre: 'Crece', precio_mensual: 499, precio_anual: 4990 },
      ]]);

      const resultado = await crearCheckoutSessionReactivacion(7, { db: pool });

      expect(resultado).toEqual({ checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_mensual' });
      const [args] = create.mock.calls[0];
      expect(args.mode).toBe('subscription');
      expect(args.line_items[0].price_data.unit_amount).toBe(49900);
      expect(args.line_items[0].price_data.recurring.interval).toBe('month');
      expect(args.metadata).toEqual({ tipo: 'reactivacion', tenantId: '7' });
      expect(args.subscription_data.metadata).toEqual({ tipo: 'reactivacion', tenantId: '7' });
      expect(args.success_url).toBe('https://clarvo.mx/cliente1/admin?reactivado=1');
    });

    test('ciclo anual: usa precio_anual y recurring.interval="year"', async () => {
      const pool = mockPool();
      const create = mockStripeSession();
      pool.query.mockResolvedValueOnce([[
        { id: 7, slug: 'cliente1', nombre_empresa: 'Empresa Uno', plan_id: 3, suscripcion_ciclo: 'anual', plan_nombre: 'Crece', precio_mensual: 499, precio_anual: 4990 },
      ]]);

      await crearCheckoutSessionReactivacion(7, { db: pool });

      const [args] = create.mock.calls[0];
      expect(args.line_items[0].price_data.unit_amount).toBe(499000);
      expect(args.line_items[0].price_data.recurring.interval).toBe('year');
    });
  });

  describe('crearCheckoutSessionDesdeToken', () => {
    test('token inválido -> propaga el error sin tocar Stripe', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const error = await crearCheckoutSessionDesdeToken('nope', pool).catch((e) => e);

      expect(error).toBeInstanceOf(ErrorReactivacion);
      expect(error.codigo).toBe('token_invalido');
    });

    test('token válido -> resuelve tenant_id y arma el Checkout de ese tenant', async () => {
      const pool = mockPool();
      const create = jest.fn().mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/pay/cs_test_1' });
      obtenerStripe.mockReturnValue({ checkout: { sessions: { create } } });
      pool.query
        .mockResolvedValueOnce([[
          { id: 1, tenant_id: 7, expira_en: '2099-01-01 00:00:00', usado_en: null, slug: 'cliente1', nombre_empresa: 'Empresa Uno' },
        ]])
        .mockResolvedValueOnce([[
          { id: 7, slug: 'cliente1', nombre_empresa: 'Empresa Uno', plan_id: 3, suscripcion_ciclo: 'mensual', plan_nombre: 'Crece', precio_mensual: 499, precio_anual: 4990 },
        ]]);

      const resultado = await crearCheckoutSessionDesdeToken('vigente', pool);

      expect(resultado).toEqual({ checkoutUrl: 'https://checkout.stripe.com/pay/cs_test_1' });
    });
  });

  describe('manejarReactivacionConfirmada', () => {
    test('sin metadata.tenantId -> no hace nada (log, no truena)', async () => {
      const pool = mockPool();
      await manejarReactivacionConfirmada({ id: 'evt_1', metadata: {} }, pool);

      expect(pool.query).not.toHaveBeenCalled();
      expect(reactivarTenant).not.toHaveBeenCalled();
    });

    test('tenant ya no existe -> no hace nada', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      await manejarReactivacionConfirmada({ id: 'evt_1', metadata: { tenantId: '999' } }, pool);

      expect(reactivarTenant).not.toHaveBeenCalled();
    });

    test('pago confirmado: actualiza suscripcion a pagada, reactiva el tenant y marca el token usado — nunca toca suscripcion_origen', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[{ id: 7, slug: 'cliente1', suscripcion_ciclo: 'mensual' }]]) // SELECT tenant
        .mockResolvedValueOnce([{}]) // UPDATE tenants
        .mockResolvedValueOnce([{}]); // UPDATE reactivacion_tokens

      const session = {
        id: 'evt_1',
        metadata: { tenantId: '7' },
        customer: 'cus_abc',
        subscription: 'sub_abc',
      };
      await manejarReactivacionConfirmada(session, pool);

      const [sqlUpdate, paramsUpdate] = pool.query.mock.calls[1];
      expect(sqlUpdate).toMatch(/UPDATE tenants/);
      expect(sqlUpdate).not.toMatch(/suscripcion_origen/);
      expect(paramsUpdate).toEqual(['cus_abc', 'sub_abc', expect.any(String), '2026-12-01', 7]);
      expect(sumarCiclo).toHaveBeenCalledWith(expect.any(String), 'mensual');
      expect(reactivarTenant).toHaveBeenCalledWith('cliente1', { actor: 'stripe-webhook:reactivacion' }, pool);
      const [sqlToken, paramsToken] = pool.query.mock.calls[2];
      expect(sqlToken).toMatch(/UPDATE reactivacion_tokens SET usado_en = \?/);
      expect(paramsToken).toEqual([expect.any(Date), 7]);
    });

    test('si reactivarTenant falla (ej. ya estaba activo), no tumba el webhook', async () => {
      const pool = mockPool();
      pool.query
        .mockResolvedValueOnce([[{ id: 7, slug: 'cliente1', suscripcion_ciclo: 'mensual' }]])
        .mockResolvedValueOnce([{}])
        .mockResolvedValueOnce([{}]);
      reactivarTenant.mockRejectedValueOnce(new Error('El tenant "cliente1" está en estado "activo"...'));

      await expect(manejarReactivacionConfirmada({ id: 'evt_1', metadata: { tenantId: '7' }, customer: null, subscription: null }, pool)).resolves.toBeUndefined();
    });
  });

  describe('archivarTrialsVencidosSinPago', () => {
    test('sin candidatos: no archiva ni envía correos', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[]]);

      const resultado = await archivarTrialsVencidosSinPago(pool);

      expect(resultado).toEqual({ archivados: 0, total: 0 });
      expect(darDeBajaTenant).not.toHaveBeenCalled();
      expect(enviarCorreoBase).not.toHaveBeenCalled();
    });

    test('archiva cada candidato con el motivo correcto y envía el correo con el link', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[
        { id: 1, slug: 'vencido1', nombre_empresa: 'Empresa Uno', contacto_email: 'contacto@uno.com' },
      ]]);
      pool.query.mockResolvedValueOnce([[]]); // obtenerOCrearTokenReactivacion: sin token vigente
      pool.query.mockResolvedValueOnce([{}]); // INSERT reactivacion_tokens

      const resultado = await archivarTrialsVencidosSinPago(pool);

      expect(darDeBajaTenant).toHaveBeenCalledWith(
        'vencido1',
        { actor: 'sistema:trial-vencido', motivo: 'trial_vencido_sin_pago' },
        pool
      );
      expect(enviarCorreoBase).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: 'contacto@uno.com',
          asunto: expect.stringContaining('15 días'),
          cuerpo: expect.stringContaining('/api/public/reactivacion/'),
        })
      );
      expect(resultado).toEqual({ archivados: 1, total: 1 });
    });

    test('candidato sin contacto_email: archiva pero no intenta enviar correo', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[
        { id: 2, slug: 'sin-correo', nombre_empresa: 'Empresa Dos', contacto_email: null },
      ]]);

      const resultado = await archivarTrialsVencidosSinPago(pool);

      expect(darDeBajaTenant).toHaveBeenCalledWith(
        'sin-correo',
        { actor: 'sistema:trial-vencido', motivo: 'trial_vencido_sin_pago' },
        pool
      );
      expect(enviarCorreoBase).not.toHaveBeenCalled();
      expect(resultado).toEqual({ archivados: 1, total: 1 });
    });

    test('un tenant que falla al archivar no detiene a los demás', async () => {
      const pool = mockPool();
      pool.query.mockResolvedValueOnce([[
        { id: 1, slug: 'falla', nombre_empresa: 'Empresa Falla', contacto_email: 'a@a.com' },
        { id: 2, slug: 'ok', nombre_empresa: 'Empresa Ok', contacto_email: 'b@b.com' },
      ]]);
      darDeBajaTenant.mockRejectedValueOnce(new Error('MySQL no disponible'));
      darDeBajaTenant.mockResolvedValueOnce(undefined);
      pool.query.mockResolvedValueOnce([[]]); // token de "ok": sin vigente
      pool.query.mockResolvedValueOnce([{}]); // INSERT token "ok"

      const resultado = await archivarTrialsVencidosSinPago(pool);

      expect(resultado).toEqual({ archivados: 1, total: 2 });
      expect(enviarCorreoBase).toHaveBeenCalledTimes(1);
    });

    test('DIAS_VIGENCIA_TOKEN está fijado en 15 (mismo valor comunicado al cliente)', () => {
      expect(DIAS_VIGENCIA_TOKEN).toBe(15);
    });
  });
});
