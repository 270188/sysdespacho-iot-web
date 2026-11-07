# n8n con el bot RPA de SysDespacho-IA ya importado (para Render u otro hosting con Docker)
# Se usa n8n 1.x porque consume menos memoria que 2.x y cabe en el plan gratuito de Render (512 MB)
FROM n8nio/n8n:1.123.92
USER root
COPY flujos /opt/bot/flujos
COPY iniciar.sh owner.js activar.js /opt/bot/
RUN chmod +x /opt/bot/iniciar.sh \
 && mkdir -p /home/node/.n8n-files \
 && chown -R node:node /opt/bot /home/node/.n8n-files
USER node
ENV N8N_PORT=5678 PORT=5678 GENERIC_TIMEZONE=America/Lima TZ=America/Lima \
    N8N_DIAGNOSTICS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false \
    N8N_VERSION_NOTIFICATIONS_ENABLED=false N8N_TEMPLATES_ENABLED=false \
    N8N_RESTRICT_FILE_ACCESS_TO=/home/node/.n8n-files \
    NODE_OPTIONS=--max-old-space-size=360 \
    N8N_RUNNERS_ENABLED=false \
    N8N_COMMUNITY_PACKAGES_ENABLED=false \
    N8N_AI_ENABLED=false \
    EXECUTIONS_DATA_PRUNE=true EXECUTIONS_DATA_MAX_AGE=48
EXPOSE 5678
ENTRYPOINT ["/bin/sh", "/opt/bot/iniciar.sh"]
