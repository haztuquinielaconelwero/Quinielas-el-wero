/* Esto de abajo trabaja los horarios para la quiniela */                                                   /* Esto de abajo trabaja los horarios para la quiniela */
const PARTIDOS_JORNADA_1 = [
{ local: "Necaxa", localLogo: "logos/necaxa.png", visitante: "Atlante", visitanteLogo: "logos/atlante.png", horario: "Jueves 16 de Julio - 7:00 pm", tvLogo: "logos/tudn.png", televisora: "TUDN" },
{ local: "Tijuana", localLogo: "logos/tijuana.png", visitante: "Tigres", visitanteLogo: "logos/tigres.png", horario: "Jueves 16 de Julio - 9:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "San Luis", localLogo: "logos/san-luis.png", visitante: "Cruz Azul", visitanteLogo: "logos/cruz-azul.png", horario: "Viernes 17 de Julio - 7:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "León", localLogo: "logos/leon.png", visitante: "Atlas", visitanteLogo: "logos/atlas.png", horario: "Viernes 17 de Julio - 7:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "FC Juárez", localLogo: "logos/juarez.png", visitante: "Puebla", visitanteLogo: "logos/puebla.png", horario: "Viernes 17 de Julio - 9:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "Pumas", localLogo: "logos/pumas.png", visitante: "Santos", visitanteLogo: "logos/santos.png", horario: "Sábado 18 de Julio - 5:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "Chivas", localLogo: "logos/chivas.png", visitante: "Pachuca", visitanteLogo: "logos/pachuca.png", horario: "Sábado 18 de Julio - 7:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "Monterrey", localLogo: "logos/monterrey.png", visitante: "Toluca", visitanteLogo: "logos/toluca.png", horario: "Sábado 18 de Julio - 7:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" },
{ local: "Querétaro", localLogo: "logos/queretaro.png", visitante: "América", visitanteLogo: "logos/america.png", horario: "Sábado 18 de Julio - 9:00 pm", tvLogo: "logos/caliente.png", televisora: "Caliente TV" }
]; 
/* Esto de abajo trabaja en funciones de apoyo (seguridad de texto e imagenes) */        /* Esto de abajo trabaja en funciones de apoyo (seguridad de texto e imagenes) */
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
/* Esto de abajo trabaja en pintar las tarjetas de partidos en pantalla */                        /* Esto de abajo trabaja en pintar las tarjetas de partidos en pantalla */
function renderMatchesHorarios() {
const container = document.getElementById('matchesHorarios');
if (!container) return;
const partidos = PARTIDOS_JORNADA_1;
if (partidos.length === 0) {
container.innerHTML = '<p class="empty-state-msg">No hay partidos configurados para esta jornada.</p>';
return;
}
container.innerHTML = partidos.map(partido => {
const logoLocal = _isSafeImageUrl(partido.localLogo) ? escapeHtml(partido.localLogo) : '';
const logoVisita = _isSafeImageUrl(partido.visitanteLogo) ? escapeHtml(partido.visitanteLogo) : '';
const logoTv = _isSafeImageUrl(partido.tvLogo) ? escapeHtml(partido.tvLogo) : '';
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
`<img src="${logoLocal}" alt="${escapeHtml(partido.local ?? '')}"` +
` class="team-logo" width="56" height="56" loading="lazy"` +
` onerror="this.style.visibility='hidden';this.onerror=null">` +
`<span>${escapeHtml(partido.local ?? 'Equipo')}</span>` +
'</div>' +
'<div class="match-vs">VS</div>' +
'<div class="match-team">' +
`<img src="${logoVisita}" alt="${escapeHtml(partido.visitante ?? '')}"` +
` class="team-logo" width="56" height="56" loading="lazy"` +
` onerror="this.style.visibility='hidden';this.onerror=null">` +
`<span>${escapeHtml(partido.visitante ?? 'Equipo')}</span>` +
'</div>' +
'</div>' +
'<div class="match-bottom">' +
'<div class="match-marcador">' +
'<span class="marcador-label">Marcador</span>' +
'<span class="marcador-score">0 - 0</span>' +
'</div>' +
'</div>' +
'</div>'
);
}).join('');
}
document.addEventListener('DOMContentLoaded', renderMatchesHorarios);