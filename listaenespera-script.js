
let datosOriginales = [];
let partidos = [];
let gridApi = null;
let ultimaInteraccion = Date.now();

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
    getRowClass: params => params.data && params.data._verificada ? 'fila-verificada' : '',
    onGridSizeChanged: () => gridApi && gridApi.sizeColumnsToFit(),
  };
  gridApi = agGrid.createGrid(document.getElementById('myGrid'), gridOptions);
}

async function cargarDatos() {
  try {
    mostrarLoading(true);
    const [resPartidos, resEspera] = await Promise.all([
      fetch('/api/partidos'),
      fetch('/api/espera?vendedor=ALL'),
    ]);
    if (!resPartidos.ok) throw new Error(`Error partidos: ${resPartidos.status}`);
    if (!resEspera.ok) throw new Error(`Error espera: ${resEspera.status}`);

    const dataPartidos = await resPartidos.json();
    const dataEspera = await resEspera.json();

    partidos = dataPartidos.partidos || [];
    datosOriginales = (dataEspera.espera || []).map(q => ({
      id: q.id,
      nombre: q.nombre || '',
      vendedor: q.vendedor || '',
      picks: q.picks || [],
      dispositivo_id: q.dispositivo_id || q.dispositivoId || '',
      llave_maestra: q.llave_maestra || q.llaveMaestra || '',
      _verificada: false,
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
      _verificada: q._verificada,
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

/*
  Logica de "Actualizar":
  1. Vuelve a cargar la lista en espera (por si llegaron nuevas quinielas desde la Lista Oficial).
  2. Toma los IDs actuales en espera y le pregunta al backend cuales de esos IDs
     ya existen en la Lista Oficial (fueron capturados manualmente).
  3. Las que ya existen en la Lista Oficial se remueven de la vista de espera
     (y opcionalmente se eliminan/marcan en el backend para que no vuelvan a aparecer).

  Se asume un endpoint POST /api/lista-oficial/verificar-ids
  que recibe { ids: [...] } y responde { existentes: [ids que ya estan en la Lista Oficial] }.
  Ajusta el nombre del endpoint si tu backend usa otro.
*/
async function actualizarYVerificar() {
  try {
    mostrarLoading(true);
    await cargarDatos();

    if (!datosOriginales.length) {
      document.getElementById('verificadasStat').textContent = '0';
      return;
    }

    const ids = datosOriginales.map(q => q.id);
    const resVerificar = await fetch('/api/lista-oficial/verificar-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (!resVerificar.ok) throw new Error(`Error verificando IDs: ${resVerificar.status}`);

    const dataVerificar = await resVerificar.json();
    const existentes = new Set(dataVerificar.existentes || []);

    if (existentes.size > 0) {
      datosOriginales.forEach(q => { q._verificada = existentes.has(q.id); });

      await Promise.allSettled(
        [...existentes].map(id =>
          fetch(`/api/espera/${id}`, { method: 'DELETE' })
        )
      );

      datosOriginales = datosOriginales.filter(q => !existentes.has(q.id));
    }

    document.getElementById('verificadasStat').textContent = existentes.size;
    poblarFiltroVendedores();
    renderTabla();
    actualizarEstadisticas();

    if (existentes.size > 0) {
      alert(`${existentes.size} quiniela(s) ya estaban en la Lista Oficial y se removieron de espera ✅`);
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
