FROM nginx:1.27-alpine

# Hallazgo m-11 (sonar_1.1.html, 2026-10-19), verificado contra el
# contenedor real (`docker exec portalManager-frontend ps aux`): los 12
# "nginx: worker process" — los que de verdad procesan cada request HTTP
# — ya corren como el usuario sin privilegios "nginx" (comportamiento de
# fábrica de esta imagen oficial, sin cambios necesarios). Solo el
# "nginx: master process" (PID 1) es root, y su único trabajo es
# bindear el puerto 80 (<1024, requiere privilegio) y supervisar a los
# workers — nunca procesa una request directamente. Mismo patrón de
# riesgo que el backend (root solo para la preparación, nunca para
# manejar entrada de usuario).
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
COPY csf.html style.css app.js admin.html admin.css admin.js login.html login.js auth.css dashboard.html dashboard.js tickets.html tickets.js portal.js portal.css mantenimiento.html control.html control.js theme.js offline.js restablecer.html restablecer.js scanner.js aclaraciones.js skeleton.js mi-cuenta.html mi-cuenta.js credito.html credito.js marcaTemaEditor.js comprimir.js 404-clarvo.html 404-clarvo.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

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
