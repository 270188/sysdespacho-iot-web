# Bot RPA en n8n · tipo de cambio del BCRP (SysDespacho-IA)

Imagen de Docker con n8n 2.35.6 y el flujo **SysDespacho-IA - Bot RPA tipo de cambio BCRP**
ya importado. El bot consulta en el portal del BCRP el tipo de cambio interbancario
(compra PD04637PD y venta PD04638PD) de los últimos 30 días, lo guarda en Excel con la
fuente de consulta y lo verifica contra la API oficial del BCRP.

## Desplegar en Render

- Tipo: Web Service · Runtime: Docker
- Dockerfile: `./bot-rpa-n8n/Dockerfile` · Contexto: `./bot-rpa-n8n` · Rama: `bot-rpa-n8n`
- Variables: `OWNER_EMAIL`, `OWNER_PASSWORD` (cuenta de acceso), `N8N_EDITOR_BASE_URL` (URL pública)

## Uso

1. Abrir la URL del servicio e iniciar sesión.
2. Abrir el flujo y pulsar **Execute workflow**.
3. Revisar el Excel en el nodo **Generar Excel** (botón Download) y la verificación en
   **Generar Excel de verificación**.

En el plan gratuito el servicio se apaga tras 15 minutos sin uso y tarda cerca de un minuto
en volver a iniciar; al reiniciarse, el historial de ejecuciones se borra.
