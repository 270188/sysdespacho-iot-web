#!/bin/sh
echo "[inicio] Importando flujos..."
n8n import:workflow --separate --input=/opt/bot/flujos || echo "[inicio] No se pudieron importar los flujos"
if [ -n "$GEMINI_API_KEY" ]; then
  echo "[inicio] Registrando la credencial de Gemini..."
  node -e 'require("fs").writeFileSync("/tmp/cred.json", JSON.stringify([{id:"GeminiSysDespacho",name:"Gemini SysDespacho",type:"googlePalmApi",data:{host:"https://generativelanguage.googleapis.com",apiKey:process.env.GEMINI_API_KEY}}]))'
  n8n import:credentials --input=/tmp/cred.json || echo "[inicio] No se pudo registrar la credencial de Gemini"
  rm -f /tmp/cred.json
fi
echo "[inicio] Activando el chat y la descarga..."
node /opt/bot/activar.js || { n8n update:workflow --id=SysDespachoAsistente --active=true; n8n update:workflow --id=SysDespachoDescarga --active=true; }
if [ "$RUN_TEST_ON_START" = "true" ]; then
  echo "[prueba] Ejecutando el bot contra el BCRP..."
  n8n execute --id SysDespachoBcrp01 2>&1 | grep -E "Fechas con dato|Rango consultado|Duraci|Error|error|El bot|El BCRP" | head -20
fi
node --max-old-space-size=32 /opt/bot/owner.js &
echo "[inicio] Iniciando n8n..."
exec n8n start
