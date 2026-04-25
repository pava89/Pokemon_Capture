/* ═══════════════════════════════════════════════════════════════
   conexion_index.js  —  Pokédex Frontend Principal
   ═══════════════════════════════════════════════════════════════
   • Autenticación (login / registro) con sessionStorage
   • Carga de Pokémon desde el BACKEND (nunca directo de PokeAPI)
   • Sprites / tipos enriquecidos con PokeAPI solo como apoyo
   • Captura correcta enviando {pokemonId, usuarioCedula}
   • Colección personal cruzada con lista del backend
   • Buscador en tiempo real
   • Toasts, loader, barra de progreso, cache de sprites
   ══════════════════════════════════════════════════════════════= */

'use strict';

/* ──────────────────────────────────────────
   ESTADO GLOBAL
─────────────────────────────────────────── */
const Estado = {
  usuario:          null,   // { cedula, nombre, email, edad }
  todosPokemon:     [],     // lista completa del backend
  capturados:       new Set(), // Set de pokemonId capturados por el usuario
  spriteCache:      {},     // { nombrePokemon: urlSprite }
  tipoCache:        {},     // { nombrePokemon: [tipo1, tipo2] }
  poderCache:       {},     // { id: poder }
  filtroBusqueda:   '',
};

/* ──────────────────────────────────────────
   CONSTANTES
─────────────────────────────────────────── */
const API_BASE    = '';               // mismo origen que el backend Express
const POKEAPI     = 'https://pokeapi.co/api/v2/pokemon';
const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

/* ══════════════════════════════════════════
   UTILIDADES GENERALES
══════════════════════════════════════════ */

/** Muestra / oculta el loader global */
function setLoader(visible) {
  document.getElementById('loader').classList.toggle('hidden', !visible);
}

/** Cambia de pantalla activa */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.classList.add('active');
}

