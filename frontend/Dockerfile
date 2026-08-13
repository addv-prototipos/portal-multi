FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Segmento 9b: nginx.conf.template en vez de un conf.d/default.conf fijo
# -- la imagen oficial procesa TODO archivo en /etc/nginx/templates/*.template
# con envsubst al arrancar el contenedor (sin script propio necesario) y
# escribe el resultado en /etc/nginx/conf.d/. Esto es lo que permite que
# CONTROL_UPSTREAM_HOST/CONTROL_UPSTREAM_PORT (ver nginx.conf.template)
# se resuelvan por variable de entorno en vez de quedar fijos en la
# imagen -- así el contenedor "control" puede vivir en la misma red
# Docker o en un servidor aparte, solo cambiando esas dos variables.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY csf.html style.css app.js admin.html admin.css admin.js login.html login.js auth.css dashboard.html dashboard.js tickets.html tickets.js portal.js portal.css mantenimiento.html control.html control.js /usr/share/nginx/html/

# Defaults para el despliegue normal (control en la misma red Docker,
# mismo docker-compose.yml) -- docker-compose.yml/docker-stack.yml los
# fijan explícitamente de todas formas, pero quedan aquí por si alguien
# construye/corre esta imagen suelta, sin overrides.
ENV CONTROL_UPSTREAM_HOST=control
ENV CONTROL_UPSTREAM_PORT=4001

EXPOSE 80

# 127.0.0.1 explícito, no "localhost": confirmado contra un contenedor
# real que "localhost" puede resolver primero a la IPv6 de loopback
# (::1), donde nginx no escucha (el "listen 80" de nginx.conf es solo
# IPv4 en este entorno) -- eso hacía fallar el healthcheck con
# "Connection refused" aunque el sitio respondiera bien por IPv4.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
