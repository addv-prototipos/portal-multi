// Modo fuera de línea para Ventas y Gastos (ver PROJECT_STATE.md punto 132,
// US.md US-073/074/075). Módulo genérico y reusable: no sabe nada de
// "ventas" ni "gastos" en concreto — admin.js registra un manejador de
// sincronización por tipo y este módulo se encarga de: detectar conexión
// real (no solo el evento del navegador, que puede dar falsos positivos),
// guardar/leer la cola pendiente en IndexedDB, y disparar la sincronización
// automática al recuperar internet.
//
// Deliberadamente NO intenta resolver: subir archivos offline, validar
// datos en vivo contra el servidor, ni mantener una sesión sin haberse
// logueado antes — ver el análisis completo en PROJECT_STATE.md punto 132
// de por qué esas partes quedaron fuera de alcance.
(function () {
  const NOMBRE_DB = 'portalfac_offline';
  const VERSION_DB = 1;
  const INTERVALO_REINTENTO_MS = 10000; // mientras esté offline, reintenta cada 10s

  let dbPromise = null;
  function abrirDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOMBRE_DB, VERSION_DB);
      req.onupgradeneeded = () => {
        const db = req.result;
        ['pendientes_ordenes', 'pendientes_gastos'].forEach((nombre) => {
          if (!db.objectStoreNames.contains(nombre)) {
            db.createObjectStore(nombre, { keyPath: 'localId', autoIncrement: true });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function storeDeTipo(tipo) {
    if (tipo === 'ordenes') return 'pendientes_ordenes';
    if (tipo === 'gastos') return 'pendientes_gastos';
    throw new Error(`Tipo de cola desconocido: ${tipo}`);
  }

  async function conTienda(tipo, modo, fn) {
    const db = await abrirDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeDeTipo(tipo), modo);
      const tienda = tx.objectStore(storeDeTipo(tipo));
      const resultado = fn(tienda);
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function agregarPendiente(tipo, datos) {
    let localIdCapturado;
    await conTienda(tipo, 'readwrite', (tienda) => {
      const req = tienda.add({ datos, creadoEn: Date.now(), error: null });
      req.onsuccess = () => {
        localIdCapturado = req.result;
      };
    });
    notificarCambioCola(tipo);
    return localIdCapturado;
  }

  function listarPendientes(tipo) {
    return conTienda(tipo, 'readonly', (tienda) => {
      return new Promise((resolve, reject) => {
        const req = tienda.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }).then((p) => p);
  }

  async function eliminarPendiente(tipo, localId) {
    await conTienda(tipo, 'readwrite', (tienda) => tienda.delete(localId));
    notificarCambioCola(tipo);
  }

  async function marcarError(tipo, localId, mensaje) {
    await conTienda(tipo, 'readwrite', (tienda) => {
      const req = tienda.get(localId);
      req.onsuccess = () => {
        const fila = req.result;
        if (fila) {
          fila.error = mensaje;
          tienda.put(fila);
        }
      };
    });
    notificarCambioCola(tipo);
  }

  async function limpiarError(tipo, localId) {
    await conTienda(tipo, 'readwrite', (tienda) => {
      const req = tienda.get(localId);
      req.onsuccess = () => {
        const fila = req.result;
        if (fila) {
          fila.error = null;
          tienda.put(fila);
        }
      };
    });
  }

  async function limpiarTodo() {
    await Promise.all(
      ['pendientes_ordenes', 'pendientes_gastos'].map((nombre) =>
        conTienda(nombre === 'pendientes_ordenes' ? 'ordenes' : 'gastos', 'readwrite', (tienda) => tienda.clear())
      )
    );
  }

  // ---------- Notificaciones a quien esté escuchando (admin.js) ----------
  const oyentesCola = {}; // tipo -> [callback]
  function notificarCambioCola(tipo) {
    (oyentesCola[tipo] || []).forEach((cb) => cb());
  }
  function onCambioCola(tipo, callback) {
    oyentesCola[tipo] = oyentesCola[tipo] || [];
    oyentesCola[tipo].push(callback);
  }

  const oyentesEstado = [];
  function onCambioEstado(callback) {
    oyentesEstado.push(callback);
  }
  let estadoActual = navigator.onLine ? 'online' : 'offline';
  function fijarEstado(nuevo) {
    if (estadoActual === nuevo) return;
    estadoActual = nuevo;
    oyentesEstado.forEach((cb) => cb(nuevo));
  }

  const manejadoresSync = {}; // tipo -> async (datos) => {ok, error}
  function registrarManejadorSync(tipo, fn) {
    manejadoresSync[tipo] = fn;
  }

  const oyentesSyncCompleto = {}; // tipo -> [callback]
  function onSincronizacionCompleta(tipo, callback) {
    oyentesSyncCompleto[tipo] = oyentesSyncCompleto[tipo] || [];
    oyentesSyncCompleto[tipo].push(callback);
  }

  // ---------- Detección de conexión real ----------
  // El evento "online" del navegador solo dice "hay una interfaz de red
  // activa" — puede ser un wifi sin internet real. Antes de confiar en
  // eso y disparar la sincronización, se confirma con un ping real a
  // /api/health (público, ya usado por mantenimiento.html para lo mismo).
  async function hayConexionReal() {
    if (!navigator.onLine) return false;
    try {
      const controlador = new AbortController();
      const timeout = setTimeout(() => controlador.abort(), 4000);
      const res = await fetch('/api/health', { cache: 'no-store', signal: controlador.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch (err) {
      return false;
    }
  }

  async function sincronizarTipo(tipo) {
    const manejador = manejadoresSync[tipo];
    if (!manejador) return;
    const pendientes = await listarPendientes(tipo);
    // En el orden en que se crearon — un fallo en uno no detiene a los
    // demás, se marca y se sigue con el siguiente.
    for (const item of pendientes) {
      const resultado = await manejador(item.datos);
      if (resultado && resultado.ok) {
        await eliminarPendiente(tipo, item.localId);
      } else {
        await marcarError(tipo, item.localId, (resultado && resultado.error) || 'No se pudo sincronizar.');
      }
    }
    (oyentesSyncCompleto[tipo] || []).forEach((cb) => cb());
  }

  let sincronizando = false;
  async function intentarSincronizarTodo() {
    if (sincronizando) return;
    const real = await hayConexionReal();
    if (!real) {
      fijarEstado('offline');
      return;
    }
    const tipos = Object.keys(manejadoresSync);
    const [ordenesPendientes, gastosPendientes] = await Promise.all([
      listarPendientes('ordenes').catch(() => []),
      listarPendientes('gastos').catch(() => []),
    ]);
    const hayPendientes = ordenesPendientes.length > 0 || gastosPendientes.length > 0;

    if (!hayPendientes) {
      fijarEstado('online');
      return;
    }

    sincronizando = true;
    fijarEstado('syncing');
    try {
      for (const tipo of tipos) {
        await sincronizarTipo(tipo);
      }
    } finally {
      sincronizando = false;
      fijarEstado('online');
    }
  }

  function iniciar() {
    if (!navigator.onLine) fijarEstado('offline');

    window.addEventListener('online', () => {
      intentarSincronizarTodo();
    });
    window.addEventListener('offline', () => {
      fijarEstado('offline');
    });

    // El evento "online" no siempre llega (wifi sin internet real que
    // luego sí conecta sin que cambie la interfaz) — mientras el estado
    // conocido sea "offline", se reintenta cada 10s por si acaso.
    setInterval(() => {
      if (estadoActual === 'offline') intentarSincronizarTodo();
    }, INTERVALO_REINTENTO_MS);
  }

  window.OfflineQueue = {
    iniciar,
    isOffline: () => estadoActual === 'offline',
    agregarPendiente,
    listarPendientes,
    eliminarPendiente,
    marcarError,
    limpiarError,
    limpiarTodo,
    onCambioCola,
    onCambioEstado,
    registrarManejadorSync,
    onSincronizacionCompleta,
    reintentarUno: async (tipo, localId) => {
      const manejador = manejadoresSync[tipo];
      if (!manejador) return;
      const pendientes = await listarPendientes(tipo);
      const item = pendientes.find((p) => p.localId === localId);
      if (!item) return;
      const resultado = await manejador(item.datos);
      if (resultado && resultado.ok) {
        await eliminarPendiente(tipo, localId);
      } else {
        await marcarError(tipo, localId, (resultado && resultado.error) || 'No se pudo sincronizar.');
      }
      (oyentesSyncCompleto[tipo] || []).forEach((cb) => cb());
    },
  };

  iniciar();
})();
