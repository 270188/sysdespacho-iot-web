#!/bin/sh
# 1) Importa el flujo del bot (si ya existe, lo actualiza)
n8n import:workflow --input=/opt/bot/flujo.json || echo "No se pudo importar el flujo"
# 2) Prueba opcional: ejecuta el bot una vez antes de abrir el editor (queda en el historial)
if [ "$RUN_TEST_ON_START" = "true" ]; then
  echo "[prueba] Ejecutando el bot contra el BCRP..."
  n8n execute --id SysDespachoBcrp01 2>&1 | grep -E "Fechas con dato|Rango consultado|Duraci|Error|error|El bot|El BCRP" | head -20
  echo "[prueba] Archivos generados:"; ls -1 /home/node/.n8n-files
fi
# 3) Crea la cuenta de acceso (solo la primera vez) en segundo plano
node --max-old-space-size=32 /opt/bot/owner.js &
# 4) Inicia n8n
exec n8n start
