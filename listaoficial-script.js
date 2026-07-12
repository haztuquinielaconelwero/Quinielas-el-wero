/* =====================================  Esto de abajo trabaja en generar las tarjetas de la quiniela                             ======================= */
(function () {
"use strict";
const API_BASE = window.location.hostname === "localhost"
? "http://localhost:8000"
: "";
const JORNADA_ACTUAL = "Jornada 1";
const PARTIDOS = [
{ id: 1, local: "Necaxa",    localLogo: "logos/necaxa.png",    visitante: "Atlante",   visitanteLogo: "logos/atlante.png",   resultadoFinal: null },
{ id: 2, local: "Tijuana",   localLogo: "logos/tijuana.png",   visitante: "Tigres",    visitanteLogo: "logos/tigres.png",    resultadoFinal: null },
{ id: 3, local: "San Luis",  localLogo: "logos/san-luis.png",  visitante: "Cruz Azul", visitanteLogo: "logos/cruz-azul.png", resultadoFinal: null },
{ id: 4, local: "León",      localLogo: "logos/leon.png",      visitante: "Atlas",     visitanteLogo: "logos/atlas.png",     resultadoFinal: null },
{ id: 5, local: "FC Juárez", localLogo: "logos/juarez.png",    visitante: "Puebla",    visitanteLogo: "logos/puebla.png",    resultadoFinal: null },
{ id: 6, local: "Pumas",     localLogo: "logos/pumas.png",     visitante: "Santos",    visitanteLogo: "logos/santos.png",    resultadoFinal: null },
{ id: 7, local: "Chivas",    localLogo: "logos/chivas.png",    visitante: "Pachuca",   visitanteLogo: "logos/pachuca.png",   resultadoFinal: null },
{ id: 8, local: "Monterrey", localLogo: "logos/monterrey.png", visitante: "Toluca",    visitanteLogo: "logos/toluca.png",    resultadoFinal: null },
{ id: 9, local: "Querétaro", localLogo: "logos/queretaro.png", visitante: "América",   visitanteLogo: "logos/america.png",   resultadoFinal: null }
];
/* =====================================  Esto de abajo trabaja en generar lista real de participantes desde la api                 ======================= */
let PARTICIPANTES = [];
/* =====================================  Esto de abajo trabaja en el filtro para buscar 1 , 2 lugar etc.                         ======================= */
const estado = {
busqueda: "",
filtroActivo: "todos"
};
/* =====================================  Esto de abajo trabaja en convertir picks de la api al formato de la tabla                ======================= */
function normalizarParticipante(q) {
const picks = Array.isArray(q?.picks) ? q.picks : [];
const selecciones = {};
PARTIDOS.forEach((partido, idx) => {
selecciones[partido.id] = picks[idx] || "";
});
return {
folio: q?.folio ?? "",
nombre: q?.nombre ?? "",
vendedor: q?.vendedor ?? "—",
selecciones,
puntos: Number(q?.puntos ?? 0)
};
}
/* =====================================  Esto de abajo trabaja en cargar participantes reales desde la api                        ======================= */
async function cargarParticipantes() {
try {
const jornadaParam = encodeURIComponent(JORNADA_ACTUAL);
const res = await fetch(`${API_BASE}/api/laapidelalistaoficial?jornada=${jornadaParam}`);
if (!res.ok) throw new Error("No se pudo cargar la Lista Oficial");
const data = await res.json();
PARTICIPANTES = Array.isArray(data?.quinielas)
? data.quinielas.map(normalizarParticipante)
: [];
renderFiltros();
renderTabla();
} catch (err) {
console.error("Lista Oficial:", err);
PARTICIPANTES = [];
renderFiltros();
renderTabla();
}
}
/* =====================================  Esto de abajo trabaja en el encabezado de la tabla  y su contenido                       ======================= */
function renderEncabezado() {
const fila = document.getElementById("filaEncabezado");
if (!fila) return;
const thPuntos = fila.querySelector(".lo-th-puntos");
if (!thPuntos || fila.querySelector(".lo-th-partido")) return;
const columnasPartidos = PARTIDOS.map((p) => `
<th class="lo-th lo-th-partido" scope="col" aria-label="${p.local} vs ${p.visitante}">
<span class="lo-th-logo-vs">
<img src="${p.localLogo}" alt="${p.local}" class="lo-th-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;">
<span class="lo-th-vs">VS</span>
<img src="${p.visitanteLogo}" alt="${p.visitante}" class="lo-th-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;">
</span>
</th>
`).join("");
thPuntos.insertAdjacentHTML("beforebegin", columnasPartidos);
}
function renderChipResultado(letra, partidoFinalizado) {
if (!letra) return `<span class="lo-chip-resultado lo-chip-vacio">—</span>`;
if (!partidoFinalizado) {
return `<span class="lo-chip-resultado lo-chip-pendiente">${letra}</span>`;
}
return `<span class="lo-chip-resultado lo-chip-${letra}">${letra}</span>`;
}
function renderFilaParticipante(p, esPrimerLugar) {
const celdasPartidos = PARTIDOS.map((partido) => {
const letra = p.selecciones?.[partido.id] || "";
const finalizado = !!partido.resultadoFinal;
return `<td class="lo-td lo-td-partido">${renderChipResultado(letra, finalizado)}</td>`;
}).join("");
return `
<tr class="${esPrimerLugar ? "lo-primer-lugar" : ""} lo-fila-resaltada" data-nombre="${String(p.nombre || "").toLowerCase()}" data-puntos="${p.puntos ?? 0}">
<td class="lo-td lo-td-folio">${p.folio}</td>
<td class="lo-td lo-td-nombre" title="${p.nombre}">${p.nombre}</td>
<td class="lo-td lo-td-vendedor">${p.vendedor || "—"}</td>
${celdasPartidos}
<td class="lo-td lo-td-puntos">
<span class="lo-puntos-badge">${p.puntos ?? 0}</span>
</td>
</tr>
`;
}
/* =====================================  Esto de abajo trabaja en ordenar por puntos la lista y en el filtro                      ======================= */
function ordenarPorPuntos(lista) {
return [...lista].sort((a, b) => {
const puntosA = Number(a?.puntos ?? 0);
const puntosB = Number(b?.puntos ?? 0);
if (puntosB !== puntosA) return puntosB - puntosA;
return String(a?.folio ?? "").localeCompare(String(b?.folio ?? ""), "es", { numeric: true });
});
}
function obtenerPuntosUnicos() {
return [...new Set(PARTICIPANTES.map((p) => Number(p?.puntos ?? 0)))].sort((a, b) => b - a);
}
function obtenerListaVisible() {
const ordenados = ordenarPorPuntos(PARTICIPANTES);
const puntosUnicos = obtenerPuntosUnicos();
const puntosMinimo = puntosUnicos.length ? puntosUnicos[puntosUnicos.length - 1] : 0;
let lista = ordenados;
if (estado.busqueda.trim()) {
const q = estado.busqueda.trim().toLowerCase();
lista = lista.filter((p) => String(p.nombre || "").toLowerCase().includes(q));
}
if (estado.filtroActivo === "primero") {
lista = lista.filter((p) => p.puntos === puntosUnicos[0]);
} else if (estado.filtroActivo === "segundo") {
lista = lista.filter((p) => p.puntos === puntosUnicos[1]);
} else if (estado.filtroActivo.startsWith("puntos-")) {
const valor = Number(estado.filtroActivo.split("-")[1]);
lista = lista.filter((p) => p.puntos === valor);
} else if (estado.filtroActivo === "ultimos") {
lista = lista.filter((p) => p.puntos === puntosMinimo);
}
return lista;
}
/* =====================================  Esto de abajo trabaja en la tabla                                                         ======================= */
function renderTabla() {
const cuerpo = document.getElementById("cuerpoTabla");
const wrap = document.getElementById("tablaWrap");
const vacio = document.getElementById("mensajeVacio");
const vacioTexto = document.getElementById("mensajeVacioTexto");
if (!cuerpo || !wrap || !vacio || !vacioTexto) return;
if (!PARTICIPANTES.length) {
cuerpo.innerHTML = "";
wrap.hidden = true;
vacio.hidden = false;
vacioTexto.textContent = "Aún no hay quinielas en la Lista Oficial.";
return;
}
const visibles = obtenerListaVisible();
const ordenadosTotal = ordenarPorPuntos(PARTICIPANTES);
const puntosMax = ordenadosTotal[0]?.puntos ?? 0;
if (!visibles.length) {
cuerpo.innerHTML = "";
wrap.hidden = true;
vacio.hidden = false;
vacioTexto.textContent = "No se encontraron participantes con esos criterios.";
return;
}
wrap.hidden = false;
vacio.hidden = true;
cuerpo.innerHTML = visibles
.map((p) => renderFilaParticipante(p, p.puntos === puntosMax && puntosMax > 0))
.join("");
}
/* =====================================  Esto de abajo trabaja en el buscandor en vivo                                             ======================= */
function initBuscador() {
const input = document.getElementById("inputBuscador");
if (!input) return;
input.addEventListener("input", () => {
estado.busqueda = input.value;
renderTabla();
});
}
/* =====================================  Esto de abajo trabaja en mostrar la informacion del panel                                 ======================= */
function construirOpcionesFiltro() {
const ordenados = ordenarPorPuntos(PARTICIPANTES);
const puntosUnicos = obtenerPuntosUnicos();
const puntosMinimo = puntosUnicos.length ? puntosUnicos[puntosUnicos.length - 1] : 0;
const puntosPrimero = puntosUnicos[0];
const puntosSegundo = puntosUnicos.length > 1 ? puntosUnicos[1] : undefined;
const opciones = [];
opciones.push({
valor: "todos",
etiqueta: "Todos",
contador: PARTICIPANTES.length
});
if (puntosUnicos.length > 0) {
opciones.push({
valor: "primero",
etiqueta: "🥇 1 Lugar",
contador: ordenados.filter((p) => p.puntos === puntosPrimero).length
});
}
if (puntosSegundo !== undefined) {
opciones.push({
valor: "segundo",
etiqueta: "🥈 2 Lugar",
contador: ordenados.filter((p) => p.puntos === puntosSegundo).length
});
}
puntosUnicos
.filter((pts) => pts !== puntosPrimero && pts !== puntosSegundo && pts !== puntosMinimo)
.forEach((pts) => {
opciones.push({
valor: `puntos-${pts}`,
etiqueta: `Puntos ${pts}`,
contador: ordenados.filter((p) => p.puntos === pts).length
});
});
if (puntosUnicos.length > 0 && puntosMinimo !== puntosPrimero && puntosMinimo !== puntosSegundo) {
opciones.push({
valor: "ultimos",
etiqueta: "Últimos Lugares",
contador: ordenados.filter((p) => p.puntos === puntosMinimo).length
});
}
return opciones;
}
function renderFiltros() {
const contenedor = document.getElementById("listaFiltrosOficial");
if (!contenedor) return;
const opciones = construirOpcionesFiltro();
contenedor.innerHTML = opciones.map((op) => `
<button
type="button"
class="lo-filtro-chip ${estado.filtroActivo === op.valor ? "activo" : ""}"
data-filtro="${op.valor}"
role="radio"
aria-checked="${estado.filtroActivo === op.valor}">
<span>${op.etiqueta}</span>
<span class="lo-filtro-chip-contador">${op.contador}</span>
</button>
`).join("");
contenedor.querySelectorAll(".lo-filtro-chip").forEach((btn) => {
btn.addEventListener("click", () => {
estado.filtroActivo = btn.dataset.filtro;
renderFiltros();
renderTabla();
cerrarPanelFiltro();
});
});
}
/* =====================================  Esto de abajo trabaja en mostrar la informacion del panel             ======================= */
let elOverlayFiltro, elBtnAbrirFiltro;
function abrirPanelFiltro() {
if (!elOverlayFiltro) return;
elOverlayFiltro.hidden = false;
elBtnAbrirFiltro.classList.add("activo");
elBtnAbrirFiltro.setAttribute("aria-expanded", "true");
}
function cerrarPanelFiltro() {
if (!elOverlayFiltro) return;
elOverlayFiltro.hidden = true;
elBtnAbrirFiltro.classList.toggle("activo", estado.filtroActivo !== "todos");
elBtnAbrirFiltro.setAttribute("aria-expanded", "false");
}
function initPanelFiltro() {
elOverlayFiltro = document.getElementById("filtroOficialOverlay");
elBtnAbrirFiltro = document.getElementById("btnFiltroOficial");
const btnCerrar = document.getElementById("btnCerrarFiltroOficial");
if (!elOverlayFiltro || !elBtnAbrirFiltro || !btnCerrar) return;
elBtnAbrirFiltro.addEventListener("click", abrirPanelFiltro);
btnCerrar.addEventListener("click", cerrarPanelFiltro);
elOverlayFiltro.addEventListener("click", (e) => {
if (e.target === elOverlayFiltro) cerrarPanelFiltro();
});
document.addEventListener("keydown", (e) => {
if (e.key === "Escape" && !elOverlayFiltro.hidden) cerrarPanelFiltro();
});
}
/* =====================================  Esto de abajo trabaja en inicianizacion de nuestra quiniela                              ======================= */
document.addEventListener("DOMContentLoaded", async () => {
renderEncabezado();
renderFiltros();
renderTabla();
initBuscador();
initPanelFiltro();
await cargarParticipantes();
});
})();