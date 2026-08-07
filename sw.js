// ══════════════════════════════════════      Service Worker — Quinielas El Wero                   ════════════════════════════════════            //
const VERSION = "v1.4.2";
const CACHE_ESTATICO = `estatico-${VERSION}`;
const CACHE_IMAGENES = `imagenes-${VERSION}`;
const ARCHIVOS_PRECARGA = [
"/",
"/inicio.html",
"/inicio-script.js",
"/inicio-styles.css",
"/realizarlaquiniela.html",
"/realizarlaquiniela-script.js",
"/realizarlaquiniela-styles.css",
"/misquinielas.html",
"/misquinielas-script.js",
"/misquinielas-styles.css",
"/listaoficial.html",
"/listaoficial-script.js",
"/listaoficial-styles.css",
"/horarios.html",
"/horarios-script.js",
"/horarios-styles.css",
"/porcentajes.html",
"/porcentajes-script.js",
"/porcentajes-styles.css",
"/ayuda.html",
"/ayuda-script.js",
"/ayuda-styles.css",
"/administrador.html",
"/administrador-script.js",
"/administrador-styles.css",
"/guiarapidayredes.html",
"/guiarapidayredes-styles.css",
"/laapidelalistaoficial.html",
"/laapidelalistaoficial-script.js",
"/laapidelalistaoficial-styles.css",
"/laapidelalistadetodaslasquinielas.html",
"/laapidelalistadetodaslasquinielas-script.js",
"/laapidelalistadetodaslasquinielas-styles.css",
"/simularlosresultados.html",
"/simularlosresultados-script.js",
"/simularlosresultados-styles.css",
];
self.addEventListener("install", (event) => {
event.waitUntil(
caches
.open(CACHE_ESTATICO)
.then((cache) => cache.addAll(ARCHIVOS_PRECARGA))
.catch((error) => {
console.error("SW: error precargando archivos", error);
})
);
self.skipWaiting();
});
self.addEventListener("activate", (event) => {
event.waitUntil(
(async () => {
const nombresCaches = await caches.keys();
await Promise.all(
nombresCaches
.filter(
(nombre) => nombre !== CACHE_ESTATICO && nombre !== CACHE_IMAGENES
)
.map((nombre) => caches.delete(nombre))
);
await self.clients.claim();
})()
);
});
self.addEventListener("fetch", (event) => {
const { request } = event;
const url = new URL(request.url);
if (request.method !== "GET") {
return;
}
if (url.pathname.startsWith("/api/")) {
event.respondWith(fetch(request));
return;
}
if (request.destination === "image" || url.pathname.startsWith("/logos/")) {
event.respondWith(estrategiaCacheFirst(request));
return;
}
event.respondWith(estrategiaNetworkFirst(request));
});
async function estrategiaNetworkFirst(request) {
try {
const respuestaRed = await fetch(request, { cache: "no-store" });
if (respuestaRed && respuestaRed.status === 200) {
const cache = await caches.open(CACHE_ESTATICO);
cache.put(request, respuestaRed.clone());
}
return respuestaRed;
} catch (error) {
const respuestaCache = await caches.match(request);
if (respuestaCache) {
return respuestaCache;
}
return new Response("Sin conexion y sin version guardada disponible.", {
status: 503,
statusText: "Sin conexion",
});
}
}
async function estrategiaCacheFirst(request) {
const cache = await caches.open(CACHE_IMAGENES);
const respuestaCache = await cache.match(request);
if (respuestaCache) {
fetch(request)
.then((respuestaRed) => {
if (respuestaRed && respuestaRed.status === 200) {
cache.put(request, respuestaRed.clone());
}
})
.catch(() => {});
return respuestaCache;
}
try {
const respuestaRed = await fetch(request);
if (respuestaRed && respuestaRed.status === 200) {
cache.put(request, respuestaRed.clone());
}
return respuestaRed;
} catch (error) {
return new Response("", { status: 404 });
}
}
self.addEventListener("message", (event) => {
if (event.data && event.data.type === "SKIP_WAITING") {
self.skipWaiting();
}
});
// ─── PUSH: se activa cuando el huerto le grita algo al arbol ─── /                       / ─── PUSH: se activa cuando el huerto le grita algo al arbol ───   / 
self.addEventListener("push", (event) => {
let datos = {};
try {
datos = event.data ? event.data.json() : {};
} catch (error) {
datos = {
titulo: "Quinielas El Wero",
cuerpo: "Tienes una notificacion nueva.",
deepLink: "/",
};
}
const titulo = datos.titulo || "Quinielas El Wero";
const opciones = {
body: datos.cuerpo || "",
icon: "/logos/icono-192.png",
badge: "/logos/icono-96.png",
data: {
deepLink: datos.deepLink || "/",
notificacionId: datos.notificacionId || null,
},
vibrate: [200, 100, 200],
requireInteraction: false,
};
event.waitUntil(self.registration.showNotification(titulo, opciones));
});
// ─── NOTIFICATIONCLICK: se activa cuando el arbol toca el aviso ─── /                            / ─── NOTIFICATIONCLICK: se activa cuando el arbol toca el aviso ───
self.addEventListener("notificationclick", (event) => {
event.notification.close();
const deepLink = event.notification.data && event.notification.data.deepLink
? event.notification.data.deepLink
: "/";
event.waitUntil(
(async () => {
const listaClientes = await self.clients.matchAll({
type: "window",
includeUncontrolled: true,
});
for (const cliente of listaClientes) {
if (cliente.url.includes(deepLink) && "focus" in cliente) {
return cliente.focus();
}
}
if (self.clients.openWindow) {
return self.clients.openWindow(deepLink);
}
})()
);
});