/*                                       Esto de abajo trabaja en las variables globales y el estado de la pagina completa                                */
let datosOriginales = [];
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
/*                                    Esto de abajo trabaja en cargar todos los clientes y refrescar la interfaz                        */
async function cargarDatos() {
try {
mostrarLoading(true);
const resp = await fetch('/api/clienteslista');
if (!resp.ok) throw new Error(`Error clientes: ${resp.status}`);
const data = await resp.json();
if (data.success === false) throw new Error(data.mensaje || 'Error al obtener clientes');
datosOriginales = (data.clientes || []).map(c => ({
id: c.id,
dispositivoid: c.dispositivoid || '',
nombre: c.nombre || '',
telefono: c.telefono || '',
fechaRegistro: c.fechaRegistro || '',
}));
renderTabla();
} catch (error) {
mostrarError(error.message);
} finally {
mostrarLoading(false);
}
}
/*                                    Esto de abajo trabaja en el buscador de texto                                */
function obtenerClientesFiltrados() {
const termino = document.getElementById('searchInput').value.trim().toLowerCase();
return datosOriginales.filter(c => {
return !termino || String(c.nombre || '').toLowerCase().includes(termino);
});
}
/*                                    Esto de abajo trabaja en transformar los clientes filtrados al formato de filas                                            */
function buildRowData(lista) {
return lista.map(c => ({
nombre: c.nombre,
telefono: c.telefono,
dispositivoid: c.dispositivoid,
fechaRegistro: c.fechaRegistro,
}));
}
/*                                    Esto de abajo trabaja en armar las columnas de la tabla                                              */
function buildColumnDefs() {
return [
{ field: 'nombre', headerName: 'Nombre', width: 200, pinned: 'left', cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' } },
{ field: 'telefono', headerName: 'Teléfono', width: 140 },
{ field: 'dispositivoid', headerName: 'ID de dispositivo', width: 300 },
{ field: 'fechaRegistro', headerName: 'Registrado en', width: 170 },
{
headerName: 'Acciones', width: 150, sortable: false,
cellRenderer: params => `
<button onclick="eliminarCliente('${params.data.dispositivoid}')" class="btn-mini btn-mini-danger">Eliminar</button>
`,
},
];
}
/*                                    Esto de abajo trabaja en re-pintar la tabla cuando escribes en el buscador                             */
function aplicarFiltros() {
renderTabla();
}
/*                              Esto de abajo trabaja en pintar la tabla completa: columnas, filas, contadores y el mensaje de "sin resultados"                   */
function renderTabla() {
const filtradas = obtenerClientesFiltrados();
gridApi.setGridOption('columnDefs', buildColumnDefs());
gridApi.setGridOption('rowData', buildRowData(filtradas));
setTimeout(() => gridApi.sizeColumnsToFit(), 50);
document.getElementById('rowsCounter').textContent = filtradas.length + ' clientes';
document.getElementById('totalStat').textContent = filtradas.length;
if (filtradas.length === 0) {
gridApi.setGridOption('overlayNoRowsTemplate', `<span style="padding:20px;color:#5f6368;font-size:14px;">No hay clientes que coincidan con la búsqueda</span>`);
gridApi.showNoRowsOverlay();
} else {
gridApi.hideOverlay();
}
}
/*                              Esto de abajo trabaja en eliminar un cliente permanentemente                  */
async function eliminarCliente(dispositivoid) {
const fila = datosOriginales.find(c => c.dispositivoid === dispositivoid);
const nombre = fila?.nombre || dispositivoid;
if (!confirm(`¿Seguro que quieres eliminar a "${nombre}"? No se puede deshacer.`)) return;
try {
const resp = await fetch('/api/clienteseliminar', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ dispositivoid }),
});
const data = await resp.json();
if (!data.success) throw new Error(data.mensaje || 'No se pudo eliminar');
await cargarDatos();
} catch (error) {
alert('❌ No se pudo completar la acción: ' + error.message);
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