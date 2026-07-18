/*                                       Esto de abajo trabaja en las variables globales y el estado de la pagina completa                                */ 
let datosOriginales = [];
let partidos = [];
let gridApi = null;
let ultimaInteraccion = Date.now();
let estadoActivo = 'No jugando';
const NUM_PICKS = 9;
const ESTADO_TODAS = 'Todas las quinielas';
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
/*                                    Esto de abajo trabaja en cargar todos los datos iniciales del panel y refrescar la interfaz                        */ 
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
/*                                    Esto de abajo trabaja en el filtro                                                          */ 
function cambiarEstado(nuevoEstado) {
estadoActivo = nuevoEstado;
document.querySelectorAll('.tab').forEach(tab => {
tab.classList.toggle('activo', tab.dataset.estado === nuevoEstado);
});
document.getElementById('estadoActualStat').textContent = nuevoEstado;
renderTabla();
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
function obtenerQuinielasFiltradas() {
const termino = document.getElementById('searchInput').value.trim().toLowerCase();
const vendedor = document.getElementById('filterVendedor').value;
return datosOriginales.filter(q => {
const matchEstado = estadoActivo === ESTADO_TODAS || q.estado === estadoActivo;
const matchTexto = !termino || [
q.nombre,
q.vendedor,
q.folio,
q.dispositivo_id,
q.llave_maestra,
].some(campo => String(campo || '').toLowerCase().includes(termino));
const matchVendedor = !vendedor || q.vendedor === vendedor;
return matchEstado && matchTexto && matchVendedor;
});
}
/*                                    Esto de abajo trabaja en transformar las quinielas filtradas al formato de filas                                            */ 
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
/*                                    Esto de abajo trabaja en armar las columnas de la tabla                                              */ 
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
if (estadoActivo === 'Jugando') {
cols.push({ field: 'folio', headerName: 'Folio', width: 90, sortable: true });
}
return cols;
}
/*                                    Esto de abajo trabaja en re-pintar la tabla cuando cambias el vendedor o escribes en el buscador                             */ 
function aplicarFiltros() {
renderTabla();
}
/*                              Esto de abajo trabaja en pintar la tabla completa: columnas, filas, contadores y el mensaje de "sin resultados"                   */ 
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
/*                              Esto de abajo trabaja en exportar exclusivamente lo que esta filtrado ahorita en pantalla                   */ 
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
const bom = '\\uFEFF';
const contenido = bom + cols.join(',') + '\\n' + filas.join('\\n');
const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `${estadoActivo.replace(/\\s+/g, '-')}-${Date.now()}.csv`;
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