/** Toast de notificación  tipo: 'success' | 'error' | 'info' */
function toast(mensaje, tipo = 'info', duracion = 3400) {
  const container = document.getElementById('toast-container');
  const iconos = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.innerHTML = `<span>${iconos[tipo] ?? 'ℹ️'}</span><span>${mensaje}</span>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), duracion);
}

function abrirModalCaptura({ titulo, mensaje, meta = '', exito = true }) {
  const modal = document.getElementById('capture-modal');
  const title  = document.getElementById('capture-modal-title');
  const text   = document.getElementById('capture-modal-text');
  const info   = document.getElementById('capture-modal-meta');

  if (!modal || !title || !text || !info) {
    toast(mensaje, exito ? 'success' : 'error');
    return;
  }

  title.textContent = titulo;
  text.textContent = mensaje;
  info.textContent = meta;

  modal.classList.remove('hidden');
  modal.classList.toggle('success', exito);
  modal.classList.toggle('error', !exito);
}

function cerrarModalCaptura() {
  const modal = document.getElementById('capture-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('success', 'error');
  document.getElementById('capture-modal-title').textContent = 'Poké Ball lista';
  document.getElementById('capture-modal-text').textContent = '';
  document.getElementById('capture-modal-meta').textContent = '';
}

function bindModalCaptura() {
  document.getElementById('capture-modal-close')?.addEventListener('click', cerrarModalCaptura);

  document.getElementById('capture-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'capture-modal') cerrarModalCaptura();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalCaptura();
  });
}

/** Formatea número de Pokémon como #001 */
function formatNum(n) {
  return '#' + String(n).padStart(3, '0');
}

/** Normaliza nombre para PokeAPI (minúsculas, sin espacios raros) */
function normalizarNombre(nombre) {
  return String(nombre)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/* ══════════════════════════════════════════
   FETCH HELPERS
══════════════════════════════════════════ */

/** GET genérico al backend */
async function apiGet(ruta) {
  const res = await fetch(`${API_BASE}${ruta}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${ruta}`);
  return res.json();
}

/** POST genérico al backend */
async function apiPost(ruta, body) {
  const res = await fetch(`${API_BASE}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const d = await res.json(); msg = d.mensaje || d.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

/** Obtiene datos de PokeAPI para un Pokémon (con cache) */
async function fetchPokeAPI(nombre) {
  const key = normalizarNombre(nombre);
  if (Estado.spriteCache[key] && Estado.tipoCache[key]) return; // ya tenemos todo
  try {
    const res = await fetch(`${POKEAPI}/${key}`);
    if (!res.ok) return;
    const data = await res.json();
    Estado.spriteCache[key] = data.sprites?.other?.['official-artwork']?.front_default
      || data.sprites?.front_default
      || null;
    Estado.tipoCache[key] = data.types?.map(t => t.type.name) ?? [];
  } catch (_) {
    // falla silenciosa — no bloqueamos la UI por PokeAPI
  }
}

/* ══════════════════════════════════════════
   SESIÓN / AUTH
══════════════════════════════════════════ */

function guardarSesion(usuario) {
  Estado.usuario = usuario;
  sessionStorage.setItem('pokedex_usuario', JSON.stringify(usuario));
}

function cargarSesion() {
  const raw = sessionStorage.getItem('pokedex_usuario');
  if (!raw) return false;
  try {
    Estado.usuario = JSON.parse(raw);
    return true;
  } catch (_) {
    return false;
  }
}

function cerrarSesion() {
  sessionStorage.removeItem('pokedex_usuario');
  Estado.usuario       = null;
  Estado.capturados    = new Set();
  Estado.todosPokemon  = [];
  Estado.filtroBusqueda = '';
  showScreen('screen-login');
  toast('Sesión cerrada', 'info');
}

/* ══════════════════════════════════════════
   LOGIN
══════════════════════════════════════════ */
async function handleLogin() {
  const cedula = document.getElementById('login-cedula').value.trim();
  if (!cedula) { toast('Ingresa tu cédula', 'error'); return; }

  setLoader(true);
  try {
    // Buscamos el usuario en la lista del backend
    const data = await apiGet('/api/usuarios/listar');
    const lista = data.resultado ?? data ?? [];
    const usuario = lista.find(u => String(u.cedula) === cedula);

    if (!usuario) {
      toast('Cédula no registrada. Regístrate primero.', 'error');
      switchTab('register');
      document.getElementById('reg-cedula').value = cedula;
      return;
    }

    guardarSesion(usuario);
    await entrarAlSistema();
  } catch (err) {
    console.error('[Login]', err);
    toast('Error al conectar con el servidor', 'error');
  } finally {
    setLoader(false);
  }
}

/* ══════════════════════════════════════════
   REGISTRO
══════════════════════════════════════════ */
async function handleRegistro() {
  const cedula = document.getElementById('reg-cedula').value.trim();
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email  = document.getElementById('reg-email').value.trim();
  const edad   = parseInt(document.getElementById('reg-edad').value);

  // Validaciones básicas
  if (!cedula || !nombre || !email || !edad) {
    toast('Completa todos los campos', 'error'); return;
  }
  if (cedula.length < 6) {
    toast('La cédula debe tener al menos 6 dígitos', 'error'); return;
  }
  if (isNaN(edad) || edad < 18 || edad > 100) {
    toast('Edad debe ser entre 18 y 100', 'error'); return;
  }
  if (!email.includes('@')) {
    toast('Email no válido', 'error'); return;
  }

  setLoader(true);
  try {
    await apiPost('/api/usuarios/registrar', { cedula, nombre, email, edad });
    toast(`¡Bienvenido, ${nombre}! Cuenta creada ✅`, 'success');
    const usuario = { cedula, nombre, email, edad };
    guardarSesion(usuario);
    await entrarAlSistema();
  } catch (err) {
    // Si ya existe → intentamos login automático
    if (err.message.toLowerCase().includes('exist')
      || err.message.toLowerCase().includes('duplic')
      || err.message.toLowerCase().includes('unique')
      || err.message.includes('400')) {
      toast('Cédula ya registrada, iniciando sesión automáticamente…', 'info');
      try {
        const data = await apiGet('/api/usuarios/listar');
        const lista = data.resultado ?? data ?? [];
        const usuario = lista.find(u => String(u.cedula) === cedula);
        if (usuario) {
          guardarSesion(usuario);
          await entrarAlSistema();
          return;
        }
      } catch (_) {}
    }
    console.error('[Registro]', err);
    toast('Error al registrar: ' + err.message, 'error');
  } finally {
    setLoader(false);
  }
}

/* ══════════════════════════════════════════
   ENTRAR AL SISTEMA (post auth)
══════════════════════════════════════════ */
async function entrarAlSistema() {
  // 1. Cargar datos base del backend
  await Promise.all([
    cargarTodosPokemon(),
    cargarCapturados(),
  ]);

  // 2. Actualizar hub
  actualizarHub();

  // 3. Ir al hub
  showScreen('screen-hub');
}

/* ══════════════════════════════════════════
   CARGAR TODOS LOS POKÉMON (BACKEND)
══════════════════════════════════════════ */
async function cargarTodosPokemon() {
  try {
    const data = await apiGet('/api/pokemon/listar');
    // El backend devuelve { resultado: [...] } o directamente un array
    Estado.todosPokemon = data.resultado ?? data ?? [];

    // Pre-cache de sprites en paralelo (sin bloquear)
    Estado.todosPokemon.forEach(p => {
      fetchPokeAPI(p.nombre).catch(() => {});
    });
  } catch (err) {
    console.error('[cargarTodosPokemon]', err);
    Estado.todosPokemon = [];
    toast('No se pudo cargar la lista de Pokémon', 'error');
  }
}

/* ══════════════════════════════════════════
   CARGAR CAPTURADOS DEL USUARIO
══════════════════════════════════════════ */
async function cargarCapturados() {
  if (!Estado.usuario?.cedula) return;
  try {
    const data = await apiGet(`/api/captura/listar/${Estado.usuario.cedula}`);
    const lista = data.resultado ?? data ?? [];
    Estado.capturados = new Set(lista.map(c => {
      // El backend puede devolver pokemonId o pokemon_id o incluso el objeto pokemon
      return c.pokemonId ?? c.pokemon_id ?? c.PokemonId ?? c.id ?? c;
    }));
  } catch (err) {
    console.error('[cargarCapturados]', err);
    Estado.capturados = new Set();
  }
}

/* ══════════════════════════════════════════
   HUB — actualizar estadísticas
══════════════════════════════════════════ */
function actualizarHub() {
  const total     = Estado.todosPokemon.length;
  const capturados = Estado.capturados.size;
  const pct       = total > 0 ? Math.round((capturados / total) * 100) : 0;

  document.getElementById('hub-username').textContent  = Estado.usuario?.nombre ?? 'Entrenador';
  document.getElementById('hub-cedula').textContent    = `Cédula: ${Estado.usuario?.cedula ?? '—'}`;
  document.getElementById('hub-captured').textContent  = capturados;
  document.getElementById('hub-total').textContent     = total;
  document.getElementById('hub-pct').textContent       = `${pct}%`;
  document.getElementById('hub-progress-fill').style.width = `${pct}%`;
}

/* ══════════════════════════════════════════
   SCREEN: CAPTURAR
══════════════════════════════════════════ */
async function abrirCapturar() {
  showScreen('screen-capturar');
  Estado.filtroBusqueda = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  document.getElementById('btn-search-clear')?.classList.add('hidden');
  await renderGridCapturar();
}

async function renderGridCapturar() {
  const grid = document.getElementById('grid-capturar');
  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando Pokémon...</p></div>`;

  if (Estado.todosPokemon.length === 0) {
    await cargarTodosPokemon();
  }
  if (Estado.capturados.size === 0 && Estado.usuario) {
    await cargarCapturados();
  }

  actualizarBarraProgreso();

  const filtro = Estado.filtroBusqueda.toLowerCase();
  const lista  = filtro
    ? Estado.todosPokemon.filter(p =>
        p.nombre?.toLowerCase().includes(filtro)
        || obtenerTipos(p).some(t => t.toLowerCase().includes(filtro))
      )
    : Estado.todosPokemon;

  grid.innerHTML = '';

  if (lista.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No se encontraron Pokémon con "<strong>${filtro}</strong>"</p>
      </div>`;
    return;
  }

  // Renderizamos las cards
  lista.forEach(pokemon => {
    const card = crearCardCapturar(pokemon);
    grid.appendChild(card);
  });
}

