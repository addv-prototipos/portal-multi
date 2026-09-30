#!/bin/bash
# Punto 345: además de "control_app" (angosto, sin DELETE — ver
# 01-narrow-grant.sql), backend necesita un usuario CON privilegio DELETE
# en control_tenants para borrar tenant_eventos/api_credenciales/tenants
# al eliminar un tenant para siempre (DROP DATABASE ya lo hace directo, no
# necesita nada de esto — es solo para las 3 tablas de control). Reusa el
# usuario "app" (mismo nombre/password que ya tiene en la instancia
# `mysql` compartida, vía APP_DB_PASSWORD) en vez de inventar una tercera
# credencial — es el mismo criterio que ya tenía este proyecto antes de
# la Fase 1 (backend/scripts/lib/controlDb.js: "app" con ALL PRIVILEGES
# sobre control_tenants desde el segmento 1).
set -e

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" control_tenants <<-EOSQL
  CREATE USER IF NOT EXISTS 'app'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
  ALTER USER 'app'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
  GRANT ALL PRIVILEGES ON control_tenants.* TO 'app'@'%';
  FLUSH PRIVILEGES;
EOSQL
