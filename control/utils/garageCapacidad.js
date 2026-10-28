// Fuente REAL del total de disco (decisión del usuario, 2026-10-27,
// tras pedir explícitamente "no lo quiero tomar a mano, lo quiero
// real"): el admin API de Garage (puerto 3903, protegido por
// GARAGE_ADMIN_TOKEN) ya expone `dataPartition.total`/`available` por
// nodo — bytes reales del filesystem del host donde vive el volumen de
// datos, confirmado contra el propio contenedor de desarrollo (no un
// valor "capacity" declarado a mano como el de la capa de replicación
// de Garage, ese es otro campo — `role.capacity` — que NO se usa aquí a
// propósito). `discoCapacidad.js` llama a esto en cada cálculo; nunca
// hay un número capturado por un operador para "capacidad total".
//
// Suma TODOS los nodos "up" que traen `dataPartition` (nodos de
// almacenamiento reales, nunca un nodo gateway sin disco propio) —
// correcto hoy con 1 solo nodo (replication_factor=1, desarrollo) y
// también para un futuro cluster multi-nodo (Segmento 8, Swarm/HA) sin
// tener que tocar este archivo: cada nodo aporta su disco físico real a
// la suma total.

class ErrorGarageCapacidad extends Error {}

async function obtenerCapacidadRealGarage() {
  const url = process.env.GARAGE_ADMIN_URL || 'http://garage:3903';
  const token = process.env.GARAGE_ADMIN_TOKEN;
  if (!token) {
    throw new ErrorGarageCapacidad('GARAGE_ADMIN_TOKEN no está configurado.');
  }

  let res;
  try {
    res = await fetch(`${url}/v1/status`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    throw new ErrorGarageCapacidad(`No se pudo conectar con Garage: ${err.message}`);
  }
  if (!res.ok) {
    throw new ErrorGarageCapacidad(`Garage respondió ${res.status} al consultar su estado.`);
  }

  const data = await res.json();
  let totalBytes = 0;
  let disponibleBytes = 0;
  let nodosContados = 0;
  for (const nodo of data.nodes || []) {
    if (!nodo.isUp || !nodo.dataPartition) continue;
    totalBytes += nodo.dataPartition.total || 0;
    disponibleBytes += nodo.dataPartition.available || 0;
    nodosContados += 1;
  }
  if (nodosContados === 0) {
    throw new ErrorGarageCapacidad('Garage no reportó ningún nodo de almacenamiento activo.');
  }

  return {
    totalMb: Math.floor(totalBytes / (1024 * 1024)),
    disponibleRealMb: Math.floor(disponibleBytes / (1024 * 1024)),
    nodos: nodosContados,
  };
}

module.exports = { obtenerCapacidadRealGarage, ErrorGarageCapacidad };
