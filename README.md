# SysDespacho IoT · Panel web para Vercel

Versión web del Centro de monitoreo IoT de SysDespacho-IA. Es un sitio estático (HTML, CSS y JavaScript) que se despliega en Vercel sin compilación.

## Cómo funciona

```text
Acelerómetro (Android) → Sensor Spot → broker.hivemq.com (MQTT)
      → panel web (WebSocket seguro, puerto 8884) → clasificación → Supabase
      → estado actual, gráficos e historial en el navegador
```

- El panel se suscribe al topic `sysdespacho/frankarone/ta3/acelerometro` por **WebSocket seguro** (`wss://broker.hivemq.com:8884/mqtt`). Sensor Spot sigue publicando por el puerto 1883, igual que antes: el broker entrega el mensaje a ambos tipos de clientes.
- Cada lectura se clasifica con la misma regla del receptor en Python (`iot_backend/clasificacion.py`): variación = |√(x²+y²+z²) − 9,81|; ≥ 2,50 IMPACTO, ≥ 0,75 MOVIMIENTO, si no NORMAL.
- Las lecturas se guardan en **Supabase** (PostgreSQL) con fecha y hora de recepción, dispositivo y timestamp del sensor. Si hay varios paneles abiertos, el índice único evita duplicados.
- Sin Supabase configurado, el panel funciona en **modo local** y guarda el historial solo en el navegador.

> Importante: Vercel solo aloja la página; no mantiene procesos encendidos. Las lecturas se guardan mientras **al menos un panel esté abierto**. Para registrar las 24 horas, mantén además el receptor en Docker del proyecto original.

## Archivos

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura del panel |
| `styles.css` | Estilos (adaptado a celular) |
| `app.js` | Conexión MQTT, clasificación, almacenamiento y gráficos |
| `config.js` | **Configuración que debes editar** (broker, topic, Supabase) |
| `supabase.sql` | Script para crear la tabla y sus permisos |
| `vendor/` | Librerías MQTT.js 5.16, ECharts 5.6 y supabase-js 2.118 (licencias incluidas) |
| `vercel.json` | Configuración de Vercel |

## Paso 1. Crear la base de datos en Supabase (gratis)

1. Entra a https://supabase.com, crea una cuenta y un proyecto nuevo (región sugerida: São Paulo).
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase.sql` y presiona **Run**.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public** key
4. Abre `config.js` y pégalos en `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

La clave *anon* está pensada para usarse en el navegador; lo que la protege son las políticas del script, que solo permiten leer e insertar en la tabla `lecturas`. Nunca pongas aquí la clave `service_role`.

## Paso 2. Subir el panel a GitHub

Opción A, dentro del repositorio del proyecto: copia esta carpeta como `web/` en `SysDespacho-IA-TIC` y haz commit y push.

Opción B, repositorio aparte: crea un repositorio nuevo (por ejemplo `sysdespacho-iot-web`) y sube estos archivos en la raíz.

## Paso 3. Desplegar en Vercel

1. Entra a https://vercel.com e inicia sesión con tu cuenta de GitHub.
2. **Add New… → Project** y elige el repositorio.
3. Configura:
   - **Framework Preset:** Other
   - **Root Directory:** `web` (solo si usaste la opción A)
   - **Build Command:** vacío · **Output Directory:** vacío
4. Presiona **Deploy**. En menos de un minuto tendrás una URL como `https://sysdespacho-iot-web.vercel.app`.

Cada vez que hagas push al repositorio, Vercel vuelve a desplegar automáticamente.

## Paso 4. Probar el recorrido completo

1. Abre la URL de Vercel (desde la PC o el celular). La insignia debe decir **Conectado al broker**.
2. En Sensor Spot usa el mismo broker (`broker.hivemq.com`, puerto `1883`) y el topic `sysdespacho/frankarone/ta3/acelerometro`, y empieza a transmitir.
3. Mueve el celular: el estado cambia a MOVIMIENTO y, con un golpe, a IMPACTO.
4. Recarga la página: el historial vuelve desde Supabase. En Supabase, **Table Editor → lecturas** muestra las filas guardadas.

Si no tienes el celular a mano, los botones **Lectura de prueba** registran una lectura de muestra en el panel. Cuando el broker está conectado, también publican un mensaje con el formato de Sensor Spot en MQTT. Si no hay conexión, la prueba igual se registra localmente en el panel. Esas filas quedan marcadas con `tipo_sensor = simulacion.panel_web` y aparecen como "prueba" en el historial.

## Problemas comunes

- **"Reconectando…" todo el tiempo:** algunas redes bloquean el puerto 8884. Prueba con datos móviles u otra red.
- **No aparecen lecturas:** revisa que el topic de Sensor Spot sea exactamente el de `config.js` (mayúsculas y barras incluidas).
- **"No se pudo guardar la lectura":** vuelve a ejecutar `supabase.sql` y revisa que la URL y la clave anon sean correctas.
- **Cambié `config.js` y no se ve el cambio:** recarga con Ctrl + F5.
