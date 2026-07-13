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
init() {
if (!this.card) return;
const closeDateAttr = this.card.getAttribute("data-close-date");
this.closeDate = new Date(closeDateAttr).getTime();
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
}},
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
if (this.statusEl) this.statusEl.textContent = "Quiniela Cerrada";
if (this.countdownEl) this.countdownEl.textContent = "00d · 00h · 00m";
if (this.card) {
this.card.classList.remove("urgent");
this.card.classList.add("critical");
}}};
/* =============                                Esto de abajo trabaja en la identidad del cliente                                       ============================ */
const IdentidadCliente = {
API_REGISTRO: "/api/registrodeclientes",
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
mostrarSiEsNecesario() {
if (!this.leerIdentidad()) this.modal.hidden = false;
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
} catch (err) {
this.errEl.hidden = false;
this.errEl.textContent = "No se pudo guardar, intenta de nuevo.";
console.error(err);
}
}
};
/* =============                      Esto de abajo trabaja en la actualizacion del Jornada en varios escritos                  ============================ */
const JornadaHero = {
elementos: document.querySelectorAll("[data-jornada-label]"),
async init() {
if (!this.elementos.length) return;
try {
const res = await fetch("/api/apijornadaactual");
const data = await res.json();
if (res.ok && data.jornadaActual) {
this.elementos.forEach((el) => {
el.textContent = `${data.jornadaActual} - Liga MX`;
});
}
} catch (err) {
console.error("No se pudo actualizar la jornada", err);
}
}
};
/* =============                                Esto de abajo trabaja en eliminar el service worker                               ============================ */
if ('serviceWorker' in navigator) {
navigator.serviceWorker.getRegistrations().then(function(registrations) {
for (let registration of registrations) {
registration.unregister();
}
});
}
/* =============                                Esto de abajo trabaja en el inicio del inicio                                            ============================ */
document.addEventListener("DOMContentLoaded", () => {
DetectorVendedor.init();
NavegacionExplora.init();
StatsQuinielas.init();
TimerPremium.init();
IdentidadCliente.init();
setInterval(() => StatsQuinielas.init(), 15000);
});
})();