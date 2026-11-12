// Monitoreo de salud real del webhook de Stripe (punto en curso): alerta
// por correo cuando la firma de un evento no valida contra ningún
// secreto conocido, o cuando procesarEventoWebhook() truena con firma ya
// válida — ambos casos con cooldown para no inundar el buzón.

jest.mock('../../utils/ajustesGlobales', () => ({
  getValorTexto: jest.fn(),
  setValorTexto: jest.fn().mockResolvedValue(undefined),
  getDiscoAlertaEmail: jest.fn(),
}));
jest.mock('../../utils/notificarBackend', () => ({
  enviarCorreoBase: jest.fn().mockResolvedValue(undefined),
}));

const { getValorTexto, getDiscoAlertaEmail } = require('../../utils/ajustesGlobales');
const { enviarCorreoBase } = require('../../utils/notificarBackend');
const { registrarFirmaInvalida, registrarErrorProcesamiento } = require('../../utils/stripeWebhookMonitor');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('utils/stripeWebhookMonitor.js', () => {
  describe('registrarFirmaInvalida', () => {
    it('sin correo de alerta configurado: no manda nada', async () => {
      getDiscoAlertaEmail.mockResolvedValue(null);
      await registrarFirmaInvalida({ mensaje: 'bad signature' });
      expect(enviarCorreoBase).not.toHaveBeenCalled();
    });

    it('con correo configurado y sin alerta previa: manda el correo branded', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      getValorTexto.mockResolvedValue(null);
      await registrarFirmaInvalida({ mensaje: 'bad signature' });
      expect(enviarCorreoBase).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: 'ops@clarvo.mx',
          titulo: expect.stringContaining('inválida'),
          parrafos: expect.arrayContaining([expect.stringContaining('bad signature')]),
        })
      );
    });

    it('dentro del cooldown de 1h: no repite el correo', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      getValorTexto.mockResolvedValue(new Date(Date.now() - 5 * 60 * 1000).toISOString());
      await registrarFirmaInvalida({ mensaje: 'bad signature' });
      expect(enviarCorreoBase).not.toHaveBeenCalled();
    });

    it('fuera del cooldown de 1h: vuelve a avisar', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      getValorTexto.mockResolvedValue(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
      await registrarFirmaInvalida({ mensaje: 'bad signature' });
      expect(enviarCorreoBase).toHaveBeenCalledTimes(1);
    });

    it('un fallo al enviar el correo nunca lanza (fire-and-forget)', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      getValorTexto.mockResolvedValue(null);
      enviarCorreoBase.mockRejectedValueOnce(new Error('SMTP caído'));
      await expect(registrarFirmaInvalida({ mensaje: 'x' })).resolves.toBeUndefined();
    });
  });

  describe('registrarErrorProcesamiento', () => {
    it('sin correo de alerta configurado: no manda nada', async () => {
      getDiscoAlertaEmail.mockResolvedValue(null);
      await registrarErrorProcesamiento({ tipo: 'invoice.payment_succeeded', id: 'evt_1', mensaje: 'DB caída' });
      expect(enviarCorreoBase).not.toHaveBeenCalled();
    });

    it('con correo configurado: manda el correo branded con tipo/id/mensaje', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      getValorTexto.mockResolvedValue(null);
      await registrarErrorProcesamiento({ tipo: 'invoice.payment_succeeded', id: 'evt_1', mensaje: 'DB caída' });
      expect(enviarCorreoBase).toHaveBeenCalledWith(
        expect.objectContaining({
          destinatario: 'ops@clarvo.mx',
          asunto: expect.stringContaining('invoice.payment_succeeded'),
          parrafos: expect.arrayContaining([
            expect.stringContaining('evt_1'),
            expect.stringContaining('DB caída'),
          ]),
        })
      );
    });

    it('el cooldown es independiente POR TIPO de evento', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      // El primer tipo ya fue alertado hace 5 min (dentro del cooldown);
      // el segundo tipo nunca se había alertado — cada `getValorTexto`
      // responde según la clave que reciba.
      getValorTexto.mockImplementation((clave) => {
        if (clave.endsWith('invoice_payment_succeeded')) {
          return Promise.resolve(new Date(Date.now() - 5 * 60 * 1000).toISOString());
        }
        return Promise.resolve(null);
      });
      await registrarErrorProcesamiento({ tipo: 'invoice.payment_succeeded', id: 'evt_1', mensaje: 'x' });
      await registrarErrorProcesamiento({ tipo: 'customer.subscription.deleted', id: 'evt_2', mensaje: 'y' });
      expect(enviarCorreoBase).toHaveBeenCalledTimes(1);
      expect(enviarCorreoBase).toHaveBeenCalledWith(
        expect.objectContaining({ asunto: expect.stringContaining('customer.subscription.deleted') })
      );
    });

    it('un fallo al enviar el correo nunca lanza (fire-and-forget)', async () => {
      getDiscoAlertaEmail.mockResolvedValue('ops@clarvo.mx');
      getValorTexto.mockResolvedValue(null);
      enviarCorreoBase.mockRejectedValueOnce(new Error('SMTP caído'));
      await expect(
        registrarErrorProcesamiento({ tipo: 'invoice.payment_failed', id: 'evt_3', mensaje: 'x' })
      ).resolves.toBeUndefined();
    });
  });
});