/** Crea una card de pokémon para la pantalla Capturar */
function crearCardCapturar(pokemon) {
  const id = Number(pokemon.id ?? pokemon.pokemonId ?? pokemon.ID);
  const nombre    = pokemon.nombre ?? pokemon.name ?? '???';
  const numStr    = formatNum(pokemon.numero ?? pokemon.num ?? id ?? 0);
  const poder     = pokemon.poder ?? pokemon.power ?? pokemon.ataque ?? '—';
  const tipos     = obtenerTipos(pokemon);
  const yaCap     = Estado.capturados.has(id);
  const spriteUrl = obtenerSprite(nombre, id);

  const card = document.createElement('div');
  card.className = `pokemon-card${yaCap ? ' captured' : ''}`;
  card.dataset.pokemonId = id;

  card.innerHTML = `
    ${yaCap ? '<div class="captured-badge">✓ Capturado</div>' : ''}
    <div class="card-sprite-wrap">
      ${spriteUrl
        ? `<img class="card-sprite" src="${spriteUrl}" alt="${nombre}"
              onerror="this.replaceWith(crearPlaceholder())">`
        : `<div class="sprite-placeholder">?</div>`}
    </div>
    <div class="card-body">
      <span class="card-number">${numStr}</span>
      <span class="card-name">${nombre}</span>
      <div class="card-types">${tipos.map(t => badgeTipo(t)).join('')}</div>
      <div class="card-poder">⚡ Poder: <strong>${poder}</strong></div>
    </div>
    <div class="card-actions">
      <button
        class="btn-capture${yaCap ? ' captured-btn' : ''}"
        data-id="${id}"
        ${yaCap ? 'disabled' : ''}
      >
        ${yaCap ? '✓ Ya capturado' : '⊕ Capturar'}
      </button>
    </div>`;

  // Evento del botón capturar
  if (!yaCap) {
    const btn = card.querySelector('.btn-capture');
    btn.addEventListener('click', () => capturar(id, nombre, btn, card));
  }

  // Si el sprite fue lazy (aún no cargado de PokeAPI), lo actualizamos
  if (!spriteUrl) {
    fetchPokeAPI(nombre).then(() => {
      const img = card.querySelector('.card-sprite-wrap');
      const url = obtenerSprite(nombre, id);
      if (url && img) {
        img.innerHTML = `<img class="card-sprite" src="${url}" alt="${nombre}"
          onerror="this.parentElement.innerHTML='<div class=\\'sprite-placeholder\\'>?</div>'">`;
      }
    });
  }

  return card;
}

