/* =============                                                       Esto de abajo trabaja en el script de inicio               ============================ */
(function () {
"use strict";
const NavegacionExplora = {
init() {
const cards = document.querySelectorAll(".card[data-target]");
cards.forEach((card) => {
card.addEventListener("click", () => this.navegar(card));
card.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") {
e.preventDefault();
this.navegar(card);}
});
});
},
navegar(card) {
const target = card.getAttribute("data-target");
if (target) window.location.href = target;
}
};
/* =============                           Esto de abajo trabaja en detectar al Vendedor                             ============================ */
const DetectorVendedor = {
STORAGE_KEY: "quinielasElWero_vendedorActual",
async init() {
const params = new URLSearchParams(window.location.search);
const codigoURL = params.get("codigo");
if (codigoURL) {
try {
const res = await fetch(`/api/validarcodigoreferido?codigo=${encodeURIComponent(codigoURL)}`);
const data = await res.json();
if (res.ok && data.valido && data.vendedor) {
localStorage.setItem(this.STORAGE_KEY, data.vendedor);
}
} catch (err) {
console.error("No se pudo resolver el vendedor del código referido:", err);
}
}
}
};
/* =============                           Esto de abajo trabaja en detectar el Codigo Referido                             ============================ */
const DetectorCodigoReferido = {
STORAGE_KEY: "quinielasElWero_codigoReferido",
init() {
const params = new URLSearchParams(window.location.search);
const codigoURL = params.get("codigo");
if (codigoURL) {
localStorage.setItem(this.STORAGE_KEY, codigoURL.trim());
}
}
};
/* =============                           Esto de abajo trabaja los contadores de Jugando y No jugando                               ============================ */
const StatsQuinielas = {
elPending: document.getElementById("statPending"),
elActive: document.getElementById("statActive"),
async init() {
try {
const dispositivoId = IdentidadCliente.leerDispositivoId();
const res = await fetch(`/api/contadordequinielas?dispositivoid=${encodeURIComponent(dispositivoId)}`);
const data = await res.json();
if (!res.ok || !data.success) {
throw new Error(data.mensaje || "No se pudo cargar el contador");
}
this.actualizar({
pending: data.pending || 0,
active: data.active || 0
});
} catch (err) {
console.error("Error cargando contadores:", err);
this.actualizar({ pending: 0, active: 0 });
}
},
actualizar({ pending, active }) {
if (this.elPending) this.elPending.textContent = pending;
if (this.elActive) this.elActive.textContent = active;
}
};
/* =============                           Esto de abajo trabaja la barra del cierre de quiniela (tiempo restante)                      ============================ */
const TimerPremium = {
card: document.getElementById("timerCard"),
barFill: document.getElementById("timerBarFill"),
countdownEl: document.getElementById("timerCountdown"),
statusEl: document.getElementById("timerStatus"),
intervalId: null,
totalDurationMs: null,
closeDate: null,
async init() {
if (!this.card) return;
try {
const res = await fetch("/api/apijornadaactual");
const data = await res.json();
if (!res.ok || !data.cierre) {
if (this.statusEl) this.statusEl.textContent = "Aún no hay fecha de cierre";
return;
}
this.closeDate = new Date(data.cierre).getTime();
} catch (err) {
console.error("No se pudo obtener el cierre de la jornada", err);
if (this.statusEl) this.statusEl.textContent = "Aún no hay fecha de cierre";
return;
}
const DIAS_JORNADA = 7;
this.totalDurationMs = DIAS_JORNADA * 24 * 60 * 60 * 1000;
this.tick();
this.intervalId = setInterval(() => this.tick(), 1000);
},
tick() {
const ahora = Date.now();
const restante = this.closeDate - ahora;
if (restante <= 0) {
this.cerrarQuiniela();
return;
}
const porcentaje = Math.max(0, Math.min(100, (restante / this.totalDurationMs) * 100));
this.actualizarBarra(porcentaje, restante);
this.actualizarTexto(restante);
this.actualizarEstadoUrgencia(restante);
},
actualizarBarra(porcentaje) {
if (this.barFill) this.barFill.style.width = porcentaje + "%";
let color1, color2;
if (porcentaje >= 75) {
color1 = "#0aa06a"; color2 = "#3ddc84"; 
} else if (porcentaje >= 50) {
color1 = "#8bc34a"; color2 = "#d4e157";
} else if (porcentaje >= 25) {
color1 = "#f4c542"; color2 = "#f4a142"; 
} else if (porcentaje >= 8) {
color1 = "#f4802e"; color2 = "#e64a19"; 
} else {
color1 = "#e53935"; color2 = "#b71c1c";
}
if (this.barFill) {
this.barFill.style.background = `linear-gradient(90deg, ${color1}, ${color2})`;
}
},
actualizarTexto(restanteMs) {
const totalSegundos = Math.floor(restanteMs / 1000);
const dias = Math.floor(totalSegundos / 86400);
const horas = Math.floor((totalSegundos % 86400) / 3600);
const minutos = Math.floor((totalSegundos % 3600) / 60);
if (this.countdownEl) {
this.countdownEl.textContent = `${dias}d · ${horas}h · ${minutos}m`;
}
},
actualizarEstadoUrgencia(restanteMs) {
const unaHora = 60 * 60 * 1000;
const veinticuatroHoras = 24 * unaHora;
if (!this.card) return;
this.card.classList.remove("urgent", "critical");
if (restanteMs <= unaHora) {
this.card.classList.add("critical");
} else if (restanteMs <= veinticuatroHoras) {
this.card.classList.add("urgent");
}
},
cerrarQuiniela() {
clearInterval(this.intervalId);
if (this.barFill) {
this.barFill.style.width = "100%";
this.barFill.style.background = "linear-gradient(90deg, #b71c1c, #e53935)";
}
if (this.statusEl) this.statusEl.textContent = "Quiniela cerrada";
if (this.countdownEl) this.countdownEl.textContent = "00d · 00h · 00m";
if (this.card) {
this.card.classList.remove("urgent");
this.card.classList.add("critical");
}
}
};
/* ============= Esto de abajo trabaja en llevarme de mis quinielas no jugando o jugando a mis quinielas============================ */
const NavegacionStats = {
chipPending: document.querySelector(".stat-chip.stat-pending"),
chipActive: document.querySelector(".stat-chip.stat-active"),
init() {
if (this.chipPending) {
this.chipPending.style.cursor = "pointer";
this.chipPending.addEventListener("click", () => {
window.location.href = "misquinielas.html?estado=nojugando";
});
}
if (this.chipActive) {
this.chipActive.style.cursor = "pointer";
this.chipActive.addEventListener("click", () => {
window.location.href = "misquinielas.html?estado=jugando";
});
}
}
};
/* =============                                Esto de abajo trabaja en la identidad del cliente                                       ============================ */
const IdentidadCliente = {
API_REGISTRO: "/api/registrodeclientes",
STORAGE_KEY_IDENTIDAD: "quinielasElWero_identidad",
STORAGE_KEY_DISPOSITIVO: "quinielasElWero_dispositivoid",
modal: document.getElementById("modalBienvenida"),
input: document.getElementById("identidadInput"),
errEl: document.getElementById("identidadError"),
btn: document.getElementById("btnGuardarIdentidad"),
CARACTER_PERMITIDO: /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]$/,
init() {
if (!this.modal) return;
this.btn?.addEventListener("click", () => this.confirmar());
this.input?.addEventListener("keydown", (e) => {
if (e.key === "Enter") { e.preventDefault(); this.confirmar(); }
this.bloquearTeclaInvalida(e);
});
this.input?.addEventListener("paste", (e) => this.limpiarPegado(e));
this.input?.addEventListener("input", () => this.autoFormatearYValidar());
this.mostrarSiEsNecesario();
},
bloquearTeclaInvalida(e) {
const teclasControl = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Home", "End"];
if (teclasControl.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
if (e.key === " " && this.input.value.endsWith(" ")) {
e.preventDefault();
return;
}
if (!this.CARACTER_PERMITIDO.test(e.key)) {
e.preventDefault();
this.mostrarError("No se permiten números, símbolos ni comillas. Solo letras.");
}
},
limpiarPegado(e) {
e.preventDefault();
const texto = (e.clipboardData || window.clipboardData).getData("text");
const teniaInvalido = /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/.test(texto);
let limpio = texto.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "").replace(/\s{2,}/g, " ");
const input = this.input;
const start = input.selectionStart, end = input.selectionEnd;
input.value = input.value.slice(0, start) + limpio + input.value.slice(end);
input.setSelectionRange(start + limpio.length, start + limpio.length);
if (teniaInvalido) {
this.mostrarError("Se quitaron números, símbolos o comillas del texto pegado.");
}
this.autoFormatearYValidar();
},
autoFormatearYValidar() {
const input = this.input;
const LIMITE_CARACTERES = 35;
let posCursor = input.selectionStart;
let valor = input.value;
if (valor.length > LIMITE_CARACTERES) {
valor = valor.slice(0, LIMITE_CARACTERES);
posCursor = Math.min(posCursor, LIMITE_CARACTERES);
}
const formateado = valor
.split(" ")
.map((palabra) => palabra ? palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase() : palabra)
.join(" ");
if (formateado !== input.value) {
input.value = formateado;
input.setSelectionRange(posCursor, posCursor);
}
this.validarEnVivo();
},
validarEnVivo() {
if (this.input.value.length === 0) {
this.input.classList.remove("error", "valido");
this.errEl.hidden = true;
return;
}
const resultado = this.validarNombre(this.input.value);
if (resultado.valido) {
this.input.classList.remove("error");
this.input.classList.add("valido");
this.errEl.hidden = true;
} else {
this.input.classList.remove("valido");
this.mostrarError(resultado.motivo);
}
},
mostrarError(texto) {
this.input.classList.add("error");
this.errEl.hidden = false;
this.errEl.textContent = texto;
},
validarNombre(valorCrudo) {
const valor = valorCrudo ?? "";
if (valor.length === 0) return { valido: false, motivo: "Escribe tu nombre por favor." };
if (/^\s/.test(valor)) return { valido: false, motivo: "No debe iniciar con espacios." };
if (/\s$/.test(valor)) return { valido: false, motivo: "No debe terminar con espacios." };
if (/\s{2,}/.test(valor)) return { valido: false, motivo: "No se permiten espacios dobles." };
if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/.test(valor)) return { valido: false, motivo: "No se permiten números, símbolos ni comillas. Solo letras." };
const palabras = valor.split(" ");
for (const palabra of palabras) {
if (!/^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]*$/.test(palabra)) {
return { valido: false, motivo: "El nombre solo puede tener letras." };
}
}
if (valor.length < 3) return { valido: false, motivo: "Escribe tu nombre completo." };
return { valido: true, motivo: "" };
},
leerIdentidad() {
return localStorage.getItem(this.STORAGE_KEY_IDENTIDAD) || "";
},
leerDispositivoId() {
let id = localStorage.getItem(this.STORAGE_KEY_DISPOSITIVO);
if (!id) {
id = crypto.randomUUID();
localStorage.setItem(this.STORAGE_KEY_DISPOSITIVO, id);
}
return id;
},
async mostrarSiEsNecesario() {
const dispositivoId = this.leerDispositivoId();
const identidadLocal = this.leerIdentidad();
try {
const res = await fetch(`/api/verificarregistro?dispositivoid=${encodeURIComponent(dispositivoId)}`);
const data = await res.json();
if (data.registrado) {
localStorage.setItem(this.STORAGE_KEY_IDENTIDAD, data.nombrecelular);
this.modal.hidden = true;
} else {
localStorage.removeItem(this.STORAGE_KEY_IDENTIDAD);
this.modal.hidden = false;
}
} catch (err) {
console.error("No se pudo verificar el registro (sin conexión):", err);
this.modal.hidden = !!identidadLocal;
}
},
async confirmar() {
const valor = this.input.value.trim();
const resultado = this.validarNombre(valor);
if (!resultado.valido) {
this.mostrarError(resultado.motivo);
this.input.focus();
return;
}
const telefono = document.getElementById("identidadTelefono")?.value.trim() || "";
if (!/^\d{10}$/.test(telefono)) {
this.errEl.hidden = false;
this.errEl.textContent = "Escribe tu número de celular (10 dígitos).";
return;
}
const dispositivoId = this.leerDispositivoId();
try {
const res = await fetch(this.API_REGISTRO, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ dispositivoid: dispositivoId, nombrecelular: valor, telefono })
});
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || "Error al registrar");
localStorage.setItem(this.STORAGE_KEY_IDENTIDAD, valor);
this.modal.hidden = true;
VentanitaPush.revisarSiDebePreguntar(dispositivoId);
} catch (err) {
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo guardar tu registro, intenta de nuevo.";
console.error(err);
}
}
};
/* ============= Esto de abajo trabaja en preguntar por las notificaciones push ============================ */
const VentanitaPush = {
VAPID_PUBLIC_KEY: "BL8SsOAl_dkr4bdH-OHkuwhUrrW7cccFyynJADVOMGNcgCOei9a5Fk2AscMuD_2LFTn2tfkYdeqmOBnHQtqBmbo",
async revisarSiDebePreguntar(dispositivoId) {
try {
const res = await fetch(`/api/debepreguntarpush?dispositivoid=${encodeURIComponent(dispositivoId)}`);
const data = await res.json();
if (data.debePreguntar) {
this.mostrar(dispositivoId);
}
} catch (err) {
console.error("Error revisando push:", err);
}
},
mostrar(dispositivoId) {
const overlay = document.createElement("div");
overlay.className = "ventanita-push-overlay";
overlay.innerHTML = `
<div class="ventanita-push-caja">
<p class="push-titulo">Déjanos acompañarte en cada jornada. ⚽</p>
<p class="push-cuerpo">"Te avisamos cuando un partido termine o esté por cerrar una jornada."
<button id="btnPushSi">Sí, avísame</button>
<button id="btnPushNo">Ahora no</button>
</div>
`;
document.body.appendChild(overlay);
document.getElementById("btnPushSi").addEventListener("click", async () => {
overlay.remove();
await this.activarNotificaciones(dispositivoId);
this.guardarRespuesta(dispositivoId, "si");
});
document.getElementById("btnPushNo").addEventListener("click", () => {
overlay.remove();
this.guardarRespuesta(dispositivoId, "no");
});
},
async guardarRespuesta(dispositivoId, respuesta) {
try {
await fetch("/api/guardarrespuestapush", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ dispositivoid: dispositivoId, respuesta })
});
} catch (err) {
console.error("Error guardando respuesta push:", err);
}
},
async activarNotificaciones(dispositivoId) {
try {
const permiso = await Notification.requestPermission();
if (permiso !== "granted") return;
const registro = await navigator.serviceWorker.ready;
const suscripcion = await registro.pushManager.subscribe({
userVisibleOnly: true,
applicationServerKey: this.convertirLlave(this.VAPID_PUBLIC_KEY),
});
await fetch("/api/guardarsuscripcion", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
dispositivoid: dispositivoId,
endpoint: suscripcion.endpoint,
p256dh: this.arrayBufferABase64(suscripcion.getKey("p256dh")),
auth: this.arrayBufferABase64(suscripcion.getKey("auth")),
navegador: navigator.userAgent,
}),
});
} catch (err) {
console.error("Error activando notificaciones:", err);
}
},
convertirLlave(llaveBase64) {
const padding = "=".repeat((4 - (llaveBase64.length % 4)) % 4);
const base64 = (llaveBase64 + padding).replace(/-/g, "+").replace(/_/g, "/");
const rawData = window.atob(base64);
const outputArray = new Uint8Array(rawData.length);
for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
return outputArray;
},
arrayBufferABase64(buffer) {
const bytes = new Uint8Array(buffer);
let binario = "";
for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
return window.btoa(binario);
}
};
/* =============                Esto de abajo trabaja en la ruleta flotante de premios                                                    ============================ */
const RuletaFlotante = {
STORAGE_KEY_MI_CODIGO: "quinielasElWero_miCodigoRuleta",
SESSION_KEY_VERIFICADO: "quinielasElWero_ruletaSesionVerificada",
boton: document.getElementById("ruletaFlotante"),
overlay: document.getElementById("ruletaOverlay"),
btnCerrar: document.getElementById("btnCerrarRuleta"),
cuartoNuevo: document.getElementById("ruletaCuartoNuevo"),
cuartoDueno: document.getElementById("ruletaCuartoDueno"),
input: document.getElementById("codigoReferidoInput"),
inputPin: document.getElementById("codigoReferidoPin"),
inputTelefono: document.getElementById("codigoReferidoTelefono"),
errEl: document.getElementById("codigoReferidoError"),
btnConfirmar: document.getElementById("btnConfirmarCodigo"),
nombreEl: document.getElementById("ruletaNombre"),
saldoEl: document.getElementById("ruletaSaldo"),
ticketsEl: document.getElementById("ruletaTicketsNum"),
quinielasEl: document.getElementById("ruletaQuinielasNum"),
btnGirar: document.getElementById("btnGirarRuleta"),
btnCanjear: document.getElementById("btnCanjearPremios"),
codigoTextoEl: document.getElementById("ruletaCodigoTexto"),
btnCopiar: document.getElementById("btnCopiarCodigo"),
btnCerrarSesionRuleta: document.getElementById("btnCerrarSesionRuleta"),
init() {
if (!this.boton || !this.overlay) return;
this.boton.addEventListener("click", () => this.abrir());
this.boton.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.abrir(); }
});
this.btnCerrar?.addEventListener("click", () => this.cerrar());
this.btnConfirmar?.addEventListener("click", () => {
if (this.codigoConfirmado) {
this.confirmarPin();
} else {
this.confirmarCodigo();
}
});
this.btnGirar?.addEventListener("click", () => this.girar());
this.btnCopiar?.addEventListener("click", () => this.copiarCodigo());
this.btnCanjear?.addEventListener("click", () => this.canjear());
this.btnCerrarSesionRuleta?.addEventListener("click", () => this.cerrarSesion());
document.getElementById("linkPedirCodigo")?.addEventListener("click", (e) => {
e.preventDefault();
this.irConVendedor();
});
},
leerSesionVerificada() {
try {
return JSON.parse(sessionStorage.getItem(this.SESSION_KEY_VERIFICADO));
} catch {
return null;
}
},
guardarSesionVerificada(codigo, pin) {
sessionStorage.setItem(this.SESSION_KEY_VERIFICADO, JSON.stringify({ codigo, pin }));
localStorage.setItem(this.STORAGE_KEY_MI_CODIGO, codigo);
},
async irConVendedor() {
const vendedor = localStorage.getItem("quinielasElWero_vendedorActual");
if (!vendedor) {
this.errEl.hidden = false;
this.errEl.textContent = "Entra desde el link de tu vendedor para poder contactarlo. 👀";
return;
}
try {
const res = await fetch(`/api/whatsappdelvendedor?vendedor=${encodeURIComponent(vendedor)}`);
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || "No se encontró el vendedor");
const mensaje = encodeURIComponent("Hola, quiero mi código para la ruleta de premios 🎁");
window.open(`https://wa.me/${data.numero}?text=${mensaje}`, "_blank");
} catch (err) {
console.error("Error obteniendo el WhatsApp del vendedor:", err);
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo contactar al vendedor, intenta de nuevo.";
}
},
async copiarCodigo() {
const texto = this.codigoTextoEl?.textContent?.trim();
if (!texto) return;
try {
if (navigator.clipboard && window.isSecureContext) {
await navigator.clipboard.writeText(texto);
} else {
const temporal = document.createElement("textarea");
temporal.value = texto;
temporal.style.position = "fixed";
temporal.style.opacity = "0";
document.body.appendChild(temporal);
temporal.focus();
temporal.select();
document.execCommand("copy");
temporal.remove();
}
this.mostrarAvisoCopiado();
} catch (err) {
console.error("Error copiando el codigo:", err);
this.mostrarAvisoCopiado("No se pudo copiar, intenta manualmente.");
}
},
mostrarAvisoCopiado(texto = "Copiado al portapapeles ✅") {
const cartel = document.createElement("div");
cartel.className = "ruleta-premio-popup";
cartel.textContent = texto;
document.body.appendChild(cartel);
setTimeout(() => cartel.classList.add("mostrar"), 10);
setTimeout(() => {
cartel.classList.remove("mostrar");
setTimeout(() => cartel.remove(), 400);
}, 2000);
},
abrir() {
this.overlay.hidden = false;
this.boton.style.pointerEvents = "none";
const sesion = this.leerSesionVerificada();
if (sesion?.codigo && sesion?.pin) {
this.mostrarCuartoDueno(sesion.codigo, sesion.pin);
} else {
this.resetearFormularioCodigo();
this.mostrarCuartoNuevo();
}
},
cerrar() {
this.overlay.hidden = true;
this.boton.style.pointerEvents = "";
this.resetearFormularioCodigo();
},
cerrarSesion() {
this.limpiarSesionRuleta();
this.overlay.hidden = true;
this.boton.style.pointerEvents = "";
this.mostrarAvisoCopiado("Sesión cerrada 🔒");
},
limpiarSesionRuleta() {
sessionStorage.removeItem(this.SESSION_KEY_VERIFICADO);
},
resetearFormularioCodigo() {
this.codigoConfirmado = null;
this.esPinNuevo = false;
this.input.hidden = false;
this.input.value = "";
this.input.classList.remove("error");
this.inputPin.hidden = true;
this.inputPin.value = "";
this.inputPin.placeholder = "";
this.inputTelefono.hidden = true;
this.inputTelefono.value = "";
this.errEl.hidden = true;
this.btnConfirmar.textContent = "Continuar";
},
mostrarCuartoNuevo() {
this.cuartoNuevo.hidden = false;
this.cuartoDueno.hidden = true;
},
async mostrarCuartoDueno(codigo, pin) {
this.cuartoNuevo.hidden = true;
this.cuartoDueno.hidden = false;
this.nombreEl.textContent = "Mucha suerte 🍀";
const linkCompleto = `https://www.quinielaselwero.com?codigo=${codigo}`;
this.codigoTextoEl.textContent = linkCompleto;
try {
const res = await fetch(`/api/ruletatickets?codigoreferido=${encodeURIComponent(codigo)}&pin=${encodeURIComponent(pin)}`);
const data = await res.json();
if (!res.ok || !data.success) {
this.cerrarSesion();
this.resetearFormularioCodigo();
this.mostrarCuartoNuevo();
this.errEl.hidden = false;
this.errEl.textContent = data.mensaje || "Tu sesión expiró, vuelve a escribir tu PIN.";
return;
}
this.saldoEl.textContent = data.saldo ?? 0;
this.ticketsEl.textContent = data.tickets ?? 0;
this.quinielasEl.textContent = data.quinielasgratis ?? 0;
this.btnCanjear.hidden = !(data.quinielasgratis > 0);
} catch (err) {
console.error("Error cargando datos de la ruleta:", err);
}
},
codigoConfirmado: null,
esPinNuevo: false,
async confirmarCodigo() {
const codigo = this.input.value.trim();
if (!codigo) {
this.errEl.hidden = false;
this.errEl.textContent = "Escribe tu código, porfa 🙂";
return;
}
try {
const resValidar = await fetch(`/api/validarcodigoreferido?codigo=${encodeURIComponent(codigo)}`);
const dataValidar = await resValidar.json();
if (!resValidar.ok || !dataValidar.valido) {
this.errEl.hidden = false;
this.errEl.textContent = dataValidar.mensaje || "Ese código no existe.";
return;
}
const resTienePin = await fetch(`/api/ruletatienepin?codigo=${encodeURIComponent(codigo)}`);
const dataTienePin = await resTienePin.json();
this.errEl.hidden = true;
this.codigoConfirmado = codigo;
this.esPinNuevo = !dataTienePin.tienepin;
this.input.hidden = true;
this.inputPin.hidden = false;
this.inputPin.value = "";
this.inputPin.focus();
if (this.esPinNuevo) {
this.inputPin.placeholder = "Crea tu PIN (4 dígitos)";
this.inputTelefono.hidden = false;
this.inputTelefono.value = "";
this.btnConfirmar.textContent = "Crear mi PIN";
} else {
this.inputPin.placeholder = "Escribe tu PIN";
this.inputTelefono.hidden = true;
this.btnConfirmar.textContent = "Entrar";
}
} catch (err) {
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo validar, intenta de nuevo.";
console.error(err);
}
},
async confirmarPin() {
const codigo = this.codigoConfirmado;
const pin = this.inputPin.value.trim();
if (!pin || pin.length < 4) {
this.errEl.hidden = false;
this.errEl.textContent = "Escribe un PIN de al menos 4 dígitos.";
 return;
}
let telefono = "";
if (this.esPinNuevo) {
telefono = this.inputTelefono.value.trim();
if (!/^\d{10}$/.test(telefono)) {
this.errEl.hidden = false;
this.errEl.textContent = "Escribe tu número de celular (10 dígitos).";
return;
}
}
const endpoint = this.esPinNuevo ? "/api/ruletacrearpin" : "/api/ruletavalidarpin";
const cuerpo = this.esPinNuevo ? { codigo, pin, telefono } : { codigo, pin };
try {
const res = await fetch(endpoint, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(cuerpo)
});
const data = await res.json();
if (!res.ok || !data.success) {
this.errEl.hidden = false;
this.errEl.textContent = data.mensaje || "PIN incorrecto 🔒";
return;
}
this.errEl.hidden = true;
this.guardarSesionVerificada(codigo, pin);
this.mostrarCuartoDueno(codigo, pin);
} catch (err) {
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo validar, intenta de nuevo.";
console.error(err);
}
},
rotacionAcumulada: 0,
async girar() {
const sesion = this.leerSesionVerificada();
if (!sesion?.codigo || !sesion?.pin) return;
const { codigo, pin } = sesion;
this.btnGirar.disabled = true;
const rueda = document.getElementById("ruletaRueda");
const flecha = document.querySelector("#ruletaCuartoDueno .ruleta-flecha-vitrina");
try {
const res = await fetch("/api/ruletagirar", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ codigoreferido: codigo, pin })
});
const data = await res.json();
if (!res.ok || !data.success) {
this.btnGirar.disabled = false;
this.errEl.hidden = false;
this.errEl.textContent = data.mensaje || "No se pudo girar.";
return;
}
this.btnGirar.textContent = "Girando... 🎰";
const grados = this.calcularGradosParaPremio(data.premio);
if (rueda) {
rueda.classList.add("girando-real");
rueda.style.transition = "transform 15s cubic-bezier(0.08, 0.75, 0.08, 1)";
rueda.style.transform = `rotate(${grados}deg)`;
}
setTimeout(() => {
if (rueda) rueda.classList.add("parando");
if (flecha) flecha.classList.add("rebota");
this.btnGirar.disabled = false;
this.btnGirar.textContent = "Girar";
this.mostrarPremio(data.premio, data.valor);
this.mostrarCuartoDueno(codigo, pin);
setTimeout(() => {
if (rueda) rueda.classList.remove("parando");
if (flecha) flecha.classList.remove("rebota");
}, 600);
}, rueda ? 15200 : 1400);
} catch (err) {
this.btnGirar.disabled = false;
this.btnGirar.textContent = "Girar";
console.error("Error girando la ruleta:", err);
}
},
calcularGradosParaPremio(premio) {
const sectores = {
"quiniela_gratis": 300.6,
"20_pesos": 181.8,
"10_pesos": 61.2,
};
const anguloFinal = sectores[premio] ?? sectores["10_pesos"];
const vueltasExtra = 8 * 360;
const rotacionMinima = this.rotacionAcumulada + vueltasExtra;
const vueltaActualEnGrados = rotacionMinima % 360;
const ajuste = (anguloFinal - vueltaActualEnGrados + 360) % 360;
this.rotacionAcumulada = rotacionMinima + ajuste;
return this.rotacionAcumulada;
},
mostrarPremio(premio, valor) {
const mensajes = {
"quiniela_gratis": "¡Ganaste una quiniela gratis! 🎁",
"20_pesos": "¡Ganaste $20 pesos! 💰",
"10_pesos": "¡Ganaste $10 pesos! 💰",
};
const cartel = document.createElement("div");
cartel.className = "ruleta-premio-popup";
cartel.textContent = mensajes[premio] || "¡Premio registrado! 🎉";
document.body.appendChild(cartel);
setTimeout(() => cartel.classList.add("mostrar"), 10);
setTimeout(() => {
cartel.classList.remove("mostrar");
setTimeout(() => cartel.remove(), 400);
}, 3000);
},
async canjear() {
const sesion = this.leerSesionVerificada();
if (!sesion?.codigo || !sesion?.pin) return;
const { codigo, pin } = sesion;
this.btnCanjear.disabled = true;
try {
const res = await fetch("/api/ruletacanjear", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ codigoreferido: codigo, pin })
});
const data = await res.json();
this.btnCanjear.disabled = false;
if (!res.ok || !data.success) {
this.errEl.hidden = false;
this.errEl.textContent = data.mensaje || "No se pudo canjear.";
return;
}
const mensajeWsp = encodeURIComponent(data.mensaje);
if (data.numero) {
window.open(`https://wa.me/${data.numero}?text=${mensajeWsp}`, "_blank");
} else {
window.open(`https://wa.me/?text=${mensajeWsp}`, "_blank");
}
this.mostrarCuartoDueno(codigo, pin);
} catch (err) {
this.btnCanjear.disabled = false;
console.error("Error canjeando premios:", err);
}
},
};
/* =============                      Esto de abajo trabaja en la actualizacion del Jornada en varios escritos                  ============================ */
const JornadaHero = {
elementosLabel: document.querySelectorAll("[data-jornada-label]"),
linkWsp: document.querySelector("[data-whatsapp-link]"),
async init() {
if (!this.elementosLabel.length && !this.linkWsp) return; 
try {
const res = await fetch("/api/apijornadaactual");
const data = await res.json();
if (!res.ok || !data.jornadaActual) return;
if (this.elementosLabel.length) {
this.elementosLabel.forEach(el => {
el.textContent = data.jornadaActual + " - Liga MX";
});
}
if (this.linkWsp && data.whatsappUrl) {
this.linkWsp.href = data.whatsappUrl;
const label = this.linkWsp.querySelector("[data-whatsapp-label]");
if (label) label.textContent = "Únete al grupo de la " + data.jornadaActual + " - Liga MX";
}
} catch (err) {
console.error("No se pudo actualizar la jornada", err);
}
}
};
JornadaHero.init();
/* =============                       Esto de abajo trabaja en registrar           (Service Worker)                ============================ */
if ('serviceWorker' in navigator) {
navigator.serviceWorker.register('/sw.js').then((registro) => {
console.log("SW registrado correctamente:", registro.scope);
}).catch((error) => {
console.error("Error registrando el SW:", error);
});
}
/* =============                                Esto de abajo trabaja en el inicio del inicio                                            ============================ */
document.addEventListener("DOMContentLoaded", () => {
DetectorVendedor.init();
DetectorCodigoReferido.init();
NavegacionExplora.init();
StatsQuinielas.init();
TimerPremium.init();
IdentidadCliente.init();
JornadaHero.init();
NavegacionStats.init();  
RuletaFlotante.init();      
setInterval(() => StatsQuinielas.init(), 15000);
});
})();