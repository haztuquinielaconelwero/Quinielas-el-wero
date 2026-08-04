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
init() {
const params = new URLSearchParams(window.location.search);
const vendedorURL = params.get("vendedor");
if (vendedorURL) {
localStorage.setItem(this.STORAGE_KEY, vendedorURL);
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
if (this.statusEl) this.statusEl.textContent = "Cierre no disponible";
return;
}
this.closeDate = new Date(data.cierre).getTime();
} catch (err) {
console.error("No se pudo obtener el cierre de la jornada", err);
if (this.statusEl) this.statusEl.textContent = "Cierre no disponible";
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
API_VERIFICAR: "/api/verificarcliente",
STORAGE_KEY_IDENTIDAD: "quinielasElWero_identidad",
STORAGE_KEY_DISPOSITIVO: "quinielasElWero_dispositivoid",
modal: document.getElementById("modalBienvenida"),
input: document.getElementById("identidadInput"),
errEl: document.getElementById("identidadError"),
btn: document.getElementById("btnGuardarIdentidad"),
init() {
if (!this.modal) return;
this.btn?.addEventListener("click", () => this.confirmar());
this.input?.addEventListener("keydown", (e) => {
if (e.key === "Enter") { e.preventDefault(); this.confirmar(); }
});
this.input?.addEventListener("input", () => this.capitalizarPrimeraLetra());
this.mostrarSiEsNecesario();
},
capitalizarPrimeraLetra() {
const input = this.input;
const LIMITE_CARACTERES = 35;
let posCursor = input.selectionStart;
let valorOriginal = input.value;
if (valorOriginal.length > LIMITE_CARACTERES) {
valorOriginal = valorOriginal.slice(0, LIMITE_CARACTERES);
posCursor = Math.min(posCursor, LIMITE_CARACTERES);
}
const valorCapitalizado = valorOriginal.replace(/(^\s*\p{L}|(?<=\s)\p{L})/gu, (letra) => letra.toUpperCase());
if (valorCapitalizado !== input.value) {
input.value = valorCapitalizado;
input.setSelectionRange(posCursor, posCursor);
}
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
if (!identidadLocal) {
this.modal.hidden = false;
return;
}
try {
const res = await fetch(`/api/verificarregistro?dispositivoid=${encodeURIComponent(dispositivoId)}`);
const data = await res.json();
if (!res.ok || !data.registrado) {
localStorage.removeItem(this.STORAGE_KEY_IDENTIDAD);
this.modal.hidden = false;
return;
}
this.modal.hidden = true;
} catch (err) {
console.error("No se pudo verificar cliente", err);
this.modal.hidden = true;
}
},
async confirmar() {
const valor = this.input.value.trim();
if (!valor || valor.length < 3) {
this.input.classList.add("error");
this.errEl.hidden = false;
this.errEl.textContent = "Escribe tu nombre por favor.";
this.input.focus();
return;
}
const dispositivoId = this.leerDispositivoId();
try {
const res = await fetch(this.API_REGISTRO, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ dispositivoid: dispositivoId, nombrecelular: valor })
});
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || "Error al registrar");
localStorage.setItem(this.STORAGE_KEY_IDENTIDAD, valor);
this.modal.hidden = true;
VentanitaPush.revisarSiDebePreguntar(dispositivoId);
} catch (err) {
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo guardar, intenta de nuevo.";
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
<p class="push-cuerpo">Te avisaremos cuando un partido finalice, esté por cerrar una jornada o haya información importante.</p>
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
STORAGE_KEY_CODIGO: "quinielasElWero_codigoReferido",
boton: document.getElementById("ruletaFlotante"),
overlay: document.getElementById("ruletaOverlay"),
btnCerrar: document.getElementById("btnCerrarRuleta"),
cuartoNuevo: document.getElementById("ruletaCuartoNuevo"),
cuartoDueno: document.getElementById("ruletaCuartoDueno"),
input: document.getElementById("codigoReferidoInput"),
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
init() {
if (!this.boton || !this.overlay) return;
this.boton.addEventListener("click", () => this.abrir());
this.boton.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.abrir(); }
});
this.btnCerrar?.addEventListener("click", () => this.cerrar());
this.btnConfirmar?.addEventListener("click", () => this.confirmarCodigo());
this.btnGirar?.addEventListener("click", () => this.girar());
this.btnCopiar?.addEventListener("click", () => this.copiarCodigo());
document.getElementById("linkPedirCodigo")?.addEventListener("click", (e) => {
e.preventDefault();
this.irConVendedor();
});
},
leerCodigo() {
return localStorage.getItem(this.STORAGE_KEY_CODIGO) || "";
},
abrir() {
this.overlay.hidden = false;
const codigo = this.leerCodigo();
if (codigo) {
this.mostrarCuartoDueno(codigo);
} else {
this.mostrarCuartoNuevo();
}
},
cerrar() {
this.overlay.hidden = true;
},
mostrarCuartoNuevo() {
this.cuartoNuevo.hidden = false;
this.cuartoDueno.hidden = true;
},
async mostrarCuartoDueno(codigo) {
this.cuartoNuevo.hidden = true;
this.cuartoDueno.hidden = false;
this.nombreEl.textContent = "Mucha suerte 🍀";
const linkCompleto = `https://www.quinielaselwero.com?codigo=${codigo}`;
this.codigoTextoEl.textContent = linkCompleto;
try {
const res = await fetch(`/api/ruletatickets?codigoreferido=${encodeURIComponent(codigo)}`);
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || "No se pudo cargar la ruleta");
this.saldoEl.textContent = data.saldo ?? 0;
this.ticketsEl.textContent = data.tickets ?? 0;
this.quinielasEl.textContent = data.quinielasgratis ?? 0;
this.btnCanjear.hidden = !(data.saldo > 0 || data.quinielasgratis > 0);
} catch (err) {
console.error("Error cargando datos de la ruleta:", err);
}
},
async confirmarCodigo() {
const codigo = this.input.value.trim();
if (!codigo) {
this.errEl.hidden = false;
this.errEl.textContent = "Escribe tu codigo por favor.";
return;
}
try {
const res = await fetch(`/api/validarcodigoreferido?codigo=${encodeURIComponent(codigo)}`);
const data = await res.json();
if (!res.ok || !data.valido) {
this.errEl.hidden = false;
this.errEl.textContent = data.mensaje || "Ese codigo no existe.";
return;
}
this.errEl.hidden = true;
localStorage.setItem(this.STORAGE_KEY_CODIGO, codigo);
this.mostrarCuartoDueno(codigo);
} catch (err) {
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo validar, intenta de nuevo.";
console.error(err);
}
},
async girar() {
const codigo = this.leerCodigo();
if (!codigo) return;
this.btnGirar.disabled = true;
this.btnGirar.textContent = "Girando... 🎰";
const rueda = document.getElementById("ruletaRueda");
const flecha = document.querySelector("#ruletaCuartoDueno .ruleta-flecha-vitrina");
try {
const res = await fetch("/api/ruletagirar", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ codigoreferido: codigo })
});
const data = await res.json();
if (!res.ok || !data.success) {
this.btnGirar.disabled = false;
this.btnGirar.textContent = "Girar";
this.errEl.hidden = false;
this.errEl.textContent = data.mensaje || "No se pudo girar.";
return;
}
const grados = this.calcularGradosParaPremio(data.premio);
if (rueda) {
rueda.classList.add("girando-real");
rueda.style.transition = "transform 5s cubic-bezier(0.1, 0.7, 0.1, 1)";
rueda.style.transform = `rotate(${grados}deg)`;
}
setTimeout(() => {
if (rueda) rueda.classList.add("parando");
if (flecha) flecha.classList.add("rebota");
this.btnGirar.disabled = false;
this.btnGirar.textContent = "Girar";
this.mostrarPremio(data.premio, data.valor);
this.mostrarCuartoDueno(codigo);
setTimeout(() => {
if (rueda) rueda.classList.remove("parando");
if (flecha) flecha.classList.remove("rebota");
}, 600);
}, rueda ? 5200 : 1400);
} catch (err) {
this.btnGirar.disabled = false;
this.btnGirar.textContent = "Girar";
console.error("Error girando la ruleta:", err);
}
},
calcularGradosParaPremio(premio) {
const sectores = {
"quinielagratis": 315,
"20pesos": 225,
"10pesos": 135,
"sigueparticipando": 45,
};
const vueltasCompletas = 5 * 360;
const anguloFinal = sectores[premio] ?? 45;
return vueltasCompletas + anguloFinal;
},
mostrarPremio(premio, valor) {
const mensajes = {
"quinielagratis": "🎁 ¡Ganaste una quiniela gratis!",
"20pesos": "💰 ¡Ganaste $20 pesos!",
"10pesos": "💰 ¡Ganaste $10 pesos!",
"sigueparticipando": "🍀 Sigue participando, la próxima es tuya",
};
const cartel = document.createElement("div");
cartel.className = "ruleta-premio-popup";
cartel.textContent = mensajes[premio] || "🍀 Sigue participando";
document.body.appendChild(cartel);
setTimeout(() => cartel.classList.add("mostrar"), 10);
setTimeout(() => {
cartel.classList.remove("mostrar");
setTimeout(() => cartel.remove(), 400);
}, 3000);
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