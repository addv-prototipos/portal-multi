# Imagen de Garage es "scratch" (sin shell) — el bootstrap (layout +
# bucket + access key, ver bootstrap.sh) corre aparte, hablando SOLO con
# la API HTTP de administración de Garage (puerto 3903), nunca con el
# binario/RPC. Mismo patrón que docker/mysql-control-init, versión
# Garage.
FROM alpine:3.20
RUN apk add --no-cache bash curl jq
COPY bootstrap.sh /bootstrap.sh
RUN chmod +x /bootstrap.sh
ENTRYPOINT ["/bootstrap.sh"]
