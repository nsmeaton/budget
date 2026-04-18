#!/bin/bash
# Start the Budget app backend server
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
CERT_DIR="$ROOT_DIR/certs"

cd "$ROOT_DIR"

# Check for certs
SSL_ARGS=""
if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ]; then
    SSL_ARGS="--ssl-certfile=$CERT_DIR/cert.pem --ssl-keyfile=$CERT_DIR/key.pem"
    echo "Starting with HTTPS..."
else
    echo "No certs found. Starting with HTTP (run scripts/generate_cert.sh for HTTPS)..."
fi

python -m uvicorn backend.main:app --host 0.0.0.0 --port 8443 $SSL_ARGS --reload
