/* Esto de abajo trabaja los horarios para la quiniela */                                                /* Esto de abajo trabaja los horarios para la quiniela */
let PARTIDOS_ACTUALES = [];
async function cargarHorarios() {
try {
const res = await fetch('/api/apijornadaactual');
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
PARTIDOS_ACTUALES = Array.isArray(data.partidos) ? data.partidos : [];
} catch (error) {
console.error('Error cargando horarios:', error);
PARTIDOS_ACTUALES = [];
}
renderMatchesHorarios();
}
/* Esto de abajo trabaja en funciones de apoyo (seguridad de texto e imagenes) */      /* Esto de abajo trabaja en funciones de apoyo (seguridad de texto e imagenes) */
function escapeHtml(str) {
if (typeof str !== 'string') return '';
const div = document.createElement('div');
div.textContent = str;
return div.innerHTML;
}
function _isSafeImageUrl(url) {
if (typeof url !== 'string' || !url.trim()) return false;
if (url.startsWith('/') && !url.startsWith('//')) return true;
if (!url.includes('://')) return true;
try {
const parsed = new URL(url);
return parsed.protocol === 'https:' || parsed.protocol === 'http:';
} catch {
return false;
}
}
/* Esto de abajo trabaja en pintar las tarjetas de partidos en pantalla */                 /* Esto de abajo trabaja en pintar las tarjetas de partidos en pantalla */
function renderMatchesHorarios() {
const container = document.getElementById('matchesHorarios');
if (!container) return;
const partidos = PARTIDOS_ACTUALES;
if (partidos.length === 0) {
container.innerHTML = '<p class="empty-state-msg">No hay partidos configurados para esta jornada.</p>';
return;
}
container.innerHTML = partidos.map(partido => {
const logoLocal = _isSafeImageUrl(partido.localLogo) ? escapeHtml(partido.localLogo) : '';
const logoVisita = _isSafeImageUrl(partido.visitanteLogo) ? escapeHtml(partido.visitanteLogo) : '';
const logoTv = _isSafeImageUrl(partido.televisionLogo) ? escapeHtml(partido.televisionLogo) : '';
const tieneResultado = partido.resultadoFinal != null;
const marcadorTexto = tieneResultado ? `${partido.marcadorLocal} - ${partido.marcadorVisita}` : '0 - 0';
const ganoLocal = partido.resultadoFinal === 'L';
const ganoVisita = partido.resultadoFinal === 'V';
const esEmpate = partido.resultadoFinal === 'E';
const badgeLocal = ganoLocal ? '<span class="match-check">✔️</span>' : '';
const badgeVisita = ganoVisita ? '<span class="match-check">✔️</span>' : '';
const badgeEmpate = esEmpate ? '<span class="match-draw-badge">=</span>' : '';
const tvHtml = logoTv
? `<img src="${logoTv}" alt="${escapeHtml(partido.televisora ?? 'Televisora')}" class="match-tv-logo" width="52" height="52" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null">`
: '<span class="match-tv-unavailable">Sin señal</span>';
return (
'<div class="match-card">' +
'<div class="match-league match-league-header">' +
`<span>${escapeHtml(partido.horario ?? 'Horario por confirmar')}</span>` +
`<div class="match-tv">${tvHtml}</div>` +
'</div>' +
'<div class="match-teams">' +
'<div class="match-team">' +
'<div class="team-logo-wrap">' +
`<img src="${logoLocal}" alt="${escapeHtml(partido.local ?? '')}" class="team-logo" width="56" height="56" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null">` +
badgeLocal +
'</div>' +
`<span>${escapeHtml(partido.local ?? 'Equipo')}</span>` +
'</div>' +
'<div class="match-vs">VS</div>' +
'<div class="match-team">' +
'<div class="team-logo-wrap">' +
`<img src="${logoVisita}" alt="${escapeHtml(partido.visitante ?? '')}" class="team-logo" width="56" height="56" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null">` +
badgeVisita +
'</div>' +
`<span>${escapeHtml(partido.visitante ?? 'Equipo')}</span>` +
'</div>' +
'</div>' +
'<div class="match-bottom">' +
'<div class="match-marcador">' +
'<span class="marcador-label">Marcador</span>' +
`<span class="marcador-score">${marcadorTexto}</span>` +
badgeEmpate +
'</div>' +
'</div>' +
'</div>'
);
}).join('');
}
document.addEventListener('DOMContentLoaded', cargarHorarios);