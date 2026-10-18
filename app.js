/* SysDespacho IoT · Panel web
 * Recorrido: Sensor Spot → broker MQTT (WebSocket) → este panel → Supabase → visualización.
 * La clasificación replica iot_backend/clasificacion.py.
 */
(() => {
  "use strict";

  const CFG = Object.assign({
    MQTT_URL: "wss://broker.hivemq.com:8884/mqtt",
    MQTT_TOPIC: "sysdespacho/frankarone/ta3/acelerometro",
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    CONTENEDOR: "CONT-IOT-001",
    RUTA: "Huaral → Puerto del Callao",
    ZONA_HORARIA: "America/Lima",
  }, window.SYSDESPACHO_CONFIG || {});

  // ---------- Clasificación (igual que el receptor en Python) ----------
  const GRAVEDAD = 9.81, LIMITE_MOVIMIENTO = 0.75, LIMITE_IMPACTO = 2.5;
  const redondear = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
  function clasificar(x, y, z) {
    const magnitud = Math.sqrt(x * x + y * y + z * z);
    const variacion = Math.abs(magnitud - GRAVEDAD);
    const estado = variacion >= LIMITE_IMPACTO ? "IMPACTO" : variacion >= LIMITE_MOVIMIENTO ? "MOVIMIENTO" : "NORMAL";
    return { magnitud: redondear(magnitud), variacion: redondear(variacion), estado };
  }

  // ---------- Estado de la aplicación ----------
  const ESTADOS = ["NORMAL", "MOVIMIENTO", "IMPACTO"];
  const COLORES = { NORMAL: "#22C55E", MOVIMIENTO: "#F59E0B", IMPACTO: "#EF4444" };
  let lecturas = [];           // ordenadas de la más antigua a la más reciente
  let totalAlmacenado = 0;
  let limite = 100;
  const vistos = new Set();    // claves para evitar duplicados

  const $ = (id) => document.getElementById(id);
  const fmtFecha = new Intl.DateTimeFormat("es-PE", { timeZone: CFG.ZONA_HORARIA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const fmtHora = new Intl.DateTimeFormat("es-PE", { timeZone: CFG.ZONA_HORARIA, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const n2 = (v) => Number(v).toFixed(2);
  const clave = (r) => r.timestamp_sensor != null ? `${r.dispositivo}|${r.timestamp_sensor}` : `id|${r.id ?? r.recibido_en}`;

  // ---------- Bitácora ----------
  const consola = $("consola");
  function log(texto, clase = "") {
    const linea = document.createElement("div");
    if (clase) linea.className = clase;
    linea.textContent = `[${fmtHora.format(new Date())}] ${texto}`;
    consola.appendChild(linea);
    while (consola.childNodes.length > 300) consola.removeChild(consola.firstChild);
    consola.scrollTop = consola.scrollHeight;
  }

  // ---------- Almacenamiento ----------
  const almacen = (() => {
    const usarSupabase = Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
    if (usarSupabase) {
      const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      return {
        nombre: "Supabase (PostgreSQL)",
        remoto: true,
        async cargar(n) {
          const { data, error } = await sb.from("lecturas").select("*").eq("dispositivo", CFG.CONTENEDOR).order("recibido_en", { ascending: false }).limit(n);
          if (error) throw error;
          const { count, error: e2 } = await sb.from("lecturas").select("id", { count: "exact", head: true }).eq("dispositivo", CFG.CONTENEDOR);
          if (e2) throw e2;
          return { filas: (data || []).reverse(), total: count ?? (data || []).length };
        },
        async guardar(fila) {
          const q = fila.timestamp_sensor != null
            ? sb.from("lecturas").upsert(fila, { onConflict: "dispositivo,timestamp_sensor", ignoreDuplicates: true })
            : sb.from("lecturas").insert(fila);
          const { error } = await q;
          if (error) throw error;
        },
      };
    }
    const KEY = "sysdespacho_lecturas_" + CFG.CONTENEDOR;
    const leer = () => {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
      catch (e) { log(`No se pudo leer el historial local: ${e.message || e}`, "err"); return []; }
    };
    return {
      nombre: "este navegador (modo local)",
      remoto: false,
      async cargar(n) { const todas = leer(); return { filas: todas.slice(-n), total: todas.length }; },
      async guardar(fila) {
        try { const todas = leer(); todas.push(fila); localStorage.setItem(KEY, JSON.stringify(todas.slice(-2000))); }
        catch (e) { log(`No se pudo guardar el historial local: ${e.message || e}`, "err"); }
      },
    };
  })();

  $("txtAlmacen").textContent = almacen.remoto ? "Supabase" : "navegador (local)";
  if (!almacen.remoto) {
    const aviso = $("avisoModo");
    aviso.hidden = false;
    aviso.textContent = "Modo local: el historial se guarda solo en este navegador. Configura Supabase en config.js para conservar las lecturas en la nube.";
  }

  async function cargarHistorial() {
    try {
      const { filas, total } = await almacen.cargar(limite);
      lecturas = filas;
      vistos.clear();
      filas.forEach((f) => vistos.add(clave(f)));
      totalAlmacenado = total;
      log(`Historial cargado desde ${almacen.nombre}: ${filas.length} lecturas (total ${total}).`, "ok");
    } catch (e) {
      log(`No se pudo leer el historial: ${e.message || e}`, "err");
    }
    programarRender();
  }

  // ---------- Recepción MQTT ----------
  let cliente = null;
  function conectar() {
    const badge = $("badgeMqtt");
    if (!window.mqtt) { badge.className = "badge err"; badge.textContent = "Librería MQTT no disponible"; return; }
    const id = "sysdespacho-web-" + Math.random().toString(16).slice(2, 10);
    log(`Conectando a ${CFG.MQTT_URL}…`);
    cliente = window.mqtt.connect(CFG.MQTT_URL, { clientId: id, clean: true, reconnectPeriod: 4000, connectTimeout: 10000, keepalive: 60 });
    cliente.on("connect", () => {
      badge.className = "badge ok"; badge.textContent = "● Conectado al broker";
      log(`Conectado al broker ${CFG.MQTT_URL}`, "ok");
      cliente.subscribe(CFG.MQTT_TOPIC, { qos: 0 }, (err) => {
        if (err) log(`Error al suscribirse: ${err.message}`, "err");
        else log(`Suscrito al topic: ${CFG.MQTT_TOPIC}`, "ok");
      });
    });
    cliente.on("reconnect", () => { badge.className = "badge warn"; badge.textContent = "Reconectando…"; });
    cliente.on("offline", () => { badge.className = "badge err"; badge.textContent = "Sin conexión al broker"; });
    cliente.on("error", (e) => log(`Error MQTT: ${e.message || e}`, "err"));
    cliente.on("message", (_topic, payload) => procesarMensaje(payload.toString()));
  }

  function procesarMensaje(texto) {
    let datos;
    try { datos = JSON.parse(texto); } catch (e) { log(`Mensaje inválido: ${e.message}`, "err"); return; }
    const v = datos && datos.values;
    if (!Array.isArray(v) || v.length < 3) { log("Mensaje inválido: La lectura no contiene los tres ejes", "err"); return; }
    const [x, y, z] = v.slice(0, 3).map(Number);
    if (![x, y, z].every(Number.isFinite)) { log("Mensaje inválido: valores no numéricos", "err"); return; }

    const c = clasificar(x, y, z);
    const fila = {
      dispositivo: CFG.CONTENEDOR,
      tipo_sensor: String(datos.type || "sensor_desconocido"),
      eje_x: x, eje_y: y, eje_z: z,
      magnitud: c.magnitud, variacion: c.variacion, estado: c.estado,
      timestamp_sensor: Number.isFinite(Number(datos.timestamp)) ? Number(datos.timestamp) : null,
      recibido_en: new Date().toISOString(),
    };
    const k = clave(fila);
    if (vistos.has(k)) return;
    vistos.add(k);

    lecturas.push(fila);
    if (lecturas.length > limite) lecturas.splice(0, lecturas.length - limite);
    totalAlmacenado += 1;
    log(`Lectura recibida: x=${n2(x)}, y=${n2(y)}, z=${n2(z)}, estado=${c.estado}`, c.estado === "IMPACTO" ? "imp" : c.estado === "MOVIMIENTO" ? "mov" : "");
    almacen.guardar(fila).catch((e) => log(`No se pudo guardar la lectura: ${e.message || e}`, "err"));
    programarRender();
  }

  // Lectura de prueba con el formato de Sensor Spot
  function simular(estado) {
    const r = (a, b) => a + Math.random() * (b - a);
    const z = estado === "IMPACTO" ? GRAVEDAD + r(3, 5) : estado === "MOVIMIENTO" ? GRAVEDAD + r(0.9, 2.0) : r(9.66, 9.86);
    const msg = { type: "simulacion.panel_web", values: [redondear(r(-0.3, 0.3), 2), redondear(r(-0.3, 0.3), 2), redondear(z, 2)], timestamp: Date.now() * 1000 + Math.floor(Math.random() * 1000) };
    procesarMensaje(JSON.stringify(msg));
    if (!cliente || !cliente.connected) {
      log(`Lectura de prueba ${estado} registrada solo en este panel; no se publicó porque el broker no está conectado.`, "warn");
      return;
    }
    cliente.publish(CFG.MQTT_TOPIC, JSON.stringify(msg), { qos: 0 }, (err) => {
      if (err) log(`No se pudo publicar la prueba en MQTT: ${err.message || err}`, "err");
      else log(`Lectura de prueba publicada en MQTT (${estado}).`, "ok");
    });
  }

  // ---------- Gráficos ----------
  const charts = {};
  const tema = { textStyle: { color: "#CBD5E1" } };
  function chart(id) { if (!charts[id] && window.echarts) charts[id] = window.echarts.init($(id), null, { renderer: "canvas" }); return charts[id]; }
  window.addEventListener("resize", () => Object.values(charts).forEach((c) => c.resize()));

  function sparkline(id, valores, tipo = "line") {
    const c = chart(id); if (!c) return;
    c.setOption({
      animation: false, grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: "category", show: false, data: valores.map((_, i) => i) }, yAxis: { type: "value", show: false, scale: true },
      series: [{ type: tipo, data: valores, symbol: "none", lineStyle: { width: 1.5, color: "#94A3B8" }, itemStyle: { color: "#94A3B8" }, barWidth: "60%" }],
    }, true);
  }

  // ---------- Render ----------
  let pendiente = false;
  function programarRender() { if (!pendiente) { pendiente = true; requestAnimationFrame(() => { pendiente = false; render(); }); } }

  function render() {
    const ultima = lecturas[lecturas.length - 1];
    $("mTotal").textContent = totalAlmacenado.toLocaleString("es-PE");
    $("bContenedor").textContent = "▣ " + CFG.CONTENEDOR;
    $("bRuta").textContent = "⇄ " + CFG.RUTA;
    sparkline("sparkTotal", lecturas.slice(-20).map((l) => l.magnitud));
    sparkline("sparkMag", lecturas.slice(-30).map((l) => l.magnitud));
    sparkline("sparkVar", lecturas.slice(-30).map((l) => l.variacion), "bar");
    actualizarFrescura();
    if (!ultima) {
      $("mEstado").textContent = "—"; $("mMagnitud").textContent = "—"; $("mVariacion").textContent = "—";
      const a = $("alerta"); a.hidden = false; a.className = "alerta"; a.style.background = "rgba(47,128,237,.12)"; a.style.color = "#BFDBFE";
      a.textContent = "La plataforma está disponible, pero todavía no hay lecturas. Inicia Sensor Spot o envía una lectura de prueba.";
    } else {
      $("mEstado").textContent = ultima.estado;
      $("mMagnitud").textContent = `${n2(ultima.magnitud)} m/s²`;
      $("mVariacion").textContent = `${n2(ultima.variacion)} m/s²`;
      const a = $("alerta"); a.hidden = false; a.style.background = ""; a.style.color = ""; a.className = "alerta " + ultima.estado;
      a.textContent = ultima.estado === "IMPACTO" ? "⚠ Alerta crítica: se detectó un posible impacto durante el traslado del contenedor."
        : ultima.estado === "MOVIMIENTO" ? "⚠ Atención: el contenedor registra movimiento."
        : "✓ Operación estable: el contenedor se encuentra en condición normal.";
    }
    renderResumen(ultima);
    renderAnalitica();
    renderHistorial();
  }

  function actualizarFrescura() {
    const ultima = lecturas[lecturas.length - 1];
    const b = $("badgeFrescura"), bt = $("bTelemetria");
    if (!ultima) { b.className = "badge"; b.textContent = "Sin lecturas"; $("txtUltima").textContent = ""; bt.className = "badge"; bt.textContent = "Telemetría sin datos"; return; }
    const fecha = new Date(ultima.recibido_en);
    const seg = Math.max(0, Math.round((Date.now() - fecha.getTime()) / 1000));
    if (seg <= 30) { b.className = "badge ok"; b.textContent = "✓ Datos recientes"; bt.className = "badge ok"; bt.textContent = "Telemetría reciente"; }
    else { b.className = "badge warn"; b.textContent = `Última lectura hace ${seg < 120 ? seg + " segundos" : Math.round(seg / 60) + " minutos"}`; bt.className = "badge warn"; bt.textContent = "Telemetría sin actualizar"; }
    $("txtUltima").textContent = `Última recepción: ${fmtFecha.format(fecha)} (hora de Lima)`;
  }
  setInterval(actualizarFrescura, 5000);

  function conteos() {
    const c = { NORMAL: 0, MOVIMIENTO: 0, IMPACTO: 0 };
    lecturas.forEach((l) => { if (c[l.estado] != null) c[l.estado] += 1; });
    return c;
  }

  function renderResumen(ultima) {
    const riesgo = ultima ? Math.min(100, Math.round((ultima.variacion / LIMITE_IMPACTO) * 100)) : 0;
    const g = chart("chGauge");
    g && g.setOption({
      ...tema,
      series: [{
        type: "gauge", min: 0, max: 100, startAngle: 210, endAngle: -30, radius: "92%",
        axisLine: { lineStyle: { width: 16, color: [[0.3, "#22C55E"], [0.6, "#F59E0B"], [1, "#EF4444"]] } },
        pointer: { width: 6, itemStyle: { color: "#2F80ED" } }, axisTick: { distance: -16, length: 6, lineStyle: { color: "#fff", width: 1 } },
        splitLine: { distance: -16, length: 16, lineStyle: { color: "#fff", width: 2 } }, axisLabel: { color: "#CBD5E1", distance: 22, fontSize: 11 },
        detail: { valueAnimation: true, formatter: "{value}%", color: "#F3F6FA", fontSize: 26, offsetCenter: [0, "62%"] },
        title: { offsetCenter: [0, "86%"], color: "#94A3B8", fontSize: 13 }, data: [{ value: riesgo, name: "Índice de riesgo" }],
      }],
    });
    const r = chart("chRadar");
    const ax = ultima ? [Math.abs(ultima.eje_x), Math.abs(ultima.eje_y), Math.abs(ultima.eje_z)] : [0, 0, 0];
    const max = Math.max(12, ...ax) * 1.05;
    r && r.setOption({
      ...tema,
      radar: { indicator: [{ name: "Eje X", max }, { name: "Eje Y", max }, { name: "Eje Z", max }], radius: "62%", axisName: { color: "#CBD5E1" }, splitLine: { lineStyle: { color: "#26364D" } }, splitArea: { areaStyle: { color: ["#111C2E", "#16243A"] } }, axisLine: { lineStyle: { color: "#26364D" } } },
      series: [{ type: "radar", data: [{ value: ax.map((v) => redondear(v, 2)), name: "Aceleración (m/s²)" }], areaStyle: { color: "rgba(47,128,237,.35)" }, lineStyle: { color: "#2F80ED", width: 2 }, itemStyle: { color: "#2F80ED" } }],
      tooltip: { trigger: "item" },
    });
    const c = conteos();
    const d = chart("chDonut");
    d && d.setOption({
      ...tema, tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { bottom: 0, textStyle: { color: "#CBD5E1" } },
      series: [{ type: "pie", radius: ["48%", "70%"], center: ["50%", "45%"], label: { color: "#CBD5E1", formatter: "{b}\n{d}%" },
        data: ESTADOS.filter((e) => c[e] > 0).map((e) => ({ name: e, value: c[e], itemStyle: { color: COLORES[e] } })) }],
    }, true);
  }

  function renderAnalitica() {
    const l = chart("chLinea");
    l && l.setOption({
      ...tema, animation: false, tooltip: { trigger: "axis" },
      grid: { left: 48, right: 72, top: 36, bottom: 40 },
      xAxis: { type: "time", axisLabel: { color: "#94A3B8", formatter: (v) => fmtHora.format(new Date(v)) }, axisLine: { lineStyle: { color: "#26364D" } }, name: "Fecha y hora", nameLocation: "middle", nameGap: 28, nameTextStyle: { color: "#94A3B8" } },
      yAxis: { type: "value", name: "Variación (m/s²)", nameTextStyle: { color: "#94A3B8" }, axisLabel: { color: "#94A3B8" }, splitLine: { lineStyle: { color: "#1E2B40" } } },
      series: [{
        type: "line", showSymbol: true, symbolSize: 5, data: lecturas.map((x) => ({ value: [x.recibido_en, x.variacion], itemStyle: { color: COLORES[x.estado] } })),
        lineStyle: { color: "#2F80ED", width: 1.5 },
        markLine: { symbol: "none", label: { color: "#CBD5E1", formatter: "{b}", position: "end" }, data: [{ yAxis: LIMITE_MOVIMIENTO, name: "Movimiento", lineStyle: { color: "#F59E0B", type: "dashed" } }, { yAxis: LIMITE_IMPACTO, name: "Impacto", lineStyle: { color: "#EF4444", type: "dashed" } }] },
      }],
    }, true);
    const c = conteos(), total = lecturas.length || 1;
    $("tablaResumen").querySelector("tbody").innerHTML = ESTADOS.map((e) => `<tr><td class="est ${e}">${e}</td><td class="num">${c[e]}</td><td class="num">${((c[e] / total) * 100).toFixed(1)}%</td></tr>`).join("");
  }

  function renderHistorial() {
    const filtro = $("filtroEstado").value;
    const filas = lecturas.slice().reverse().filter((l) => !filtro || l.estado === filtro);
    $("tablaHistorial").querySelector("tbody").innerHTML = filas.map((l) => `<tr>
      <td>${fmtFecha.format(new Date(l.recibido_en))}</td>
      <td class="num">${n2(l.eje_x)}</td><td class="num">${n2(l.eje_y)}</td><td class="num">${n2(l.eje_z)}</td>
      <td class="num">${n2(l.magnitud)}</td><td class="num">${n2(l.variacion)}</td>
      <td class="est ${l.estado}">${l.estado}</td><td>${l.tipo_sensor === "simulacion.panel_web" ? "prueba" : "sensor"}</td></tr>`).join("")
      || `<tr><td colspan="8" class="muted">Sin lecturas para mostrar.</td></tr>`;
  }

  function descargarCsv() {
    const cab = ["recibido_en", "dispositivo", "tipo_sensor", "eje_x", "eje_y", "eje_z", "magnitud", "variacion", "estado", "timestamp_sensor"];
    const txt = [cab.join(",")].concat(lecturas.map((l) => cab.map((k) => JSON.stringify(l[k] ?? "")).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv" }));
    a.download = `lecturas_${CFG.CONTENEDOR}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- Eventos de la interfaz ----------
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("activo", x === t));
    document.querySelectorAll(".panel").forEach((p) => { p.hidden = p.id !== "tab-" + t.dataset.tab; });
    requestAnimationFrame(() => Object.values(charts).forEach((c) => c.resize()));
  }));
  $("ventana").addEventListener("change", (e) => { limite = Number(e.target.value); cargarHistorial(); });
  $("btnActualizar").addEventListener("click", cargarHistorial);
  $("filtroEstado").addEventListener("change", renderHistorial);
  $("btnCsv").addEventListener("click", descargarCsv);
  document.querySelectorAll("[data-simular]").forEach((b) => b.addEventListener("click", () => simular(b.dataset.simular)));
  $("btnMenu").addEventListener("click", () => $("sidebar").classList.toggle("abierta"));
  document.querySelector(".contenido").addEventListener("click", (e) => { if (!e.target.closest("#btnMenu")) $("sidebar").classList.remove("abierta"); });

  // ---------- Inicio ----------
  log(`Panel iniciado. Almacenamiento: ${almacen.nombre}.`);
  cargarHistorial().then(conectar);
})();
