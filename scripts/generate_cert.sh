#!/bin/bash
# Generate a self-signed HTTPS certificate for local use
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERT_DIR="$SCRIPT_DIR/../certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -newkey rsa:2048 -keyout "$CERT_DIR/key.pem" -out "$CERT_DIR/cert.pem" \
    -days 365 -nodes \
    -subj "/C=GB/ST=Local/L=Home/O=Budget/CN=budget.local"

echo "Certificate generated at:"
echo "  $CERT_DIR/cert.pem"
echo "  $CERT_DIR/key.pem"
