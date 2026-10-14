#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# enganchar-nginx.sh — engancha la página de mantenimiento 3D
# (unavailable/index.html, carpeta al mismo nivel que prod/) al nginx
# del HOST, para que se muestre en vez del 502 default cuando el stack
# de Docker está abajo.
#
# Idempotente: si ya está enganchado, no hace nada. Hace backup del
# archivo de nginx ANTES de tocarlo y lo restaura solo si "nginx -t"
# falla después del cambio — nunca deja el sitio real roto.
#
# Uso (con sudo, en el VPS — copia la carpeta unavailable/ junto a prod/,
# igual que ya haces con prod/, y corre esto una sola vez desde ahí):
#   cd unavailable && sudo ./enganchar-nginx.sh
#
# Variables opcionales:
#   DOMAIN=yt.addv.com.mx
#   PAGINA_ORIGEN=./index.html   (debe estar junto a este script)
#   PAGINA_DESTINO=/opt/clarvo-mantenimiento/index.html
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DOMAIN="${DOMAIN:-yt.addv.com.mx}"
PAGINA_ORIGEN="${PAGINA_ORIGEN:-$SCRIPT_DIR/index.html}"
PAGINA_DESTINO="${PAGINA_DESTINO:-/opt/clarvo-mantenimiento/index.html}"
NGINX_SITE="/etc/nginx/sites-available/${DOMAIN}.conf"
URL_INTERNA="/clarvo-mantenimiento.html"
MARCADOR="# clarvo-mantenimiento-host (agregado por enganchar-nginx.sh)"

info()  { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn()  { printf '\033[1;33m!!  %s\033[0m\n' "$1"; }
fail()  { printf '\033[1;31mXX  %s\033[0m\n' "$1"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Corre con sudo: sudo ./enganchar-nginx.sh"
fi

[ -f "$PAGINA_ORIGEN" ] || fail "No encontré $PAGINA_ORIGEN — corre este script desde la misma carpeta que index.html, o pasa PAGINA_ORIGEN=/ruta/real."
[ -f "$NGINX_SITE" ] || fail "No existe $NGINX_SITE — ¿es el dominio correcto? (DOMAIN=$DOMAIN)"

# ---------- Paso 1: copiar la página a su carpeta persistente ----------
info "Copiando la página de mantenimiento a $PAGINA_DESTINO (fuera de prod/, sobrevive cualquier borrado ahí)..."
mkdir -p "$(dirname "$PAGINA_DESTINO")"
cp "$PAGINA_ORIGEN" "$PAGINA_DESTINO"
chmod 644 "$PAGINA_DESTINO"

# ---------- Paso 2: idempotencia — ¿ya está enganchado? ----------
if grep -qF "$MARCADOR" "$NGINX_SITE"; then
  info "Ya estaba enganchado en $NGINX_SITE — nada que hacer."
  nginx -t
  info "Listo. Prueba con: curl -s https://${DOMAIN}${URL_INTERNA}"
  exit 0
fi

# ---------- Paso 3: backup antes de tocar nginx ----------
BACKUP="${NGINX_SITE}.bak-$(date +%Y%m%d%H%M%S)"
cp "$NGINX_SITE" "$BACKUP"
info "Backup guardado en $BACKUP"

# ---------- Paso 4: insertar el snippet después de cada "server_name" ----------
# awk en vez de sed -i: inserta el bloque después de CADA línea
# "server_name <domain>;" que encuentre (hay 2 normalmente: el bloque 80
# y el 443 que agregó certbot), sin depender del orden ni de escapar
# caracteres especiales del dominio en una regex de sed.
TMP_FILE="$(mktemp)"
awk -v marcador="$MARCADOR" -v url="$URL_INTERNA" -v destino="$PAGINA_DESTINO" -v domain="$DOMAIN" '
  { print }
  $0 ~ ("server_name " domain ";") {
    print "    " marcador
    print "    error_page 502 503 504 " url ";"
    print "    location = " url " {"
    print "        alias " destino ";"
    print "    }"
  }
' "$NGINX_SITE" > "$TMP_FILE"

if ! grep -qF "$MARCADOR" "$TMP_FILE"; then
  rm -f "$TMP_FILE"
  fail "No encontré ninguna línea 'server_name ${DOMAIN};' en $NGINX_SITE — no se tocó nada. Revísalo a mano."
fi

cp "$TMP_FILE" "$NGINX_SITE"
rm -f "$TMP_FILE"

# ---------- Paso 5: validar y recargar (con rollback automático) ----------
info "Validando configuración de nginx..."
if nginx -t; then
  systemctl reload nginx
  info "nginx recargado OK."
else
  warn "nginx -t falló — restaurando el backup automáticamente."
  cp "$BACKUP" "$NGINX_SITE"
  nginx -t && systemctl reload nginx
  fail "Se revirtió el cambio. Revisa $NGINX_SITE a mano (el snippet insertado puede chocar con algo ya existente)."
fi

info "Enganchado con éxito."
echo
echo "  Página real:        $PAGINA_DESTINO"
echo "  Config de nginx:     $NGINX_SITE (backup: $BACKUP)"
echo "  Prueba directa:      curl -s https://${DOMAIN}${URL_INTERNA} | head -5"
echo "  Prueba real (502):   para simularlo, apaga el backend un momento:"
echo "                        docker stop portalManager-prod-backend"
echo "                        curl -s https://${DOMAIN}/ | head -5   (debe traer la página nueva)"
echo "                        docker start portalManager-prod-backend"
