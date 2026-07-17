/* Esto de abajo trabaja en la configuracion base del servidor y los encabezados para las peticiones */ /* Esto de abajo trabaja en la configuracion base del servidor y los encabezados para las peticiones */
const API_BASE = window.location.hostname === 'localhost'
? 'http://localhost:8000'
: '';
function getAuthHeaders() {
return { 'Content-Type': 'application/json' };
}
/*                                    Esto de abajo trabaja en guardar el estado general de la lista oficial, jornada, partidos y resultados                      */ 
const state = {
datosOriginales: [],
partidos: [],
resultados: {},
marcadores: {},
primerPuntos: -1,
segundoPuntos: -1,
rowDataCache: null,
enProceso: false,
refreshCtrl: null,
listaBloqueada: false,
modoEspera: false,
jornada: null,
totalJugandoConocido: null,
pollingInterval: null
};
let gridApi = null;
/*            Esto de abajo trabaja en el estado en espera y estado bloqueado               (Para que se no se rompan al recargar)                                */
async function cargarEstadoAdmin(signal) {
const res = await fetch(`${API_BASE}/api/estadoadmin`, {
headers: getAuthHeaders(),
signal
});
if (!res.ok) throw new Error('No se pudo cargar el estado del panel');
const data = await res.json();
state.listaBloqueada = !!data.listaBloqueada;
state.modoEspera = !!data.modoEspera;
actualizarUIBotonBloquear();
actualizarUIBotonEspera();
}
/*                   Esto de abajo trabaja en mostrar alertas visuales y mensajes rapidos dentro del panel                                                   */
function toast(msg, tipo = 'success', ms = 4500) {
if (!msg || typeof msg !== 'string') return;
const container = document.getElementById('toastContainer');
if (!container) return;
const iconos = { success: '✅', error: '❌', warn: '⚠️' };
const el = document.createElement('div');
el.className = `toast toast-${tipo}`;
el.textContent = `${iconos[tipo] ?? ''} ${msg}`;
container.appendChild(el);
requestAnimationFrame(() => el.classList.add('show'));
setTimeout(() => {
el.classList.remove('show');
setTimeout(() => el.remove(), 300);
}, ms);
}
/*                            Esto de abajo trabaja en retrasar filtros para no recargar la tabla en cada tecla                                                    */
function debounce(fn, delay) {
let t;
return (...args) => {
clearTimeout(t);
t = setTimeout(() => fn(...args), delay);
};
}
const debouncedFiltros = debounce(aplicarFiltros, 250);
/*                               Esto de abajo trabaja en proteger acciones para evitar doble clic y procesos repetidos                                   */
async function conGuard(fn, btnIds = []) {
if (state.enProceso) return;
state.enProceso = true;
btnIds.forEach(id => {
const b = document.getElementById(id);
if (b) b.disabled = true;
});
try {
await fn();
} catch (err) {
toast(err.message || 'Error inesperado', 'error');
console.error(err);
} finally {
state.enProceso = false;
btnIds.forEach(id => {
const b = document.getElementById(id);
if (b) b.disabled = false;
});
const loadingText = document.getElementById('loadingText');
if (loadingText) loadingText.textContent = 'Cargando datos...';
mostrarLoading(false);
}
}
/* Esto de abajo trabaja en limpiar texto HTML para evitar caracteres peligrosos dentro de la tabla */ /* Esto de abajo trabaja en limpiar texto HTML para evitar caracteres peligrosos dentro de la tabla */
function escHtml(str) {
return String(str ?? '')
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;');
}
/*                         Esto de abajo trabaja en normalizar las rutas de logos de equipos para que siempre carguen bien                                    */ 
function normalizarSrcLogo(src) {
if (!src) return '';
if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
return src;
}
return `/${src.replace(/^\.?\//, '')}`;
}
/* Esto de abajo trabaja en inicializar la grid principal de la lista oficial */     /* Esto de abajo trabaja en inicializar la grid principal de la lista oficial */
function initGrid() {
const gridOptions = {
columnDefs: [],
rowData: [],
animateRows: true,
suppressMovableColumns: false,
rowHeight: 36,
headerHeight: 38,
defaultColDef: { resizable: true, sortable: true, filter: false },
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
/*                                   Esto de abajo trabaja en cargar la jornada actual y los partidos oficiales desde la api                                     */ 
async function cargarJornadaActual(signal) {
const res = await fetch(`${API_BASE}/api/apijornadaactual`, {
headers: getAuthHeaders(),
signal
});
if (!res.ok) {
throw new Error('No se pudo cargar la jornada actual');
}
const data = await res.json();
if (!Array.isArray(data?.partidos)) {
throw new Error('La jornada actual no trae partidos válidos');
}
state.jornada = data?.jornada || 'Jornada 1';
state.partidos = data.partidos.map((p) => ({
id: Number(p.id),
local: p.local || '',
visitante: p.visitante || '',
localLogo: normalizarSrcLogo(p.localLogo),
visitanteLogo: normalizarSrcLogo(p.visitanteLogo),
resultadoFinal: p.resultadoFinal ?? null
}));
state.resultados = {};
state.partidos.forEach((p) => {
const key = String(p.id);
if (p.resultadoFinal) {
state.resultados[key] = p.resultadoFinal;
}
});
}
/*                    Esto de abajo trabaja en cargar la lista oficial de quinielas segun la jornada activa                                                       */ 
async function cargarListaOficial(signal) {
const jornadaParam = encodeURIComponent(state.jornada || 'Jornada 1');
const res = await fetch(`${API_BASE}/api/laapidelalistaoficial?jornada=${jornadaParam}`, {
headers: getAuthHeaders(),
signal
});
if (!res.ok) {
throw new Error('Error de servidor al cargar los datos');
}
const data = await res.json();
state.datosOriginales = data?.quinielas || [];
}
/*                                       Esto de abajo trabaja en cargar todos los datos iniciales del panel y refrescar la interfaz                                 */ 
async function cargarDatos() {
try {
mostrarLoading(true);
await cargarEstadoAdmin();
await cargarJornadaActual();
await cargarListaOficial();
state.marcadores = {};
state.rowDataCache = null;
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
/*                          Esto de abajo trabaja en inicializar la pagina y activar el auto refresh de jornada y quinielas                                 */ 
document.addEventListener('DOMContentLoaded', async () => {
initGrid();
await cargarDatos();
state.totalJugandoConocido = state.datosOriginales.length;
evaluarPolling();
});
async function chequearNuevaQuiniela(signal) {
const jornadaParam = encodeURIComponent(state.jornada || 'Jornada 1');
const res = await fetch(`${API_BASE}/api/totaljugando?jornada=${jornadaParam}`, { headers: getAuthHeaders(), signal });
if (!res.ok) throw new Error('No se pudo verificar nuevas quinielas');
const data = await res.json();
return typeof data.total === 'number' ? data.total : null;
}
async function tickPolling() {
if (state.enProceso) return;
if (state.listaBloqueada || state.modoEspera) { detenerPolling(); return; }
if (state.refreshCtrl) state.refreshCtrl.abort();
state.refreshCtrl = new AbortController();
const { signal } = state.refreshCtrl;
try {
const totalActual = await chequearNuevaQuiniela(signal);
if (totalActual === null || totalActual === state.totalJugandoConocido) return;
state.totalJugandoConocido = totalActual;
await cargarEstadoAdmin(signal);
await cargarJornadaActual(signal);
await cargarListaOficial(signal);
state.rowDataCache = null;
poblarFiltroVendedores();
renderResultadosInputs();
procesarDatos();
renderTabla();
actualizarEstadisticas();
} catch (err) {
if (err.name !== 'AbortError') console.warn('Polling:', err.message);
}
}
function iniciarPolling() {
if (state.pollingInterval) return;
state.pollingInterval = setInterval(tickPolling, 30000);
}
function detenerPolling() {
if (state.pollingInterval) {
clearInterval(state.pollingInterval);
state.pollingInterval = null;
}
}
function evaluarPolling() {
if (state.listaBloqueada || state.modoEspera) {
detenerPolling();
} else {
iniciarPolling();
}
}
/*                Esto de abajo trabaja en poblar el filtro de vendedores con datos reales de la lista oficial                                         */ 
function poblarFiltroVendedores() {
const select = document.getElementById('filterVendedor');
if (!select) return;
const actual = select.value;
const vendedores = [...new Set(state.datosOriginales.map(q => q.vendedor).filter(Boolean))].sort();
select.innerHTML = '<option value="">Todos los vendedores</option>';
vendedores.forEach(v => {
const opt = document.createElement('option');
opt.value = v;
opt.textContent = v;
if (v === actual) opt.selected = true;
select.appendChild(opt);
});
}
/* Esto de abajo trabaja en aplicar filtros de texto y vendedor sobre la tabla */     /* Esto de abajo trabaja en aplicar filtros de texto y vendedor sobre la tabla */
function aplicarFiltros() {
if (!gridApi) return;
const termino = (document.getElementById('searchInput')?.value ?? '').trim().toLowerCase();
const vendedor = document.getElementById('filterVendedor')?.value ?? '';
const base = buildRowData();
const filtradas = (termino || vendedor)
? base.filter(row => {
if (!row.folio) return false;
const matchTexto = !termino || (row.nombre || '').toLowerCase().includes(termino) || (row.vendedor || '').toLowerCase().includes(termino);
const matchVendedor = !vendedor || row.vendedor === vendedor;
return matchTexto && matchVendedor;
})
: base;
gridApi.setGridOption('rowData', filtradas);
const counter = document.getElementById('rowsCounter');
if (counter) {
counter.textContent = (termino || vendedor ? filtradas.length : state.datosOriginales.length) + ' registros';
}
}
/*                        Esto de abajo trabaja en calcular puntos, primer lugar y segundo lugar con base en resultados                                        */ 
function procesarDatos() {
const hayResultados = Object.values(state.resultados).some(Boolean);
state.datosOriginales = state.datosOriginales.map(q => {
let puntos = 0;
if (hayResultados && Array.isArray(q.picks)) {
q.picks.forEach((pick, idx) => {
const partido = state.partidos[idx];
if (!partido) return;
const key = String(partido.id);
if (state.resultados[key] && pick === state.resultados[key]) {
puntos++;
}
});
}
return { ...q, puntos };
});
if (!state.datosOriginales.length || !hayResultados) {
state.primerPuntos = -1;
state.segundoPuntos = -1;
state.rowDataCache = null;
return;
}
state.primerPuntos = state.datosOriginales.reduce((mx, q) => Math.max(mx, q.puntos), 0);
const puntosUnicos = [...new Set(state.datosOriginales.map(q => q.puntos))].sort((a, b) => b - a);
state.segundoPuntos = puntosUnicos.length > 1 ? puntosUnicos[1] : -1;
state.rowDataCache = null;
}
/*                  Esto de abajo trabaja en construir las columnas dinamicas de la tabla segun los partidos oficiales                    */ 
function buildColumnDefs() {
const pickCols = state.partidos.map((partido, idx) => ({
headerName: `P${idx + 1}`,
field: `_pick_${idx}`,
width: 72,
sortable: false,
resizable: false,
headerTooltip: `${partido.local} vs ${partido.visitante}`,
cellClass: params => {
const v = params.value;
return (!v || v === '-' || v === '') ? 'cell-empty' : '';
},
cellRenderer: params => {
const v = params.value;
if (!v || v === '-' || v === '') {
return '<span style="color:#fca5a5">—</span>';
}
const key = String(partido.id);
const r = state.resultados[key];
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
},
{
field: 'nombre',
headerName: 'Nombre',
width: 200,
pinned: 'left',
filter: 'agTextColumnFilter',
cellStyle: { justifyContent: 'flex-start', paddingLeft: '10px' },
cellClass: params => (!params.value || params.value === '') ? 'cell-empty' : '',
},
{
field: 'vendedor',
headerName: 'Vendedor',
width: 140,
filter: 'agTextColumnFilter',
cellStyle: { justifyContent: 'flex-start', paddingLeft: '8px' },
cellClass: params => (!params.value || params.value === '') ? 'cell-empty' : '',
},
...pickCols,
{
field: 'puntos',
headerName: 'Pts',
width: 72,
cellClass: params => (params.value === '' || params.value === null || params.value === undefined) ? 'cell-empty' : '',
cellStyle: params => {
if (params.data?.esPrimero) return { fontWeight: '700', color: '#92400e' };
if (params.data?.esSegundo) return { fontWeight: '600', color: '#1e40af' };
return {};
},
valueFormatter: params => (params.value === '' || params.value === null || params.value === undefined) ? '—' : params.value,
},
{
field: '_acciones',
headerName: '',
width: 88,
sortable: false,
resizable: false,
pinned: 'right',
cellRenderer: params => {
const folio = params.data?.folio;
if (!folio) return '';
const f = String(folio).replace(/'/g, "\\'");
return `<button class="btn-eliminar-fila" onclick="eliminarQuiniela('${f}')">🗑️</button>`;
},
},
];
}
/*                         Esto de abajo trabaja en construir las filas de la tabla desde el folio 1 hasta el 5000                                 */ 
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
(q.picks || []).forEach((pick, idx) => {
row[`_pick_${idx}`] = pick || '';
});
rows.push(row);
} else {
const empty = { '#': i, folio: '', nombre: '', vendedor: '', puntos: '' };
state.partidos.forEach((_, idx) => {
empty[`_pick_${idx}`] = '';
});
rows.push(empty);
}
}
state.rowDataCache = rows;
return rows;
}
/*                          Esto de abajo trabaja en renderizar la tabla principal con columnas y datos actualizados                                        */ 
function renderTabla() {
if (!gridApi) return;
const rows = buildRowData();
gridApi.setGridOption('columnDefs', buildColumnDefs());
gridApi.setGridOption('rowData', rows);
setTimeout(() => gridApi.sizeColumnsToFit(), 50);
const counter = document.getElementById('rowsCounter');
if (counter) counter.textContent = state.datosOriginales.length + ' registros';
}
/*                          Esto de abajo trabaja en mostrar las capturas de resultados con equipos, logos y marcador                                    */ 
function renderResultadosInputs() {
const container = document.getElementById('resultadosGrid');
if (!container) return;
container.innerHTML = '';
state.partidos.forEach((partido, idx) => {
const key = String(partido.id);
const curRes = state.resultados[key] || '';
const curMarcador = state.marcadores[key] || { local: '', visita: '' };
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
img.src = src || '';
img.alt = nombreCorto || '';
img.title = nombreCorto || '';
img.width = 34;
img.height = 34;
img.loading = 'lazy';
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
const nombrePartido = document.createElement('div');
nombrePartido.className = 'resultado-partido-nombre';
nombrePartido.textContent = `${partido.local || 'Local'} vs ${partido.visitante || 'Visitante'}`;
grupo.appendChild(nombrePartido);
const marcadorWrap = document.createElement('div');
marcadorWrap.className = 'resultado-marcador';
const inputLocal = document.createElement('input');
inputLocal.type = 'number';
inputLocal.min = '0';
inputLocal.max = '20';
inputLocal.className = 'marcador-input';
inputLocal.placeholder = '-';
inputLocal.value = curMarcador.local ?? '';
inputLocal.dataset.idx = idx;
inputLocal.dataset.rol = 'local';
inputLocal.setAttribute('aria-label', `Goles local P${idx + 1}`);
const guion = document.createElement('span');
guion.className = 'marcador-guion';
guion.textContent = ':';
guion.style.cssText = 'font-size:13px;font-weight:800;color:var(--gray-400);';
const inputVisita = document.createElement('input');
inputVisita.type = 'number';
inputVisita.min = '0';
inputVisita.max = '20';
inputVisita.className = 'marcador-input';
inputVisita.placeholder = '-';
inputVisita.value = curMarcador.visita ?? '';
inputVisita.dataset.idx = idx;
inputVisita.dataset.rol = 'visita';
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
if (!estaActivo) {
btn.classList.add('active');
state.resultados[key] = val;
} else {
delete state.resultados[key];
}
actualizarResaltado(inputLocal, inputVisita, btns);
procesarDatos();
renderTabla();
actualizarEstadisticas();
});
btns.appendChild(btn);
});
grupo.appendChild(btns);
function actualizarResaltado(inpL, inpV, botonesDiv) {
const activo = botonesDiv.querySelector('.resultado-btn.active')?.dataset.val;
inpL.classList.remove('ganador', 'perdedor');
inpV.classList.remove('ganador', 'perdedor');
if (activo === 'L') {
inpL.classList.add('ganador');
inpV.classList.add('perdedor');
}
if (activo === 'V') {
inpL.classList.add('perdedor');
inpV.classList.add('ganador');
}
}
function onMarcadorChange() {
const gl = parseInt(inputLocal.value, 10);
const gv = parseInt(inputVisita.value, 10);
state.marcadores[key] = {
local: inputLocal.value,
visita: inputVisita.value
};
if (isNaN(gl) || isNaN(gv) || inputLocal.value === '' || inputVisita.value === '') {
inputLocal.classList.remove('ganador', 'perdedor');
inputVisita.classList.remove('ganador', 'perdedor');
btns.querySelectorAll('.resultado-btn').forEach(b => b.classList.remove('active'));
delete state.resultados[key];
procesarDatos();
renderTabla();
actualizarEstadisticas();
return;
}
const resultado = gl > gv ? 'L' : gl === gv ? 'E' : 'V';
state.resultados[key] = resultado;
btns.querySelectorAll('.resultado-btn').forEach(b => {
b.classList.toggle('active', b.dataset.val === resultado);
});
actualizarResaltado(inputLocal, inputVisita, btns);
procesarDatos();
renderTabla();
actualizarEstadisticas();
}
inputLocal.addEventListener('input', onMarcadorChange);
inputVisita.addEventListener('input', onMarcadorChange);
if (curRes) actualizarResaltado(inputLocal, inputVisita, btns);
const oficial = document.createElement('div');
oficial.className = 'resultado-oficial-label';
oficial.textContent = partido.resultadoFinal
? `Resultado oficial: ${partido.resultadoFinal}`
: 'Sin resultado oficial';
grupo.appendChild(oficial);
container.appendChild(grupo);
});
}
/* Esto de abajo trabaja en guardar los resultados finales */                                          /* Esto de abajo trabaja en guardar los resultados finales */
async function guardarResultados() {
await conGuard(async () => {
const resultadosPayload = state.partidos
.map((partido) => {
const key = String(partido.id);
const resultado = state.resultados[key];
const marcador = state.marcadores[key] || {};
if (!resultado) return null;
return {
partido_id: partido.id,
resultado,
marcador_local: marcador.local === '' || marcador.local == null ? null : Number(marcador.local),
marcador_visita: marcador.visita === '' || marcador.visita == null ? null : Number(marcador.visita)
};
})
.filter(Boolean);
if (!resultadosPayload.length) {
throw new Error('No hay resultados capturados para guardar');
}
const res = await fetch(`${API_BASE}/api/apiparaactualizarlosresultados`, {
method: 'POST',
headers: getAuthHeaders(),
body: JSON.stringify({
jornada: state.jornada,
resultados: resultadosPayload
})
});
const data = await res.json();
if (!res.ok || !data.success) {
throw new Error(data.mensaje || data.error || 'Error al guardar resultados');
}
toast(data.mensaje || 'Resultados guardados correctamente', 'success');
await cargarDatos();
}, ['btnGuardarResultados']);
}
/*                   Esto de abajo trabaja en limpiar resultados cargados en pantalla y recalcular puntos                                        */ 
async function limpiarResultados() {
state.resultados = {};
state.marcadores = {};
state.rowDataCache = null;
renderResultadosInputs();
procesarDatos();
renderTabla();
actualizarEstadisticas();
toast('Resultados limpiados localmente', 'success');
}
/*                   Esto de abajo trabaja en activar la funcion de bloquear y la de en espera la lista en la apidelalistaoficial                  */
function actualizarUIBotonBloquear() {
const btn = document.getElementById('btnBloquear');
if (!btn) return;
if (state.listaBloqueada) {
btn.textContent = 'Bloqueo (Activado) 🔴';
btn.classList.add('bloqueado');
} else {
btn.textContent = 'Bloqueo (Desactivado) 🟢';
btn.classList.remove('bloqueado');
}
}
async function toggleBloqueo() {
await conGuard(async () => {
const res = await fetch(`${API_BASE}/api/togglebloqueo`, {
method: 'POST',
headers: getAuthHeaders(),
body: JSON.stringify({ activar: !state.listaBloqueada })
});
const data = await res.json();
if (!res.ok || !data.success) {
throw new Error(data.mensaje || data.error || 'Error al cambiar modo bloqueo');
}
state.listaBloqueada = !!data.listaBloqueada;
actualizarUIBotonBloquear();
evaluarPolling();
toast(state.listaBloqueada ? 'Lista bloqueada 🔒' : 'Lista desbloqueada 🔓', 'success');
}, ['btnBloquear']);
}
/*                              Esto de abajo trabaja en activar o quitar el modo espera                                                                        */
function actualizarUIBotonEspera() {
const btn = document.getElementById('btnEspera');
if (state.modoEspera) {
btn.textContent = 'En espera (Activado) 🔴';
btn.classList.add('bloqueado');
} else {
btn.textContent = 'En espera (Desactivado) 🟢';
btn.classList.remove('bloqueado');
}
}
async function toggleModoEspera() {
await conGuard(async () => {
const res = await fetch(`${API_BASE}/api/togglemodoespera`, {
method: 'POST',
headers: getAuthHeaders(),
body: JSON.stringify({ activar: !state.modoEspera })
});
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || 'Error al cambiar modo en espera');
state.modoEspera = data.modoEspera;
actualizarUIBotonEspera();
evaluarPolling();
toast(state.modoEspera ? 'Modo en espera activado ⏳' : 'Modo en espera desactivado ⏳', 'success');
});
}
/*                                                    Esto de abajo trabaja en importar un archivo csv                                                       */ 
async function importararchivodeexcel(event) {
const file = event.target.files[0];
event.target.value = '';
if (!file) return;
const jornadaEsperada = (state.jornada || '').toLowerCase().replace(/\s+/g, '');
const nombreSinExtension = file.name.replace(/\.csv$/i, '').toLowerCase().replace(/\s+/g, '');
if (nombreSinExtension !== jornadaEsperada) {
toast(`❌ El archivo debe llamarse exactamente "${state.jornada}.csv". Tu archivo se llama "${file.name}".`, 'error', 8000);
return;
}
const texto = await file.text();
const lineas = texto.split(/\r?\n/).filter(l => l.trim());
lineas.shift();
if (!lineas.length) {
toast('El archivo no tiene filas', 'error');
return;
}
const numPicks = state.partidos.length || 9;
const filas = lineas.map(linea => {
const cols = linea.split(',');
const inicioExtras = 3 + numPicks;
return {
folio: (cols[0] || '').trim(),
nombre: (cols[1] || '').trim(),
vendedor: (cols[2] || '').trim(),
picks: cols.slice(3, inicioExtras).map(p => p.trim().toUpperCase()),
dispositivoid: (cols[inicioExtras] || '').trim(),
llavemaestra: (cols[inicioExtras + 2] || '').trim()
};
}).filter(f => f.folio && f.nombre && f.vendedor);
if (!filas.length) {
toast('El archivo no tiene filas válidas', 'error');
return;
}
await conGuard(async () => {
const res = await fetch(`${API_BASE}/api/importararchivodeexcel`, {
method: 'POST',
headers: getAuthHeaders(),
body: JSON.stringify({ jornada: state.jornada, filas })
});
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || 'Error al importar');
const chips = (data.foliosrechazados || []).map(f => `<span class="modal-folio-chip">${f}</span>`).join('');
const html = `
<p><strong>Archivo:</strong> ${file.name}</p>
<p><strong>Jornada:</strong> ${state.jornada}</p>
<p><strong>Total de filas leídas:</strong> ${filas.length}</p>
<p style="color:#16a34a;font-weight:700;">✅ Nuevas quinielas insertadas: ${data.insertadas}</p>
<p style="color:#2563eb;font-weight:700;">🔄 Reactivadas desde archivadas: ${data.reactivadas}</p>
<p style="color:#dc2626;font-weight:700;">⏭️ Filas con picks inválidos: ${data.rechazadas}</p>
${chips ? `<p><strong>Folios con error:</strong></p><div>${chips}</div>` : ''}
`;
abrirModalImportar(html);
await cargarDatos();
});
}
/* Esto de abajo trabaja en exportar la lista oficial completa a archivo csv */ /* Esto de abajo trabaja en exportar la lista oficial completa a archivo csv */
function exportarExcel() {
const MAX_FOLIO = 5000;
const numPartidos = state.partidos.length || (state.datosOriginales[0]?.picks?.length || 9);
if (!state.datosOriginales.length && !confirm('No hay quinielas cargadas. ¿Exportar de todas formas los 5000 folios vacíos?')) return;
const pickHeaders = Array.from({ length: numPartidos }, (_, i) => `P${i + 1}`);
const headers = ['Folio', 'Nombre', 'Vendedor', ...pickHeaders, 'DispositivoId', 'Id', 'LlaveMaestra'];
const csvLines = [headers.join(',')];
const porFolio = {};
state.datosOriginales.forEach(q => {
const n = parseInt(q.folio, 10);
if (!isNaN(n) && n >= 1 && n <= MAX_FOLIO) porFolio[n] = q;
});
let exportadas = 0;
for (let i = 1; i <= MAX_FOLIO; i++) {
const q = porFolio[i];
if (q) {
const nombre = (q.nombre ?? '').replace(/,/g, ' ');
const vendedor = (q.vendedor ?? '').replace(/,/g, ' ');
const picks = Array.from({ length: numPartidos }, (_, idx) => {
const v = Array.isArray(q.picks) ? q.picks[idx] : undefined;
return (v && v !== '-') ? v : '';
});
csvLines.push(`${q.folio ?? i},${nombre},${vendedor},${picks.join(',')},${q.dispositivoid ?? ''},${q.id ?? ''},${q.llavemaestra ?? ''}`);
exportadas++;
} else {
const vacios = Array(numPartidos).fill('').join(',');
csvLines.push(`${i},,,${vacios},,,`);
}
}
const nombreArchivo = (state.jornada || 'Jornada').replace(/[\\/:*?"<>|]/g, '');
descargarCSVBlob(csvLines.join('\n'), `${nombreArchivo}.csv`);
toast(`✅ Exportado: ${exportadas} quinielas + ${MAX_FOLIO - exportadas} folios vacíos (total ${MAX_FOLIO})`, 'success', 6000);
}
/*                                       Esto de abajo trabaja en generar los archivos de excel                                                       */
function descargarCSVBlob(csv, filename) {
if (!csv || !filename) return;
const bom = '\uFEFF';
const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/*                          Esto de abajo trabaja en el boton de Nueva quiniela para empezar de 0                                                           */ 
function confirmarNuevaJornada() {
document.getElementById('modalNuevaJornada').classList.add('visible');
}
function cerrarModalNuevaJornada() {
document.getElementById('modalNuevaJornada').classList.remove('visible');
}
async function ejecutarNuevaJornada() {
cerrarModalNuevaJornada();
await conGuard(async () => {
const res = await fetch(`${API_BASE}/api/nuevajornada`, {
method: 'POST',
headers: getAuthHeaders(),
body: JSON.stringify({ confirmacion: 'SI_BORRAR_TODO' })
});
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || 'Error al iniciar nueva jornada');
toast('✅ ' + data.mensaje, 'success', 7000);
await cargarDatos();
});
}
/*                                       Esto de abajo trabaja en el modal de confirmar archivar todas las quinielas                                     */ 
function confirmarArchivarTodas() {
document.getElementById('modalArchivarTodas').classList.add('visible');
}
function cerrarModalArchivarTodas() {
document.getElementById('modalArchivarTodas').classList.remove('visible');
}
async function ejecutarArchivarTodas() {
cerrarModalArchivarTodas();
await conGuard(async () => {
const res = await fetch(`${API_BASE}/api/archivarjugando`, {
method: 'POST',
headers: getAuthHeaders()
});
const data = await res.json();
if (!res.ok || !data.success) throw new Error(data.mensaje || 'Error al archivar');
toast('✅ ' + data.mensaje, 'success', 7000);
await cargarDatos();
});
}
/*                                 Esto de abajo trabaja en actualizar las estadisticas generales de la lista oficial                                         */ 
function actualizarEstadisticas() {
const { datosOriginales: datos, primerPuntos: p1, segundoPuntos: p2 } = state;
const ids = ['totalStat', 'firstStat', 'secondStat', 'vendedoresStat'];
if (!datos.length) {
ids.forEach(id => {
const el = document.getElementById(id);
if (el) el.textContent = '0';
});
return;
}
const hayRes = p1 >= 0;
const c1 = hayRes ? datos.filter(q => q.puntos === p1).length : 0;
const c2 = (hayRes && p2 >= 0) ? datos.filter(q => q.puntos === p2).length : 0;
const cv = new Set(datos.map(q => q.vendedor).filter(Boolean)).size;
const set = (id, val) => {
const el = document.getElementById(id);
if (el) el.textContent = val;
};
set('totalStat', datos.length);
set('firstStat', c1);
set('secondStat', c2);
set('vendedoresStat', cv);
}
/* Esto de abajo trabaja en mostrar u ocultar la capa de carga del sistema */           /* Esto de abajo trabaja en mostrar u ocultar la capa de carga del sistema */
function mostrarLoading(show) {
document.getElementById('loadingOverlay')?.classList.toggle('show', show);
}
/*                                 Esto de abajo trabaja en mostrar errores de carga y limpiar la tabla cuando algo falla                                  */ 
function mostrarError(mensaje) {
if (gridApi) gridApi.setGridOption('rowData', []);
console.error('Error:', mensaje);
toast('Error al cargar datos: ' + (mensaje || 'Error desconocido'), 'error', 7000);
}