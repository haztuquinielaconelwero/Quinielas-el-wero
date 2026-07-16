/* Esto de abajo trabaja en los datos del servidor*/                                           /* Esto de abajo trabaja en los datos del servidor*/   
const API_BASE = "";
const ENV = { isDev: true };
function apiUrl(path, params = {}) {
try {
const url = new URL(path, window.location.origin);
Object.entries(params).forEach(([k, v]) => {
if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
});
return url.toString();
} catch {
return null;
}}
/* Esto de abajo trabaja en los datos del de los partidos */                                        /* Esto de abajo trabaja en los datos del de los partidos */   
let partidos = [];
let jornadaActual = { nombre: "Jornada 1", cierre: null };
let officialResults = {};
function normalizarSrcLogo(src) {
if (!src) return "";
if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/")) {
return src;
}
return `/${src.replace(/^\.?\//, "")}`;
}
async function cargarPartidos() {
try {
const url = apiUrl("api/apijornadaactual");
if (!url) throw new Error("URL inválida para api/apijornadaactual");
const response = await _fetchConTimeout(url, { headers: { Accept: "application/json" } }, 10000);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
if (!Array.isArray(data?.partidos)) {
throw new Error("La respuesta no contiene partidos válidos");
}
jornadaActual = {
nombre: data?.jornada || "Jornada 1",
cierre: data?.cierre || null
};
partidos = data.partidos.map((p) => ({
id: Number(p.id),
local: p.local || "",
localLogo: normalizarSrcLogo(p.localLogo),
visitante: p.visitante || "",
visitanteLogo: normalizarSrcLogo(p.visitanteLogo),
horario: p.horario || "",
televisora: p.televisora || "",
televisionLogo: normalizarSrcLogo(p.televisionLogo || ""),
kickoff: p.kickoff || null,
resultadoFinal: p.resultadoFinal ?? null
}));
officialResults = {};
partidos.forEach((p) => {
if (p.resultadoFinal) {
officialResults[String(p.id)] = p.resultadoFinal;
}
});
} catch (err) {
if (ENV?.isDev) console.error("❌ cargarPartidos:", err);
partidos = [];
jornadaActual = { nombre: "Jornada 1", cierre: null };
officialResults = {};
throw err;
}
}
/* Esto de abajo trabaja en los datos del vendedor para que el navegador sepa quien es*/ /* Esto de abajo trabaja en los datos del vendedor para que el navegador sepa quien es*/ 
function getVendedorAdmin() {
return sessionStorage.getItem("adm_vendedor") || null;
}
/* Esto de abajo trabaja en el gesto para el panel y el panel*/            /* Esto de abajo trabaja en el gesto para el panel y el panel*/ 
const PinAdmin = (() => {
let pinActual = "";
const LONGITUD_PIN = 4;
async function _validarPin() {
const params = new URLSearchParams(window.location.search);
const vendedor = params.get("vendedor") || localStorage.getItem("quinielasElWero_vendedorActual");
if (!vendedor) {
_mostrarError();
pinActual = "";
_actualizarDots();
return;
}
try {
const url = apiUrl("api/validarpin");
const response = await _fetchConTimeout(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ vendedor, pin: pinActual })
}, 10000);
const data = await response.json();
console.log("📩 Respuesta del servidor:", JSON.stringify(data));
if (data.valido) {
sessionStorage.setItem("adm_vendedor", data.vendedor);
_ocultarError();
_mostrarPanel();
} else {
pinActual = "";
_actualizarDots();
_mostrarError();
}
} catch (err) {
pinActual = "";
_actualizarDots();
showToast("Error de conexión al validar PIN", "error");
}
}
const TOQUES_NECESARIOS = 5;
const VENTANA_MS = 3000;
let _contadorToques = 0;
let _temporizadorToques = null;
function init() {
console.log("🔍 PinAdmin.init() ejecutado");
_cerrarSesionSiEsInicio();
_initGestoSecreto();
_initModal();
if (getVendedorAdmin()) {
_mostrarPanel();
}
}
function _initGestoSecreto() {
const trigger = document.getElementById("brandBlockInicio");
console.log("🔍 Buscando #brandBlockInicio:", trigger);
if (!trigger) {
console.error("❌ No se encontró #brandBlockInicio — revisa el id en el HTML");
return;
}
trigger.addEventListener("click", _registrarToque);
console.log("✅ Listener de toques agregado correctamente");
}
function _registrarToque() {
_contadorToques += 1;
console.log(`👆 Toque registrado: ${_contadorToques}/${TOQUES_NECESARIOS}`);
if (_temporizadorToques) clearTimeout(_temporizadorToques);
_temporizadorToques = setTimeout(() => {
console.log("⏱ Ventana de tiempo agotada, contador reiniciado");
_contadorToques = 0;
_ocultarCandado();
}, VENTANA_MS);
_feedbackToque();
_mostrarCandado(_contadorToques);
if (_contadorToques >= TOQUES_NECESARIOS) {
console.log("🔓 5 toques completados, abriendo modal de PIN");
_contadorToques = 0;
clearTimeout(_temporizadorToques);
_ocultarCandado();
abrir();
}
}
function _feedbackToque() {
const trigger = document.getElementById("brandBlockInicio");
if (!trigger) return;
trigger.classList.add("tap-pulso");
setTimeout(() => trigger.classList.remove("tap-pulso"), 150);
}
function _mostrarCandado(cantidad) {
let badge = document.getElementById("tapCandadoBadge");
if (!badge) {
badge = document.createElement("div");
badge.id = "tapCandadoBadge";
badge.className = "tap-candado-badge";
document.body.appendChild(badge);
}
badge.textContent = `🔒 ${cantidad}/${TOQUES_NECESARIOS}`;
badge.classList.add("visible");
}
function _ocultarCandado() {
const badge = document.getElementById("tapCandadoBadge");
if (badge) badge.classList.remove("visible");
}
function _initModal() {
const btnCerrar = document.getElementById("btnCerrarPin");
const overlay = document.getElementById("pinOverlay");
const keypad = document.getElementById("pinKeypad");
console.log("🔍 Overlay del PIN encontrado:", overlay);
if (btnCerrar) btnCerrar.addEventListener("click", cerrar);
if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
if (keypad) keypad.addEventListener("click", _onTecla);
document.addEventListener("keydown", (e) => {
if (!overlay || overlay.hidden) return;
if (e.key === "Escape") cerrar();
if (/^[0-9]$/.test(e.key)) _agregarDigito(e.key);
if (e.key === "Backspace") _borrarDigito();
});
}
function abrir() {
const overlay = document.getElementById("pinOverlay");
console.log("🔍 Intentando abrir overlay:", overlay);
if (!overlay) {
console.error("❌ #pinOverlay no existe en el HTML de esta página");
return;
}
const params = new URLSearchParams(window.location.search);
const vendedorURL = params.get("vendedor");
const vendedorGuardado = localStorage.getItem("quinielasElWero_vendedorActual");
const vendedor = vendedorURL || vendedorGuardado || "Vendedor";
const pinVendorText = document.getElementById("pinVendorText");
if (pinVendorText) pinVendorText.textContent = vendedor;
pinActual = "";
_actualizarDots();
_ocultarError();
overlay.hidden = false;
console.log("✅ overlay.hidden ahora es:", overlay.hidden);
}
function cerrar() {
const overlay = document.getElementById("pinOverlay");
if (overlay) overlay.hidden = true;
}
function _onTecla(e) {
const btn = e.target.closest(".adm-pin-key");
if (!btn || !btn.dataset.key) return;
if (btn.dataset.key === "borrar") return _borrarDigito();
_agregarDigito(btn.dataset.key);
}
function _agregarDigito(digito) {
if (pinActual.length >= LONGITUD_PIN) return;
pinActual += digito;
_actualizarDots();
if (pinActual.length === LONGITUD_PIN) setTimeout(_validarPin, 150);
}
function _borrarDigito() {
pinActual = pinActual.slice(0, -1);
_actualizarDots();
}
function _actualizarDots() {
document.querySelectorAll(".adm-pin-dot").forEach((dot, i) => dot.classList.toggle("lleno", i < pinActual.length));
}
function _mostrarError() {
const errorEl = document.getElementById("pinError");
if (errorEl) errorEl.hidden = false;
document.querySelectorAll(".adm-pin-dot").forEach((dot) => {
dot.classList.add("error-shake");
setTimeout(() => dot.classList.remove("error-shake"), 400);
});
}
function _ocultarError() {
const errorEl = document.getElementById("pinError");
if (errorEl) errorEl.hidden = true;
}
function _mostrarPanel() {
cerrar();
const page = document.getElementById("pageAdmin");
if (!page) {
console.log("↪️ #pageAdmin no está en esta página, redirigiendo a administrador.html");
window.location.href = "administrador.html";
return;
}
const vendorText = document.getElementById("heroVendorText");
page.hidden = false;
if (vendorText) vendorText.textContent = getVendedorAdmin() || "Vendedor";
if (typeof iniciarPanelAdmin === "function") iniciarPanelAdmin();
}
function _cerrarSesionSiEsInicio() {
const esInicio = !!document.getElementById("brandBlockInicio");
if (esInicio && getVendedorAdmin()) {
console.log("🚪 Volviste a inicio.html — cerrando sesión de vendedor");
sessionStorage.removeItem("adm_vendedor");
sessionStorage.removeItem("adm_token");
}
}
return { init, abrir, cerrar };
})();
/* Esto de abajo trabaja en las utilidades de red*/                                            /* Esto de abajo trabaja en las utilidades de red*/    
async function _fetchConTimeout(url, opciones = {}, ms = 10000) {
const controller = new AbortController();
const timerId = setTimeout(() => controller.abort(), ms);
try {
const response = await fetch(url, { ...opciones, signal: controller.signal });
clearTimeout(timerId);
return response;
} catch (err) {
clearTimeout(timerId);
throw err;
}
}
/* Esto de abajo trabaja en las alertas*/                                                                      /* Esto de abajo trabaja en las alertas*/       
function showToast(texto, tipo = "success", ms = 5000) {
const contenedor = document.getElementById("toastContainer");
if (!contenedor) return;
const toast = document.createElement("div");
toast.className = `adm-toast adm-toast--${tipo}`;
toast.innerHTML = String(texto).replace(/\n/g, "<br>");
contenedor.appendChild(toast);
setTimeout(() => toast.remove(), ms);
}
/* Esto de abajo trabaja aceptar las quinielas o rechazar*/                                                    /* Esto de abajo trabaja en las alertas*/       
const QuinielasAdmin = (() => {
const _state = { quinielaId: null, nombre: "", vendedor: "", isSubmitting: false };
let _controller = null;
const FETCH_TIMEOUT = 10000;
function _resetState() {
_state.quinielaId = null;
_state.nombre = "";
_state.vendedor = "";
_state.isSubmitting = false;
}
async function _safeFetch(url, options = {}) {
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
try {
const response = await fetch(url, { ...options, signal: controller.signal });
clearTimeout(timeoutId);
return response;
} catch (err) {
clearTimeout(timeoutId);
throw err;
}
}
async function _safeJson(response) {
try { return await response.json(); }
catch { return { success: false, error: "Respuesta no válida del servidor" }; }
}
function _refrescarTablas() {
Promise.allSettled([
cargarNoJugandoTabla(), cargarJugandoTabla(), cargarEsperaTabla()
]).finally(() => actualizarKPIs());
}
function init() {
if (_controller) destroy();
_controller = new AbortController();
document.addEventListener("click", _handleGlobalClick, { signal: _controller.signal });
}
function _handleGlobalClick(e) {
const btnConfirmar = e.target.closest(".btn-confirmar");
const btnRechazar = e.target.closest(".btn-rechazar");
if (btnConfirmar) {
const row = btnConfirmar.closest(".admin-row");
if (!row) return;
const id = parseInt(row.dataset.id, 10);
if (!Number.isInteger(id) || id <= 0) { showToast("ID de quiniela inválido", "error"); return; }
const nombre = row.dataset.nombre || "";
const vendedor = row.dataset.vendedor || getVendedorAdmin() || "";
_mostrarModalConfirmar(id, nombre, vendedor);
return;
}
if (btnRechazar) {
const row = btnRechazar.closest(".admin-row");
if (!row) return;
const id = parseInt(row.dataset.id, 10);
if (!Number.isInteger(id) || id <= 0) { showToast("ID de quiniela inválido", "error"); return; }
const nombre = row.dataset.nombre || "";
_mostrarModalRechazar(id, nombre);
}}
function _mostrarModalConfirmar(id, nombre, vendedor) {
_cerrarModalRechazar();
_state.quinielaId = id; _state.nombre = nombre; _state.vendedor = vendedor;
const msgEl = document.getElementById("confirmarMessage");
const modalEl = document.getElementById("modalConfirmar");
if (msgEl) msgEl.textContent = `"${nombre}" pasará a estado "jugando"`;
if (modalEl) modalEl.classList.add("show");
}
function _cerrarModalConfirmar() {
const modalEl = document.getElementById("modalConfirmar");
if (modalEl) { modalEl.classList.remove("show"); modalEl.classList.remove("loading"); }
_resetState();
}
function _mostrarModalRechazar(id, nombre) {
_cerrarModalConfirmar();
_state.quinielaId = id; _state.nombre = nombre;
const msgEl = document.getElementById("rechazarMessage");
const modalEl = document.getElementById("modalRechazar");
if (msgEl) msgEl.textContent = `"${nombre}" será eliminada permanentemente`;
if (modalEl) modalEl.classList.add("show");
}
function _cerrarModalRechazar() {
const modalEl = document.getElementById("modalRechazar");
if (modalEl) { modalEl.classList.remove("show"); modalEl.classList.remove("loading"); }
_resetState();
}
async function ejecutarConfirmar() {
if (!_state.quinielaId || _state.isSubmitting) return;
_state.isSubmitting = true;
const { quinielaId: id, nombre, vendedor } = _state;
const modalEl = document.getElementById("modalConfirmar");
if (modalEl) modalEl.classList.add("loading");
try {
const response = await _safeFetch(`${API_BASE}/api/quinielas/${id}/confirmar`, {
method: "PATCH",
headers: { "Content-Type": "application/json" }
});
const result = await _safeJson(response);
_cerrarModalConfirmar();
if (result.success) {
if (result.estado === "espera") {
if (result.motivo === "modo_espera") {
showToast(
"En espera (Limite de tiempo)\nLa quiniela fue enviada a en espera",
"warning"
);
} else if (result.motivo === "sin_folios") {
showToast(
"En espera (Falta de espacios)\nSe alcanzó el límite de espacios disponibles.",
"warning"
);
} else {
showToast("La quiniela quedó en espera", "warning");
}
} else {
const folio = result.quiniela?.folio;
showToast(folio ? `${nombre} — Folio: ${folio} ✅` : `${nombre} ✅`, "success");
}
_refrescarTablas();
} else {
showToast(`Error: ${result.error || "No se pudo confirmar"}`, "error");
}
} catch (err) {
_cerrarModalConfirmar();
const isTimeout = err.name === "AbortError";
if (ENV?.isDev) console.error("❌ ejecutarConfirmar:", err);
showToast(
isTimeout ? `⏱ Tiempo de espera agotado al confirmar "${nombre}"` : "Error de conexión",
"error"
);
}
}
async function ejecutarRechazo() {
if (!_state.quinielaId || _state.isSubmitting) return;
_state.isSubmitting = true;
const { quinielaId: id, nombre } = _state;
const modalEl = document.getElementById("modalRechazar");
if (modalEl) modalEl.classList.add("loading");
try {
const response = await _safeFetch(`${API_BASE}/api/quinielas/${id}/rechazar`, { method: "PATCH" });
const result = await _safeJson(response);
_cerrarModalRechazar();
if (response.ok && result.success) {
showToast(`"${nombre}" rechazada ❌`, "error");
_refrescarTablas();
} else {
showToast(`Error: ${result.error || "No se pudo rechazar"}`, "error");
}
} catch (err) {
_cerrarModalRechazar();
const isTimeout = err.name === "AbortError";
if (ENV?.isDev) console.error("ejecutarRechazo ❌:", err);
showToast(isTimeout ? `⏱ Tiempo de espera agotado al rechazar "${nombre}"` : "Error de conexión", "error");
}
}
function destroy() {
if (_controller) { _controller.abort(); _controller = null; }
_resetState();
}
return Object.freeze({
init, destroy, ejecutarConfirmar, ejecutarRechazo,
cerrarModalConfirmar: _cerrarModalConfirmar,
cerrarModalRechazar: _cerrarModalRechazar
});
})();
function ejecutarConfirmar() { QuinielasAdmin.ejecutarConfirmar(); }
function ejecutarRechazo() { QuinielasAdmin.ejecutarRechazo(); }
function cerrarModalConfirmar() { QuinielasAdmin.cerrarModalConfirmar(); }
function cerrarModalRechazar() { QuinielasAdmin.cerrarModalRechazar(); }
/* Esto de abajo trabaja en la tabla de No Jugando*/                                                   /* Esto de abajo trabaja en la tabla de No Jugando*/        
function _actualizarHeadersMatch(selectorTabla) {
const headerCells = document.querySelectorAll(`${selectorTabla} thead .col-match`);
headerCells.forEach((th) => {
const index = parseInt(th.dataset.matchIndex, 10);
if (!Number.isInteger(index) || index < 1) return;
const partido = partidos?.[index - 1];
if (!partido) return;
th.innerHTML = "";
const wrap = document.createElement("div");
wrap.className = "match-header";
const localImg = document.createElement("img");
localImg.className = "match-logo"; localImg.src = partido.localLogo ?? ""; localImg.alt = partido.local ?? ""; localImg.loading = "lazy";
const vs = document.createElement("span"); vs.className = "match-vs"; vs.textContent = "vs";
const visitImg = document.createElement("img");
visitImg.className = "match-logo"; visitImg.src = partido.visitanteLogo ?? ""; visitImg.alt = partido.visitante ?? ""; visitImg.loading = "lazy";
wrap.append(localImg, vs, visitImg);
th.appendChild(wrap);
});
}
function _renderEstadoTabla(tbody, tipo, texto, numCols) {
tbody.innerHTML = "";
const tr = document.createElement("tr");
const td = document.createElement("td");
td.colSpan = numCols;
td.className = `admin-tabla-estado admin-tabla-estado--${tipo}`;
const inner = document.createElement("div");
inner.className = "admin-tabla-estado-inner";
inner.textContent = texto;
td.appendChild(inner);
tr.appendChild(td);
tbody.appendChild(tr);
}
function _buildFilaNoJugando(q) {
const tr = document.createElement("tr");
tr.className = "admin-row";
tr.dataset.id = String(q.id ?? "");
tr.dataset.nombre = String(q.nombre ?? "");
tr.dataset.vendedor = String(q.vendedor ?? "");
const tdNombre = document.createElement("td");
tdNombre.className = "col-name"; tdNombre.textContent = q.nombre ?? "-";
tr.appendChild(tdNombre);
const picks = Array.isArray(q.picks) ? q.picks : [];
picks.forEach((pick, i) => {
const partidoId = partidos[i]?.id;
const resultado = (officialResults ?? {})[String(partidoId)];
const cls = !resultado ? "pending" : pick === resultado ? "correct" : "incorrect";
const td = document.createElement("td");
td.className = "col-match";
const span = document.createElement("span");
span.className = "result-cell " + cls;
span.textContent = pick ?? "-";
td.appendChild(span);
tr.appendChild(td);
});
const tdAcciones = document.createElement("td");
tdAcciones.className = "col-actions";
const innerAcciones = document.createElement("div");
innerAcciones.className = "col-actions-inner";
const btnConfirmar = document.createElement("button");
btnConfirmar.type = "button"; btnConfirmar.className = "btn-confirmar"; btnConfirmar.textContent = "Confirmar ✅";
const btnRechazar = document.createElement("button");
btnRechazar.type = "button"; btnRechazar.className = "btn-rechazar"; btnRechazar.textContent = "Rechazar ❌";
innerAcciones.append(btnConfirmar, btnRechazar);
tdAcciones.appendChild(innerAcciones);
tr.appendChild(tdAcciones);
return tr;
}
async function cargarNoJugandoTabla() {
const tbody = document.getElementById("nojugandoTableBody");
const countElement = document.getElementById("totalQuinielasCount");
const resumenElement = document.getElementById("pendingCount");
if (!tbody) return;
const numCols = 2 + (Array.isArray(partidos) ? partidos.length : 9);
_renderEstadoTabla(tbody, "cargando", "Cargando por confirmar ⏳...", numCols);
const vendedor = getVendedorAdmin();
if (!vendedor) {
_renderEstadoTabla(tbody, "sin-vendedor", "Vendedor no identificado ⚠️", numCols);
if (countElement) countElement.textContent = "0 En total";
if (resumenElement) resumenElement.textContent = "0";
return;
}
try {
if (!Array.isArray(partidos) || !partidos.length) await cargarPartidos();
_actualizarHeadersMatch("#adminNoJugando .results-table");
const jornada = jornadaActual?.nombre ?? "";
const url = apiUrl("api/nojugando", { vendedor, jornada });
if (!url) throw new Error("URL inválida para api/nojugando");
const response = await _fetchConTimeout(url, { headers: { Accept: "application/json" } }, 10000);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
const lista = data.pendientes ?? [];
if (!lista.length) {
_renderEstadoTabla(tbody, "vacio", "No hay quinielas por confirmar", numCols);
if (countElement) countElement.textContent = "0 En total";
if (resumenElement) resumenElement.textContent = "0";
return;
}
if (countElement) countElement.textContent = `${lista.length} En total`;
if (resumenElement) resumenElement.textContent = String(lista.length);
tbody.innerHTML = "";
const fragment = document.createDocumentFragment();
lista.forEach((q) => fragment.appendChild(_buildFilaNoJugando(q)));
tbody.appendChild(fragment);
} catch (err) {
const esTimeout = err.name === "AbortError";
if (ENV?.isDev) console.error("❌ cargarNoJugandoTabla:", err);
_renderEstadoTabla(tbody, "error", esTimeout ? "Tiempo de espera agotado ⏱" : "Error al cargar datos ", numCols);
if (countElement) countElement.textContent = "0 En total";
if (resumenElement) resumenElement.textContent = "0";
}}
/* Esto de abajo trabaja en la tabla En espera*/                                                   /* Esto de abajo trabaja en la tabla En espera*/      
function _buildFilaEspera(q) {
const tr = document.createElement("tr");
tr.className = "admin-row";
tr.dataset.id = String(q.id ?? "");
tr.dataset.nombre = String(q.nombre ?? "");
tr.dataset.vendedor = String(q.vendedor ?? "");
const tdNombre = document.createElement("td");
tdNombre.className = "col-name"; tdNombre.textContent = q.nombre ?? "-";
tr.appendChild(tdNombre);
const picks = Array.isArray(q.picks) ? q.picks : [];
picks.forEach((pick, i) => {
const partidoId = partidos[i]?.id;
const resultado = (officialResults ?? {})[String(partidoId)];
const cls = !resultado ? "pending" : pick === resultado ? "correct" : "incorrect";
const td = document.createElement("td");
td.className = "col-match";
const span = document.createElement("span");
span.className = "result-cell " + cls;
span.textContent = pick ?? "-";
td.appendChild(span);
tr.appendChild(td);
});
const tdAcciones = document.createElement("td");
tdAcciones.className = "col-actions";
const innerAcciones = document.createElement("div");
innerAcciones.className = "col-actions-inner col-actions-inner--espera";
const badge = document.createElement("span");
badge.className = "admin-espera-badge"; badge.textContent = "Esperando ⏳";
innerAcciones.appendChild(badge);
tdAcciones.appendChild(innerAcciones);
tr.appendChild(tdAcciones);
return tr;
}
async function cargarEsperaTabla() {
const tbody = document.getElementById("esperaTableBody");
const countElement = document.getElementById("esperaCount");
const resumenEspera = document.getElementById("waitingCount");
if (!tbody) return;
const numCols = 2 + (Array.isArray(partidos) ? partidos.length : 9);
_renderEstadoTabla(tbody, "cargando", "Cargando en espera ⏳...", numCols);
const vendedor = getVendedorAdmin();
if (!vendedor) {
_renderEstadoTabla(tbody, "sin-vendedor", "Vendedor no identificado ⚠️", numCols);
if (countElement) countElement.textContent = "0 en espera";
if (resumenEspera) resumenEspera.textContent = "0";
return;
}
try {
if (!Array.isArray(partidos) || !partidos.length) await cargarPartidos();
_actualizarHeadersMatch("#adminEspera .results-table");
const jornada = jornadaActual?.nombre ?? "";
const url = apiUrl("api/espera", { vendedor, jornada });
if (!url) throw new Error("URL inválida para api/espera");
const response = await _fetchConTimeout(url, { headers: { Accept: "application/json" } }, 10000);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
const lista = data.espera ?? [];
if (!lista.length) {
_renderEstadoTabla(tbody, "vacio", "No hay quinielas en espera", numCols);
if (countElement) countElement.textContent = "0 en espera";
if (resumenEspera) resumenEspera.textContent = "0";
return;
}
if (countElement) countElement.textContent = `${lista.length} en espera`;
if (resumenEspera) resumenEspera.textContent = String(lista.length);
tbody.innerHTML = "";
const fragment = document.createDocumentFragment();
lista.forEach((q) => fragment.appendChild(_buildFilaEspera(q)));
tbody.appendChild(fragment);
} catch (err) {
const esTimeout = err.name === "AbortError";
if (ENV?.isDev) console.error("❌ cargarEsperaTabla:", err);
_renderEstadoTabla(tbody, "error", esTimeout ? "Tiempo de espera agotado ⏱" : "Error al cargar datos ", numCols);
if (countElement) countElement.textContent = "0 en espera";
if (resumenEspera) resumenEspera.textContent = "0";
}}
/* Esto de abajo trabaja en la tabla Jugando*/                                                           /* Esto de abajo trabaja en la tabla Jugando*/      
function _buildFilaJugando(q) {
const tr = document.createElement("tr");
tr.className = "admin-row";
tr.dataset.id = String(q.id ?? "");
const tdFolio = document.createElement("td");
tdFolio.className = "col-folio"; tdFolio.textContent = q.folio ?? "-";
const tdNombre = document.createElement("td");
tdNombre.className = "col-name"; tdNombre.textContent = q.nombre ?? "-";
const tdVendedor = document.createElement("td");
tdVendedor.className = "col-vendor"; tdVendedor.textContent = q.vendedor ?? "-";
tr.append(tdFolio, tdNombre, tdVendedor);
const picks = Array.isArray(q.picks) ? q.picks : [];
let puntos = 0;
picks.forEach((pick, i) => {
const partidoId = partidos[i]?.id;
const resultado = (officialResults ?? {})[String(partidoId)];
const acierto = !!resultado && pick === resultado;
if (acierto) puntos += 1;
const cls = !resultado ? "pending" : acierto ? "correct" : "incorrect";
const td = document.createElement("td");
td.className = "col-match";
const span = document.createElement("span");
span.className = "result-cell " + cls;
span.textContent = pick ?? "-";
td.appendChild(span);
tr.appendChild(td);
});
const tdPuntos = document.createElement("td");
tdPuntos.className = "col-points";
const badgePuntos = document.createElement("span");
badgePuntos.className = "puntos-badge";
badgePuntos.textContent = String(q.puntos ?? puntos);
tdPuntos.appendChild(badgePuntos);
tr.appendChild(tdPuntos);
return tr;
}
async function cargarJugandoTabla() {
const tbody = document.getElementById("jugandoTableBody");
const countElement = document.getElementById("jugandoCount");
const resumenJugando = document.getElementById("playingCount");
const totalCount = document.getElementById("totalCount");
if (!tbody) return;
const numCols = 4 + (Array.isArray(partidos) ? partidos.length : 9);
_renderEstadoTabla(tbody, "cargando", "Cargando quinielas en juego ⏳...", numCols);
const vendedor = getVendedorAdmin();
if (!vendedor) {
_renderEstadoTabla(tbody, "sin-vendedor", "Vendedor no identificado ⚠️", numCols);
if (countElement) countElement.textContent = "0 en juego";
if (resumenJugando) resumenJugando.textContent = "0";
return;
}
try {
if (!Array.isArray(partidos) || !partidos.length) await cargarPartidos();
_actualizarHeadersMatch("#adminJugando .results-table");
const jornada = jornadaActual?.nombre ?? "";
const url = apiUrl("api/jugando", { vendedor, jornada });
if (!url) throw new Error("URL inválida para api/jugando");
const response = await _fetchConTimeout(url, { headers: { Accept: "application/json" } }, 10000);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
const lista = (data.jugando ?? []).slice().sort((a, b) => (b.puntos ?? 0) - (a.puntos ?? 0));
if (totalCount) {
const totalSemana = Number(data.totalSemana ?? lista.length);
totalCount.textContent = String(totalSemana);
}
if (!lista.length) {
_renderEstadoTabla(tbody, "vacio", "No hay quinielas jugando todavía", numCols);
if (countElement) countElement.textContent = "0 en juego";
if (resumenJugando) resumenJugando.textContent = "0";
return;
}
if (countElement) countElement.textContent = `${lista.length} en juego`;
if (resumenJugando) resumenJugando.textContent = String(lista.length);
tbody.innerHTML = "";
const fragment = document.createDocumentFragment();
lista.forEach((q) => fragment.appendChild(_buildFilaJugando(q)));
tbody.appendChild(fragment);
} catch (err) {
const esTimeout = err.name === "AbortError";
if (ENV?.isDev) console.error("❌ cargarJugandoTabla:", err);
_renderEstadoTabla(tbody, "error", esTimeout ? "Tiempo de espera agotado ⏱" : "Error al cargar datos ", numCols);
if (countElement) countElement.textContent = "0 en juego";
if (resumenJugando) resumenJugando.textContent = "0";
}}
/* Esto de abajo trabaja en mostrar las tablas correctamente*/                                            /* Esto de abajo trabaja en mostrar las tablas correctamente*/      
function initFiltros() {
const botones = document.querySelectorAll(".filter-btn");
const secciones = {
nojugando: document.getElementById("adminNoJugando"),
espera: document.getElementById("adminEspera"),
jugando: document.getElementById("adminJugando")
};
function mostrarSeccion(clave) {
Object.entries(secciones).forEach(([k, el]) => {
if (el) el.style.display = k === clave ? "" : "none";
});
botones.forEach((b) => b.classList.toggle("active", b.dataset.filter === clave));
}
botones.forEach((btn) => {
btn.addEventListener("click", () => mostrarSeccion(btn.dataset.filter));
});
document.querySelectorAll("[data-filter-target]").forEach((alerta) => {
alerta.addEventListener("click", () => mostrarSeccion(alerta.dataset.filterTarget));
});
}
/* Esto de abajo trabaja en actualizar el nombre de la jornada y el cronómetro*/        /* Esto de abajo trabaja en actualizar el nombre de la jornada y el cronómetro*/ 
function actualizarKPIs() {
const jornadaNombreEl = document.getElementById("jornadaNombre");
if (jornadaNombreEl) jornadaNombreEl.textContent = jornadaActual?.nombre ?? "Jornada 1";
const weekCard = document.getElementById("weekCard");
if (weekCard && jornadaActual?.cierre) {
weekCard.setAttribute("data-close-date", jornadaActual.cierre);
}
TimerPanelAdmin.init();
}  
const TimerPanelAdmin = (() => {
let card = null, barFill = null, progressLabel = null, statusEl = null;
let intervalId = null, totalDurationMs = null, closeDate = null, _iniciado = false;
function init() {
card = document.getElementById("weekCard");
if (!card) return;
barFill = document.getElementById("progressFill");
progressLabel = document.getElementById("progressLabel");
statusEl = document.getElementById("jornadaCierre");
const closeDateAttr = card.getAttribute("data-close-date");
const parsed = new Date(closeDateAttr).getTime();
if (!closeDateAttr || Number.isNaN(parsed)) {
if (statusEl) statusEl.textContent = "Cierre no disponible";
return;
}
closeDate = parsed;
const DIAS_JORNADA = 7;
totalDurationMs = DIAS_JORNADA * 24 * 60 * 60 * 1000;
if (intervalId) clearInterval(intervalId);
tick();
intervalId = setInterval(tick, 1000);
_iniciado = true;
}
function tick() {
const ahora = Date.now();
const restante = closeDate - ahora;
if (restante <= 0) {
cerrarQuiniela();
return;
}
const transcurridoPct = Math.max(0, Math.min(100, 100 - (restante / totalDurationMs) * 100));
actualizarBarra(transcurridoPct);
actualizarTexto(restante);
}
function actualizarBarra(porcentajeTranscurrido) {
if (barFill) barFill.style.setProperty("--progress", porcentajeTranscurrido + "%");
if (progressLabel) progressLabel.textContent = Math.round(porcentajeTranscurrido) + "% completado";
}
function actualizarTexto(restanteMs) {
const totalSegundos = Math.floor(restanteMs / 1000);
const dias = Math.floor(totalSegundos / 86400);
const horas = Math.floor((totalSegundos % 86400) / 3600);
const minutos = Math.floor((totalSegundos % 3600) / 60);
if (statusEl) statusEl.textContent = `Cierra en ${dias}d · ${horas}h · ${minutos}m`;
}
function cerrarQuiniela() {
clearInterval(intervalId);
if (barFill) barFill.style.setProperty("--progress", "100%");
if (progressLabel) progressLabel.textContent = "100% completado";
if (statusEl) statusEl.textContent = "Quiniela Cerrada";
}
return { init };
})();
/* Esto de abajo trabaja en la iniciazion del administrador*/                                     /* Esto de abajo trabaja en la iniciazion del administrador*/      
let _panelIniciado = false;
async function iniciarPanelAdmin() {
if (_panelIniciado) {
cargarNoJugandoTabla(); cargarEsperaTabla(); cargarJugandoTabla();
return;
}
_panelIniciado = true;
initFiltros();
QuinielasAdmin.init();
await cargarPartidos();
await Promise.allSettled([cargarNoJugandoTabla(), cargarEsperaTabla(), cargarJugandoTabla()]);
actualizarKPIs();
}
document.addEventListener("DOMContentLoaded", () => {
PinAdmin.init();
});