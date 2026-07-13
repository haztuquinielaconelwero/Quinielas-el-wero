/* Esto de abajo trabaja los porcentajes para la quiniela */                                              /* Esto de abajo trabaja los porcentajes para la quiniela */
let PARTIDOS_ACTUALES = [];
async function cargarPorcentajes() {
try {
const res = await fetch('/api/apiporcentajesactuales');
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = await res.json();
PARTIDOS_ACTUALES = Array.isArray(data.partidos) ? data.partidos : [];
} catch (error) {
console.error('Error cargando porcentajes:', error);
PARTIDOS_ACTUALES = [];
}
renderMatchesHorarios();
}
/* Esto de abajo trabaja en funciones de apoyo (seguridad de texto e imagenes) */ /* Esto de abajo trabaja en funciones de apoyo (seguridad de texto e imagenes) */
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
/* Esto de abajo trabaja en pintar las tarjetas de partidos en pantalla */                /* Esto de abajo trabaja en pintar las tarjetas de partidos en pantalla */
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
const pL = partido.porcL ?? 0;
const pE = partido.porcE ?? 0;
const pV = partido.porcV ?? 0;
return (
'<div class="match-card">' +
'<div class="match-league match-league-header">' +
`<span>${escapeHtml(partido.horario ?? 'Porcentajes por confirmar')}</span>` +
'</div>' +
'<div class="match-teams">' +
'<div class="match-team">' +
`<img src="${logoLocal}" alt="${escapeHtml(partido.local ?? '')}" class="team-logo" width="40" height="40" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null">` +
`<span>${escapeHtml(partido.local ?? 'Equipo')}</span>` +
'</div>' +
'<div class="match-vs">VS</div>' +
'<div class="match-team">' +
`<img src="${logoVisita}" alt="${escapeHtml(partido.visitante ?? '')}" class="team-logo" width="40" height="40" loading="lazy" onerror="this.style.visibility='hidden';this.onerror=null">` +
`<span>${escapeHtml(partido.visitante ?? 'Equipo')}</span>` +
'</div>' +
'</div>' +
'<div class="match-porcentajes">' +
'<div class="porcentaje-fila">' +
'<span class="porcentaje-letra letra-l">L</span>' +
`<div class="porcentaje-bar"><div class="porcentaje-fill fill-l" style="width:${pL}%"></div></div>` +
`<span class="porcentaje-num">${pL}%</span>` +
'</div>' +
'<div class="porcentaje-fila">' +
'<span class="porcentaje-letra letra-e">E</span>' +
`<div class="porcentaje-bar"><div class="porcentaje-fill fill-e" style="width:${pE}%"></div></div>` +
`<span class="porcentaje-num">${pE}%</span>` +
'</div>' +
'<div class="porcentaje-fila">' +
'<span class="porcentaje-letra letra-v">V</span>' +
`<div class="porcentaje-bar"><div class="porcentaje-fill fill-v" style="width:${pV}%"></div></div>` +
`<span class="porcentaje-num">${pV}%</span>` +
'</div>' +
'</div>' +
'</div>'
);
}).join('');
}
document.addEventListener('DOMContentLoaded', cargarPorcentajes);