/** Lógica de captura */
async function capturar(pokemonId, nombre, btn, card) {
  if (Estado.capturados.has(pokemonId)) {
    abrirModalCaptura({
      titulo: 'Ya está capturado',
      mensaje: `Ya tienes a ${nombre} en tu colección.`,
      meta: 'Prueba con otro Pokémon',
      exito: false
    });
    return;
  }

  btn.disabled = true;
  btn.classList.add('capturing');
  btn.textContent = '⟳ Capturando...';

  try {
    const respuesta = await apiPost('/api/captura/capturar', {
      pokemonId: pokemonId,
      usuarioCedula: Estado.usuario.cedula,
    });

    Estado.capturados.add(Number(pokemonId));

    btn.classList.remove('capturing');
    btn.classList.add('captured-btn');
    btn.textContent = '✓ Ya capturado';

    const badge = document.createElement('div');
    badge.className = 'captured-badge';
    badge.textContent = '✓ Capturado';
    card.classList.add('captured');
    if (!card.querySelector('.captured-badge')) card.prepend(badge);

    actualizarBarraProgreso();
    actualizarHub();

    const rareza = respuesta?.meta?.rareza ?? 'normal';
    const probabilidad = respuesta?.meta?.probabilidad ?? 0;

    abrirModalCaptura({
      titulo: '¡Poké Ball conectó!',
      mensaje: `${nombre} fue capturado con éxito.`,
      meta: `Rareza: ${rareza} • Probabilidad: ${Math.round(probabilidad * 100)}%`,
      exito: true
    });

    toast(`¡${nombre} capturado! 🎉`, 'success');
  } catch (err) {
    console.error('[Capturar]', err);
    btn.disabled = false;
    btn.classList.remove('capturing');
    btn.textContent = '⊕ Capturar';

    abrirModalCaptura({
      titulo: '¡La Poké Ball falló!',
      mensaje: err.message || 'La captura no salió esta vez.',
      meta: 'Intenta de nuevo',
      exito: false
    });

    toast(`Error al capturar: ${err.message}`, 'error');
  }
}

/** Actualiza barra de progreso en screen-capturar */
function actualizarBarraProgreso() {
  const total     = Estado.todosPokemon.length;
  const capturados = Estado.capturados.size;
  const pct       = total > 0 ? Math.round((capturados / total) * 100) : 0;

  const fill  = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  if (fill)  fill.style.width = `${pct}%`;
  if (label) label.textContent = `${capturados}/${total} capturados`;
}

