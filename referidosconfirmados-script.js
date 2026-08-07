// ================================ Esto de abajo trabaja con Referidosconfirmados ================================
let gridApi;
let todosLosReferidos = [];
let referidosVisibles = [];
// ================================ Esto de abajo trabaja con lo que se ve en la tabla ================================
const columnDefs = [
{ headerName: 'Dueño del código', field: 'duenoCodigo', minWidth: 180, flex: 1.1 },
{ headerName: 'Código referido', field: 'codigoReferido', minWidth: 165, cellClass: 'cell-code' },
{ headerName: 'Nombre del participante', field: 'nombreParticipante', minWidth: 205, flex: 1.2 },
{ headerName: 'Celular', field: 'celular', minWidth: 135 },
{ headerName: 'Dispositivo ID', field: 'dispositivoId', minWidth: 220, flex: 1.35, cellClass: 'cell-device', tooltipField: 'dispositivoId' },
{ headerName: 'Folio', field: 'folio', minWidth: 90, maxWidth: 110, cellClass: 'cell-folio' },
{ headerName: 'Vendedor', field: 'vendedor', minWidth: 150 },
{ headerName: 'Fecha confirmada', field: 'fechaConfirmado', minWidth: 170 }
];
const gridOptions = {
columnDefs,
rowData: [],
defaultColDef: {
sortable: true,
resizable: true,
filter: false
},
animateRows: true,
suppressCellFocus: true,
overlayNoRowsTemplate: '<span class="empty-state">No hay referidos confirmados para mostrar.</span>'
};
// ================================ Esto de abajo trabaja con iniciar la tabla al iniciar ================================
document.addEventListener('DOMContentLoaded', () => {
const gridDiv = document.getElementById('myGrid');
gridApi = agGrid.createGrid(gridDiv, gridOptions);
actualizarTodo();
});
document.addEventListener('keydown', event => {
if (event.key === 'Escape') {
cerrarRespaldos();
}
});
// ================================ Esto de abajo trabaja con los datos de Python (referidos) ================================
async function actualizarTodo() {
mostrarCarga(true);
try {
const respuesta = await fetch('/api/referidosconfirmadoslista', {
cache: 'no-store'
});
if (!respuesta.ok) {
throw new Error(`Error HTTP ${respuesta.status}`);
}
const datos = await respuesta.json();
if (!datos.success) {
throw new Error(datos.mensaje || 'No se pudieron cargar los referidos.');
}
todosLosReferidos = Array.isArray(datos.referidos)
? datos.referidos.map(normalizarReferido)
: [];
llenarFiltros();
aplicarFiltros();
} catch (error) {
console.error(error);
todosLosReferidos = [];
referidosVisibles = [];
gridApi.setGridOption('rowData', []);
actualizarResumen();
alert(`No fue posible cargar los referidos confirmados.\n${error.message}`);
} finally {
mostrarCarga(false);
}
}
// ================================ Esto de abajo trabaja con los datos de Python ================================
function normalizarReferido(referido) {
return {
duenoCodigo: referido.duenoCodigo || 'Sin dueño',
codigoReferido: referido.codigoReferido || '',
nombreParticipante: referido.nombreParticipante || 'Sin registro',
celular: referido.celular || 'Sin registro',
dispositivoId: referido.dispositivoId || '',
folio: referido.folio || '—',
vendedor: referido.vendedor || 'Sin vendedor',
fechaConfirmado: referido.fechaConfirmado || '—'
};
}
// ================================ Esto de abajo trabaja con llenar la informacion de los filtros ================================
function llenarFiltros() {
const vendedorActual = document.getElementById('filterVendedor').value;
const vendedores = [...new Set(
todosLosReferidos
.map(referido => referido.vendedor)
.filter(Boolean)
)].sort((a, b) => a.localeCompare(b));
llenarSelect(
'filterVendedor',
'Todos los vendedores',
vendedores,
vendedorActual
);
}
function llenarSelect(id, textoInicial, valores, valorSeleccionado) {
const select = document.getElementById(id);
select.replaceChildren(
new Option(textoInicial, '')
);
valores.forEach(valor => {
select.add(new Option(valor, valor));
});
select.value = valores.includes(valorSeleccionado)
? valorSeleccionado
: '';
}
// =============================== Esto de abajo trabaja con los filtros ================================
function aplicarFiltros() {
const texto = document
.getElementById('searchInput')
.value
.trim()
.toLocaleLowerCase('es-MX');
const vendedor = document.getElementById('filterVendedor').value;
referidosVisibles = todosLosReferidos.filter(referido => {
const coincideTexto = !texto || [
referido.duenoCodigo,
referido.codigoReferido,
referido.nombreParticipante,
referido.celular,
referido.dispositivoId,
referido.folio,
referido.vendedor,
referido.fechaConfirmado
].some(valor => {
return String(valor)
.toLocaleLowerCase('es-MX')
.includes(texto);
});
const coincideVendedor = !vendedor || referido.vendedor === vendedor;
return coincideTexto && coincideVendedor;
});
gridApi.setGridOption('rowData', referidosVisibles);
actualizarResumen();
}
// ================================ Esto de abajo trabaja con los contadores ================================
function actualizarResumen() {
const total = referidosVisibles.length;
const codigos = new Set(
referidosVisibles
.map(referido => referido.codigoReferido)
.filter(Boolean)
).size;
const vendedores = new Set(
referidosVisibles
.map(referido => referido.vendedor)
.filter(vendedor => vendedor && vendedor !== 'Sin vendedor')
).size;
document.getElementById('rowsCounter').textContent =
`${total} ${total === 1 ? 'referido' : 'referidos'}`;
document.getElementById('totalStat').textContent = total;
document.getElementById('codigosStat').textContent = codigos;
document.getElementById('vendedoresStat').textContent = vendedores;
}
// ================================ Esto de abajo trabaja con mostrar la carga de las cosas ================================
function mostrarCarga(mostrar) {
document
.getElementById('loadingOverlay')
.classList
.toggle('show', mostrar);
}
// ================================ Esto de abajo trabaja con abrir la ventana de respaldos ================================
async function abrirRespaldos() {
const modal = document.getElementById('modalRespaldos');
const lista = document.getElementById('listaRespaldos');
modal.classList.add('activo');
lista.innerHTML = `
<div class="mensaje-respaldos">
Cargando respaldos...
</div>
`;
try {
const respuesta = await fetch('/api/referidosrespaldosjornadas', {
cache: 'no-store'
});
if (!respuesta.ok) {
throw new Error(`Error HTTP ${respuesta.status}`);
}
const datos = await respuesta.json();
if (!datos.success) {
throw new Error(datos.mensaje || 'No se pudieron cargar los respaldos.');
}
const jornadas = Array.isArray(datos.jornadas)
? datos.jornadas
: [];
mostrarListaRespaldos(jornadas);
} catch (error) {
console.error(error);
lista.innerHTML = `
<div class="mensaje-respaldos">
No fue posible cargar los respaldos.<br>
${escaparHTML(error.message)}
</div>
`;
}
}
// ================================ Esto de abajo trabaja con mostrar las jornadas respaldadas ================================
function mostrarListaRespaldos(jornadas) {
const lista = document.getElementById('listaRespaldos');
lista.replaceChildren();
if (jornadas.length === 0) {
const mensaje = document.createElement('div');
mensaje.className = 'mensaje-respaldos';
mensaje.textContent = 'Todavía no existen respaldos de jornadas anteriores.';
lista.appendChild(mensaje);
return;
}
jornadas.forEach(respaldo => {
const jornada = respaldo.jornada || 'Jornada sin nombre';
const totalReferidos = Number(respaldo.totalReferidos || 0);
const item = document.createElement('div');
item.className = 'respaldo-item';
const informacion = document.createElement('div');
const titulo = document.createElement('div');
titulo.className = 'respaldo-jornada';
titulo.textContent = jornada;
const detalle = document.createElement('div');
detalle.className = 'respaldo-detalle';
detalle.textContent = `${totalReferidos} ${totalReferidos === 1 ? 'referido confirmado' : 'referidos confirmados'}`;
informacion.appendChild(titulo);
informacion.appendChild(detalle);
const boton = document.createElement('button');
boton.type = 'button';
boton.className = 'btn-descargar-respaldo';
boton.textContent = 'Descargar 📥';
boton.addEventListener('click', () => {
descargarRespaldo(jornada);
});
item.appendChild(informacion);
item.appendChild(boton);
lista.appendChild(item);
});
}
// ================================ Esto de abajo trabaja con descargar una jornada respaldada ================================
function descargarRespaldo(jornada) {
const jornadaCodificada = encodeURIComponent(jornada);
window.location.href =
`/api/referidosrespaldoexportar?jornada=${jornadaCodificada}`;
}
// ================================ Esto de abajo trabaja con cerrar la ventana de respaldos ================================
function cerrarRespaldos() {
const modal = document.getElementById('modalRespaldos');
modal.classList.remove('activo');
}
// ================================ Esto de abajo trabaja con cerrar respaldos al tocar fuera de la ventana ================================
function cerrarRespaldosAlFondo(event) {
if (event.target.id === 'modalRespaldos') {
cerrarRespaldos();
}
}
// ================================ Esto de abajo protege los mensajes que se muestran en pantalla ================================
function escaparHTML(texto) {
return String(texto)
.replaceAll('&', '&amp;')
.replaceAll('<', '&lt;')
.replaceAll('>', '&gt;')
.replaceAll('"', '&quot;')
.replaceAll("'", '&#039;');
}