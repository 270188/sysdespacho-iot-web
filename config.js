// Configuración del panel SysDespacho IoT.
// Edita estos valores antes de desplegar en Vercel.
window.SYSDESPACHO_CONFIG = {
  // Broker MQTT por WebSocket seguro (obligatorio en un sitio https como Vercel).
  // HiveMQ público: puerto 8884 con TLS, ruta /mqtt.
  MQTT_URL: "wss://broker.hivemq.com:8884/mqtt",

  // Debe ser el mismo topic que tienes configurado en Sensor Spot.
  MQTT_TOPIC: "sysdespacho/frankarone/ta3/acelerometro",

  // Datos de tu proyecto Supabase (Project Settings → API).
  // Si los dejas vacíos, el panel funciona en "modo local" y guarda el
  // historial solo en este navegador.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Identificación que se muestra en el panel y se guarda con cada lectura.
  CONTENEDOR: "CONT-IOT-001",
  RUTA: "Huaral → Puerto del Callao",

  // Zona horaria para mostrar fechas y horas.
  ZONA_HORARIA: "America/Lima",
};
