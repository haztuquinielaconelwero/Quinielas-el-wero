/* =====================================  Esto de abajo trabaja en generar los partidos de la quiniela                                          ======================= */
(function () {
"use strict";
let PARTIDOS = [];
let MAX_DOBLES = 3;
let MAX_TRIPLES = 3;
let JORNADA_ACTUAL = "Jornada 1";
async function cargarJornadaActual() {
try {
const res = await fetch(`${APIBASE}/api/apijornadaactual`);
const data = await res.json();
if (!res.ok || !data?.partidos?.length) {
throw new Error("No se pudo cargar la jornada actual");
}
PARTIDOS = data.partidos;
MAX_DOBLES = Number(data.maxDobles ?? 3);
MAX_TRIPLES = Number(data.maxTriples ?? 3);
JORNADA_ACTUAL = data.jornadaActual || "Jornada 1";
} catch (err) {
console.error("Error cargando jornada actual", err);
tarjetaroja("No se pudo cargar la jornada actual.");
}
}
/* =====================================  Esto de abajo trabaja en donde encontrar las quinielas , precio y maximo de dobles y triples         ======================= */
const STORAGE_KEY = "quinielasElWero_guardadas";
const nombreCelularActual = localStorage.getItem("quinielasElWero_identidad") || "";
const OPCIONES = ["L", "E", "V"];
const PRECIO_UNITARIO = 30;
const APIBASE = window.location.hostname === "localhost" ? "http://localhost:8000" : "";
let VENDEDOR_WHATSAPP = {};
const estado = {
selecciones: {},
get nombre() {
return document.getElementById("nombreInput")?.value.trim() ?? "";},
get total() {
return Object.keys(this.selecciones).length;},
get completo() {
return this.total === PARTIDOS.length;},
get totalDobles() {
return Object.values(this.selecciones).filter((s) => s.length === 2).length;},
get totalTriples() {
return Object.values(this.selecciones).filter((s) => s.length === 3).length;}
};
function detectarVendedor() {
const params = new URLSearchParams(window.location.search);
const vendedorURL = params.get("vendedor");
if (vendedorURL) {
localStorage.setItem("quinielasElWero_vendedorActual", vendedorURL);
return vendedorURL;
}
const guardado = localStorage.getItem("quinielasElWero_vendedorActual");
return guardado || null;
}
/* =====================================       Esto de abajo trabaja formar la quiniela                                                      ======================= */
function renderPartidos() {
const grid = document.getElementById("listaPartidos");
if (!grid) return;
grid.innerHTML = PARTIDOS.map((p, i) => `
<article class="rq-partido" id="partido-${p.id}" role="listitem" aria-label="Partido ${p.local} vs ${p.visitante}" style="animation-delay:${i * 0.05}s">
<div class="rq-partido-equipos">
<button class="rq-opcion" data-partido="${p.id}" data-tipo="L" aria-pressed="false" aria-label="Local (L)">L</button>
<div class="rq-equipo-local-logo"><img src="${p.localLogo}" alt="${p.local}" class="rq-equipo-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;"></div>
<span class="rq-equipo-nombre rq-equipo-local-nombre">${p.local}</span>
<button class="rq-opcion" data-partido="${p.id}" data-tipo="E" aria-pressed="false" aria-label="Empate (E)">E</button>
<span class="rq-equipo-nombre rq-equipo-visitante-nombre">${p.visitante}</span>
<div class="rq-equipo-visitante-logo"><img src="${p.visitanteLogo}" alt="${p.visitante}" class="rq-equipo-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;"></div>
<button class="rq-opcion" data-partido="${p.id}" data-tipo="V" aria-pressed="false" aria-label="Visitante (V)">V</button>
</div>
</article>
`).join("");
grid.querySelectorAll(".rq-opcion").forEach((btn) => {
btn.addEventListener("click", manejarOpcion);
btn.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
manejarOpcion.call(btn, e);
}
});
});
}
/* =====================================  Esto de abajo trabajamaximo de dobles y triples - Y tambien las selecionnes de L E V         ======================= */
function manejarOpcion(e) {
const btn = e.currentTarget ?? this;
const partidoId = Number(btn.dataset.partido);
const tipo = btn.dataset.tipo;
let seleccionActual = estado.selecciones[partidoId] || [];
if (seleccionActual.includes(tipo)) {
seleccionActual = seleccionActual.filter((t) => t !== tipo);} 
else {
const nuevaLongitud = seleccionActual.length + 1;
if (nuevaLongitud === 2 && estado.totalDobles >= MAX_DOBLES) {
tarjetaroja(`Solo puedes tener máximo ${MAX_DOBLES} dobles por quiniela.`);
return;}
if (nuevaLongitud === 3 && estado.totalTriples >= MAX_TRIPLES) {
tarjetaroja(`Solo puedes tener máximo ${MAX_TRIPLES} triples por quiniela.`);
return;}
seleccionActual = [...seleccionActual, tipo];}
if (seleccionActual.length === 0) {
delete estado.selecciones[partidoId];} 
else {
estado.selecciones[partidoId] = seleccionActual;}
ripple(btn, e);
actualizarPartido(partidoId);
actualizarPrecio();
}
function actualizarPartido(partidoId) {
const articulo = document.getElementById(`partido-${partidoId}`);
if (!articulo) return;
const seleccion = estado.selecciones[partidoId] || [];
const botones = articulo.querySelectorAll(".rq-opcion");
botones.forEach((b) => {
const activo = seleccion.includes(b.dataset.tipo);
b.classList.toggle("seleccionado", activo);
b.setAttribute("aria-pressed", String(activo));});
articulo.classList.toggle("completo", seleccion.length > 0);
articulo.classList.toggle("es-doble", seleccion.length === 2);
articulo.classList.toggle("es-triple", seleccion.length === 3);
}
function ripple(btn, e) {
const r = document.createElement("span");
r.className = "rq-opcion-ripple";
const size = Math.max(btn.offsetWidth, btn.offsetHeight) * 1.2;
r.style.width = r.style.height = `${size}px`;
r.style.left = `${btn.offsetWidth / 2 - size / 2}px`;
r.style.top = `${btn.offsetHeight / 2 - size / 2}px`;
btn.appendChild(r);
r.addEventListener("animationend", () => r.remove());
}
/* =====================================  Esto de abajo trabaja en generar las combinaciones y en guardar la quiniela                        ======================= */
function generarCombinaciones(selecciones) {
let combos = [{}];
PARTIDOS.forEach((p) => {
const letras = selecciones[p.id] || [];
const nuevas = [];
combos.forEach((c) => {
letras.forEach((l) => nuevas.push({ ...c, [p.id]: l }));
});
combos = nuevas;
});
return combos;
}
function firmaBoleto(nombre, vendedor, combo) {
const resultado = PARTIDOS.map((p) => combo[p.id] || "").join("");
return `${nombre.trim().toLowerCase()}|${vendedor.trim().toLowerCase()}|${resultado}`;
}
function existeAlgunDuplicado(nombre, vendedor, combos) {
const firmasExistentes = new Set(leerStorage().map((q) => q.firma));
return combos.some((combo) => firmasExistentes.has(firmaBoleto(nombre, vendedor, combo)));
}
function guardarQuiniela() {
const nombre = estado.nombre;
if (!nombre) { marcarErrorNombre(); tarjetaroja("Escribe tu nombre antes de continuar."); return; }
if (!estado.completo) { notificar(`Faltan ${PARTIDOS.length - estado.total} partidos por seleccionar.`, "aviso"); return; }
const vendedor = detectarVendedor();
if (!vendedor) {
tarjetaroja("No se detectó tu vendedor. Verifica tu link para poder añadir quinielas correctamente.");
return;
}
const combos = generarCombinaciones(estado.selecciones);
if (existeAlgunDuplicado(nombre, vendedor, combos)) {
tarjetaroja("Ya añadiste una quiniela con el mismo nombre y resultados, tu quiniela no fue guardada.");
return;
}
const quinielas = leerStorage();
const base = Date.now();
combos.forEach((combo, idx) => {
quinielas.push({
id: base + idx,
nombre,
vendedor,
jornada: JORNADA_ACTUAL,
firma: firmaBoleto(nombre, vendedor, combo),
selecciones: combo
});
});
escribirStorage(quinielas);
document.getElementById("nombreInput").value = "";
estado.selecciones = {};
PARTIDOS.forEach((p) => actualizarPartido(p.id));
actualizarPrecio();
actualizarBadgeGuardadas();
notificar(`¡${combos.length} quiniela${combos.length > 1 ? "s" : ""} guardada${combos.length > 1 ? "s" : ""} correctamente!`, "exito");
}
function leerStorage() {
try {
return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
} catch {
return [];
}
}
function escribirStorage(arr) {
localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
const STORAGE_KEY_ENVIADAS = "quinielasElWero_enviadas";
function guardarEnMisQuinielas(quinielasEnviadas) {
try {
const actuales = JSON.parse(localStorage.getItem(STORAGE_KEY_ENVIADAS)) ?? [];
const nuevas = quinielasEnviadas.map((q) => ({
id: q.id,
nombre: q.nombre,
vendedor: q.vendedor,
jornada: q.jornada,
estado: "no-jugando",
puntos: 0,
selecciones: q.selecciones
}));
localStorage.setItem(STORAGE_KEY_ENVIADAS, JSON.stringify([...actuales, ...nuevas]));
} catch (err) {
console.error("No se pudo guardar en Mis Quinielas", err);
}
}
/* =====================================     Esto de abajo calcula el precio de las quinielas en tiempo real y tambien las quinielas guardadas      ======================= */
function calcularCombinacionesEstado() {
if (estado.total === 0) return 0;
return PARTIDOS.reduce((acc, p) => {
const sel = estado.selecciones[p.id];
const len = sel ? sel.length : 0;
return acc * (len > 0 ? len : 1);
}, 1);
}
function actualizarPrecio() {
const enEdicion = calcularCombinacionesEstado();
const precio = enEdicion * PRECIO_UNITARIO;
const badge = document.getElementById("badgeQuinielas");
if (badge) badge.textContent = enEdicion;
const precioEl = document.getElementById("precioMonto");
if (precioEl) precioEl.textContent = `$${precio}`;
}
function actualizarResumenGuardadas() {
const guardadas = leerStorage().length;
const precio = guardadas * PRECIO_UNITARIO;
const totalTexto = document.getElementById("totalQuinielasTexto");
if (totalTexto) totalTexto.textContent = `Total de quinielas: ${guardadas}`;
const precioTexto = document.getElementById("precioGuardadasTexto");
if (precioTexto) precioTexto.textContent = `Precio: $${precio}`;
}
function actualizarBadgeGuardadas() {
const el = document.getElementById("badgeGuardadas");
if (el) el.textContent = leerStorage().length;
}
/* =====================================                Esto de abajo borra la quiniela (En la quiniela)                                        ======================= */
function borrarQuiniela() {
document.getElementById("nombreInput").value = "";
estado.selecciones = {};
PARTIDOS.forEach((p) => actualizarPartido(p.id));
actualizarPrecio();
}
/* =====================================   Esto de abajo trabaja en la quiniela aletoria (En la quiniela)                                        ======================= */
const MAX_COMBOS_ALEATORIO = 12;
function elegirLetrasAleatorias(cantidad) {
const copia = [...OPCIONES];
const resultado = [];
for (let i = 0; i < cantidad; i++) {
const idx = Math.floor(Math.random() * copia.length);
resultado.push(copia.splice(idx, 1)[0]);
}
return resultado;
}
function elegirCantidadPorProbabilidad() {
const roll = Math.random();
if (roll < 0.05) return 3;
if (roll < 0.30) return 2;
return 1;
}
function seleccionAleatoria() {
estado.selecciones = {};
let totalCombos = 1;
PARTIDOS.forEach((p) => {
let cantidad = elegirCantidadPorProbabilidad();
if (totalCombos * cantidad > MAX_COMBOS_ALEATORIO) cantidad = 1;
totalCombos *= cantidad;
estado.selecciones[p.id] = elegirLetrasAleatorias(cantidad);
});
PARTIDOS.forEach((p) => actualizarPartido(p.id));
actualizarPrecio();
}
/* =====================================   Esto de abajo trabaja en mostrar las quinielas guardadas                                        ======================= */
function abrirModalGuardadas() {
const quinielas = leerStorage();
const contenedor = document.getElementById("listaGuardadasModal");
if (!contenedor) return;
if (quinielas.length === 0) {
contenedor.innerHTML = `<p class="rq-empty-msg">No tienes quinielas guardadas aún.</p>`;
} else {
contenedor.innerHTML = quinielas.map((q) => renderTarjetaGuardada(q)).join("");
contenedor.querySelectorAll(".rq-tg-eliminar").forEach((btn) => {
btn.addEventListener("click", (e) => {
e.stopPropagation();
eliminarQuinielaGuardada(Number(btn.dataset.id));
});
});
contenedor.querySelectorAll(".rq-tarjeta-guardada").forEach((card) => {
card.addEventListener("click", () => cargarQuinielaGuardada(Number(card.dataset.id)));
});
}
actualizarResumenGuardadas();
abrirModal("modalGuardadas");
}
function renderMiniOpciones(letras) {
return OPCIONES.map((op) => {
const activa = letras.includes(op);
return `<span class="rq-opcion rq-opcion-mini${activa ? " seleccionado" : ""}" aria-hidden="true">${op}</span>`;
}).join("");
}
function renderTarjetaGuardada(q) {
const miniPartidos = PARTIDOS.map((p) => {
const sel = q.selecciones?.[p.id];
const letras = Array.isArray(sel) ? sel : sel ? [sel] : [];
return `
<div class="rq-mini-partido">
<img src="${p.localLogo}" alt="${p.local}" class="rq-mini-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;">
<span class="rq-mini-equipo local">${p.local}</span>
<div class="rq-mini-opciones" aria-hidden="true">
${renderMiniOpciones(letras)}
</div>
<span class="rq-mini-equipo visitante">${p.visitante}</span>
<img src="${p.visitanteLogo}" alt="${p.visitante}" class="rq-mini-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;">
</div>`;
}).join("");
return `
<div class="rq-tarjeta-guardada" data-id="${q.id}">
<button class="rq-tg-eliminar" data-id="${q.id}" aria-label="Eliminar quiniela">❌</button>
<div class="rq-tg-header">
<span class="rq-tg-nombre">${q.nombre}</span>
<span class="rq-tg-jornada">${q.jornada || "Jornada 1"}</span>
<span class="rq-tg-vendedor">Vendedor: ${q.vendedor}</span>
</div>
<div class="rq-tg-mini-quiniela">
${miniPartidos}
</div>
</div>`;
}
function eliminarQuinielaGuardada(id) {
const arr = leerStorage().filter((q) => q.id !== id);
escribirStorage(arr);
actualizarPrecio();
actualizarResumenGuardadas();
actualizarBadgeGuardadas();
document.querySelector(`.rq-tarjeta-guardada[data-id="${id}"]`)?.remove();
const contenedor = document.getElementById("listaGuardadasModal");
if (contenedor && arr.length === 0) {
contenedor.innerHTML = `<p class="rq-empty-msg">No tienes quinielas guardadas aún.</p>`;
}
}
function cargarQuinielaGuardada(id) {
const q = leerStorage().find((q) => q.id === id);
if (!q) return;
document.getElementById("nombreInput").value = "";
estado.selecciones = {};
PARTIDOS.forEach((p) => {
const sel = q.selecciones?.[p.id];
if (sel) estado.selecciones[p.id] = Array.isArray(sel) ? sel : [sel];
actualizarPartido(p.id);
});
actualizarPrecio();
cerrarTodosModales();
notificar("Resultados subidos nuevamente. Escribe otro nombre para guardar esta quiniela.", "info");
}
/* =====================================   Esto de abajo trabaja en mostrar el reglamento                                        ======================= */
function abrirModalReglamento() {
abrirModal("modalReglamento");
}
/* =====================================             Esto de abajo trabaja en cargar los vendedores desde el servidor              ======================= */
async function cargarVendedores() {
try {
const res = await fetch(`${APIBASE}/api/vendedores`);
const data = await res.json();
if (data.success) VENDEDOR_WHATSAPP = data.vendedores;
} catch (err) {
console.error("No se pudieron cargar los vendedores", err);
}
}
/* =====================================             Esto de abajo trabaja con el envio de la quiniela                                         ======================= */
function enviarQuiniela() {
const guardadas = leerStorage();
if (guardadas.length === 0) { tarjetaroja("No tienes quinielas guardadas para enviar."); return; }
const precio = guardadas.length * PRECIO_UNITARIO;
document.getElementById("confirmCantidad").textContent = `${guardadas.length} quiniela${guardadas.length > 1 ? "s" : ""} guardada${guardadas.length > 1 ? "s" : ""}`;
document.getElementById("confirmPrecio").textContent = `$${precio}`;
abrirModal("modalConfirmarEnvio");
}
function cancelarEnvio() {
cerrarModal("modalConfirmarEnvio");
}
async function confirmarEnvioAlServidor() {
const guardadas = leerStorage();
if (guardadas.length === 0) return;
const dispositivoid = localStorage.getItem("quinielasElWero_dispositivoid") || "";
if (!dispositivoid) {
tarjetaroja("No se encontró el dispositivo. Registra de nuevo el celular.");
return;
}
cerrarModal("modalConfirmarEnvio");
const overlay = document.getElementById("overlayEnvio");
const contador = document.getElementById("progresoContador");
overlay.hidden = false;
contador.textContent = `0 de ${guardadas.length}`;
const enviadasOk = [];
try {
for (let i = 0; i < guardadas.length; i++) {
const q = guardadas[i];
const res = await fetch(`${APIBASE}/api/enviarlaquinielaporwhatsapp`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
nombrecelular: nombreCelularActual || q.nombre,
nombrequiniela: q.nombre,
vendedor: q.vendedor || detectarVendedor() || (() => { throw new Error("SIN_VENDEDOR"); })(),
jornada: q.jornada || JORNADA_ACTUAL,
dispositivoid: dispositivoid,
selecciones: q.selecciones
})
});
const data = await res.json();
if (!res.ok || !data.success) {
throw new Error(data.mensaje || "Error al enviar al servidor");
}
enviadasOk.push({
...q,
id: data.id
});
contador.textContent = `${i + 1} de ${guardadas.length}`;
await new Promise(r => setTimeout(r, 350));
}
escribirStorage([]);
guardarEnMisQuinielas(enviadasOk);
actualizarPrecio();
actualizarBadgeGuardadas();
actualizarResumenGuardadas();
overlay.hidden = true;
mostrarModalListo(enviadasOk, precioTotal(enviadasOk));
} catch (err) {
overlay.hidden = true;
if (err.message === "SIN_VENDEDOR") {
tarjetaroja("Verifica tu link para poder añadir quinielas correctamente.");
} else {
tarjetaroja("Hubo un error al enviar tus quinielas. Intenta de nuevo.");
}
console.error(err);
}
}
function precioTotal(arr) {
return arr.length * PRECIO_UNITARIO;
}
function mostrarModalListo(quinielas, precio) {
document.getElementById("listoCantidad").textContent = quinielas.length;
document.getElementById("listoPrecio").textContent = `$${precio}`;
window._quinielasEnviadasParaWhatsApp = quinielas;
window._precioEnviadoParaWhatsApp = precio;
abrirModal("modalEnvioListo");
}
function construirMensajeWhatsApp(quinielas, precio) {
let mensaje = "";
quinielas.forEach((q, idx) => {
mensaje += `*${q.nombre}*\n`;
PARTIDOS.forEach((p, i) => {
const sel = q.selecciones[p.id];
const letra = Array.isArray(sel) ? sel.join("/") : sel || "-";
mensaje += `P${i + 1} ${letra}\n`;
});
if (idx < quinielas.length - 1) mensaje += "\n";
});
mensaje += "\n---------------------------------\n";
mensaje += `Total de quinielas: ${quinielas.length} quiniela${quinielas.length > 1 ? "s" : ""}\n`;
mensaje += `A pagar: $${precio}\n\n`;
mensaje += "En unos momentos te envío el comprobante";
return mensaje;
}
function enviarAWhatsApp() {
const quinielas = window._quinielasEnviadasParaWhatsApp || [];
const precio = window._precioEnviadoParaWhatsApp || 0;
if (quinielas.length === 0) return;
const vendedorNombre = quinielas[0]?.vendedor || detectarVendedor();
if (!vendedorNombre) {
tarjetaroja("Verifica tu link para poder añadir quinielas correctamente.");
return;
}
const numeroVendedor = VENDEDOR_WHATSAPP[vendedorNombre];
if (!numeroVendedor) { tarjetaroja("No se encontró el número del vendedor."); return; }
const mensaje = construirMensajeWhatsApp(quinielas, precio);
const url = `https://wa.me/${numeroVendedor}?text=${encodeURIComponent(mensaje)}`;
window.open(url, "_blank");
cerrarModal("modalEnvioListo");
}
/* =====================================   Esto de abajo trabaja en mostrar las notificaciones                                        ======================= */
function notificar(mensaje, tipo = "info") {
const container = document.getElementById("notifContainer");
if (!container) return;
const tipos = { exito: "rq-notif-exito", error: "rq-notif-error", aviso: "rq-notif-aviso", info: "rq-notif-info" };
const iconos = { exito: "✅", error: "🟥", aviso: "⚠️", info: "ℹ️" };
const el = document.createElement("div");
el.className = `rq-notif ${tipos[tipo] ?? tipos.info}`;
el.setAttribute("role", "status");
el.innerHTML = `<span>${mensaje}</span><span class="rq-notif-icono" aria-hidden="true">${iconos[tipo] ?? "ℹ️"}</span>`;
container.appendChild(el);
setTimeout(() => {
el.classList.add("saliendo");
el.addEventListener("animationend", () => el.remove(), { once: true });
}, 3500);
}
function tarjetaroja(mensaje) {
notificar(mensaje, "error");
}
/* =====================================  Esto de abajo trabaja con las cajitas para poder cerrar y abrirlas junto con la de ayuda  ======================= */
function abrirModal(id) {
const overlay = document.getElementById(id);
if (!overlay) return;
overlay.hidden = false;
overlay.removeAttribute("hidden");
const primerFoco = overlay.querySelector("button, [tabindex]");
primerFoco?.focus();
overlay.addEventListener("click", (e) => {
if (e.target === overlay) cerrarModal(id);
}, { once: true });
}
function cerrarModal(id) {
const overlay = document.getElementById(id);
if (overlay) overlay.hidden = true;
}
function cerrarTodosModales() {
["modalReglamento", "modalGuardadas", "modalConfirmarEnvio", "modalEnvioListo"].forEach(cerrarModal);
}
function marcarErrorNombre() {
const input = document.getElementById("nombreInput");
const errEl = document.getElementById("nombreError");
if (input) {
input.classList.add("error");
input.focus();
}
if (errEl) errEl.textContent = "El nombre es obligatorio.";
setTimeout(() => {
input?.classList.remove("error");
if (errEl) errEl.textContent = "";
}, 3000);
}
function initAyuda() {
const trigger = document.getElementById("ayudaTrigger");
const contenido = document.getElementById("ayudaContenido");
if (!trigger || !contenido) return;
trigger.addEventListener("click", () => {
const abierto = trigger.getAttribute("aria-expanded") === "true";
trigger.setAttribute("aria-expanded", String(!abierto));
contenido.hidden = abierto;
contenido.classList.toggle("open", !abierto);
});
}
document.addEventListener("keydown", (e) => {
if (e.key === "Escape") cerrarTodosModales();
});
/* =====================================  Esto de abajo trabaja con las acciones de los botones  ======================= */
function initBotones() {
document.getElementById("btnGuardar")?.addEventListener("click", guardarQuiniela);
document.getElementById("btnReglamento")?.addEventListener("click", abrirModalReglamento);
document.getElementById("btnBorrar")?.addEventListener("click", borrarQuiniela);
document.getElementById("btnAleatoria")?.addEventListener("click", seleccionAleatoria);
document.getElementById("btnGuardadas")?.addEventListener("click", abrirModalGuardadas);
document.getElementById("btnEnviar")?.addEventListener("click", enviarQuiniela);
document.getElementById("btnCancelarEnvio")?.addEventListener("click", cancelarEnvio);
document.getElementById("btnConfirmarEnvio")?.addEventListener("click", confirmarEnvioAlServidor);
document.getElementById("btnEnviarWhatsApp")?.addEventListener("click", enviarAWhatsApp);
document.querySelectorAll("[data-close]").forEach((btn) => {
btn.addEventListener("click", () => cerrarModal(btn.dataset.close));
});
document.getElementById("nombreInput")?.addEventListener("input", () => {
const input = document.getElementById("nombreInput");
const errEl = document.getElementById("nombreError");
if (input.value.trim()) {
input.classList.remove("error");
if (errEl) errEl.textContent = "";
}
});
}
/* =====================================   Esto de abajo trabaja en inicianizacion de nuestra quiniela                                       ======================= */
document.addEventListener("DOMContentLoaded", async () => {
const vendedor = detectarVendedor();
if (!vendedor) { tarjetaroja("Verifica tu link para poder añadir quinielas correctamente."); }
cargarVendedores();
await cargarJornadaActual();
renderPartidos();
actualizarPrecio();
actualizarBadgeGuardadas();
initAyuda();
initBotones();
});
})();