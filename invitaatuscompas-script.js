/*                                       Esto de abajo trabaja en las variables globales y el estado de la pagina completa                                */
let datosOriginales = [];
let vendedoresDisponibles = [];
let gridApi = null;
/*                                     Esto de abajo trabaja en el arranque de la pagina                           */
document.addEventListener('DOMContentLoaded', async () => {
initGrid();
await cargarDatos();
});
/*                                     Esto de abajo trabaja en construir la tabla                           */
function initGrid() {
const gridOptions = {
columnDefs: [],
rowData: [],
animateRows: true,
suppressMovableColumns: false,
rowHeight: 36,
headerHeight: 38,
defaultColDef: { resizable: true, sortable: true, filter: false },
onGridSizeChanged: () => gridApi && gridApi.sizeColumnsToFit(),
};
gridApi = agGrid.createGrid(document.getElementById('myGrid'), gridOptions);
}
/*                                    Esto de abajo trabaja en cargar todos los codigos de referido y refrescar la interfaz                        */
async function cargarDatos() {
try {
mostrarLoading(true);
const [resCodigos, resVendedores] = await Promise.all([
fetch('/api/invitaatuscompaslista'),
fetch('/api/vendedores'),
]);
if (!resCodigos.ok) throw new Error(`Error codigos: ${resCodigos.status}`);
if (!resVendedores.ok) throw new Error(`Error vendedores: ${resVendedores.status}`);
const dataCodigos = await resCodigos.json();
const dataVendedores = await resVendedores.json();
if (dataCodigos.success === false) throw new Error(dataCodigos.mensaje || 'Error al obtener codigos');
vendedoresDisponibles = Object.keys(dataVendedores.vendedores || {}).map(nombre => ({ nombre }));
datosOriginales = (dataCodigos.codigos || []).map(c => ({
codigo: c.codigo || '',
dueno: c.dueno || '',
telefono: c.telefono || '',
vendedor: c.vendedor || '',
linkCodigo: c.linkCodigo || '',
activo: c.activo,
totalReferidos: c.totalReferidos || 0,
tickets: c.tickets || 0,
saldo: c.saldo || 0,
quinielasGratis: c.quinielasGratis || 0,
ticketsGirados: c.ticketsGirados || 0,
quinielasCanjeadas: c.quinielasCanjeadas || 0,
creadoEn: c.creadoEn || '',
}));
poblarFiltroVendedores();
poblarSelectCrear();
renderTabla();
} catch (error) {
mostrarError(error.message);
} finally {
mostrarLoading(false);
}
}
/*                                    Esto de abajo trabaja en el filtro de vendedor y busqueda de texto                                */
function poblarFiltroVendedores() {
const select = document.getElementById('filterVendedor');
const actual = select.value;
const vendedoresUsados = [...new Set(datosOriginales.map(c => c.vendedor).filter(Boolean))].sort();
select.innerHTML = '<option value="">Todos los vendedores</option>';
vendedoresUsados.forEach(v => {
const opt = document.createElement('option');
opt.value = v;
opt.textContent = v;
if (v === actual) opt.selected = true;
select.appendChild(opt);
});
}
function poblarSelectCrear() {
const select = document.getElementById('nuevoVendedor');
select.innerHTML = '';
vendedoresDisponibles.forEach(v => {
const opt = document.createElement('option');
opt.value = v.nombre;
opt.textContent = v.nombre;
select.appendChild(opt);
});
}
function obtenerCodigosFiltrados() {
const termino = document.getElementById('searchInput').value.trim().toLowerCase();
const vendedor = document.getElementById('filterVendedor').value;
return datosOriginales.filter(c => {
const matchTexto = !termino || [
c.codigo,
c.dueno,
c.vendedor,
].some(campo => String(campo || '').toLowerCase().includes(termino));
const matchVendedor = !vendedor || c.vendedor === vendedor;
return matchTexto && matchVendedor;
});
}
/*                                    Esto de abajo trabaja en transformar los codigos filtrados al formato de filas                                            */
function buildRowData(lista) {
return lista.map(c => ({
codigo: c.codigo,
telefono: c.telefono,
vendedor: c.vendedor,
linkCodigo: c.linkCodigo,
activo: c.activo ? 'Activo' : 'Inactivo',
totalReferidos: c.totalReferidos,
tickets: c.tickets,
saldo: c.saldo,
quinielasGratis: c.quinielasGratis,
ticketsGirados: c.ticketsGirados,
quinielasCanjeadas: c.quinielasCanjeadas,
creadoEn: c.creadoEn,
}));
}
/*                                    Esto de abajo trabaja en armar las columnas de la tabla                                              */
function buildColumnDefs() {
return [
{ field: 'codigo', headerName: 'Código', width: 160, pinned: 'left', cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' } },
{ field: 'telefono', headerName: 'Teléfono', width: 130 },
{ field: 'vendedor', headerName: 'Vendedor', width: 130 },
{
field: 'linkCodigo', headerName: 'Link del código', width: 260,
cellRenderer: params => params.value ? `<a href="${params.value}" target="_blank" style="color:#4f9eff">${params.value}</a>` : '-',
},
{
field: 'activo', headerName: 'Estado', width: 100,
cellRenderer: params => params.value === 'Activo'
? '<span style="color:#2ecc71">● Activo</span>'
: '<span style="color:#e74c3c">● Inactivo</span>',
},
{ field: 'totalReferidos', headerName: 'Referidos', width: 100 },
{ field: 'tickets', headerName: '🎟️ Tickets', width: 100 },
{ field: 'saldo', headerName: '💰 Dinero', width: 110, cellRenderer: params => `$${params.value}` },
{ field: 'quinielasGratis', headerName: '🎁 Quinielas', width: 110 },
{ field: 'creadoEn', headerName: 'Creado en', width: 160 },
{
headerName: 'Acciones', width: 230, sortable: false,
cellRenderer: params => `
<button onclick="regalarTickets('${params.data.codigo}')" class="btn-mini btn-mini-dorado">🎁 Regalar</button>
<button onclick="editarCodigo('${params.data.codigo}')" class="btn-mini">Editar</button>
<button onclick="eliminarCodigo('${params.data.codigo}')" class="btn-mini btn-mini-danger">Eliminar</button>
`,
},
{
field: 'quinielasCanjeadas', headerName: 'Premios canjeados ✅', width: 190, sortable: true,
cellRenderer: params => `
<div style="display:flex;flex-direction:column;gap:2px;font-size:11px;line-height:1.3;">
<span style="color:#5f6368">Tickets 🎟️: <strong style="color:#202124">${params.data.ticketsGirados}</strong></span>
<span style="color:#5f6368">Quinielas 🎁: <strong style="color:#2ecc71">${params.value}</strong></span>
</div>
`,
},
];
}
/*                                    Esto de abajo trabaja en re-pintar la tabla cuando cambias el vendedor o escribes en el buscador                             */
function aplicarFiltros() {
renderTabla();
}
/*                              Esto de abajo trabaja en pintar la tabla completa: columnas, filas, contadores y el mensaje de "sin resultados"                   */
function renderTabla() {
const filtradas = obtenerCodigosFiltrados();
gridApi.setGridOption('columnDefs', buildColumnDefs());
gridApi.setGridOption('rowData', buildRowData(filtradas));
setTimeout(() => gridApi.sizeColumnsToFit(), 50);
document.getElementById('rowsCounter').textContent = filtradas.length + ' códigos';
document.getElementById('totalStat').textContent = filtradas.length;
document.getElementById('activosStat').textContent = filtradas.filter(c => c.activo).length;
document.getElementById('vendedoresStat').textContent = new Set(filtradas.map(c => c.vendedor)).size;
if (filtradas.length === 0) {
gridApi.setGridOption('overlayNoRowsTemplate', `<span style="padding:20px;color:#5f6368;font-size:14px;">No hay códigos que coincidan con la búsqueda</span>`);
gridApi.showNoRowsOverlay();
} else {
gridApi.hideOverlay();
}
}
/*                              Esto de abajo trabaja en crear un codigo nuevo a mano (solo tu, el admin)                  */
async function crearCodigo() {
const codigo = document.getElementById('nuevoCodigo').value.trim();
const dueno = document.getElementById('nuevoDueno').value.trim();
const telefono = document.getElementById('nuevoTelefono').value.trim();
const vendedor = document.getElementById('nuevoVendedor').value;
if (!codigo || !dueno || !telefono || !vendedor) {
alert('Completa código, dueño, teléfono y vendedor antes de crear.');
return;
}
try {
const resp = await fetch('/api/invitaatuscompascrearreferido', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ codigo, dueno, telefono, vendedor }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo crear el código');
document.getElementById('nuevoCodigo').value = '';
document.getElementById('nuevoDueno').value = '';
document.getElementById('nuevoTelefono').value = '';
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en editar el vendedor o dueño de un codigo existente                  */
async function editarCodigo(codigo) {
const fila = datosOriginales.find(c => c.codigo === codigo);
if (!fila) return;
const nuevoDueno = prompt('Dueño del código:', fila.dueno) ?? fila.dueno;
const nuevoTelefono = prompt('Teléfono:', fila.telefono) ?? fila.telefono;
const nuevoVendedor = prompt('Vendedor (debe existir en la lista):', fila.vendedor) ?? fila.vendedor;
try {
const resp = await fetch('/api/invitaatuscompaseditar', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ codigo, dueno: nuevoDueno, telefono: nuevoTelefono, vendedor: nuevoVendedor }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo editar');
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en eliminar un codigo permanentemente (queda bloqueado para siempre)                  */
async function eliminarCodigo(codigo) {
if (!confirm(`¿Seguro que quieres eliminar el código "${codigo}"? No podrá volver a usarse jamás.`)) return;
try {
const resp = await fetch('/api/invitaatuscompaseliminar', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ codigo }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo eliminar');
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en mostrar la ventanita bonita para pedir cuantos tickets regalar                  */
function pedirCantidadTickets(codigo) {
return new Promise((resolve) => {
const overlay = document.createElement('div');
overlay.className = 'regalo-tickets-overlay';
overlay.innerHTML = `
<div class="regalo-tickets-caja">
<p class="regalo-tickets-titulo">🎁 Regalar tickets de ruleta</p>
<p class="regalo-tickets-cuerpo">¿Cuántos tickets quieres regalarle a <strong>${codigo}</strong>?</p>
<input type="number" id="regaloTicketsInput" min="1" value="1" class="regalo-tickets-input" />
<div class="regalo-tickets-botones">
<button id="btnRegaloCancelar" class="btn-mini">Cancelar</button>
<button id="btnRegaloConfirmar" class="btn-mini btn-mini-dorado">Regalar 🎟️</button>
</div>
</div>
`;
document.body.appendChild(overlay);
const input = document.getElementById('regaloTicketsInput');
input.focus();
input.select();
document.getElementById('btnRegaloCancelar').addEventListener('click', () => {
overlay.remove();
resolve(null);
});
document.getElementById('btnRegaloConfirmar').addEventListener('click', () => {
const cantidad = parseInt(input.value, 10);
overlay.remove();
resolve(cantidad > 0 ? cantidad : null);
});
});
}
/*                              Esto de abajo trabaja en regalar tickets manualmente a un dueño de codigo (premio o agradecimiento)                  */
async function regalarTickets(codigo) {
const cantidad = await pedirCantidadTickets(codigo);
if (!cantidad) return;
try {
const resp = await fetch('/api/ruletaregalartickets', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ codigoreferido: codigo, cantidad, motivo: 'Regalo manual desde el panel' }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo regalar tickets');
alert('✅ ' + data.mensaje);
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en el boton de "Actualizar": vuelve a pedir todo al servidor y re-renderiza                  */
async function actualizarTodo() {
await cargarDatos();
}
/*                              Esto de abajo trabaja en mostrar/ocultar el overlay de "Cargando..." mientras se piden los datos               */
function mostrarLoading(show) {
document.getElementById('loadingOverlay')?.classList.toggle('show', show);
}
/*                             Esto de abajo trabaja en avisar al usuario cuando algo sale mal al cargar datos              */
function mostrarError(mensaje) {
if (gridApi) gridApi.setGridOption('rowData', []);
console.error('Error:', mensaje);
alert('❌ Error al cargar datos: ' + mensaje);
}