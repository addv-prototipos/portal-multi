#!/bin/bash
# Bootstrap idempotente de un nodo Garage de un solo nodo (desarrollo
# local) — reemplaza el equivalente de "crear bucket + credenciales" que
# MinIO resolvía con variables de entorno simples. Garage no tiene ese
# atajo: el layout del cluster, el bucket y la access key hay que crearlos
# a mano una sola vez. Usa SOLO la API HTTP de administración (puerto
# 3903, token fijo de docker/garage/garage.toml) — nunca el binario
# `garage`/RPC, para no tener que resolver el node-id completo desde
# otro contenedor. Seguro de re-correr en cada `docker compose up`
# (cada paso comprueba primero si ya existe).
set -euo pipefail

ADMIN_URL="http://garage:3903"
AUTH=(-H "Authorization: Bearer ${GARAGE_ADMIN_TOKEN}")
JSON=(-H "Content-Type: application/json")
BUCKET_ALIAS="${MINIO_BUCKET:-portal-facturacion}"
KEY_ID="${MINIO_ROOT_USER}"
KEY_SECRET="${MINIO_ROOT_PASSWORD}"

echo "[garage-init] esperando a que la API de admin responda..."
until curl -sf -o /dev/null "${ADMIN_URL}/health"; do
  sleep 1
done

echo "[garage-init] resolviendo node id..."
NODE_ID=$(curl -s "${AUTH[@]}" "${ADMIN_URL}/v1/status" | jq -r '.node')
if [ -z "$NODE_ID" ] || [ "$NODE_ID" = "null" ]; then
  echo "[garage-init] ERROR: no se pudo leer el node id de /v1/status" >&2
  exit 1
fi

HAS_ROLE=$(curl -s "${AUTH[@]}" "${ADMIN_URL}/v1/layout" | jq -r --arg id "$NODE_ID" '.roles[] | select(.id == $id) | .id')
if [ -z "$HAS_ROLE" ]; then
  echo "[garage-init] asignando layout de un solo nodo..."
  curl -sf "${AUTH[@]}" "${JSON[@]}" -X POST \
    -d "[{\"id\":\"${NODE_ID}\",\"zone\":\"dev\",\"capacity\":1000000000,\"tags\":[]}]" \
    "${ADMIN_URL}/v1/layout" > /dev/null
  curl -sf "${AUTH[@]}" "${JSON[@]}" -X POST -d '{"version": 1}' \
    "${ADMIN_URL}/v1/layout/apply" > /dev/null
  echo "[garage-init] layout aplicado."
else
  echo "[garage-init] layout ya existe, nada que hacer."
fi

BUCKET_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${ADMIN_URL}/v1/bucket?globalAlias=${BUCKET_ALIAS}")
if [ "$BUCKET_STATUS" = "404" ]; then
  echo "[garage-init] creando bucket ${BUCKET_ALIAS}..."
  curl -sf "${AUTH[@]}" "${JSON[@]}" -X POST \
    -d "{\"globalAlias\":\"${BUCKET_ALIAS}\"}" "${ADMIN_URL}/v1/bucket" > /dev/null
else
  echo "[garage-init] bucket ${BUCKET_ALIAS} ya existe."
fi
BUCKET_ID=$(curl -s "${AUTH[@]}" "${ADMIN_URL}/v1/bucket?globalAlias=${BUCKET_ALIAS}" | jq -r '.id')

KEY_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "${ADMIN_URL}/v1/key?id=${KEY_ID}")
if [ "$KEY_STATUS" = "404" ]; then
  echo "[garage-init] importando access key fija..."
  curl -sf "${AUTH[@]}" "${JSON[@]}" -X POST \
    -d "{\"accessKeyId\":\"${KEY_ID}\",\"secretAccessKey\":\"${KEY_SECRET}\",\"name\":\"backend-key\"}" \
    "${ADMIN_URL}/v1/key/import" > /dev/null
else
  echo "[garage-init] access key ya existe."
fi

echo "[garage-init] otorgando permisos read/write/owner sobre ${BUCKET_ALIAS}..."
curl -sf "${AUTH[@]}" "${JSON[@]}" -X POST \
  -d "{\"bucketId\":\"${BUCKET_ID}\",\"accessKeyId\":\"${KEY_ID}\",\"permissions\":{\"read\":true,\"write\":true,\"owner\":true}}" \
  "${ADMIN_URL}/v1/bucket/allow" > /dev/null

echo "[garage-init] listo."
