/* =====================================  Esto de abajo trabaja en generar las tarjetas de la quiniela                                    ======================= */
(function () {
"use strict";
let PARTIDOS = [];
async function cargarPartidosOficiales() {
try {
const res = await fetch("/api/apijornadaactual");
const data = await res.json();
if (!res.ok || !data?.partidos || !Array.isArray(data.partidos)) {
return false;
}
PARTIDOS = data.partidos.map((p) => ({
id: Number(p.id),
local: p.local,
localLogo: normalizarSrcLogo(p.localLogo),
visitante: p.visitante,
visitanteLogo: normalizarSrcLogo(p.visitanteLogo)
}));
return true;
} catch (err) {
console.error("Error en cargarPartidosOficiales:", err);
return false;
}
}
function normalizarSrcLogo(src) {
if (!src) return "";
if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
return src;
}
return `/${src.replace(/^\.?\//, "")}`;
}
/* =====================================  Esto de abajo trabaja en el almacenimiento de las quinielas en el celular                  ======================= */
const STORAGE_KEY_ENVIADAS = "quinielasElWero_enviadas";
const STORAGE_KEY_DISPOSITIVO = "quinielasElWero_dispositivoid";
function leerEnviadas() {
try {
return JSON.parse(localStorage.getItem(STORAGE_KEY_ENVIADAS)) ?? [];
} catch {
return [];
}
}
function guardarEnviadas(lista) {
localStorage.setItem(STORAGE_KEY_ENVIADAS, JSON.stringify(lista));
}
function leerDispositivoId() {
return localStorage.getItem(STORAGE_KEY_DISPOSITIVO) || "";
}
const MAPA_ESTADO_BACKEND = {
"No jugando": "no-jugando",
"Jugando": "jugando",
"En espera": "espera",
"Rechazada": "rechazada"
};
async function sincronizarConBackend() {
const dispositivoId = leerDispositivoId();
if (!dispositivoId) return;
try {
const res = await fetch(`/api/actualizarmisquinielas?dispositivoid=${encodeURIComponent(dispositivoId)}`);
const data = await res.json();
if (!res.ok || !data.success) return;
const enviadas = leerEnviadas();
let cambio = false;
const actualizadas = enviadas.map((q) => {
const remota = data.quinielas.find((r) => r.llavemaestra === q.llavemaestra);
if (!remota) return q;
const estadoNuevo = MAPA_ESTADO_BACKEND[remota.estado] ?? q.estado;
if (estadoNuevo !== q.estado || remota.folio !== q.folio) cambio = true;
return { ...q, id: remota.id, estado: estadoNuevo, folio: remota.folio ?? q.folio ?? null };
});
if (cambio) {
guardarEnviadas(actualizadas);
renderLista();
}
} catch (err) {
console.error("Error en sincronizarConBackend:", err);
}
}
/* =====================================  Esto de abajo trabaja en ordenar las quinielas para mostrarlas correctamente                     ======================= */
const ORDEN_ESTADO = { jugando: 0, "no-jugando": 1, "rechazada": 1, espera: 2 };
function ordenarQuinielas(lista) {
return [...lista].sort((a, b) => {
const estadoA = ORDEN_ESTADO[a.estado] ?? 2;
const estadoB = ORDEN_ESTADO[b.estado] ?? 2;
if (estadoA !== estadoB) return estadoA - estadoB;
return (b.puntos ?? 0) - (a.puntos ?? 0);
});
}
/* =====================================  Esto de abajo trabaja en el filtro en la estructura para mostrar correctamente            ======================= */
let filtroActivo = "todas";
function aplicarFiltro(lista) {
switch (filtroActivo) {
case "jugando":
return lista.filter((q) => q.estado === "jugando");
case "no-jugando":
return lista.filter((q) => q.estado === "no-jugando" || q.estado === "rechazada");
case "espera":
return lista.filter((q) => q.estado === "espera");
case "mayor-puntos":
return [...lista].sort((a, b) => (b.puntos ?? 0) - (a.puntos ?? 0));
case "menor-puntos":
return [...lista].sort((a, b) => (a.puntos ?? 0) - (b.puntos ?? 0));
default:
return lista;
}
}
/* =====================================  Esto de abajo trabaja en los estados de la quiniela y lo que muestra                 ======================= */    
const ESTADO_INFO = {
jugando: { clase: "mq-estado-jugando", texto: "Jugando ✅" },
"no-jugando": { clase: "mq-estado-no-jugando", texto: "No jugando ❌" },
espera: { clase: "mq-estado-espera", texto: "En espera ⏳" },
rechazada: { clase: "mq-estado-no-jugando", texto: "Rechazada ❌" }
};
function renderMiniQuiniela(q) {
if (!Array.isArray(PARTIDOS) || PARTIDOS.length === 0) {
return `
<div class="mq-empty-msg">
<span class="mq-empty-icon">📋</span>
<span>No se pudieron cargar los partidos de la jornada.</span>
</div>
`;
}
return PARTIDOS.map((p) => {
const sel = q.selecciones?.[p.id];
const letras = Array.isArray(sel) ? sel : sel ? [sel] : [];
const mult = q.multiplicador?.[p.id] || "S";
const chips = letras.length
? letras.map((l) => `<span class="mq-mini-chip mq-mini-chip-neutro">${l}</span>`).join("")
: `<span class="mq-mini-chip mq-mini-chip-vacio">—</span>`;
const multTag = mult !== "S" ? `<span class="mq-mini-mult">${mult}</span>` : "";
return `
<div class="mq-mini-partido">
<div class="mq-mini-lado">
<img src="${normalizarSrcLogo(p.localLogo)}" alt="${p.local}" class="mq-mini-logo" loading="lazy" onerror="this.style.visibility='hidden'">
<span class="mq-mini-equipo">${p.local}</span>
</div>
<span class="mq-mini-chips">${chips}${multTag}</span>
<div class="mq-mini-lado">
<span class="mq-mini-equipo visitante">${p.visitante}</span>
<img src="${normalizarSrcLogo(p.visitanteLogo)}" alt="${p.visitante}" class="mq-mini-logo" loading="lazy" onerror="this.style.visibility='hidden'">
</div>
</div>
`;
}).join("");
}
function renderTarjeta(q) {
const info = ESTADO_INFO[q.estado] ?? ESTADO_INFO.espera;
const folioTexto = q.folio
? `<span class="mq-tarjeta-meta mq-tarjeta-folio">Folio: ${q.folio}</span>`
: "";
return `
<article class="mq-tarjeta ${q.estado || 'espera'}" role="listitem" data-id="${q.id}">
<div class="mq-tarjeta-header">
<div class="mq-tarjeta-info">
<span class="mq-tarjeta-nombre">${q.nombre}</span>
<span class="mq-tarjeta-meta">Vendedor: ${q.vendedor} - ${q.jornada || "Jornada 1"}</span>
${folioTexto}
</div>
<span class="mq-estado-badge ${info.clase}">${info.texto}</span>
</div>
<div class="mq-mini-quiniela">${renderMiniQuiniela(q)}</div>
<div class="mq-puntos">Puntos ⚽ : ${q.puntos ?? 0}</div>
</article>
`;
}
/* =====================================  Esto de abajo trabaja en mostrar las quinielas en mis quinielas                ======================= */    
function renderLista() {
const contenedor = document.getElementById("listaMisQuinielas");
if (!contenedor) return;
const enviadas = leerEnviadas();
if (enviadas.length === 0) {
contenedor.innerHTML = `
<div class="mq-empty-msg">
<span class="mq-empty-icon">📭</span>
<span>Aún no has enviado ninguna quiniela.</span>
</div>
`;
return;
}
const filtradas = aplicarFiltro(enviadas);
const ordenadas = ["mayor-puntos", "menor-puntos"].includes(filtroActivo)
? filtradas
: ordenarQuinielas(filtradas);
contenedor.innerHTML = ordenadas.length
? ordenadas.map(renderTarjeta).join("")
: `
<div class="mq-empty-msg">
<span class="mq-empty-icon">🔍</span>
<span>No hay quinielas con este filtro.</span>
</div>
`;
}
/* =====================================  Esto de abajo trabaja para que el filtro jale correctamente                           ======================= */
function abrirFiltro() {
const overlay = document.getElementById("filtroOverlay");
const btn = document.getElementById("btnFiltro");
if (!overlay) return;
overlay.hidden = false;
btn?.setAttribute("aria-expanded", "true");
btn?.classList.add("activo");
}
function cerrarFiltro() {
const overlay = document.getElementById("filtroOverlay");
const btn = document.getElementById("btnFiltro");
if (!overlay) return;
overlay.hidden = true;
btn?.setAttribute("aria-expanded", "false");
btn?.classList.remove("activo");
}
function initFiltro() {
document.getElementById("btnFiltro")?.addEventListener("click", abrirFiltro);
document.getElementById("btnCerrarFiltro")?.addEventListener("click", cerrarFiltro);
document.getElementById("filtroOverlay")?.addEventListener("click", (e) => {
if (e.target.id === "filtroOverlay") cerrarFiltro();
});
document.querySelectorAll(".mq-filtro-chip").forEach((chip) => {
chip.addEventListener("click", () => {
filtroActivo = chip.dataset.filtro;
document.querySelectorAll(".mq-filtro-chip").forEach((c) => {
c.classList.toggle("activo", c === chip);
c.setAttribute("aria-checked", String(c === chip));
});
renderLista();
cerrarFiltro();
});
});
document.addEventListener("keydown", (e) => {
if (e.key === "Escape") cerrarFiltro();
});
}
/* =====================================  Esto de abajo para la sincronizacion por si el cliente tiene varias pestañas abiertas              ======================= */
function initSincronizacion() {
window.addEventListener("storage", (e) => {
if (e.key === STORAGE_KEY_ENVIADAS) renderLista();
});
}
/* =============                                Esto de abajo trabaja en el inicio del mis quinielas                                    ============================ */
document.addEventListener("DOMContentLoaded", async () => {
await cargarPartidosOficiales();
renderLista();
initFiltro();
initSincronizacion();
sincronizarConBackend();
setInterval(sincronizarConBackend, 15000);
});
})();