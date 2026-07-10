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
/* =============                           Esto de abajo trabaja los contadores de Jugando y No jugando                               ============================ */
const StatsQuinielas = {
elPending: document.getElementById("statPending"),
elActive: document.getElementById("statActive"),
init() {
const dataInicial = { pending: 0, active: 0 };
this.actualizar(dataInicial);
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
/* =============                                Esto de abajo trabaja en el inicio del inicio                                            ============================ */
document.addEventListener("DOMContentLoaded", () => {
NavegacionExplora.init();
StatsQuinielas.init();
TimerPremium.init();
});
})();