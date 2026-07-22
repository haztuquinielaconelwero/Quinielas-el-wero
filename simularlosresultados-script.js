/* Esto de abajo trabaja en la quiniela para el simuladorderesultados*/                     /* Esto de abajo trabaja en la quiniela para el simuladorderesultados*/
(function () {
"use strict";
const API_BASE = window.location.hostname === "localhost"
? "http://localhost:8000"
: "";
let JORNADA_ACTUAL = "";
let PARTIDOS = [];
let PARTICIPANTES = [];
/* Esto de abajo trabaja en el estado para el simuladorderesultados */          /* Esto de abajo trabaja en el estado para el simuladorderesultados */
const estado = {
simulacion: {},
busqueda: "",
filtroActivo: "todos"
};
function normalizarSrcLogo(src) {
if (!src) return "";
if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
return src;
}
return `/${src.replace(/^\.?\//, "")}`;
}
function normalizarParticipanteSim(q) {
const picks = Array.isArray(q?.picks) ? q.picks : [];
const selecciones = {};
PARTIDOS.forEach((partido, idx) => {
selecciones[partido.id] = picks[idx] || "";
});
return {
id: q?.id ?? null,
folio: q?.folio ?? "",
nombre: q?.nombre ?? "",
vendedor: q?.vendedor ?? "—",
selecciones
};
}
async function cargarDatosSimulador() {
try {
const resJornada = await fetch(`${API_BASE}/api/apijornadaactual`);
const dataJornada = await resJornada.json();
if (!resJornada.ok || !dataJornada?.partidos || !Array.isArray(dataJornada.partidos)) {
throw new Error("No se pudo cargar la jornada oficial");
}
JORNADA_ACTUAL = dataJornada.jornadaActual || "";
PARTIDOS = dataJornada.partidos.map((p) => ({
id: Number(p.id),
local: p.local,
localLogo: normalizarSrcLogo(p.localLogo),
visitante: p.visitante,
visitanteLogo: normalizarSrcLogo(p.visitanteLogo)
}));
const jornadaParam = encodeURIComponent(JORNADA_ACTUAL);
const resLista = await fetch(`${API_BASE}/api/laapidelalistaoficial?jornada=${jornadaParam}`);
const dataLista = await resLista.json();
if (!resLista.ok) {
throw new Error("No se pudo cargar la Lista Oficial");
}
PARTICIPANTES = Array.isArray(dataLista?.quinielas)
? dataLista.quinielas.map(normalizarParticipanteSim)
: [];
PARTICIPANTES.sort((a, b) => {
const fa = parseInt(a.folio, 10);
const fb = parseInt(b.folio, 10);
if (isNaN(fa) && isNaN(fb)) return 0;
if (isNaN(fa)) return 1;
if (isNaN(fb)) return -1;
return fa - fb;
});
return true;
} catch (err) {
console.error("Simulador:", err);
JORNADA_ACTUAL = "";
PARTIDOS = [];
PARTICIPANTES = [];
return false;
}
}
/* Esto de abajo trabaja en la quiniela para el simuladorderesultados */          /* Esto de abajo trabaja en la quiniela para el simuladorderesultados */
function renderPartidos() {
const grid = document.getElementById("listaPartidosSim");
if (!grid) return;
grid.innerHTML = PARTIDOS.map((p, i) => {
const sel = estado.simulacion[p.id];
return `
<article class="rq-partido${sel ? " completo" : ""}" id="partido-sim-${p.id}" role="listitem" aria-label="Partido ${p.local} vs ${p.visitante}" style="animation-delay:${i * 0.05}s">
<div class="rq-partido-equipos">
<button class="rq-opcion${sel === "L" ? " seleccionado" : ""}" data-partido="${p.id}" data-tipo="L" aria-pressed="${sel === "L"}" aria-label="Local (L)">L</button>
<div class="rq-equipo-local-logo"><img src="${p.localLogo}" alt="${p.local}" class="rq-equipo-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;"></div>
<span class="rq-equipo-nombre rq-equipo-local-nombre">${p.local}</span>
<button class="rq-opcion${sel === "E" ? " seleccionado" : ""}" data-partido="${p.id}" data-tipo="E" aria-pressed="${sel === "E"}" aria-label="Empate (E)">E</button>
<span class="rq-equipo-nombre rq-equipo-visitante-nombre">${p.visitante}</span>
<div class="rq-equipo-visitante-logo"><img src="${p.visitanteLogo}" alt="${p.visitante}" class="rq-equipo-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;"></div>
<button class="rq-opcion${sel === "V" ? " seleccionado" : ""}" data-partido="${p.id}" data-tipo="V" aria-pressed="${sel === "V"}" aria-label="Visitante (V)">V</button>
</div>
</article>
`;
}).join("");
grid.querySelectorAll(".rq-opcion").forEach((btn) => {
btn.addEventListener("click", manejarSeleccion);
});
}
/*                      Esto de abajo trabaja en seleccion de L E V y el Overlay de carga para el simuladorderesultados                                        */
function manejarSeleccion(e) {
const btn = e.currentTarget;
const partidoId = Number(btn.dataset.partido);
const tipo = btn.dataset.tipo;
estado.simulacion[partidoId] = tipo;
renderPartidos();
mostrarOverlaySimulando();
const duracion = 600 + Math.floor(Math.random() * 300);
setTimeout(() => {
recalcularYRenderizarTodo();
ocultarOverlaySimulando();
}, duracion);
}
function mostrarOverlaySimulando() {
const overlay = document.getElementById("srOverlaySimulando");
if (overlay) overlay.hidden = false;
}
function ocultarOverlaySimulando() {
const overlay = document.getElementById("srOverlaySimulando");
if (overlay) overlay.hidden = true;
}
/*   Calculo de puntos para el simuladorderesultados              */                             /*   Calculo de puntos para el simuladorderesultados              */
function calcularPuntos(participante) {
let puntos = 0;
PARTIDOS.forEach((p) => {
const simulado = estado.simulacion[p.id];
const elegido = participante.selecciones?.[p.id];
if (simulado && elegido && simulado === elegido) puntos += 1;
});
return puntos;
}
function obtenerParticipantesConPuntos() {
return PARTICIPANTES.map((p) => ({ ...p, puntos: calcularPuntos(p) }));
}
function ordenarPorPuntos(lista) {
return [...lista].sort((a, b) => (b.puntos ?? 0) - (a.puntos ?? 0));
}
function obtenerPuntosUnicos(lista) {
return [...new Set(lista.map((p) => p.puntos ?? 0))].sort((a, b) => b - a);
}
function actualizarContador(id, valor) {
const el = document.getElementById(id);
if (!el) return;
el.textContent = valor;
el.classList.remove("sr-pulse");
requestAnimationFrame(() => el.classList.add("sr-pulse"));
}
/*Esto de abajo trabaja en la lista de participantes para el simuladorderesultados*/ /*Esto de abajo trabaja en la lista de participantes para el simuladorderesultados*/
function renderEncabezado() {
const fila = document.getElementById("filaEncabezadoSim");
if (!fila) return;
fila.querySelectorAll(".lo-th-partido").forEach((el) => el.remove());
const thPuntos = fila.querySelector(".lo-th-puntos");
if (!thPuntos) return;
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
function renderChipResultado(letra, simulado) {
if (!letra) return `<span class="result-cell pending">—</span>`;
if (!simulado) {
return `<span class="result-cell pending">${letra}</span>`;
}
const acierto = letra === simulado;
return `<span class="result-cell ${acierto ? "correct" : "incorrect"}">${letra}</span>`;
}
function renderFilaParticipante(p, esPrimerLugar) {
const celdasPartidos = PARTIDOS.map((partido) => {
const letra = p.selecciones?.[partido.id] || "";
const simulado = estado.simulacion[partido.id];
return `<td class="lo-td lo-td-partido">${renderChipResultado(letra, simulado)}</td>`;
}).join("");
return `
<tr class="${esPrimerLugar ? "lo-primer-lugar" : ""} lo-fila-resaltada" data-nombre="${p.nombre.toLowerCase()}" data-puntos="${p.puntos ?? 0}">
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
function obtenerListaVisible() {
const conPuntos = obtenerParticipantesConPuntos();
const ordenados = ordenarPorPuntos(conPuntos);
const puntosUnicos = obtenerPuntosUnicos(conPuntos);
const puntosMinimo = puntosUnicos.length ? puntosUnicos[puntosUnicos.length - 1] : 0;
let lista = ordenados;
if (estado.busqueda.trim()) {
const q = estado.busqueda.trim().toLowerCase();
lista = lista.filter((p) => p.nombre.toLowerCase().includes(q));
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
function renderTabla() {
const cuerpo = document.getElementById("cuerpoTablaSim");
const wrap = document.getElementById("tablaWrapSim");
const vacio = document.getElementById("mensajeVacioSim");
const vacioTexto = document.getElementById("mensajeVacioTextoSim");
if (!cuerpo || !wrap || !vacio || !vacioTexto) return;
wrap.hidden = PARTIDOS.length === 0;
if (!PARTICIPANTES.length) {
cuerpo.innerHTML = "";
vacio.hidden = false;
vacioTexto.textContent = "Aún no hay quinielas registradas.";
return;
}
const visibles = obtenerListaVisible();
const ordenadosTotal = ordenarPorPuntos(obtenerParticipantesConPuntos());
const puntosMax = ordenadosTotal[0]?.puntos ?? 0;
if (!visibles.length) {
cuerpo.innerHTML = "";
vacio.hidden = false;
vacioTexto.textContent = "No se encontraron participantes con esos criterios.";
return;
}
vacio.hidden = true;
cuerpo.innerHTML = visibles
.map((p) => renderFilaParticipante(p, p.puntos === puntosMax && puntosMax > 0))
.join("");
}
/*Esto de abajo trabaja en el buscador en vivo para el simuladorderesultados*/ /*Esto de abajo trabaja en el buscador en vivo para el simuladorderesultados*/
function initBuscador() {
const input = document.getElementById("inputBuscadorSim");
if (!input) return;
input.addEventListener("input", () => {
estado.busqueda = input.value;
renderTabla();
});
}
/*Esto de abajo trabaja en el Filtro para el simuladorderesultados*/ /*Esto de abajo trabaja en el Filtro para el simuladorderesultados*/
function construirOpcionesFiltro() {
const conPuntos = obtenerParticipantesConPuntos();
const ordenados = ordenarPorPuntos(conPuntos);
const puntosUnicos = obtenerPuntosUnicos(conPuntos);
const puntosMinimo = puntosUnicos.length ? puntosUnicos[puntosUnicos.length - 1] : 0;
const puntosPrimero = puntosUnicos[0];
const puntosSegundo = puntosUnicos.length > 1 ? puntosUnicos[1] : undefined;
const opciones = [{ valor: "todos", etiqueta: "Todos", contador: PARTICIPANTES.length }];
if (puntosUnicos.length > 0) {
opciones.push({ valor: "primero", etiqueta: "🥇 1 Lugar", contador: ordenados.filter((p) => p.puntos === puntosPrimero).length });
}
if (puntosSegundo !== undefined) {
opciones.push({ valor: "segundo", etiqueta: "🥈 2 Lugar", contador: ordenados.filter((p) => p.puntos === puntosSegundo).length });
}
puntosUnicos
.filter((pts) => pts !== puntosPrimero && pts !== puntosSegundo && pts !== puntosMinimo)
.forEach((pts) => {
opciones.push({ valor: `puntos-${pts}`, etiqueta: `Puntos ${pts}`, contador: ordenados.filter((p) => p.puntos === pts).length });
});
if (puntosUnicos.length > 0 && puntosMinimo !== puntosPrimero && puntosMinimo !== puntosSegundo) {
opciones.push({ valor: "ultimos", etiqueta: "Últimos Lugares", contador: ordenados.filter((p) => p.puntos === puntosMinimo).length });
}
return opciones;
}
function renderFiltros() {
const contenedor = document.getElementById("listaFiltrosSim");
if (!contenedor) return;
const opciones = construirOpcionesFiltro();
contenedor.innerHTML = opciones.map((op) => `
<button type="button" class="lo-filtro-chip ${estado.filtroActivo === op.valor ? "activo" : ""}" data-filtro="${op.valor}" role="radio" aria-checked="${estado.filtroActivo === op.valor}">
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
elOverlayFiltro = document.getElementById("filtroSimOverlay");
elBtnAbrirFiltro = document.getElementById("btnFiltroSim");
const btnCerrar = document.getElementById("btnCerrarFiltroSim");
if (!elOverlayFiltro || !elBtnAbrirFiltro || !btnCerrar) return;
elBtnAbrirFiltro.addEventListener("click", abrirPanelFiltro);
btnCerrar.addEventListener("click", cerrarPanelFiltro);
elOverlayFiltro.addEventListener("click", (e) => { if (e.target === elOverlayFiltro) cerrarPanelFiltro(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !elOverlayFiltro.hidden) cerrarPanelFiltro(); });
}
/*                                  Esto de abajo trabaja en el boton de reiniciar pronosticos para el simuladorderesultados                                      */
function inicializarBotonReiniciar() {
const btn = document.getElementById("btnReiniciarSim");
if (!btn) return;
btn.addEventListener("click", () => {
estado.simulacion = {};
btn.classList.add("sr-girando");
setTimeout(() => btn.classList.remove("sr-girando"), 650);
renderPartidos();
mostrarOverlaySimulando();
setTimeout(() => {
recalcularYRenderizarTodo();
ocultarOverlaySimulando();
mostrarNotificacion("Pronósticos reiniciados correctamente.");
}, 650);
});
}
/*                                  Esto de abajo trabaja en las notificaciones para el simuladorderesultados                                      */
function mostrarNotificacion(texto) {
const contenedor = document.getElementById("notifContainer");
if (!contenedor) return;
const notif = document.createElement("div");
notif.className = "sr-notif";
notif.textContent = texto;
contenedor.appendChild(notif);
setTimeout(() => notif.remove(), 3200);
}
/*                                  Esto de abajo trabaja en acciones globales  para el simuladorderesultados y como funciona                                     */
function recalcularYRenderizarTodo() {
const conPuntos = obtenerParticipantesConPuntos();
const puntosUnicos = obtenerPuntosUnicos(conPuntos);
const puntosPrimero = puntosUnicos[0];
const puntosSegundo = puntosUnicos.length > 1 ? puntosUnicos[1] : undefined;
const totalPrimerLugar = puntosPrimero !== undefined
? conPuntos.filter((p) => p.puntos === puntosPrimero).length
: 0;
const totalSegundoLugar = puntosSegundo !== undefined
? conPuntos.filter((p) => p.puntos === puntosSegundo).length
: 0;
actualizarContador("statPrimerLugar", totalPrimerLugar);
actualizarContador("statSegundoLugar", totalSegundoLugar);
actualizarContador("statTotalQuinielas", PARTICIPANTES.length);
renderFiltros();
renderTabla();
}
/* =============                                 Esto de abajo trabaja en el inicio de simularlosresultados                        ============================ */
document.addEventListener("DOMContentLoaded", async () => {
const ok = await cargarDatosSimulador();
renderPartidos();
renderEncabezado();
recalcularYRenderizarTodo();
initBuscador();
initPanelFiltro();
inicializarBotonReiniciar();
if (!ok) {
console.warn("No se pudieron cargar los datos reales del simulador.");
}
});
})();