let datosOriginales = [];
let partidos = [];
let gridApi = null;
let ultimaInteraccion = Date.now();
let idsAnteriores = new Set();
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
async function cargarDatos() {
try {
mostrarLoading(true);
const [resPartidos, resEspera] = await Promise.all([
fetch('/api/apijornadaactual'),
fetch('/api/apiquinielasenespera'),
]);
if (!resPartidos.ok) throw new Error(`Error partidos: ${resPartidos.status}`);
if (!resEspera.ok) throw new Error(`Error espera: ${resEspera.status}`);
const dataPartidos = await resPartidos.json();
const dataEspera = await resEspera.json();
if (dataEspera.success === false) throw new Error(dataEspera.mensaje || 'Error al obtener espera');
partidos = dataPartidos.partidos || [];
datosOriginales = (dataEspera.espera || []).map(q => ({
id: q.id,
nombre: q.nombre || '',
vendedor: q.vendedor || '',
picks: q.picks || [],
dispositivo_id: q.dispositivo_id || '',
llave_maestra: q.llave_maestra || '',
}));
poblarFiltroVendedores();
renderTabla();
actualizarEstadisticas();
} catch (error) {
mostrarError(error.message);
} finally {
mostrarLoading(false);
}
}
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
function buildRowData() {
return datosOriginales.map(q => {
const row = {
id: q.id,
nombre: q.nombre,
vendedor: q.vendedor,
dispositivo_id: q.dispositivo_id,
llave_maestra: q.llave_maestra,
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
return [
{ field: 'nombre', headerName: 'Nombre', width: 200, pinned: 'left', cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' } },
{ field: 'vendedor', headerName: 'Vendedor', width: 140, cellStyle: { justifyContent: 'flex-start', paddingLeft: '8px' } },
...pickCols,
{ field: 'dispositivo_id', headerName: 'Dispositivo ID', width: 150 },
{ field: 'id', headerName: 'ID', width: 90, sortable: true },
{ field: 'llave_maestra', headerName: 'Llave Maestra', width: 160 },
];
}
function aplicarFiltros() {
const termino = document.getElementById('searchInput').value.trim().toLowerCase();
const vendedor = document.getElementById('filterVendedor').value;
if (!gridApi) return;
const filas = buildRowData();
const hayFiltro = termino || vendedor;
const filtradas = hayFiltro ? filas.filter(row => {
const matchTexto = !termino || (row.nombre || '').toLowerCase().includes(termino) || (row.vendedor || '').toLowerCase().includes(termino);
const matchVendedor = !vendedor || row.vendedor === vendedor;
return matchTexto && matchVendedor;
}) : filas;
gridApi.setGridOption('rowData', filtradas);
document.getElementById('rowsCounter').textContent = (hayFiltro ? filtradas.length : datosOriginales.length) + ' registros';
}
function renderTabla() {
gridApi.setGridOption('columnDefs', buildColumnDefs());
gridApi.setGridOption('rowData', buildRowData());
setTimeout(() => gridApi.sizeColumnsToFit(), 50);
document.getElementById('rowsCounter').textContent = datosOriginales.length + ' registros';
if (datosOriginales.length === 0) {
gridApi.setGridOption('overlayNoRowsTemplate', '<span style="padding:20px;color:#5f6368;font-size:14px;">No tienes quinielas en espera ⏳</span>');
gridApi.showNoRowsOverlay();
} else {
gridApi.hideOverlay();
}
}
function exportarCSV() {
const cols = ['Nombre', 'Vendedor'];
for (let i = 1; i <= NUM_PICKS; i++) cols.push(`P${i}`);
cols.push('Dispositivo ID', 'ID', 'Llave Maestra');
const filas = datosOriginales.map(q => {
const picks = Array.isArray(q.picks) && q.picks.length ? q.picks : new Array(NUM_PICKS).fill('-');
const picksCompletos = [];
for (let i = 0; i < NUM_PICKS; i++) picksCompletos.push(picks[i] || '-');
const nombre = '"' + (q.nombre || '').replace(/"/g, '""') + '"';
const vendedor = '"' + (q.vendedor || '').replace(/"/g, '""') + '"';
const dispositivo = '"' + (q.dispositivo_id || '').replace(/"/g, '""') + '"';
const llave = '"' + (q.llave_maestra || '').replace(/"/g, '""') + '"';
return [nombre, vendedor].concat(picksCompletos).concat([dispositivo, q.id || '', llave]).join(',');
});
if (!filas.length) { alert('No hay quinielas para exportar.'); return; }
const bom = '\uFEFF';
const contenido = bom + cols.join(',') + '\n' + filas.join('\n');
const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `espera-${Date.now()}.csv`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
}
async function actualizarYVerificar() {
try {
mostrarLoading(true);
idsAnteriores = new Set(datosOriginales.map(q => q.id));
await cargarDatos();
if (idsAnteriores.size > 0) {
const resVerificar = await fetch('/api/apiparaactualizarlasquinielasenespera', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ ids: [...idsAnteriores] })
});
if (!resVerificar.ok) throw new Error(`Error verificando IDs: ${resVerificar.status}`);
const dataVerificar = await resVerificar.json();
const entraron = dataVerificar.entraron || [];
if (entraron.length > 0) {
alert(`${entraron.length} quiniela(s) ya entraron a la Lista Oficial ✅`);
} else {
alert('Aun no hay quinielas nuevas en la Lista Oficial.');
}
}
} catch (error) {
alert('❌ Error al actualizar: ' + error.message);
} finally {
mostrarLoading(false);
}
}
function actualizarEstadisticas() {
document.getElementById('totalStat').textContent = datosOriginales.length;
document.getElementById('vendedoresStat').textContent = new Set(datosOriginales.map(q => q.vendedor)).size;
}
function mostrarLoading(show) {
document.getElementById('loadingOverlay')?.classList.toggle('show', show);
}
function mostrarError(mensaje) {
if (gridApi) gridApi.setGridOption('rowData', []);
console.error('Error:', mensaje);
alert('❌ Error al cargar datos: ' + mensaje);
}