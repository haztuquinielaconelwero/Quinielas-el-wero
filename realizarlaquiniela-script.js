/* =====================================  Esto de abajo trabaja en generar los partidos de la quiniela                                          ======================= */
(function () {
"use strict";
const PARTIDOS = [
{ id: 1, local: "Necaxa",     localLogo: "logos/necaxa.png",     visitante: "Atlante",   visitanteLogo: "logos/atlante.png" },
{ id: 2, local: "Tijuana",    localLogo: "logos/tijuana.png",    visitante: "Tigres",    visitanteLogo: "logos/tigres.png" },
{ id: 3, local: "San Luis",   localLogo: "logos/san-luis.png",   visitante: "Cruz Azul", visitanteLogo: "logos/cruz-azul.png" },
{ id: 4, local: "León",       localLogo: "logos/leon.png",       visitante: "Atlas",     visitanteLogo: "logos/atlas.png" },
{ id: 5, local: "FC Juárez",  localLogo: "logos/juarez.png",     visitante: "Puebla",    visitanteLogo: "logos/puebla.png" },
{ id: 6, local: "Pumas",      localLogo: "logos/pumas.png",      visitante: "Santos",    visitanteLogo: "logos/santos.png" },
{ id: 7, local: "Chivas",     localLogo: "logos/chivas.png",     visitante: "Pachuca",   visitanteLogo: "logos/pachuca.png" },
{ id: 8, local: "Monterrey",  localLogo: "logos/monterrey.png",  visitante: "Toluca",    visitanteLogo: "logos/toluca.png" },
{ id: 9, local: "Querétaro",  localLogo: "logos/queretaro.png",  visitante: "América",   visitanteLogo: "logos/america.png" }
];
/* =====================================  Esto de abajo trabaja en donde encontrar las quinielas , precio y maximo de dobles y triples         ======================= */
const STORAGE_KEY = "quinielasElWero_guardadas";
const OPCIONES = ["L", "E", "V"];
const PRECIO_UNITARIO = 30;
const MAX_DOBLES = 3;
const MAX_TRIPLES = 3;
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
const combos = generarCombinaciones(estado.selecciones);
if (existeAlgunDuplicado(nombre, "El Wero", combos)) {
tarjetaroja("Ya añadiste una quiniela con el mismo nombre y resultados, tu quiniela no fue guardada.");
return;
}
const quinielas = leerStorage();
const base = Date.now();
combos.forEach((combo, idx) => {
quinielas.push({
id: base + idx,
nombre,
vendedor: "El Wero",
jornada: "Jornada 1",
firma: firmaBoleto(nombre, "El Wero", combo),
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
function renderTarjetaGuardada(q) {
const miniPartidos = PARTIDOS.map((p) => {
const sel = q.selecciones?.[p.id];
const letras = Array.isArray(sel) ? sel : sel ? [sel] : [];
const marcador = letras.length ? letras.join("") : "—";
const claseMarcador = letras.length === 3 ? "triple" : letras.length === 2 ? "doble" : "";
return `
<div class="rq-mini-partido">
<img src="${p.localLogo}" alt="${p.local}" class="rq-mini-logo" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null;">
<span class="rq-mini-equipo local">${p.local}</span>
<span class="rq-mini-marcador ${claseMarcador}">${marcador}</span>
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
<span class="rq-tg-vendedor">Vendedor: ${q.vendedor || "El Wero"}</span>
</div>
<div class="rq-tg-mini-quiniela">${miniPartidos}</div>
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
/* =====================================             Esto de abajo trabaja con el envio de la quiniela                                         ======================= */
const STORAGE_KEY_ENVIADAS = "quinielasElWero_enviadas";
function leerEnviadas() {
try { return JSON.parse(localStorage.getItem(STORAGE_KEY_ENVIADAS)) ?? []; }
catch { return []; }
}
function escribirEnviadas(arr) {
localStorage.setItem(STORAGE_KEY_ENVIADAS, JSON.stringify(arr));
}
function enviarQuiniela() {
const guardadas = leerStorage();
if (guardadas.length === 0) {
tarjetaroja("No tienes quinielas guardadas para enviar.");
return;
}
const overlay = document.getElementById("overlayEnvio");
overlay.hidden = false;
setTimeout(() => {
overlay.hidden = true;
const enviadas = leerEnviadas();
guardadas.forEach((q) => {
enviadas.push({
id: Date.now() + Math.floor(Math.random() * 1000),
nombre: q.nombre,
vendedor: q.vendedor || "El Wero",
jornada: q.jornada || "Jornada 1",
selecciones: { ...q.selecciones },
estado: "no-jugando",
puntos: 0
});
});
escribirEnviadas(enviadas);
escribirStorage([]);
actualizarPrecio();           
actualizarBadgeGuardadas();    
actualizarResumenGuardadas();  
cerrarTodosModales();
notificar(`¡${guardadas.length} quiniela(s) enviada(s) con éxito! Mucha suerte.`, "exito");
}, 2200);
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
el.innerHTML = `<span class="rq-notif-icono" aria-hidden="true">${iconos[tipo] ?? "ℹ️"}</span><span>${mensaje}</span>`;
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
["modalReglamento", "modalGuardadas"].forEach(cerrarModal);
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
document.addEventListener("DOMContentLoaded", () => {
renderPartidos();
actualizarPrecio();
actualizarBadgeGuardadas();
initAyuda();
initBotones();
});
})();