/* ══════════════════════════════════════════
   SCREEN: COLECCIÓN
══════════════════════════════════════════ */
async function abrirColeccion() {
  showScreen('screen-coleccion');
  await renderGridColeccion();
}

async function renderGridColeccion() {
  const grid = document.getElementById('grid-coleccion');
  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando colección...</p></div>`;

  // Aseguramos datos frescos
  await cargarCapturados();
  if (Estado.todosPokemon.length === 0) await cargarTodosPokemon();

  // Filtramos los pokémon que el usuario capturó
  const miColeccion = Estado.todosPokemon.filter(p => {
    const id = Number(p.id ?? p.pokemonId ?? p.ID);
    return Estado.capturados.has(id);
  });

  // Actualizamos conteo
  const countEl = document.getElementById('coleccion-count');
  if (countEl) countEl.textContent = `${miColeccion.length} Pokémon`;

  grid.innerHTML = '';

  if (miColeccion.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Aún no has capturado ningún Pokémon.<br>¡Ve a explorar!</p>
      </div>`;
    return;
  }

  miColeccion.forEach(pokemon => {
    const card = crearCardColeccion(pokemon);
    grid.appendChild(card);
  });
}

/** Card de colección (solo muestra, sin botón de captura) */
function crearCardColeccion(pokemon) {
  const id = Number(pokemon.id ?? pokemon.pokemonId ?? pokemon.ID);
  const nombre    = pokemon.nombre ?? pokemon.name ?? '???';
  const numStr    = formatNum(pokemon.numero ?? pokemon.num ?? id ?? 0);
  const poder     = pokemon.poder ?? pokemon.power ?? pokemon.ataque ?? '—';
  const tipos     = obtenerTipos(pokemon);
  const spriteUrl = obtenerSprite(nombre, id);

  const card = document.createElement('div');
  card.className = 'pokemon-card captured coleccion-card';
  card.dataset.pokemonId = id;

  card.innerHTML = `
    <div class="captured-badge">✓ Capturado</div>
    <div class="card-sprite-wrap">
      ${spriteUrl
        ? `<img class="card-sprite" src="${spriteUrl}" alt="${nombre}"
              onerror="this.parentElement.innerHTML='<div class=\\'sprite-placeholder\\'>?</div>'">`
        : `<div class="sprite-placeholder">?</div>`}
    </div>
    <div class="card-body">
      <span class="card-number">${numStr}</span>
      <span class="card-name">${nombre}</span>
      <div class="card-types">${tipos.map(t => badgeTipo(t)).join('')}</div>
      <div class="card-poder">⚡ Poder: <strong>${poder}</strong></div>
    </div>`;

  // Lazy sprite
  if (!spriteUrl) {
    fetchPokeAPI(nombre).then(() => {
      const wrap = card.querySelector('.card-sprite-wrap');
      const url  = obtenerSprite(nombre, id);
      if (url && wrap) {
        wrap.innerHTML = `<img class="card-sprite" src="${url}" alt="${nombre}"
          onerror="this.parentElement.innerHTML='<div class=\\'sprite-placeholder\\'>?</div>'">`;
      }
    });
  }

  return card;
}

/* ══════════════════════════════════════════
   HELPERS: SPRITE / TIPOS
══════════════════════════════════════════ */

/** Devuelve la URL del sprite (official-artwork o fallback numérico) */
function obtenerSprite(nombre, id) {
  const key = normalizarNombre(nombre);
  if (Estado.spriteCache[key]) return Estado.spriteCache[key];
  // Fallback: construir URL por número de ID si PokeAPI aún no respondió
  if (id && !isNaN(id)) {
    return `${SPRITE_BASE}/${id}.png`;
  }
  return null;
}

/** Devuelve array de tipos del Pokémon */
function obtenerTipos(pokemon) {
  // Primero miramos cache de PokeAPI
  const key = normalizarNombre(pokemon.nombre ?? pokemon.name ?? '');
  if (Estado.tipoCache[key]?.length) return Estado.tipoCache[key];
  // Luego miramos campos del backend
  const tipo = pokemon.tipo ?? pokemon.type ?? pokemon.tipos ?? pokemon.types;
  if (!tipo) return ['normal'];
  if (Array.isArray(tipo)) return tipo;
  return [String(tipo)];
}

