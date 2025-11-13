/**
 * Peg Solitaire – "Batman vs Superman" (POO) – Hints mejorados
 * - Tablero vacío al cargar
 * - Usa tus botones .btnJugar y #peg-restart
 * - NUEVO: highlight verde animado sobre la pieza que sería eliminada
 *
 * Archivo COMENTADO para estudio: agregué explicaciones en cada sección
 * sin modificar la lógica.
 */

////////////////////////// ASSETS //////////////////////////
// Fondo del tablero como SVG embebido en data URL. Se usa para no depender de archivos externos.
const __BOARD_BG_DATAURL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="700" height="700">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0e1116"/>
        <stop offset="1" stop-color="#151a22"/>
      </linearGradient>
      <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="none" stroke="#2a3140" stroke-width="2"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#grid)" opacity="0.35"/>
  </svg>
`);

// Helper para convertir un string SVG a data URL
function __svgDataURL(svg) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }

// SVG de la ficha Batman como data URL
const __PIECE_SVG_BATMAN = __svgDataURL(`
<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 100 100">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#222"/><stop offset="100%" stop-color="#000"/></radialGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#bg)" stroke="#ffd200" stroke-width="4"/>
  <path fill="#ffd200" d="M13 55c7-3 8-6 12-11 3 4 5 6 10 8-1-4 0-7 2-10 2 3 4 5 8 6 4-1 6-3 8-6 2 3 3 6 2 10 5-2 7-4 10-8 4 5 5 8 12 11-2 3-5 6-8 7-3-3-6-5-11-5-3 1-6 2-9 2-3 0-6-1-9-2-5 0-8 2-11 5-3-1-6-4-8-7z"/>
</svg>
`);

// SVG de la ficha Superman como data URL
const __PIECE_SVG_SUPERMAN = __svgDataURL(`
<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 100 100">
  <defs><radialGradient id="bg2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#1b2a6b"/><stop offset="100%" stop-color="#0a1440"/></radialGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#bg2)" stroke="#e21d25" stroke-width="4"/>
  <path fill="#ffd200" d="M50 18l28 14-15 32H37L22 32 50 18zm0 10L36 35l14 6 14-6-14-7z"/>
