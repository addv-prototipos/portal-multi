// Capacidad real del disco del HOST (punto 433, addendum 2 — hallazgo
// real del usuario, 2026-10-27): el admin API de Garage mide el
// filesystem ext4 DENTRO de la VM de WSL2 (ver garageCapacidad.js), que
// en Docker Desktop para Windows NO coincide con el disco físico real —
// confirmado real: Garage decía ~945 GB libres mientras la unidad C:
// (donde vive el disco virtual de Docker Desktop) tenía solo 45 de
// 295 GB libres de verdad.
//
// Este archivo lee el disco REAL vía un bind mount de solo lectura de
// una carpeta vacía y de bajo riesgo (`/hostdisk`, ver docker-compose.yml
// — nunca la unidad completa montada) — `fs.statfsSync()` reporta las
// estadísticas del FILESYSTEM completo donde vive esa carpeta, no de su
// contenido (vacío a propósito), así que el bind mount no expone ningún
// archivo real del host, solo permite medir la unidad. Confirmado real
// contra un contenedor de prueba: reportó 295.9/45.3 GB, exacto a lo que
// Windows mostraba para la unidad C:.
//
// Esta es la fuente PRIMARIA de capacidad (más simple y más confiable que
// Garage: mide el disco de verdad, no la vista interna de un proceso
// dentro de otra VM) — discoCapacidad.js intenta esto primero, cae a
// Garage solo si el mount no está disponible (ej. un entorno sin este
// bind mount configurado todavía).

const fs = require('fs');

const RUTA_PROBE = '/hostdisk';

class ErrorHostDiscoCapacidad extends Error {}

function obtenerCapacidadRealHost() {
  let stats;
  try {
    stats = fs.statfsSync(RUTA_PROBE);
  } catch (err) {
    throw new ErrorHostDiscoCapacidad(
      `No se pudo leer ${RUTA_PROBE} (¿falta el bind mount HOST_DISK_PROBE_PATH en docker-compose.yml?): ${err.message}`
    );
  }
  const totalBytes = Number(stats.blocks) * Number(stats.bsize);
  const disponibleBytes = Number(stats.bavail) * Number(stats.bsize);
  return {
    totalMb: Math.floor(totalBytes / (1024 * 1024)),
    disponibleMb: Math.floor(disponibleBytes / (1024 * 1024)),
  };
}

module.exports = { obtenerCapacidadRealHost, ErrorHostDiscoCapacidad };
