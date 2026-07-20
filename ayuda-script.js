/* =====================================  Esto de abajo trabaja en generar las cuentas del banco y la inicializacion                  ======================= */
(function () {
"use strict";
const BANCOS = [
{
id: "banorte",
nombre: "Banorte",
emoji: "🔴",
claseColor: "banorte",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "bbva",
nombre: "BBVA",
emoji: "🔵",
claseColor: "bbva",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "azteca",
nombre: "Banco Azteca",
emoji: "🟢",
claseColor: "azteca",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "spin",
nombre: "Spin by Oxxo",
emoji: "🟣",
claseColor: "spin",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "nu",
nombre: "Nu",
emoji: "🟣",
claseColor: "nu",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "mercadopago",
nombre: "Mercado Pago",
emoji: "🔵",
claseColor: "mercadopago",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "bancoppel",
nombre: "BanCoppel",
emoji: "🔵",
claseColor: "bancoppel",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "hsbc",
nombre: "HSBC",
emoji: "🔴",
claseColor: "hsbc",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
},
{
id: "santander",
nombre: "Santander",
emoji: "🔴",
claseColor: "santander",
tarjeta: "XXXX XXXX XXXX XXXX",
cuenta: "XXXXXXXXXX",
clabe: "XXXXXXXXXXXXXXXXXX"
}
];
/* =====================================  Esto de abajo trabaja en generar las tarejtas de preguntas frecuentes         ======================= */
const FAQS = [
{ pregunta: "¿Cómo te llamas?", respuesta: "Irving Emilio Gonzalez Romero." },
{ pregunta: "¿Dónde se ubican?", respuesta: "Cadereyta Jiménez." },
{ pregunta: "¿Cuánto es el premio?", respuesta: "El premio se publica poco antes del primer partido." },
{ pregunta: "¿Qué pasa si salen varios ganadores?", respuesta: "El premio se reparte entre las personas que obtuvieron la mayor cantidad de puntos." },
{ pregunta: "¿A qué hora cierra la quiniela?", respuesta: "Semana a semana se postula diferente horario tras finalizar la quiniela anterior." },
{ pregunta: "¿Cómo es el método de pago cuando resulto ganador?", respuesta: "Se te pide alguna tarjeta de tu pertenencia para depositarte." },
{ pregunta: "¿Cuándo se publica la lista oficial de participantes?", respuesta: "Poco antes del primer partido." },
{ pregunta: "¿Cuánto vale la quiniela?", respuesta: "$30 pesos." }
];
/* =====================================  Esto de abajo trabaja en generar el numero de whats app y acciones        ======================= */
const WHATSAPP_CONFIG = {
numero: "528281011650",
mensajeGeneral: "Hola, tengo una duda ❓ ",
};
function construirLinkWhatsapp(mensaje) {
const texto = encodeURIComponent(mensaje);
return `https://wa.me/${WHATSAPP_CONFIG.numero}?text=${texto}`;
}
/* ===================================== Esto de abajo trabaja en generar las tarjetas de banco ======================= */
const VENDEDOR_CUENTAS = {
/* ======================================================================================================================================================== */
"Patty": [
{ banco: "Bancomer", titular: "Patty", numero: "4152 3146 3467 6319" },
{ banco: "Bancomer", titular: "Patty", numero: "4152 3146 3467 7309" },
{ banco: "Bancomer", titular: "Patty", numero: "4152 3140 7229 3171" },
{ banco: "Banorte",  titular: "Patty", numero: "4189 1432 1647 2863" },
{ banco: "Spin by Oxxo", titular: "Patty", numero: "4217 4700 9325 7828" },
{ banco: "Banco Azteca", titular: "Patty", numero: "4198 2101 4171 8824" },
{ banco: "Scotiabank", titular: "Patty", numero: "4043 1300 0616 9680" }
],
/* ======================================================================================================================================================== */
"•": [
{ banco: "Banorte", titular: "Irving Emilio Gonzalez Romero", numero: "4189 1430 7518 4476" },
{ banco: "Bancomer", titular: "Irving Emilio Gonzalez Romero", numero: "4152 3137 2949 5908" },
{ banco: "Bancomer", titular: "Irving Emilio Gonzalez Romero", numero: "4152 3137 2949 5916" },
{ banco: "Spin by Oxxo", titular: "Irving Emilio Gonzalez Romero", numero: "4217 4700 8441 1996" },
{ banco: "Spin by Oxxo", titular: "Irving Emilio Gonzalez Romero", numero: "4217 4700 0587 8323" },
{ banco: "Spin by Oxxo", titular: "Irving Emilio Gonzalez Romero", numero: "4217 4700 8443 4659" }
],
/* ======================================================================================================================================================== */



/* ======================================================================================================================================================== */
};
const COLOR_POR_BANCO = {
"Banorte": "banorte",
"Bancomer": "bbva",
"BBVA": "bbva",
"Banco Azteca": "azteca",
"Spin by Oxxo": "spin",
"Nu": "nu",
"Mercado Pago": "mercadopago",
"Bancoppel": "bancoppel",
"HSBC": "hsbc",
"Santander": "santander",
"Scotiabank": "santander"
};
function obtenerVendedorDeURL() {
const params = new URLSearchParams(window.location.search);
const vendedorURL = params.get("vendedor");
if (vendedorURL) return vendedorURL;
return localStorage.getItem("quinielasElWero_vendedorActual") || null;
}
function normalizarNombreVendedor(nombre) {
return (nombre || "").replace(/\s+/g, "").toLowerCase();
}
function renderBancos() {
const contenedor = document.getElementById("ayudaBancos");
if (!contenedor) return;
const nombreURL = obtenerVendedorDeURL();
const claveEncontrada = Object.keys(VENDEDOR_CUENTAS).find((k) => normalizarNombreVendedor(k) === normalizarNombreVendedor(nombreURL));
const cuentas = VENDEDOR_CUENTAS[claveEncontrada];
if (!cuentas || cuentas.length === 0) {
contenedor.innerHTML = `
<div class="ay-deposit-tip">
<p>Actualmente no tienes una cuenta bancaria habilitada.</p>
</div>`;
return;
}
contenedor.innerHTML = cuentas.map((c) => {
const clase = COLOR_POR_BANCO[c.banco] || "banorte";
return `
<div class="ay-bank-card">
<div class="ay-bank-card-bar ${clase}"></div>
<div class="ay-bank-card-body">
<div class="ay-bank-card-header">
<span class="ay-bank-card-dot ${clase}"></span>
<span class="ay-bank-card-name">${c.banco}</span>
</div>
<div class="ay-bank-card-rows">
<div class="ay-bank-card-row">
<span class="ay-bank-card-row-label">Titular</span>
<span class="ay-bank-card-row-value">${c.titular}</span>
</div>
<div class="ay-bank-card-row">
<span class="ay-bank-card-row-label">Tarjeta</span>
<span class="ay-bank-card-row-value">${c.numero}</span>
</div>
</div>
</div>
</div>`;
}).join("");
}
/* =====================================  Esto de abajo trabaja en generar las tarejtas de preguntas frecuentes         ======================= */
function renderFaq() {
const contenedor = document.getElementById("listaFaq");
if (!contenedor) return;
contenedor.innerHTML = FAQS.map((f, i) => `
<article class="ay-faq-item" data-faq-index="${i}">
<button class="ay-faq-question" aria-expanded="false" aria-controls="faq-answer-${i}">
<span>${f.pregunta}</span>
<svg class="ay-faq-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
</button>
<div class="ay-faq-answer" id="faq-answer-${i}">
<div class="ay-faq-answer-inner">
<div class="ay-faq-answer-box">
<p>${f.respuesta}</p>
</div>
</div>
</div>
</article>
`).join("");
}
/* =====================================  Esto de abajo trabaja en generar las tarejtas de ayuda        ======================= */
function initAcordeonTarjetas() {
const tarjetas = document.querySelectorAll(".ay-help-card");
tarjetas.forEach((tarjeta) => {
const trigger = tarjeta.querySelector(".ay-help-card-trigger");
if (!trigger) return;
trigger.addEventListener("click", () => {
const abierta = tarjeta.classList.toggle("abierto");
trigger.setAttribute("aria-expanded", String(abierta));
});
});
}
/* =====================================  Esto de abajo trabaja en generar las preguntas frecuentes de ayuda        ======================= */
function initAcordeonFaq() {
const items = document.querySelectorAll(".ay-faq-item");
items.forEach((item) => {
const boton = item.querySelector(".ay-faq-question");
if (!boton) return;
boton.addEventListener("click", () => {
const yaAbierto = item.classList.contains("abierto");
items.forEach((otro) => {
otro.classList.remove("abierto");
const otroBoton = otro.querySelector(".ay-faq-question");
if (otroBoton) otroBoton.setAttribute("aria-expanded", "false");
});
if (!yaAbierto) {
item.classList.add("abierto");
boton.setAttribute("aria-expanded", "true");
}
});
});
}
/* =====================================  Esto de abajo trabaja en hacer que jalen correctamente los botones de whats app       ======================= */
function initBotonesWhatsapp() {
const btnContacto = document.getElementById("btnAbrirWhatsapp");
if (btnContacto) {
btnContacto.setAttribute("href", construirLinkWhatsapp(WHATSAPP_CONFIG.mensajeGeneral));
}
}
/* =============                                Esto de abajo trabaja en el inicio de ayuda                       ============================ */
document.addEventListener("DOMContentLoaded", () => {
renderBancos();
renderFaq();
initAcordeonTarjetas();
initAcordeonFaq();
initBotonesWhatsapp();
});
})();