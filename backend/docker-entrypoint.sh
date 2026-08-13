#!/bin/sh
set -e

# Cuando /app/uploads se monta como bind mount desde el host (carpeta local
# del proyecto), su dueño en el host puede no coincidir con el usuario
# "appuser" dentro del contenedor. Este script corre como root únicamente
# para corregir esos permisos, y luego cede el control al usuario sin
# privilegios antes de ejecutar la aplicación. Los datos ya no se guardan
# en un archivo local (ahora viven en el contenedor de MySQL), así que solo
# hace falta ajustar uploads.

mkdir -p "$UPLOAD_DIR"
chown -R appuser:appgroup "$UPLOAD_DIR" 2>/dev/null || true

exec su-exec appuser:appgroup node server.js
