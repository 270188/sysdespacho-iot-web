# n8n con el bot RPA de SysDespacho-IA ya importado (para Render u otro hosting con Docker)
FROM n8nio/n8n:2.35.6
USER root
COPY flujo.json iniciar.sh owner.js /opt/bot/
RUN chmod +x /opt/bot/iniciar.sh \
 && mkdir -p /home/node/.n8n-files \
 && chown -R node:node /opt/bot /home/node/.n8n-files
USER node
ENV N8N_PORT=5678 PORT=5678 GENERIC_TIMEZONE=America/Lima TZ=America/Lima \
    N8N_DIAGNOSTICS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false \
    N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_TEMPLATES_ENABLED=false \
    N8N_RESTRICT_FILE_ACCESS_TO=/home/node/.n8n-files \
    NODE_OPTIONS=--max-old-space-size=380
EXPOSE 5678
ENTRYPOINT ["/bin/sh", "/opt/bot/iniciar.sh"]
