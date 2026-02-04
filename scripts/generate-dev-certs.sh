#!/bin/bash

# generate-dev-certs.sh
# Generates self-signed certificates for local HTTPS development
# Usage: ./scripts/generate-dev-certs.sh

mkdir -p certs

echo "🔐 Generating Self-Signed Certificates for Localhost..."

openssl req -x509 -out certs/localhost.crt -keyout certs/localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")

echo "✅ Certificates created in ./certs/"
echo "   - certs/localhost.crt"
echo "   - certs/localhost.key"
echo ""
echo "To use them, you will need to configure your server to read these files when in development mode."
echo "Note: Browsers will warn about self-signed certificates. You must manually accept the risk."