/** Crea el badge HTML para un tipo */
function badgeTipo(tipo) {
  const t = String(tipo).toLowerCase();
  return `<span class="type-badge type-${t}">${tipo}</span>`;
}

/* ══════════════════════════════════════════
   BUSCADOR
══════════════════════════════════════════ */
function initBuscador() {
  const input    = document.getElementById('search-input');
  const btnClear = document.getElementById('btn-search-clear');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    Estado.filtroBusqueda = input.value.trim();
    btnClear?.classList.toggle('hidden', Estado.filtroBusqueda === '');
    debounceTimer = setTimeout(() => renderGridCapturar(), 280);
  });

  btnClear?.addEventListener('click', () => {
    input.value = '';
    Estado.filtroBusqueda = '';
    btnClear.classList.add('hidden');
    renderGridCapturar();
  });
}

/* ══════════════════════════════════════════
   TAB SWITCHER (login/registro)
══════════════════════════════════════════ */
function switchTab(tab) {
  const tabLogin    = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin   = document.getElementById('form-login');
  const formReg     = document.getElementById('form-register');

  if (tab === 'login') {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  } else {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formReg.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}
window.switchTab = switchTab; // exponer para onclick del HTML

/* ══════════════════════════════════════════
   EVENTOS DE NAVEGACIÓN
══════════════════════════════════════════ */
function bindNavegacion() {
  // Login
  document.getElementById('btn-login')?.addEventListener('click', handleLogin);
  document.getElementById('login-cedula')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  // Registro
  document.getElementById('btn-register')?.addEventListener('click', handleRegistro);
  document.getElementById('reg-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleRegistro();
  });

  // Hub → Capturar
  document.getElementById('btn-go-capturar')?.addEventListener('click', abrirCapturar);

  // Hub → Colección
  document.getElementById('btn-go-coleccion')?.addEventListener('click', abrirColeccion);

  // Todos los botones "Hub" de las sub-pantallas
  document.querySelectorAll('.nav-hub').forEach(btn => {
    btn.addEventListener('click', () => showScreen('screen-hub'));
  });

  // Todos los botones "Colección" de la barra nav
  document.querySelectorAll('.nav-coleccion').forEach(btn => {
    btn.addEventListener('click', abrirColeccion);
  });

  // Todos los botones "Capturar" de la barra nav
  document.querySelectorAll('.nav-capturar').forEach(btn => {
    btn.addEventListener('click', abrirCapturar);
  });

  // Todos los botones Logout
  document.querySelectorAll('.nav-logout').forEach(btn => {
    btn.addEventListener('click', cerrarSesion);
  });
}

/* ══════════════════════════════════════════
   ════════════════════════════════════════
   FUNCIÓN EXTRA — POBLAR POKÉMON EN XAMPP
   ════════════════════════════════════════
   Llama a la PokeAPI y registra en el backend
   los primeros N pokémon que no existan aún.
   Uso: await poblarPokemonEnBackend(151)
   ══════════════════════════════════════════ */

/**
 * Obtiene datos de un Pokémon de PokeAPI y los envía al backend.
 * El endpoint esperado es POST /api/pokemon/registrar
 * con body { id, nombre, tipo, poder, numero }
 */
async function poblarUnPokemon(numDex) {
  const url = `${POKEAPI}/${numDex}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PokeAPI no encontró #${numDex}`);
  const data = await res.json();

  const nombre = data.name;
  const tipo   = data.types?.[0]?.type?.name ?? 'normal';
  const poder  = data.stats?.find(s => s.stat.name === 'attack')?.base_stat ?? 50;
  const numero = data.id;

  // Guardamos en cache para no volver a pedirlo
  const key = normalizarNombre(nombre);
  Estado.spriteCache[key] = data.sprites?.other?.['official-artwork']?.front_default
    || data.sprites?.front_default || null;
  Estado.tipoCache[key]   = data.types?.map(t => t.type.name) ?? [];

  // POST al backend
  await apiPost('/api/pokemon/registrar', { id: numero, nombre, tipo, poder, numero });

  return { nombre, tipo, poder, numero };
}

