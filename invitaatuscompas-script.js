/*                                       Esto de abajo trabaja en las variables globales y el estado de la pagina completa                                */
let datosOriginales = [];
let vendedoresDisponibles = [];
let gridApi = null;
let ultimaInteraccion = Date.now();
const ESTADO_TODOS = 'Todos';
/*                                       Esto de abajo trabaja en detectar si el usuario sigue activo en pantalla                              */
document.addEventListener('mousemove', () => ultimaInteraccion = Date.now());
document.addEventListener('keydown', () => ultimaInteraccion = Date.now());
document.addEventListener('scroll', () => ultimaInteraccion = Date.now());
/*                                     Esto de abajo trabaja en el arranque de la pagina                           */
document.addEventListener('DOMContentLoaded', async () => {
initGrid();
await cargarDatos();
setInterval(async () => {
if (Date.now() - ultimaInteraccion > 15000) await cargarDatos();
}, 30000);
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
fetch('/api/admin/codigos/listar', { headers: { 'X-Admin-Token': obtenerAdminToken() } }),
fetch('/api/admin/vendedores/listar', { headers: { 'X-Admin-Token': obtenerAdminToken() } }),
]);
if (!resCodigos.ok) throw new Error(`Error codigos: ${resCodigos.status}`);
if (!resVendedores.ok) throw new Error(`Error vendedores: ${resVendedores.status}`);
const dataCodigos = await resCodigos.json();
const dataVendedores = await resVendedores.json();
if (dataCodigos.success === false) throw new Error(dataCodigos.mensaje || 'Error al obtener codigos');
vendedoresDisponibles = dataVendedores.vendedores || [];
datosOriginales = (dataCodigos.codigos || []).map(c => ({
codigo: c.codigo || '',
dueno: c.dueno || '',
vendedor: c.vendedor || '',
linkVendedor: c.linkVendedor || '',
activo: c.activo,
totalReferidos: c.totalReferidos || 0,
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
dueno: c.dueno,
vendedor: c.vendedor,
linkVendedor: c.linkVendedor,
activo: c.activo ? 'Activo' : 'Inactivo',
totalReferidos: c.totalReferidos,
creadoEn: c.creadoEn,
}));
}
/*                                    Esto de abajo trabaja en armar las columnas de la tabla                                              */
function buildColumnDefs() {
return [
{ field: 'codigo', headerName: 'Código', width: 160, pinned: 'left', cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' } },
{ field: 'dueno', headerName: 'Dueño del código', width: 160, cellStyle: { justifyContent: 'flex-start', paddingLeft: '8px' } },
{ field: 'vendedor', headerName: 'Vendedor', width: 130 },
{
field: 'linkVendedor', headerName: 'Link del vendedor', width: 260,
cellRenderer: params => params.value ? `<a href="${params.value}" target="_blank" style="color:#4f9eff">${params.value}</a>` : '-',
},
{
field: 'activo', headerName: 'Estado', width: 100,
cellRenderer: params => params.value === 'Activo'
? '<span style="color:#2ecc71">● Activo</span>'
: '<span style="color:#e74c3c">● Inactivo</span>',
},
{ field: 'totalReferidos', headerName: 'Referidos', width: 100 },
{ field: 'creadoEn', headerName: 'Creado en', width: 160 },
{
headerName: 'Acciones', width: 220, sortable: false,
cellRenderer: params => `
<button onclick="editarCodigo('${params.data.codigo}')" class="btn-mini">Editar</button>
<button onclick="toggleCodigo('${params.data.codigo}', ${params.data.activo === 'Activo' ? 'false' : 'true'})" class="btn-mini">${params.data.activo === 'Activo' ? 'Desactivar' : 'Reactivar'}</button>
<button onclick="eliminarCodigo('${params.data.codigo}')" class="btn-mini btn-mini-danger">Eliminar</button>
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
const vendedor = document.getElementById('nuevoVendedor').value;
if (!codigo || !dueno || !vendedor) {
alert('Completa código, dueño y vendedor antes de crear.');
return;
}
try {
const resp = await fetch('/api/admin/codigos/crear', {
method: 'POST',
headers: { 'Content-Type': 'application/json', 'X-Admin-Token': obtenerAdminToken() },
body: JSON.stringify({ codigo, dueno, vendedor, adminId: 'ElWero' }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo crear el código');
document.getElementById('nuevoCodigo').value = '';
document.getElementById('nuevoDueno').value = '';
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
const nuevoVendedor = prompt('Vendedor (debe existir en la lista):', fila.vendedor) ?? fila.vendedor;
try {
const resp = await fetch(`/api/admin/codigos/${encodeURIComponent(codigo)}/editar`, {
method: 'PATCH',
headers: { 'Content-Type': 'application/json', 'X-Admin-Token': obtenerAdminToken() },
body: JSON.stringify({ dueno: nuevoDueno, vendedor: nuevoVendedor, adminId: 'ElWero' }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo editar');
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en activar/desactivar un codigo sin borrarlo                  */
async function toggleCodigo(codigo, activar) {
try {
const resp = await fetch(`/api/admin/codigos/${encodeURIComponent(codigo)}/estado`, {
method: 'PATCH',
headers: { 'Content-Type': 'application/json', 'X-Admin-Token': obtenerAdminToken() },
body: JSON.stringify({ activar, adminId: 'ElWero' }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo cambiar el estado');
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en eliminar un codigo permanentemente (queda bloqueado para siempre)                  */
async function eliminarCodigo(codigo) {
if (!confirm(`¿Seguro que quieres eliminar el código "${codigo}"? No podrá volver a usarse jamás.`)) return;
try {
const resp = await fetch(`/api/admin/codigos/${encodeURIComponent(codigo)}/eliminar`, {
method: 'DELETE',
headers: { 'Content-Type': 'application/json', 'X-Admin-Token': obtenerAdminToken() },
body: JSON.stringify({ adminId: 'ElWero' }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo eliminar');
await cargarDatos();
} catch (error) {
alert('❌ ' + error.message);
}
}
/*                              Esto de abajo trabaja en exportar exclusivamente lo que esta filtrado ahorita en pantalla                   */
function exportarCSV() {
const filtradas = obtenerCodigosFiltrados();
const cols = ['Codigo', 'Dueno', 'Vendedor', 'LinkVendedor', 'Estado', 'Referidos', 'CreadoEn'];
const filas = filtradas.map(c => {
const codigo = '"' + (c.codigo || '').replace(/"/g, '""') + '"';
const dueno = '"' + (c.dueno || '').replace(/"/g, '""') + '"';
const vendedor = '"' + (c.vendedor || '').replace(/"/g, '""') + '"';
const link = '"' + (c.linkVendedor || '').replace(/"/g, '""') + '"';
const estado = c.activo ? 'Activo' : 'Inactivo';
return [codigo, dueno, vendedor, link, estado, c.totalReferidos || 0, c.creadoEn || ''].join(',');
});
if (!filas.length) { alert('No hay códigos para exportar.'); return; }
const bom = '\uFEFF';
const contenido = bom + cols.join(',') + '\n' + filas.join('\n');
const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `codigos-referido-${Date.now()}.csv`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
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
/*                             Esto de abajo trabaja en obtener el token de administrador guardado localmente               */
function obtenerAdminToken() {
return localStorage.getItem('adminToken') || '';
}