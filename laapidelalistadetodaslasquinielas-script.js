
// ==================== APUNTE IMPORTANTE ====================
// Esta pagina trae TODAS las quinielas del servidor de una sola vez con /api/apitodaslasquinielas
// y aplica 3 filtros combinados en el frontend:
// 1) estadoActivo (los botones/tabs: No jugando, Jugando, En espera, Archivada, Rechazada)
// 2) filterVendedor (el select de vendedores)
// 3) searchInput (el buscador de texto por nombre o vendedor)
// Si algun dia agregas un nuevo estado en la base de datos, solo agrega su boton en el HTML
// y su color en el CSS, este script ya lo soporta automaticamente via data-estado.
// ==============================================================
let datosOriginales = [];
let partidos = [];
let gridApi = null;
let ultimaInteraccion = Date.now();
let estadoActivo = 'No jugando';
const NUM_PICKS = 9;
document.addEventListener('mousemove', () => ultimaInteraccion = Date.now());
document.addEventListener('keydown', () => ultimaInteraccion = Date.now());
document.addEventListener('scroll', () => ultimaInteraccion = Date.now());
document.addEventListener('DOMContentLoaded', async () => {
initGrid();
await cargarDatos();
setInterval(async () => {
if (Date.now() - ultimaInteraccion > 15000) await cargarDatos();
}, 30000);
});
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
// APUNTE: aqui se pide TODO sin filtrar por estado, el filtrado pasa despues en el frontend.
async function cargarDatos() {
try {
mostrarLoading(true);
const [resPartidos, resTodas] = await Promise.all([
fetch('/api/apijornadaactual'),
fetch('/api/apitodaslasquinielas'),
]);
if (!resPartidos.ok) throw new Error(`Error partidos: ${resPartidos.status}`);
if (!resTodas.ok) throw new Error(`Error quinielas: ${resTodas.status}`);
const dataPartidos = await resPartidos.json();
const dataTodas = await resTodas.json();
if (dataTodas.success === false) throw new Error(dataTodas.mensaje || 'Error al obtener quinielas');
partidos = dataPartidos.partidos || [];
datosOriginales = (dataTodas.quinielas || []).map(q => ({
id: q.id,
nombre: q.nombre || '',
vendedor: q.vendedor || '',
picks: q.picks || [],
dispositivo_id: q.dispositivo_id || '',
llave_maestra: q.llave_maestra || '',
estado: q.estado || '',
folio: q.folio || '',
}));
poblarFiltroVendedores();
renderTabla();
} catch (error) {
mostrarError(error.message);
} finally {
mostrarLoading(false);
}
}
// APUNTE: filtro 1 de 3, el de los botones de estado. Al hacer click cambia estadoActivo y re-renderiza.
function cambiarEstado(nuevoEstado) {
estadoActivo = nuevoEstado;
document.querySelectorAll('.tab').forEach(tab => {
tab.classList.toggle('activo', tab.dataset.estado === nuevoEstado);
});
document.getElementById('estadoActualStat').textContent = nuevoEstado;
renderTabla();
}
// APUNTE: filtro 2 de 3, el select de vendedores. Se llena dinamicamente segun lo que trae la BD.
function poblarFiltroVendedores() {
const select = document.getElementById('filterVendedor');
const actual = select.value;
const vendedores = [...new Set(datosOriginales.map(q => q.vendedor).filter(Boolean))].sort();
select.innerHTML = '<option value="">Todos los vendedores</option>';
vendedores.forEach(v => {
const opt = document.createElement('option');
opt.value = v;
opt.textContent = v;
if (v === actual) opt.selected = true;
select.appendChild(opt);
});
}
// APUNTE: aqui se combinan los 3 filtros: estadoActivo + vendedor + texto de busqueda.
// Esta funcion es la unica fuente de verdad de "que se debe ver ahorita en la tabla".
function obtenerQuinielasFiltradas() {
const termino = document.getElementById('searchInput').value.trim().toLowerCase();
const vendedor = document.getElementById('filterVendedor').value;

return datosOriginales.filter(q => {
const matchEstado = q.estado === estadoActivo;
const matchTexto = !termino || (q.nombre || '').toLowerCase().includes(termino) || (q.vendedor || '').toLowerCase().includes(termino);
const matchVendedor = !vendedor || q.vendedor === vendedor;
return matchEstado && matchTexto && matchVendedor;
});
}
function buildRowData(lista) {
return lista.map(q => {
const row = {
id: q.id,
nombre: q.nombre,
vendedor: q.vendedor,
dispositivo_id: q.dispositivo_id,
llave_maestra: q.llave_maestra,
folio: q.folio,
};
for (let i = 0; i < NUM_PICKS; i++) {
row[`_pick_${i}`] = (q.picks && q.picks[i]) ? q.picks[i] : '-';
}
return row;
});
}
function buildColumnDefs() {
const pickCols = [];
for (let i = 0; i < NUM_PICKS; i++) {
const partido = partidos[i];
pickCols.push({
headerName: `P${i + 1}`,
field: `_pick_${i}`,
width: 58,
sortable: false,
resizable: false,
headerTooltip: partido ? `${partido.local} vs ${partido.visitante}` : `Partido ${i + 1}`,
cellRenderer: params => {
const val = params.value;
if (!val || val === '-') return '<span style="color:#fca5a5">-</span>';
return `<span>${val}</span>`;
},
});
}
const cols = [
{ field: 'nombre', headerName: 'Nombre', width: 200, pinned: 'left', cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' } },
{ field: 'vendedor', headerName: 'Vendedor', width: 140, cellStyle: { justifyContent: 'flex-start', paddingLeft: '8px' } },
...pickCols,
{ field: 'dispositivo_id', headerName: 'Dispositivo ID', width: 150 },
{ field: 'id', headerName: 'ID', width: 90, sortable: true },
{ field: 'llave_maestra', headerName: 'Llave Maestra', width: 160 },
];
// APUNTE: la columna Folio solo tiene sentido mostrarla cuando el tab activo es 'Jugando'.
if (estadoActivo === 'Jugando') {
cols.push({ field: 'folio', headerName: 'Folio', width: 90, sortable: true });
}
return cols;
}
function aplicarFiltros() {
renderTabla();
}
function renderTabla() {
const filtradas = obtenerQuinielasFiltradas();
gridApi.setGridOption('columnDefs', buildColumnDefs());
gridApi.setGridOption('rowData', buildRowData(filtradas));
setTimeout(() => gridApi.sizeColumnsToFit(), 50);
document.getElementById('rowsCounter').textContent = filtradas.length + ' registros';
document.getElementById('totalStat').textContent = filtradas.length;
document.getElementById('vendedoresStat').textContent = new Set(filtradas.map(q => q.vendedor)).size;
if (filtradas.length === 0) {
gridApi.setGridOption('overlayNoRowsTemplate', `<span style="padding:20px;color:#5f6368;font-size:14px;">No hay quinielas en estado "${estadoActivo}"</span>`);
gridApi.showNoRowsOverlay();
} else {
gridApi.hideOverlay();
}
}
// APUNTE IMPORTANTE: el CSV exporta EXCLUSIVAMENTE lo que esta filtrado ahorita en pantalla
// (respeta el tab de estado activo + el vendedor seleccionado + el texto buscado).
function exportarCSV() {
const filtradas = obtenerQuinielasFiltradas();
const cols = ['Nombre', 'Vendedor'];
for (let i = 1; i <= NUM_PICKS; i++) cols.push(`P${i}`);
cols.push('Dispositivo ID', 'ID', 'Llave Maestra', 'Estado', 'Folio');
const filas = filtradas.map(q => {
const picks = Array.isArray(q.picks) && q.picks.length ? q.picks : new Array(NUM_PICKS).fill('-');
const picksCompletos = [];
for (let i = 0; i < NUM_PICKS; i++) picksCompletos.push(picks[i] || '-');
const nombre = '"' + (q.nombre || '').replace(/"/g, '""') + '"';
const vendedor = '"' + (q.vendedor || '').replace(/"/g, '""') + '"';
const dispositivo = '"' + (q.dispositivo_id || '').replace(/"/g, '""') + '"';
const llave = '"' + (q.llave_maestra || '').replace(/"/g, '""') + '"';
const estado = '"' + (q.estado || '').replace(/"/g, '""') + '"';
return [nombre, vendedor].concat(picksCompletos).concat([dispositivo, q.id || '', llave, estado, q.folio || '']).join(',');
});
if (!filas.length) { alert(`No hay quinielas en estado "${estadoActivo}" para exportar.`); return; }
const bom = '\uFEFF';
const contenido = bom + cols.join(',') + '\n' + filas.join('\n');
const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${estadoActivo.replace(/\s+/g, '-')}-${Date.now()}.csv`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}
// APUNTE: Actualizar vuelve a pedir TODO al servidor y re-renderiza
// respetando el tab de estado, el vendedor y el texto que ya tenias seleccionados.
async function actualizarTodo() {
await cargarDatos();
}
function mostrarLoading(show) {
document.getElementById('loadingOverlay')?.classList.toggle('show', show);
}
function mostrarError(mensaje) {
if (gridApi) gridApi.setGridOption('rowData', []);
console.error('Error:', mensaje);
alert('❌ Error al cargar datos: ' + mensaje);
}