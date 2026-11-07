#!/bin/sh
# 1) Importa el flujo del bot (si ya existe, lo actualiza)
n8n import:workflow --input=/opt/bot/flujo.json || echo "No se pudo importar el flujo"
# 2) Crea la cuenta de acceso (solo la primera vez) en segundo plano
node /opt/bot/owner.js &
# 3) Inicia n8n
exec n8n start
