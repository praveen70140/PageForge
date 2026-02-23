#!/bin/bash
# Initialize MinIO bucket for PageForge artifacts

set -e

MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-pageforge}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-pageforge-secret}"
MINIO_BUCKET="${MINIO_BUCKET:-pageforge-artifacts}"

echo "Waiting for MinIO to be ready..."
for i in $(seq 1 30); do
  if curl -sf "http://${MINIO_ENDPOINT}:${MINIO_PORT}/minio/health/ready" > /dev/null 2>&1; then
    echo "MinIO is ready."
    break
  fi
  if [ $i -eq 30 ]; then
    echo "MinIO did not become ready in time."
    exit 1
  fi
  sleep 1
done

# Use mc (MinIO Client) via Docker — entrypoint is /usr/bin/mc so override it with sh
docker run --rm --network host --entrypoint sh minio/mc -c "
  mc alias set pageforge http://${MINIO_ENDPOINT}:${MINIO_PORT} ${MINIO_ACCESS_KEY} ${MINIO_SECRET_KEY} && \
  mc mb --ignore-existing pageforge/${MINIO_BUCKET} && \
  mc anonymous set download pageforge/${MINIO_BUCKET} && \
  echo 'Bucket ${MINIO_BUCKET} created and configured.'
"

echo "MinIO initialization complete."