/**
 * Pobla el backend con los primeros `cantidad` Pokémon de la PokeAPI.
 * Llama internamente a POST /api/pokemon/registrar por cada uno.
 * Si el endpoint no existe o retorna error → avisa por consola y sigue.
 *
 * @param {number} cantidad  - cuántos pokémon traer (default 151 = Gen 1)
 * @param {function} onProgress - callback(actual, total, nombre) opcional
 */
async function poblarPokemonEnBackend(cantidad = 151, onProgress = null) {
  console.log(`[Poblar] Iniciando carga de ${cantidad} Pokémon desde PokeAPI…`);

  // Verificamos cuáles ya existen en el backend para no duplicar
  let existentes = new Set();
  try {
    const data = await apiGet('/api/pokemon/listar');
    const lista = data.resultado ?? data ?? [];
    lista.forEach(p => existentes.add(Number(p.id ?? p.numero ?? 0)));
  } catch (_) {
    console.warn('[Poblar] No se pudo obtener lista existente; se intentará registrar todos.');
  }

  let exitosos = 0;
  let omitidos = 0;
  let errores  = 0;

  for (let i = 1; i <= cantidad; i++) {
    if (existentes.has(i)) { omitidos++; continue; }

    try {
      const { nombre } = await poblarUnPokemon(i);
      exitosos++;
      if (typeof onProgress === 'function') onProgress(i, cantidad, nombre);
      console.log(`[Poblar] ✅ ${i}/${cantidad} — ${nombre}`);

      // Pausa de 80ms para no saturar la PokeAPI
      await new Promise(r => setTimeout(r, 80));
    } catch (err) {
      errores++;
      console.warn(`[Poblar] ⚠️  #${i} error:`, err.message);
    }
  }

  const resumen = `[Poblar] Finalizado. ✅ ${exitosos} nuevos | ⏭ ${omitidos} omitidos | ❌ ${errores} errores`;
  console.log(resumen);
  return { exitosos, omitidos, errores };
}

/**
 * Versión con UI integrada — muestra progreso en un toast mientras carga.
 * Uso desde consola del navegador: poblarConUI(151)
 */
async function poblarConUI(cantidad = 151) {
  // Verificamos que haya sesión
  if (!Estado.usuario) {
    alert('Primero inicia sesión para poder poblar la base de datos.');
    return;
  }

  const confirmado = confirm(
    `¿Registrar los primeros ${cantidad} Pokémon en la base de datos?\n\n` +
    `Esto llamará a POST /api/pokemon/registrar × ${cantidad} veces.\n` +
    `Los que ya existan serán omitidos automáticamente.`
  );
  if (!confirmado) return;

  toast(`Iniciando carga de ${cantidad} Pokémon… Revisa la consola para el progreso.`, 'info', 6000);

  const resultado = await poblarPokemonEnBackend(cantidad, (actual, total, nombre) => {
    if (actual % 10 === 0) {
      toast(`Cargando… ${actual}/${total} (${nombre})`, 'info', 2500);
    }
  });

  toast(
    `Carga completa: ${resultado.exitosos} nuevos, ${resultado.omitidos} omitidos, ${resultado.errores} errores`,
    resultado.errores === 0 ? 'success' : 'info',
    6000
  );

  // Refrescar la grilla si estamos en capturar
  const capturarScreen = document.getElementById('screen-capturar');
  if (capturarScreen?.classList.contains('active')) {
    await cargarTodosPokemon();
    await renderGridCapturar();
  }
}

// Exponer globalmente para uso desde consola del navegador
window.poblarPokemonEnBackend = poblarPokemonEnBackend;
window.poblarConUI            = poblarConUI;

/* ══════════════════════════════════════════
   INICIALIZACIÓN
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Vincular todos los eventos de navegación
  bindNavegacion();

  // Iniciar buscador
  initBuscador();

  bindModalCaptura();

  // Verificar si ya hay sesión activa
  if (cargarSesion() && Estado.usuario?.cedula) {
    // Entrar directo al hub sin pedir login de nuevo
    entrarAlSistema().catch(err => {
      console.error('[Init] Error al restaurar sesión:', err);
      cerrarSesion();
    });
  } else {
    showScreen('screen-login');
  }

  console.log('%cPokéDex Frontend listo ✅', 'color:#3b82f6;font-size:14px;font-weight:bold;');
  console.log('%cPara poblar Pokémon en la BD: poblarConUI(151)', 'color:#22c55e;font-size:12px;');
});