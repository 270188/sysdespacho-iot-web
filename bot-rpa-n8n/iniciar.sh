#!/bin/sh
# 1) Importa los flujos (bot del informe, herramienta del asistente, asistente y descarga de Excel)
for f in flujo herramienta asistente descarga prueba_asistente; do
  n8n import:workflow --input=/opt/bot/$f.json || echo "No se pudo importar $f.json"
done
# 2) Credencial de Gemini desde la variable secreta GEMINI_API_KEY (no se guarda en el repositorio)
if [ -n "$GEMINI_API_KEY" ]; then
  node -e 'require("fs").writeFileSync("/tmp/cred.json", JSON.stringify([{id:"GeminiSysDespacho",name:"Gemini SysDespacho",type:"googlePalmApi",data:{host:"https://generativelanguage.googleapis.com",apiKey:process.env.GEMINI_API_KEY}}]))'
  n8n import:credentials --input=/tmp/cred.json || echo "No se pudo importar la credencial de Gemini"
  rm -f /tmp/cred.json
fi
# 3) Activa el chat del asistente y el enlace de descarga
n8n update:workflow --id=SysDespachoAsistente --active=true || true
n8n update:workflow --id=SysDespachoDescarga --active=true || true
# 4) Prueba opcional: ejecuta el bot una vez antes de abrir el editor (queda en el historial)
if [ "$RUN_TEST_ON_START" = "true" ]; then
  echo "[prueba] Ejecutando el bot contra el BCRP..."
  n8n execute --id SysDespachoBcrp01 2>&1 | grep -E "Fechas con dato|Rango consultado|Duraci|Error|error|El bot|El BCRP" | head -20
  echo "[prueba] Archivos generados:"; ls -1 /home/node/.n8n-files
fi
if [ "$RUN_AGENT_TEST_ON_START" = "true" ] && [ -n "$GEMINI_API_KEY" ]; then
  echo "[prueba-asistente] Preguntando al asistente..."
  n8n execute --id SysDespachoPruebaAsistente 2>&1 | grep -E '"output"|rror|"message"' | head -8
fi
# 5) Crea la cuenta de acceso (solo la primera vez) en segundo plano
node --max-old-space-size=32 /opt/bot/owner.js &
# 6) Inicia n8n
exec n8n start