</svg>
`);

////////////////////////// CONFIG //////////////////////////
// Dimensiones y espaciados del tablero y celdas
const CELL = 70;         // diámetro "lógico" de una celda (radio se usa en colisiones)
const GAP = 10;         // separación entre celdas
const BOARD_PAD = 20;    // margen interno del tablero
const W = 7 * CELL + (7 - 1) * GAP + BOARD_PAD * 2; // ancho canvas
const H = W;                                     // alto = ancho

// Tiempo límite de partida (3 minutos)
const GAME_TIME_LIMIT_MS = 3 * 60 * 1000; // 3 minutos

// Molde de la cruz 7x7 del Peg Solitaire clásico:
// -1 = celda inválida (fuera de la cruz)
//  0 = agujero vacío
//  1 = agujero con ficha
// El centro arranca vacío en este layout.
const CROSS_7x7 = [
  [-1, -1, 1, 1, 1, -1, -1],
  [-1, -1, 1, 1, 1, -1, -1],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [-1, -1, 1, 1, 1, -1, -1],
  [-1, -1, 1, 1, 1, -1, -1],
];

////////////////////////// UTIL //////////////////////////
// Carga una imagen (data URL o URL real) y devuelve una Promesa con el objeto Image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Convierte coordenadas de celda (r,c) a coordenadas de píxel del centro
function cellToXY(r, c) {
  const x = BOARD_PAD + c * (CELL + GAP) + CELL / 2;
  const y = BOARD_PAD + r * (CELL + GAP) + CELL / 2;
  return { x, y };
}
// Chequea si (r,c) está dentro del rango 0..6
function inside(r, c) { return r >= 0 && r < 7 && c >= 0 && c < 7; }

////////////////////////// CLASES //////////////////////////
// Representa una ficha individual. No guarda el grid, sólo su tipo y posición.
class Ficha {
  constructor(tipo, r, c) { this.tipo = tipo; this.r = r; this.c = c; }
  // Dibuja la ficha en su celda actual
  dibujar(ctx, images) {
    const { x, y } = cellToXY(this.r, this.c);
    const img = (this.tipo === 'bat') ? images.bat : images.sup;
    const size = CELL * 0.8;
    ctx.save(); ctx.translate(x, y);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }
  // Dibuja una "sombra" (fantasma) de la ficha en una posición libre (arrastre)
  dibujarFantasma(ctx, images, x, y) {
    const img = (this.tipo === 'bat') ? images.bat : images.sup;
    const size = CELL * 0.85;
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
    ctx.restore();
  }
}

// Maneja el estado del tablero: grilla, tipos de fichas y reglas de movimiento
class Tablero {

  constructor(startEmpty = false, theme = 'mixed') {
    // Copiamos el layout base; si startEmpty es true, lo dejamos todo vacío
    this.grid = CROSS_7x7.map(row => row.map(v => v === -1 ? -1 : (startEmpty ? 0 : v)));

    // Matriz paralela con el "equipo" de cada celda ocupada: 'bat' o 'sup'
    this.kinds = this.grid.map(row => row.map(v => {
      if (v !== 1) return null;                 // sólo celdas con ficha
      if (theme === 'bat') return 'bat';        // todas Batman
      if (theme === 'sup') return 'sup';        // todas Superman
      return (Math.random() < 0.5) ? 'bat' : 'sup'; // mixto
    }));

    // Si iniciamos con fichas y el tema es mixto, balanceamos 50/50 exacto
    if (!startEmpty && theme === 'mixed') {
      this._rebalanceKinds();
    }
  }

  // Devuelve true si la celda existe y no es inválida
  isPlayable(r, c) { return inside(r, c) && this.grid[r][c] !== -1; }
  // Cuenta cuántas fichas quedan
  countPieces() { let n = 0; for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) if (this.grid[r][c] === 1) n++; return n; }
  // Convierte (x,y) en el canvas a una celda si el punto cae dentro de su círculo
  xyToCell(x, y) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (this.grid[r][c] === -1) continue; // celdas inválidas fuera de la cruz
        const { x: cx, y: cy } = cellToXY(r, c);
        // Radio de interacción ~36% de CELL (de ahí "sale" el 0.36)
        if (Math.hypot(x - cx, y - cy) <= CELL * 0.36) return { r, c };
      }
    }
    return null;
  }
  // Devuelve los saltos válidos desde (r,c) en las 4 direcciones cardinales
  getPossibleJumps(r, c) {
    if (this.grid[r][c] !== 1) return [];
    const res = [];
    const dirs = [{ dr: -2, dc: 0 }, { dr: 2, dc: 0 }, { dr: 0, dc: -2 }, { dr: 0, dc: 2 }];
    for (const d of dirs) {
      const r2 = r + d.dr, c2 = c + d.dc;           // destino a 2 pasos
      const rm = r + d.dr / 2, cm = c + d.dc / 2;       // celda intermedia (a capturar)
      if (!inside(r2, c2)) continue;
      if (!this.isPlayable(r2, c2)) continue;
      if (this.grid[r2][c2] !== 0) continue;   // destino debe estar vacío
      if (this.grid[rm][cm] !== 1) continue;   // intermedio debe tener ficha
      res.push({ r: r2, c: c2, over: { r: rm, c: cm } });
    }
    return res;
  }
  // Aplica un movimiento de salto: vacía origen, llena destino y elimina la intermedia
  realizarMovimiento(from, dest) {
    this.grid[from.r][from.c] = 0;
    this.grid[dest.r][dest.c] = 1;
    this.kinds[dest.r][dest.c] = this.kinds[from.r][from.c];
    this.kinds[from.r][from.c] = null;
    this.grid[dest.over.r][dest.over.c] = 0;
    this.kinds[dest.over.r][dest.over.c] = null;
  }
  // Chequea si existe algún movimiento posible en el tablero actual
  hayMovimientos() {
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < 7; c++)
        if (this.grid[r][c] === 1 && this.getPossibleJumps(r, c).length) return true;
    return false;
  }
  // Dibuja el tablero (fondo, agujeros y fichas). Si hay una ficha en arrastre, no la dibuja aquí.
  dibujar(ctx, images, dragging) {
    // fondo pre-renderizado
    ctx.drawImage(images.board, 0, 0, W, H);
    // agujeros (sombras circulares)
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (this.grid[r][c] !== -1) {
          const { x, y } = cellToXY(r, c);
          ctx.beginPath(); ctx.arc(x, y, CELL * 0.36, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
        }
      }
    }
    // fichas (excepto la que se está arrastrando)
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (this.grid[r][c] === 1) {
          const isDrag = dragging && dragging.r === r && dragging.c === c;
          if (!isDrag) {
            new Ficha(this.kinds[r][c], r, c).dibujar(ctx, images);
          }
        }
      }
    }
  }

  // ================== UTILIDAD PARA 50/50 EQUIPOS ==================

  /** Cuenta cuántas fichas hay por equipo. */
  _countByTeam() {
    let bat = 0, sup = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      if (this.grid[r][c] === 1) {
        if (this.kinds[r][c] === 'bat') bat++;
        else if (this.kinds[r][c] === 'sup') sup++;
      }
    }
    return { bat, sup };
  }

  /**
   * Balancea EXACTAMENTE 50/50 las fichas (Batman/Superman).
   * Si el layout clásico tiene 32 fichas, deja 16 y 16.
   * exclude: set de celdas a no modificar (por si más adelante querés fijarlas).
   */
  _rebalanceKinds(exclude = new Set()) {
    const total = this.countPieces();     // 32 en el layout clásico
    const target = total / 2;              // 16 y 16
    let { bat, sup } = this._countByTeam();

    // Busca una celda de cierto equipo que no esté excluida
    const pick = (team) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
        if (this.grid[r][c] !== 1) continue;
        if (this.kinds[r][c] !== team) continue;
        if (exclude.has(`${r},${c}`)) continue;
        return { r, c };
      }
      return null;
    };

    // Convertir fichas del mayoritario al minoritario hasta empatar
    while (bat !== target || sup !== target) {
      if (bat > sup) {
        const v = pick('bat'); if (!v) break;
        this.kinds[v.r][v.c] = 'sup'; bat--; sup++;
      } else if (sup > bat) {
        const v = pick('sup'); if (!v) break;
        this.kinds[v.r][v.c] = 'bat'; sup--; bat++;
      } else {
        break;
      }
    }
  }


  getSaltosPosiblesLargo(r, c) {

    const resultados = [];
    const inicioR = r, inicioC = c;

    function getJumpsFromState(r0, c0, gridState) {
      if (gridState[r0][c0] !== 1) return [];
      const res = [];
      const dirs = [
        { dr: -2, dc: 0 },
        { dr: 2, dc: 0 },
        { dr: 0, dc: -2 },
        { dr: 0, dc: 2 }
      ];

      for (const d of dirs) {
        const r2 = r0 + d.dr;
        const c2 = c0 + d.dc;
        const rm = r0 + d.dr / 2;
        const cm = c0 + d.dc / 2;

        if (!inside(r2, c2)) continue;
        if (gridState[r2][c2] !== 0) continue;
        if (gridState[rm][cm] !== 1) continue;

        res.push({
          from: { r: r0, c: c0 },
          to: { r: r2, c: c2 },
          over: { r: rm, c: cm }
        });
      }

      return res;
    }

    function dfs(r0, c0, gridState, pathActual) {

      const jumps = getJumpsFromState(r0, c0, gridState);

      // Caso final: sin saltos → guardar camino completo
      if (!jumps.length) {
        if (!(r0 === inicioR && c0 === inicioC)) {
          resultados.push({
            final: { r: r0, c: c0 },
            path: [...pathActual]  // copia del camino
          });
        }
        return;
      }

      // Hay saltos → explorar cada uno
      for (const j of jumps) {
        const newGrid = gridState.map(row => row.slice());

        // aplicar salto virtual
        newGrid[j.from.r][j.from.c] = 0;
        newGrid[j.over.r][j.over.c] = 0;
        newGrid[j.to.r][j.to.c] = 1;

        // agregar a la ruta y recursar
        dfs(j.to.r, j.to.c, newGrid, [...pathActual, j]);
      }
    }

    const initialGrid = this.grid.map(row => row.slice());
    dfs(r, c, initialGrid, []);

    return resultados;
  }
}

// Controlador del juego: crea el canvas, maneja input, timer, loop y efectos
class JuegoPegSolitaire {

  constructor(selectorRoot = '#peg-root', opts = {}) {
    // Contenedor raíz (div donde se monta el canvas)
    this.root = document.querySelector(selectorRoot);
    if (!this.root) { console.error('No existe el contenedor', selectorRoot); return; }

    // Preferencias de inicio
    this.startEmptyOnLoad = opts.startEmpty ?? true; // arranca vacío por defecto
    this.theme = localStorage.getItem('peg_theme') || 'mixed'; // tema guardado

    // Canvas principal y estilos visuales
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.style.borderRadius = '12px';
    this.canvas.style.boxShadow = '0 12px 32px rgba(0,0,0,.35)';
    this.canvas.style.touchAction = 'none';
    this.root.innerHTML = '';
    this.root.appendChild(this.canvas);

    // Contexto 2D y recursos
    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.images = { board: null, bat: null, sup: null };
    this.tablero = null; // se crea en _reset

    // Estado de interacción / juego
    this.dragging = null;           // {r,c} de la ficha arrastrada
    this.dragPos = { x: 0, y: 0 };       // posición del mouse durante arrastre
    this.validDrops = [];           // destinos válidos desde la celda seleccionada
    this.timerStart = 0;            // marca para descontar el tiempo
    this.timerLeftMs = GAME_TIME_LIMIT_MS; // tiempo restante
    this.running = false;           // si el contador corre
    this.gameOver = false;          // si terminó la partida
    this._rafId = 0;                // id del requestAnimationFrame activo
    this._dashPhase = 0;            // fase para animar dashes en highlight
    this.multiDestHints = [];

    // Bind de eventos
    this._bindEventosCanvas();
    this._bindBotonesExternos();

    // Sincroniza el selector de tema si existe fuera del canvas
    const sel = document.getElementById('peg-theme');
    if (sel) sel.value = this.theme;

    // Carga assets y prepara estado inicial, luego arranca el loop de render
    this._init().then(() => this._loop());
  }

  // Carga imágenes y resetea el tablero
  async _init() {
    await this._loadAssets();
    this._reset(this.startEmptyOnLoad, this.theme);
  }

  // Carga paralelo del fondo y de las fichas (Batman / Superman)
  async _loadAssets() {
    const [board, bat, sup] = await Promise.all([
      loadImage(__BOARD_BG_DATAURL),
      loadImage(__PIECE_SVG_BATMAN),
      loadImage(__PIECE_SVG_SUPERMAN),
    ]);
    this.images.board = board; this.images.bat = bat; this.images.sup = sup;
  }

  // Re-inicia el juego (con opción de tablero vacío o armado)
  _reset(startEmpty = false, theme = this.theme) {
    this.tablero = new Tablero(startEmpty, theme);
    this.dragging = null;
    this.validDrops = [];
    this.timerLeftMs = GAME_TIME_LIMIT_MS;
    this.running = false;
    this.gameOver = false;
  }

  // Eventos de mouse sobre el canvas
  _bindEventosCanvas() {
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup', this._onMouseUp.bind(this));
  }

  // Conecta botones externos: jugar, reiniciar y selector de tema
  _bindBotonesExternos() {
    const playBtn = document.querySelector('.gameBar .jugar .btnJugar');
    const restartBtn = document.getElementById('peg-restart');
    const themeSel = document.getElementById('peg-theme');

    // Cambio de tema persistido en localStorage
    if (themeSel) {
      themeSel.addEventListener('change', () => {
        this.theme = themeSel.value;                 // 'mixed' | 'bat' | 'sup'
        localStorage.setItem('peg_theme', this.theme);
      });
    }

    // Empezar juego con layout armado
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.root.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.theme = (themeSel?.value) || this.theme;
        this._reset(false, this.theme);
        this.running = true;
        this.timerStart = performance.now();
      });
    }

    // Reiniciar con tablero vacío
    if (restartBtn) {
      restartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.theme = (themeSel?.value) || this.theme;
        this._reset(true, this.theme);
        this.running = true;
        this.timerStart = performance.now();
      });
    }
  }

  ////////////////////////// Dibujo //////////////////////////
  // Dibuja tablero, agujeros y fichas
  _drawBoard() { this.tablero.dibujar(this.ctx, this.images, this.dragging); }

  // Highlight verde animado sobre la pieza que sería capturada (celda "over")
  _drawCaptureHighlights(ts) {
    if (!this.validDrops.length) return;

    const pulse = 0.65 + 0.35 * Math.sin(ts / 260);        // respiración
    const alpha = 0.35 + 0.45 * Math.sin(ts / 300 + 1.2);  // brillo alterno
    this._dashPhase = (this._dashPhase - 2) % 100;          // animación del punteado

    for (const d of this.validDrops) {
      const { x, y } = cellToXY(d.over.r, d.over.c);

      this.ctx.save();
      this.ctx.translate(x, y);

      // Glow base
      this.ctx.shadowColor = `rgba(16,185,129, ${0.9 * pulse})`;
      this.ctx.shadowBlur = 18 * pulse;

      // Anillo base
      this.ctx.beginPath();
      this.ctx.arc(0, 0, CELL * 0.40, 0, Math.PI * 2);
      this.ctx.lineWidth = 4 + 2 * pulse;
      this.ctx.strokeStyle = `rgba(16,185,129, 0.75)`;
      this.ctx.stroke();

      // Anillo punteado animado
      this.ctx.setLineDash([10, 10]);
      this.ctx.lineDashOffset = this._dashPhase;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, CELL * 0.43, 0, Math.PI * 2);
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = `rgba(16,185,129, ${0.55 + 0.35 * alpha})`;
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  // Dibuja la ficha fantasma bajo el puntero cuando arrastramos
  _drawDragging() {
    if (!this.dragging) return;
    const tipo = this.tablero.kinds[this.dragging.r][this.dragging.c];
    new Ficha(tipo, 0, 0).dibujarFantasma(this.ctx, this.images, this.dragPos.x, this.dragPos.y);
  }

  // Flechitas rosas sobre los destinos válidos desde la celda de origen
_drawDestHints(ts) {
  // Si hay saltos largos, usamos SUS finales; si no, usamos los saltos simples
  const list = (this.multiDestHints && this.multiDestHints.length)
    ? this.multiDestHints.map(s => s.final)
    : this.validDrops;

  if (!list || !list.length) return;

  const pulse = 0.6 + 0.4 * Math.sin(ts / 400);
  for (const d of list) {
    const { x, y } = cellToXY(d.r, d.c);
    this.ctx.save();
    this.ctx.translate(x, y - CELL * 0.55);
    this.ctx.globalAlpha = 0.8 * pulse;
    this._drawArrow();
    this.ctx.restore();
  }
}

  // Flecha estilizada (líneas + punta)
  _drawArrow() {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
    ctx.lineWidth = 6; ctx.strokeStyle = '#EC4899'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 20);
    ctx.lineWidth = 6; ctx.strokeStyle = '#EC4899'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(0, 22); ctx.lineTo(10, 12);
    ctx.closePath(); ctx.fillStyle = '#EC4899'; ctx.fill();
  }

  /// HUD (contador de tiempo y cantidad de fichas)
  _drawHUD() {
    const ctx = this.ctx;

    // Escala del HUD en función del tamaño del canvas
    const S = Math.min(1, Math.max(0.6, W / 700)) * 0.8; // ~20% más chico

    // Tamaño y posición del panel
    const P = 10 * S;              // padding interno
    const padTop = 10 * S;
    const w = 220 * S;             // ancho
    const h = 76 * S;              // alto  (h no se usa mucho pero queda documentado)
    const x = 12 * S;
    const y = 12 * S;

    // Fondo + borde
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(x, y, w, h);

    // Texto de tiempo (mm:ss)
    const ms = Math.max(0, this.timerLeftMs | 0);
    const m = String(Math.floor(ms / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${22 * S}px Inter, system-ui, sans-serif`;
    ctx.fillText(`Tiempo: ${m}:${s}`, x + P, y + padTop + 22 * S);

    // Conteo de fichas restantes
    ctx.font = `600 ${20 * S}px Inter, system-ui, sans-serif`;
    ctx.fillText(`Fichas: ${this.tablero.countPieces()}`, x + P, y + padTop + 22 * S + 20 * S);

    ctx.restore();
  }

  // Mensaje de fin de juego (victoria / sin movimientos)
  _drawGameOver(won) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 40px Inter, system-ui, sans-serif';
    ctx.fillText(won ? '¡Ganaste!' : 'Sin movimientos', W / 2, H / 2 - 8);
    ctx.font = '600 18px Inter, system-ui, sans-serif';
    ctx.fillText('Reiniciá el juego para volver a intentar', W / 2, H / 2 + 24);
    ctx.restore();
  }

  ////////////////////////// Loop //////////////////////////
  // Bucle principal de renderizado/actualización. Se llama con requestAnimationFrame.
  _loop(ts = 0) {
    // Limpiar y dibujar escena base
    this.ctx.clearRect(0, 0, W, H);
    this._drawBoard();

    // Orden de overlays: destinos → highlight captura → fantasma
    this._drawDestHints(ts);
    this._drawCaptureHighlights(ts);
    this._drawDragging();

    // HUD arriba de todo
    this._drawHUD();

    // Lógica de timer y fin de juego
    if (this.running && !this.gameOver) {
      const elapsed = performance.now() - this.timerStart;
      this.timerLeftMs = GAME_TIME_LIMIT_MS - elapsed;
      if (this.timerLeftMs <= 0) { this.timerLeftMs = 0; this._endGame(false); }
    }
    if (this.gameOver) {
      this._drawGameOver(this.tablero.countPieces() === 1);
    }
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  // Marca fin de juego y dispara efectos si ganaste
  _endGame(won) {
    this.gameOver = true;
    this.running = false;
  }

  ////////////////////////// Input //////////////////////////
  // Inicio del arrastre: sólo si clickeás una celda con ficha
  _onMouseDown(ev) {
    if (this.gameOver) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const cell = this.tablero.xyToCell(x, y); if (!cell) return;
    const { r, c } = cell;
    if (this.tablero.grid[r][c] !== 1) return; // sólo si hay ficha en esa celda
    this.dragging = { r, c };
    this.dragPos = { x, y };

    // Saltos simples (se siguen usando para la lógica del movimiento real)
    this.validDrops = this.tablero.getPossibleJumps(r, c);

    // Destinos FINALES de cadenas de capturas (para hints tipo damas)
    this.multiDestHints = this.tablero.getSaltosPosiblesLargo(r, c);

  }

  // Arrastre: actualiza posición fantasma
  _onMouseMove(ev) {
    if (!this.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dragPos.x = ev.clientX - rect.left;
    this.dragPos.y = ev.clientY - rect.top;
  }

  // Fin del arrastre: si soltás sobre un destino válido, aplica el movimiento
  _onMouseUp(ev) {
    if (!this.dragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const cell = this.tablero.xyToCell(x, y);

    const from = this.dragging;

    // limpiar estado de arrastre
    this.dragging = null;
    this.validDrops = [];
    const largos = this.multiDestHints;
    this.multiDestHints = [];

    if (!cell) return;

    // 1️⃣ verificar si soltó en un destino final de cadena
    const destinoFinal = largos.find(s => s.final.r === cell.r && s.final.c === cell.c);

    if (!destinoFinal) {
      // soltó en lugar no permitido → no mueve
      return;
    }

    // 2️⃣ ejecutar toda la ruta de saltos reales
    for (const paso of destinoFinal.path) {
      this.tablero.realizarMovimiento(paso.from, {
        r: paso.to.r,
        c: paso.to.c,
        over: paso.over
      });
    }

    // 3️⃣ check de fin de juego
    if (!this.tablero.hayMovimientos()) {
      this._endGame(this.tablero.countPieces() === 1);
    }
  }

}

////////////////////////// Export //////////////////////////
// Expone la clase principal en window para poder instanciarla desde HTML
window.JuegoPegSolitaire = JuegoPegSolitaire;
