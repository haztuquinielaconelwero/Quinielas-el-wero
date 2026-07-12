const API_BASE = window.location.hostname === 'localhost'
? 'http://localhost:8000'
: '';
function getAuthHeaders() {
return { 'Content-Type': 'application/json' };
}
const state = {
datosOriginales: [],
partidos:        [],
resultados:      {},
marcadores:      {},
primerPuntos:    -1,
segundoPuntos:   -1,
rowDataCache:    null,
enProceso:       false,
refreshCtrl:     null,
bloqueado:       false,
jornada:         null
};
let gridApi = null;
function toast(msg, tipo = 'success', ms = 4500) {
if (!msg || typeof msg !== 'string') return;
const container = document.getElementById('toastContainer');
if (!container) return;
const iconos = { success:'✅', error:'❌', warn:'⚠️' };
const el = document.createElement('div');
el.className = `toast toast-${tipo}`;
el.textContent = `${iconos[tipo] ?? ''} ${msg}`;
container.appendChild(el);
requestAnimationFrame(() => el.classList.add('show'));
setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}
function debounce(fn, delay) {
let t;
return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
const debouncedFiltros = debounce(aplicarFiltros, 250);
async function conGuard(fn, btnIds = []) {
if (state.enProceso) return;
state.enProceso = true;
btnIds.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = true; });
try { await fn(); }
catch (err) { toast(err.message || 'Error inesperado', 'error'); console.error(err); }
finally {
state.enProceso = false;
btnIds.forEach(id => { const b = document.getElementById(id); if (b) b.disabled = false; });
const loadingText = document.getElementById('loadingText');
if (loadingText) loadingText.textContent = 'Cargando datos...';
mostrarLoading(false);
}
}
function escHtml(str) {
return String(str ?? '')
.replace(/&/g,'&amp;').replace(/</g,'&lt;')
.replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function actualizarBarraSeleccion() {
if (!gridApi) return;
const sel = gridApi.getSelectedRows().filter(r => r.folio);
const bar = document.getElementById('selectionBar');
const cnt = document.getElementById('selCount');
if (!bar || !cnt) return;
if (sel.length > 0) {
cnt.textContent = `${sel.length} quiniela${sel.length > 1 ? 's' : ''} seleccionada${sel.length > 1 ? 's' : ''}`;
bar.classList.add('visible');
} else {
bar.classList.remove('visible');
}
}
function limpiarSeleccion() {
if (gridApi) gridApi.deselectAll();
const bar = document.getElementById('selectionBar');
if (bar) bar.classList.remove('visible');
}
function initGrid() {
const gridOptions = {
columnDefs: [],
rowData: [],
animateRows: true,
suppressMovableColumns: false,
rowHeight: 36,
headerHeight: 38,
defaultColDef: { resizable: true, sortable: true, filter: false },
rowSelection: 'multiple',
suppressRowClickSelection: true,
isRowSelectable: (params) => !!(params.data && params.data.folio),
onSelectionChanged: actualizarBarraSeleccion,
onGridSizeChanged: () => { if (gridApi) gridApi.sizeColumnsToFit(); },
getRowClass: params => {
if (!params.data) return '';
if (params.data.esPrimero) return 'ag-row-rank-first';
if (params.data.esSegundo) return 'ag-row-rank-second';
return '';
},
};
gridApi = agGrid.createGrid(document.getElementById('myGrid'), gridOptions);
}
async function cargarDatos() {
try {
mostrarLoading(true);
const jornada = 'Jornada 1';
state.jornada = jornada;
const jornadaParam = encodeURIComponent(jornada);
const resL = await fetch(`${API_BASE}/api/laapidelalistaoficial?jornada=${jornadaParam}`);
if (!resL.ok) throw new Error('Error de servidor al cargar los datos');
const dataL = await resL.json();
state.partidos        = [];
state.datosOriginales = dataL.quinielas  || [];
state.resultados      = {};
state.marcadores      = {};
state.rowDataCache    = null;
poblarFiltroVendedores();
renderResultadosInputs();
procesarDatos();
renderTabla();
actualizarEstadisticas();
} catch (err) {
mostrarError(err.message);
} finally {
mostrarLoading(false);
}
}
document.addEventListener('DOMContentLoaded', async () => {
initGrid();
await cargarDatos();
setInterval(async () => {
if (state.enProceso || !state.jornada) return;
if (state.refreshCtrl) state.refreshCtrl.abort();
state.refreshCtrl = new AbortController();
const { signal } = state.refreshCtrl;
const jornadaParam = encodeURIComponent(state.jornada);
try {
const r1 = await fetch(`${API_BASE}/api/laapidelalistaoficial?jornada=${jornadaParam}`, { signal });
if (!r1.ok) return;
const { quinielas: nuevas = [] } = await r1.json();
const sinCambios = nuevas.length === state.datosOriginales.length &&
JSON.stringify(nuevas) === JSON.stringify(state.datosOriginales);
if (sinCambios) return;
state.datosOriginales = nuevas;
state.rowDataCache    = null;
poblarFiltroVendedores();
procesarDatos();
renderTabla();
renderResultadosInputs();
actualizarEstadisticas();
} catch (err) {
if (err.name !== 'AbortError') console.warn('Auto-refresh:', err.message);
}
}, 30000);
});
function poblarFiltroVendedores() {
const select = document.getElementById('filterVendedor');
if (!select) return;
const actual = select.value;
const vendedores = [...new Set(state.datosOriginales.map(q => q.vendedor).filter(Boolean))].sort();
select.innerHTML = '<option value="">Todos los vendedores</option>';
vendedores.forEach(v => {
const opt = document.createElement('option');
opt.value = v; opt.textContent = v;
if (v === actual) opt.selected = true;
select.appendChild(opt);
});
}
function aplicarFiltros() {
if (!gridApi) return;
const termino  = (document.getElementById('searchInput')?.value ?? '').trim().toLowerCase();
const vendedor = document.getElementById('filterVendedor')?.value ?? '';
const base = buildRowData();
const filtradas = (termino || vendedor)
? base.filter(row => {
if (!row.folio) return false;
const matchTexto    = !termino  || (row.nombre||'').toLowerCase().includes(termino) || (row.vendedor||'').toLowerCase().includes(termino);
const matchVendedor = !vendedor || row.vendedor === vendedor;
return matchTexto && matchVendedor;
})
: base;
gridApi.setGridOption('rowData', filtradas);
const counter = document.getElementById('rowsCounter');
if (counter) counter.textContent = (termino || vendedor ? filtradas.length : state.datosOriginales.length) + ' registros';
}
function procesarDatos() {
const hayResultados = Object.values(state.resultados).some(Boolean);
state.datosOriginales = state.datosOriginales.map(q => {
let puntos = 0;
if (hayResultados && Array.isArray(q.picks)) {
q.picks.forEach((pick, idx) => {
if (state.resultados[String(idx)] && pick === state.resultados[String(idx)]) puntos++;
});
}
return { ...q, puntos };
});
if (!state.datosOriginales.length || !hayResultados) {
state.primerPuntos  = -1;
state.segundoPuntos = -1;
state.rowDataCache  = null;
return;
}
state.primerPuntos  = state.datosOriginales.reduce((mx, q) => Math.max(mx, q.puntos), 0);
const puntosUnicos  = [...new Set(state.datosOriginales.map(q => q.puntos))].sort((a, b) => b - a);
state.segundoPuntos = puntosUnicos.length > 1 ? puntosUnicos[1] : -1;
state.rowDataCache  = null;
}
function buildColumnDefs() {
const numPicks = state.partidos.length || (state.datosOriginales[0]?.picks?.length || 9);
const pickCols = Array.from({ length: numPicks }, (_, idx) => ({
headerName: `P${idx + 1}`,
field: `_pick_${idx}`,
width: 62,
sortable: false,
resizable: false,
cellClass: params => {
const v = params.value;
return (!v || v === '-' || v === '') ? 'cell-empty' : '';
},
cellRenderer: params => {
const v = params.value;
if (!v || v === '-' || v === '') return '<span style="color:#fca5a5">—</span>';
const r = state.resultados[String(idx)];
if (r && v === r) return `<span class="pick-correct">${escHtml(v)}</span>`;
if (r) return `<span class="pick-incorrect">${escHtml(v)}</span>`;
return `<span>${escHtml(v)}</span>`;
},
}));
return [
{
field: '#',
headerName: '#',
width: 70,
sortable: false,
resizable: false,
pinned: 'left',
cellClass: 'col-numero',
checkboxSelection: params => !!(params.data && params.data.folio),
headerCheckboxSelection: true,
headerCheckboxSelectionFilteredOnly: true,
},
{
field: 'nombre', headerName: 'Nombre', width: 200, pinned: 'left', filter: 'agTextColumnFilter',
cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' },
cellClass: params => (!params.value || params.value === '') ? 'cell-empty' : '',
},
{
field: 'vendedor', headerName: 'Vendedor', width: 140, filter: 'agTextColumnFilter',
cellStyle: { justifyContent: 'flex-start', paddingLeft: '8px' },
cellClass: params => (!params.value || params.value === '') ? 'cell-empty' : '',
},
...pickCols,
{
field: 'puntos', headerName: 'Pts', width: 72,
cellClass: params => (params.value === '' || params.value === null || params.value === undefined) ? 'cell-empty' : '',
cellStyle: params => {
if (params.data?.esPrimero) return { fontWeight: '700', color: '#92400e' };
if (params.data?.esSegundo) return { fontWeight: '600', color: '#1e40af' };
return {};
},
valueFormatter: params => (params.value === '' || params.value === null || params.value === undefined) ? '—' : params.value,
},
{
field: '_acciones', headerName: '', width: 88, sortable: false, resizable: false, pinned: 'right',
cellRenderer: params => {
const folio = params.data?.folio;
if (!folio) return '';
const f = String(folio).replace(/'/g, "\\'");
return `<button class="btn-eliminar-fila" onclick="eliminarQuiniela('${f}')">🗑️</button>`;
},
},
];
}
function buildRowData() {
if (state.rowDataCache) return state.rowDataCache;
const rows = [];
const porFolio = {};
state.datosOriginales.forEach(q => {
const n = parseInt(q.folio, 10);
if (!isNaN(n)) porFolio[n] = q;
});
for (let i = 1; i <= 5000; i++) {
const q = porFolio[i];
if (q) {
const row = {
'#': i,
folio: q.folio,
nombre: q.nombre || '',
vendedor: q.vendedor || '',
puntos: q.puntos ?? 0,
_id: q.id,
esPrimero: state.primerPuntos >= 0 && q.puntos === state.primerPuntos,
esSegundo: state.segundoPuntos >= 0 && q.puntos !== state.primerPuntos && q.puntos === state.segundoPuntos,
};
(q.picks || []).forEach((pick, idx) => { row[`_pick_${idx}`] = pick || ''; });
rows.push(row);
} else {
const empty = { '#': i, folio: '', nombre: '', vendedor: '', puntos: '' };
state.partidos.forEach((_, idx) => { empty[`_pick_${idx}`] = ''; });
rows.push(empty);
}
}
state.rowDataCache = rows;
return rows;
}
function renderTabla() {
if (!gridApi) return;
const rows = buildRowData();
gridApi.setGridOption('columnDefs', buildColumnDefs());
gridApi.setGridOption('rowData', rows);
setTimeout(() => gridApi.sizeColumnsToFit(), 50);
const counter = document.getElementById('rowsCounter');
if (counter) counter.textContent = state.datosOriginales.length + ' registros';
}
function renderResultadosInputs() {
const container = document.getElementById('resultadosGrid');
if (!container) return;
container.innerHTML = '';
state.partidos.forEach((partido, idx) => {
const curRes      = state.resultados[String(idx)] || '';
const curMarcador = state.marcadores[String(idx)]  || { local: '', visita: '' };
const grupo = document.createElement('div');
grupo.className = 'resultado-input-group';
const num = document.createElement('span');
num.className = 'resultado-num';
num.textContent = `P${idx + 1}`;
grupo.appendChild(num);
const logosWrap = document.createElement('div');
logosWrap.className = 'resultado-logos';
function crearLogo(src, nombreCorto) {
const img = document.createElement('img');
img.className = 'resultado-logo-img';
img.src = src || ''; img.alt = nombreCorto || ''; img.title = nombreCorto || '';
img.width = 34; img.height = 34; img.loading = 'lazy';
img.onerror = function () {
const fb = document.createElement('span');
fb.className = 'resultado-logo-fb';
fb.textContent = (nombreCorto || '?').substring(0, 3).toUpperCase();
fb.title = nombreCorto || '';
this.replaceWith(fb);
};
return img;
}
const vsSpan = document.createElement('span');
vsSpan.className = 'resultado-vs';
vsSpan.textContent = 'vs';
logosWrap.appendChild(crearLogo(partido.localLogo || '', partido.local || 'L'));
logosWrap.appendChild(vsSpan);
logosWrap.appendChild(crearLogo(partido.visitanteLogo || '', partido.visitante || 'V'));
grupo.appendChild(logosWrap);
const marcadorWrap = document.createElement('div');
marcadorWrap.className = 'resultado-marcador';
const inputLocal = document.createElement('input');
inputLocal.type = 'number'; inputLocal.min = '0'; inputLocal.max = '20';
inputLocal.className = 'marcador-input'; inputLocal.placeholder = '-';
inputLocal.value = curMarcador.local ?? '';
inputLocal.dataset.idx = idx; inputLocal.dataset.rol = 'local';
inputLocal.setAttribute('aria-label', `Goles local P${idx + 1}`);
const guion = document.createElement('span');
guion.className = 'marcador-guion';
guion.textContent = ':';
guion.style.cssText = 'font-size:13px;font-weight:800;color:var(--gray-400);';
const inputVisita = document.createElement('input');
inputVisita.type = 'number'; inputVisita.min = '0'; inputVisita.max = '20';
inputVisita.className = 'marcador-input'; inputVisita.placeholder = '-';
inputVisita.value = curMarcador.visita ?? '';
inputVisita.dataset.idx = idx; inputVisita.dataset.rol = 'visita';
inputVisita.setAttribute('aria-label', `Goles visitante P${idx + 1}`);
marcadorWrap.appendChild(inputLocal);
marcadorWrap.appendChild(guion);
marcadorWrap.appendChild(inputVisita);
grupo.appendChild(marcadorWrap);
const btns = document.createElement('div');
btns.className = 'resultado-buttons';
btns.dataset.partido = idx;
['L', 'E', 'V'].forEach(val => {
const btn = document.createElement('button');
btn.className = 'resultado-btn' + (curRes === val ? ' active' : '');
btn.dataset.val = val;
btn.textContent = val;
btn.addEventListener('click', () => {
const estaActivo = btn.classList.contains('active');
btns.querySelectorAll('.resultado-btn').forEach(b => b.classList.remove('active'));
if (!estaActivo) btn.classList.add('active');
actualizarResaltado(inputLocal, inputVisita, btns);
});
btns.appendChild(btn);
});
grupo.appendChild(btns);
function actualizarResaltado(inpL, inpV, botonesDiv) {
const activo = botonesDiv.querySelector('.resultado-btn.active')?.dataset.val;
inpL.classList.remove('ganador', 'perdedor');
inpV.classList.remove('ganador', 'perdedor');
if (activo === 'L') { inpL.classList.add('ganador'); inpV.classList.add('perdedor'); }
if (activo === 'V') { inpL.classList.add('perdedor'); inpV.classList.add('ganador'); }
}
function onMarcadorChange() {
const gl = parseInt(inputLocal.value, 10);
const gv = parseInt(inputVisita.value, 10);
state.marcadores[String(idx)] = { local: inputLocal.value, visita: inputVisita.value };
if (isNaN(gl) || isNaN(gv) || inputLocal.value === '' || inputVisita.value === '') {
inputLocal.classList.remove('ganador', 'perdedor');
inputVisita.classList.remove('ganador', 'perdedor');
return;
}
const resultado = gl > gv ? 'L' : gl === gv ? 'E' : 'V';
btns.querySelectorAll('.resultado-btn').forEach(b => {
b.classList.toggle('active', b.dataset.val === resultado);
});
actualizarResaltado(inputLocal, inputVisita, btns);
}
inputLocal.addEventListener('input', onMarcadorChange);
inputVisita.addEventListener('input', onMarcadorChange);
if (curRes) actualizarResaltado(inputLocal, inputVisita, btns);
container.appendChild(grupo);
});
}
async function guardarResultados() {
toast('Guardar resultados aun no esta conectado al servidor (siguiente paso)', 'warn');
}
async function limpiarResultados() {
toast('Limpiar resultados aun no esta conectado al servidor (siguiente paso)', 'warn');
}
async function eliminarQuiniela(folio) {
toast('El borrado individual aun no esta conectado al servidor (siguiente paso)', 'warn');
}
async function eliminarSeleccionadas() {
toast('El borrado en lote aun no esta conectado al servidor (siguiente paso)', 'warn');
}
async function eliminarTodasLasQuinielas() {
toast('Archivar todas aun no esta conectado al servidor (siguiente paso)', 'warn');
}
function actualizarUIBloqueo() {
const btn    = document.getElementById('btnEspera');
const banner = document.getElementById('bloqueoBanner');
if (!btn || !banner) return;
if (state.bloqueado) {
btn.textContent = 'Modo en espera ⏳';
btn.classList.add('bloqueado');
banner.classList.add('visible');
} else {
btn.textContent = 'Modo en espera 🔓';
btn.classList.remove('bloqueado');
banner.classList.remove('visible');
}
}
async function toggleBloqueo() {
toast('Modo en espera aun no esta conectado al servidor (siguiente paso)', 'warn');
}
async function recargarDatos() { await cargarDatos(); }
async function importarCSV(event) {
toast('Importar CSV aun no esta conectado al servidor (siguiente paso)', 'warn');
event.target.value = '';
}
function descargarPlantilla() {
const cols = state.partidos.length || 9;
const pickHeaders = Array.from({ length: cols }, (_, i) => `P${i + 1}`);
const picks1 = Array.from({ length: cols }, (_, i) => ['L','E','V'][i % 3]).join(',');
const picks2 = Array.from({ length: cols }, (_, i) => ['V','V','E','L'][i % 4]).join(',');
descargarCSVBlob(
`Folio,Nombre,Vendedor,${pickHeaders.join(',')},ID\n` +
`1,Juan Pérez,Checo,${picks1},1\n` +
`2,María López,Checo,${picks2},2`,
'plantilla-quiniela.csv'
);
}
function exportarExcel() {
const MAX_FOLIO   = 5000;
const numPartidos = state.partidos.length || (state.datosOriginales[0]?.picks?.length || 9);
if (!state.datosOriginales.length && !confirm('No hay quinielas cargadas. ¿Exportar de todas formas los 5000 folios vacíos?')) return;
const pickHeaders = Array.from({ length: numPartidos }, (_, i) => `P${i + 1}`);
const headers     = ['Folio', 'Nombre', 'Vendedor', ...pickHeaders, 'Puntos', 'ID'];
const csvLines    = [headers.join(',')];
const porFolio = {};
state.datosOriginales.forEach(q => {
const n = parseInt(q.folio, 10);
if (!isNaN(n) && n >= 1 && n <= MAX_FOLIO) porFolio[n] = q;
});
let exportadas = 0;
for (let i = 1; i <= MAX_FOLIO; i++) {
const q = porFolio[i];
if (q) {
const nombre   = (q.nombre   ?? '').replace(/,/g, ' ');
const vendedor = (q.vendedor ?? '').replace(/,/g, ' ');
const picks    = Array.from({ length: numPartidos }, (_, idx) => {
const v = Array.isArray(q.picks) ? q.picks[idx] : undefined;
return (v && v !== '-') ? v : '';
});
csvLines.push(`${q.folio ?? i},${nombre},${vendedor},${picks.join(',')},${q.puntos ?? 0},${q.id ?? ''}`);
exportadas++;
} else {
const vacios = Array(numPartidos).fill('').join(',');
csvLines.push(`${i},,,${vacios},,`);
}
}
const fecha = new Date().toISOString().split('T')[0];
descargarCSVBlob(csvLines.join('\n'), `lista-oficial-${fecha}.csv`);
toast(`✅ Exportado: ${exportadas} quinielas + ${MAX_FOLIO - exportadas} folios vacíos (total ${MAX_FOLIO})`, 'success', 6000);
}
function descargarCSVBlob(csv, filename) {
if (!csv || !filename) return;
const bom  = '\uFEFF';
const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
const url  = URL.createObjectURL(blob);
const a    = document.createElement('a');
a.href     = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function actualizarEstadisticas() {
const { datosOriginales: datos, primerPuntos: p1, segundoPuntos: p2 } = state;
const ids = ['totalStat','firstStat','secondStat','vendedoresStat'];
if (!datos.length) {
ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
return;
}
const hayRes = p1 >= 0;
const c1 = hayRes ? datos.filter(q => q.puntos === p1).length : 0;
const c2 = (hayRes && p2 >= 0) ? datos.filter(q => q.puntos === p2).length : 0;
const cv = new Set(datos.map(q => q.vendedor).filter(Boolean)).size;
const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
set('totalStat',      datos.length);
set('firstStat',      c1);
set('secondStat',     c2);
set('vendedoresStat', cv);
}
function mostrarLoading(show) {
document.getElementById('loadingOverlay')?.classList.toggle('show', show);
}
function mostrarError(mensaje) {
if (gridApi) gridApi.setGridOption('rowData', []);
console.error('Error:', mensaje);
toast('Error al cargar datos: ' + (mensaje || 'Error desconocido'), 'error', 7000);
}