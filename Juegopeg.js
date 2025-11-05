/**
 * Peg Solitaire – "Batman vs Superman" (POO) – Hints mejorados
 * - Tablero vacío al cargar
 * - Usa tus botones .btnJugar y #peg-restart
 * - NUEVO: highlight verde animado sobre la pieza que sería eliminada
 */

////////////////////////// ASSETS //////////////////////////
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

function __svgDataURL(svg){ return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg); }

const __PIECE_SVG_BATMAN = __svgDataURL(`
<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 100 100">
  <defs><radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#222"/><stop offset="100%" stop-color="#000"/></radialGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#bg)" stroke="#ffd200" stroke-width="4"/>
  <path fill="#ffd200" d="M13 55c7-3 8-6 12-11 3 4 5 6 10 8-1-4 0-7 2-10 2 3 4 5 8 6 4-1 6-3 8-6 2 3 3 6 2 10 5-2 7-4 10-8 4 5 5 8 12 11-2 3-5 6-8 7-3-3-6-5-11-5-3 1-6 2-9 2-3 0-6-1-9-2-5 0-8 2-11 5-3-1-6-4-8-7z"/>
</svg>
`);

const __PIECE_SVG_SUPERMAN = __svgDataURL(`
<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 100 100">
  <defs><radialGradient id="bg2" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#1b2a6b"/><stop offset="100%" stop-color="#0a1440"/></radialGradient></defs>
  <circle cx="50" cy="50" r="46" fill="url(#bg2)" stroke="#e21d25" stroke-width="4"/>
  <path fill="#ffd200" d="M50 18l28 14-15 32H37L22 32 50 18zm0 10L36 35l14 6 14-6-14-7z"/>
</svg>
`);

////////////////////////// CONFIG //////////////////////////
const CELL = 70;
const GAP  = 10;
const BOARD_PAD = 20;
const W = 7 * CELL + (7-1)*GAP + BOARD_PAD*2;
const H = W;

const GAME_TIME_LIMIT_MS = 3 * 60 * 1000; // 3 minutos

// Cruz 7x7: -1 inválido | 0 vacío | 1 ocupado (centro vacío)
const CROSS_7x7 = [
  [-1,-1, 1, 1, 1,-1,-1],
  [-1,-1, 1, 1, 1,-1,-1],
  [ 1,  1, 1, 1, 1,  1, 1],
  [ 1,  1, 1, 0, 1,  1, 1],
  [ 1,  1, 1, 1, 1,  1, 1],
  [-1,-1, 1, 1, 1,-1,-1],
  [-1,-1, 1, 1, 1,-1,-1],
];

////////////////////////// UTIL //////////////////////////
function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function cellToXY(r,c){
  const x = BOARD_PAD + c*(CELL+GAP) + CELL/2;
  const y = BOARD_PAD + r*(CELL+GAP) + CELL/2;
  return {x,y};
}
function inside(r,c){ return r>=0 && r<7 && c>=0 && c<7; }

////////////////////////// CLASES //////////////////////////
class Ficha{
  constructor(tipo, r, c){ this.tipo=tipo; this.r=r; this.c=c; }
  dibujar(ctx, images){
    const {x,y} = cellToXY(this.r, this.c);
    const img = (this.tipo==='bat') ? images.bat : images.sup;
    const size = CELL * 0.8;
    ctx.save(); ctx.translate(x,y);
    ctx.drawImage(img, -size/2, -size/2, size, size);
    ctx.restore();
  }
  dibujarFantasma(ctx, images, x, y){
    const img = (this.tipo==='bat') ? images.bat : images.sup;
    const size = CELL * 0.85;
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.drawImage(img, x - size/2, y - size/2, size, size);
    ctx.restore();
  }
}

class Tablero{
  constructor(startEmpty=false, theme='mixed'){
    this.grid = CROSS_7x7.map(row => row.map(v => v===-1 ? -1 : (startEmpty ? 0 : v)));

    // Asignación de imágenes según tema elegido
    this.kinds = this.grid.map(row => row.map(v => {
      if (v !== 1) return null;                 // sólo celdas ocupadas
      if (theme === 'bat') return 'bat';        // todas Batman
      if (theme === 'sup') return 'sup';        // todas Superman
      return (Math.random() < 0.5) ? 'bat' : 'sup'; // mixed
    }));

    // Si no está vacío y el tema es "mixed", balanceamos 50/50 exacto
    if (!startEmpty && theme === 'mixed'){
      this._rebalanceKinds();
    }
  }

  isPlayable(r,c){ return inside(r,c) && this.grid[r][c] !== -1; }
  countPieces(){ let n=0; for(let r=0;r<7;r++) for(let c=0;c<7;c++) if (this.grid[r][c]===1) n++; return n; }
  xyToCell(x,y){
    for(let r=0;r<7;r++){
      for(let c=0;c<7;c++){
        if (this.grid[r][c]===-1) continue;
        const {x:cx,y:cy} = cellToXY(r,c);
        if (Math.hypot(x-cx, y-cy) <= CELL*0.36) return {r,c};
      }
    }
    return null;
  }
  getPossibleJumps(r,c){
    if (this.grid[r][c] !== 1) return [];
    const res = [];
    const dirs = [{dr:-2,dc:0},{dr:2,dc:0},{dr:0,dc:-2},{dr:0,dc:2}];
    for (const d of dirs){
      const r2=r+d.dr, c2=c+d.dc;
      const rm=r+d.dr/2, cm=c+d.dc/2;
      if (!inside(r2,c2)) continue;
      if (!this.isPlayable(r2,c2)) continue;
      if (this.grid[r2][c2] !== 0) continue;   // destino vacío
      if (this.grid[rm][cm] !== 1) continue;   // intermedio ocupado
      res.push({r:r2,c:c2, over:{r:rm,c:cm}});
    }
    return res;
  }
  realizarMovimiento(from, dest){
    this.grid[from.r][from.c] = 0;
    this.grid[dest.r][dest.c] = 1;
    this.kinds[dest.r][dest.c] = this.kinds[from.r][from.c];
    this.kinds[from.r][from.c] = null;
    this.grid[dest.over.r][dest.over.c] = 0;
    this.kinds[dest.over.r][dest.over.c] = null;
  }
  hayMovimientos(){
    for(let r=0;r<7;r++) for(let c=0;c<7;c++)
      if (this.grid[r][c]===1 && this.getPossibleJumps(r,c).length) return true;
    return false;
  }
  dibujar(ctx, images, dragging){
    // fondo
    ctx.drawImage(images.board, 0, 0, W, H);
    // agujeros
    for(let r=0;r<7;r++){
      for(let c=0;c<7;c++){
        if (this.grid[r][c] !== -1){
          const {x,y} = cellToXY(r,c);
          ctx.beginPath(); ctx.arc(x,y,CELL*0.36,0,Math.PI*2);
          ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fill();
        }
      }
    }
    // fichas
    for(let r=0;r<7;r++){
      for(let c=0;c<7;c++){
        if (this.grid[r][c]===1){
          const isDrag = dragging && dragging.r===r && dragging.c===c;
          if (!isDrag){
            new Ficha(this.kinds[r][c], r, c).dibujar(ctx, images);
          }
        }
      }
    }
  }

  // ================== SOLO 50/50 ==================

  /** Cuenta cuántas fichas hay por equipo. */
  _countByTeam(){
    let bat = 0, sup = 0;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++){
      if (this.grid[r][c] === 1){
        if (this.kinds[r][c] === 'bat') bat++;
        else if (this.kinds[r][c] === 'sup') sup++;
      }
    }
    return { bat, sup };
  }

  /**
   * Balancea EXACTAMENTE 50/50 las fichas (Batman/Superman).
   * Si el layout clásico tiene 32 fichas, deja 16 y 16.
   */
  _rebalanceKinds(exclude = new Set()){
    const total  = this.countPieces();     // 32 en el layout clásico
    const target = total / 2;              // 16 y 16
    let { bat, sup } = this._countByTeam();

    // Busca una celda de cierto equipo que no esté excluida
    const pick = (team) => {
      for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++){
        if (this.grid[r][c] !== 1) continue;
        if (this.kinds[r][c] !== team) continue;
        if (exclude.has(`${r},${c}`)) continue;
        return { r, c };
      }
      return null;
    };

    // Convertir fichas del mayoritario al minoritario hasta empatar
    while (bat !== target || sup !== target){
      if (bat > sup){
        const v = pick('bat'); if (!v) break;
        this.kinds[v.r][v.c] = 'sup'; bat--; sup++;
      } else if (sup > bat){
        const v = pick('sup'); if (!v) break;
        this.kinds[v.r][v.c] = 'bat'; sup--; bat++;
      } else {
        break;
      }
    }
  }
}

class JuegoPegSolitaire{
  constructor(selectorRoot='#peg-root', opts={}){
    this.root = document.querySelector(selectorRoot);
    if(!this.root){ console.error('No existe el contenedor', selectorRoot); return; }

    this.startEmptyOnLoad = opts.startEmpty ?? true;
    this.theme = localStorage.getItem('peg_theme') || 'mixed';

    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.canvas.style.borderRadius = '12px';
    this.canvas.style.boxShadow = '0 12px 32px rgba(0,0,0,.35)';
    this.canvas.style.touchAction = 'none';
    this.root.innerHTML = '';
    this.root.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', {alpha:true});
    this.images = { board:null, bat:null, sup:null };
    this.tablero = null;

    this.dragging = null;
    this.dragPos = {x:0,y:0};
    this.validDrops = [];
    this.timerStart = 0;
    this.timerLeftMs = GAME_TIME_LIMIT_MS;
    this.running = false;
    this.gameOver = false;
    this._rafId = 0;
    this._dashPhase = 0;

    this._bindEventosCanvas();
    this._bindBotonesExternos();

    const sel = document.getElementById('peg-theme');
    if (sel) sel.value = this.theme;

    this._init().then(()=> this._loop());
  }

  async _init(){
    await this._loadAssets();
    this._reset(this.startEmptyOnLoad, this.theme);
  }

  async _loadAssets(){
    const [board, bat, sup] = await Promise.all([
      loadImage(__BOARD_BG_DATAURL),
      loadImage(__PIECE_SVG_BATMAN),
      loadImage(__PIECE_SVG_SUPERMAN),
    ]);
    this.images.board = board; this.images.bat = bat; this.images.sup = sup;
  }

  _reset(startEmpty=false, theme=this.theme){
    this.tablero = new Tablero(startEmpty, theme);
    this.dragging = null;
    this.validDrops = [];
    this.timerLeftMs = GAME_TIME_LIMIT_MS;
    this.running = false;
    this.gameOver = false;
    this._celebrated = false; // ok para re-jugar normalmente
  }

  _bindEventosCanvas(){
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup',   this._onMouseUp.bind(this));
  }

  _bindBotonesExternos(){
    const playBtn   = document.querySelector('.gameBar .jugar .btnJugar');
    const restartBtn= document.getElementById('peg-restart');
    const themeSel  = document.getElementById('peg-theme');

    if (themeSel){
      themeSel.addEventListener('change', ()=>{
        this.theme = themeSel.value;                 // 'mixed' | 'bat' | 'sup'
        localStorage.setItem('peg_theme', this.theme);
      });
    }

    if (playBtn){
      playBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        this.root.scrollIntoView({behavior:'smooth', block:'center'});
        this.theme = (themeSel?.value) || this.theme;
        this._reset(false, this.theme);
        this.running = true;
        this.timerStart = performance.now();
      });
    }

    if (restartBtn){
      restartBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        this.theme = (themeSel?.value) || this.theme;
        this._reset(false, this.theme);
        this.running = true;
        this.timerStart = performance.now();
      });
    }
  }

  ////////////////////////// Dibujo //////////////////////////
  _drawBoard(){ this.tablero.dibujar(this.ctx, this.images, this.dragging); }

  // Highlight verde sobre la pieza "over" (la que se eliminaría)
  _drawCaptureHighlights(ts){
    if (!this.validDrops.length) return;

    const pulse = 0.65 + 0.35 * Math.sin(ts / 260);
    const alpha = 0.35 + 0.45 * Math.sin(ts / 300 + 1.2);
    this._dashPhase = (this._dashPhase - 2) % 100;

    for (const d of this.validDrops){
      const {x, y} = cellToXY(d.over.r, d.over.c);

      this.ctx.save();
      this.ctx.translate(x, y);

      // glow
      this.ctx.shadowColor = `rgba(16,185,129, ${0.9 * pulse})`;
      this.ctx.shadowBlur  = 18 * pulse;

      // anillo base
      this.ctx.beginPath();
      this.ctx.arc(0, 0, CELL * 0.40, 0, Math.PI*2);
      this.ctx.lineWidth   = 4 + 2*pulse;
      this.ctx.strokeStyle = `rgba(16,185,129, 0.75)`;
      this.ctx.stroke();

      // anillo punteado animado
      this.ctx.setLineDash([10, 10]);
      this.ctx.lineDashOffset = this._dashPhase;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, CELL * 0.43, 0, Math.PI*2);
      this.ctx.lineWidth   = 2.5;
      this.ctx.strokeStyle = `rgba(16,185,129, ${0.55 + 0.35*alpha})`;
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  _drawDragging(){
    if (!this.dragging) return;
    const tipo = this.tablero.kinds[this.dragging.r][this.dragging.c];
    new Ficha(tipo,0,0).dibujarFantasma(this.ctx, this.images, this.dragPos.x, this.dragPos.y);
  }

  _drawDestHints(ts){
    if (!this.validDrops.length) return;
    const pulse = 0.6 + 0.4 * Math.sin(ts/400);
    for (const d of this.validDrops){
      const {x,y} = cellToXY(d.r, d.c);
      this.ctx.save();
      this.ctx.translate(x, y - CELL*0.55);
      this.ctx.globalAlpha = 0.8 * pulse;
      this._drawArrow();
      this.ctx.restore();
    }
  }

  _drawArrow(){
    const ctx = this.ctx;
    ctx.beginPath(); ctx.moveTo(-12,0); ctx.lineTo(12,0);
    ctx.lineWidth=6; ctx.strokeStyle='#EC4899'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,20);
    ctx.lineWidth=6; ctx.strokeStyle='#EC4899'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10,12); ctx.lineTo(0,22); ctx.lineTo(10,12);
    ctx.closePath(); ctx.fillStyle='#EC4899'; ctx.fill();
  }



  /// contador
 _drawHUD(){
  const ctx = this.ctx;

  // Escala del HUD (bajalo/subilo si querés)
  const S = Math.min(1, Math.max(0.6, W / 700)) * 0.8; // ~20% más chico

  // Tamaño y posición del panel
  const P = 10 * S;              // padding interno
  const padTop = 10 * S;
  const w = 220 * S;             // ancho (antes 220)
  const h = 76 * S;              // alto  (antes 76)
  const x = 12 * S;
  const y = 12 * S;

  // Fondo + borde
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(x, y, w, h);

  // Texto
  const ms = Math.max(0, this.timerLeftMs|0);
  const m  = String(Math.floor(ms/60000)).padStart(2,'0');
  const s  = String(Math.floor((ms%60000)/1000)).padStart(2,'0');

  ctx.fillStyle = '#fff';
  ctx.font = `bold ${22*S}px Inter, system-ui, sans-serif`;
  ctx.fillText(`Tiempo: ${m}:${s}`, x + P, y + padTop + 22*S);

  ctx.font = `600 ${20*S}px Inter, system-ui, sans-serif`;
ctx.fillText(`Fichas: ${this.tablero.countPieces()}`, x + P, y + padTop + 22*S + 20*S);

  ctx.restore();
}


  _drawGameOver(won){
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.textAlign='center';
    ctx.font='bold 40px Inter, system-ui, sans-serif';
    ctx.fillText(won ? '¡Victoria!' : 'Sin movimientos', W/2, H/2 - 8);
    ctx.font='600 18px Inter, system-ui, sans-serif';
    ctx.fillText('Reiniciá el juego para volver a intentar', W/2, H/2 + 24);
    ctx.restore();
  }

  ////////////////////////// Loop //////////////////////////
  _loop(ts=0){
    this.ctx.clearRect(0,0,W,H);
    this._drawBoard();

    // Orden: flechas destino → anillos verdes → fantasma
    this._drawDestHints(ts);
    this._drawCaptureHighlights(ts);
    this._drawDragging();

    this._drawHUD();

    if (this.running && !this.gameOver){
      const elapsed = performance.now() - this.timerStart;
      this.timerLeftMs = GAME_TIME_LIMIT_MS - elapsed;
      if (this.timerLeftMs <= 0){ this.timerLeftMs = 0; this._endGame(false); }
    }
    if (this.gameOver){
      this._drawGameOver(this.tablero.countPieces()===1);
    }
    this._rafId = requestAnimationFrame(this._loop.bind(this));
  }

  _endGame(won){
    this.gameOver = true;
    this.running = false;
    if (won) {
      this._celebrateWin();
    }
  }

  ////////////////////////// Input //////////////////////////
  _onMouseDown(ev){
    if (this.gameOver) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const cell = this.tablero.xyToCell(x,y); if (!cell) return;
    const {r,c} = cell;
    if (this.tablero.grid[r][c] !== 1) return; // solo si hay ficha
    this.dragging = {r,c};
    this.dragPos = {x,y};
    this.validDrops = this.tablero.getPossibleJumps(r,c);
  }

  _onMouseMove(ev){
    if (!this.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    this.dragPos.x = ev.clientX - rect.left;
    this.dragPos.y = ev.clientY - rect.top;
  }

  _onMouseUp(ev){
    if (!this.dragging) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const cell = this.tablero.xyToCell(x,y);
    const from = this.dragging; const possible = this.validDrops;
    this.dragging = null; this.validDrops = [];
    if (!cell) return;
    const dest = possible.find(d => d.r===cell.r && d.c===cell.c);
    if (dest){
      this.tablero.realizarMovimiento(from, dest);
      if (!this.tablero.hayMovimientos()){
        this._endGame(this.tablero.countPieces()===1);
      }
    }
  }

  /** Efectos visuales/sonoros al ganar */
  _celebrateWin(){
    if (this._celebrated) return;
    this._celebrated = true;

    const overlay = __makeOverlayOver(this.canvas);
    const ctx = overlay.getContext('2d');

    // 1) Flash
    const t0Flash = performance.now();
    (function flash(){
      const t = (performance.now() - t0Flash) / 220;
      if (t <= 1){
        ctx.clearRect(0,0,overlay.width,overlay.height);
        ctx.fillStyle = `rgba(255,255,255,${1 - t})`;
        ctx.fillRect(0,0,overlay.width,overlay.height);
        requestAnimationFrame(flash);
      }
    })();

    // 2) Anillo expansivo
    const cx = overlay.width/2, cy = overlay.height/2;
    const maxR = Math.hypot(cx, cy);
    const t0Ring = performance.now();
    (function ring(){
      const tt = (performance.now() - t0Ring) / 720;
      if (tt <= 1.1){
        const e = 1 - Math.pow(1 - Math.min(tt,1), 3);
        const r = e * maxR;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 8 * (1 - e) + 2;
        ctx.strokeStyle = `rgba(34,211,238,${0.35 + 0.35*(1-e)})`;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
        requestAnimationFrame(ring);
      }
    })();

    // 3) Banner
    (()=>{
      const c2 = this.ctx;
      c2.save();
      c2.fillStyle = 'rgba(0,0,0,.55)';
      const W = this.canvas.width, H = this.canvas.height;
      const dpr = window.devicePixelRatio || 1;
      c2.setTransform(1,0,0,1,0,0);
      const bw = Math.min(W * 0.8, 520*dpr), bh = 90*dpr;
      const bx = (W - bw)/2, by = (H - bh)/2 - 10*dpr;
      c2.fillRect(bx, by, bw, bh);
      c2.strokeStyle = 'rgba(255,255,255,.25)';
      c2.strokeRect(bx, by, bw, bh);
      c2.fillStyle = '#fff';
      c2.textAlign = 'center';
      c2.font = `${36*dpr}px Inter, system-ui, sans-serif`;
      c2.fillText('¡GANASTE!', W/2, by + 54*dpr);
      c2.restore();
    })();

    // 4) Confetti
    const N = 70;
    const parts = Array.from({length:N}, () => ({
      x: Math.random()*overlay.width,
      y: -10 - Math.random()*40,
      vx:(Math.random()-0.5)*1.4,
      vy: 1 + Math.random()*2.6,
      r: 2 + Math.random()*3.8,
      rot: Math.random()*Math.PI,
      vr:(Math.random()-0.5)*0.25,
      col: ['#EC4899','#22D3EE','#FDE047'][Math.floor(Math.random()*3)]
    }));
    const t0 = performance.now();
    (function confetti(){
      const t = performance.now() - t0;
      ctx.clearRect(0,0,overlay.width,overlay.height);
      parts.forEach(p=>{
        p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col; ctx.fillRect(-p.r,-p.r,p.r*2,p.r*2);
        ctx.restore();
      });
      if (t < 1100) requestAnimationFrame(confetti);
      else overlay.remove();
    })();

    // 5) Vibración + ping
    if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    try{
      const ac = new (window.AudioContext||window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type='triangle'; o.frequency.value=880;
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime+0.25);
      o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime+0.28);
    }catch{}
  }
}


function drawWinBanner() {
  if (!board) return;
  const dpr = window.devicePixelRatio || 1;
  const W = board.width / dpr, H = board.height / dpr;
  const ctx = bctx;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  const bw = Math.min(W * 0.8, 520), bh = 90;
  const bx = (W - bw) / 2, by = (H - bh) / 2 - 10;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.fillText('¡GANASTE!', W/2, by + 54);
  ctx.restore();
}


// Reemplaza tu triggerWinFXOverBoard por este “suite” de victoria
function triggerWinFXOverBoard() {
  if (!board) return;

  const rect = board.getBoundingClientRect();

  // 1) Canvas overlay posicionado sobre el tablero
  const overlay = document.createElement('canvas');
  overlay.width = rect.width;
  overlay.height = rect.height;
  Object.assign(overlay.style, {
    position: 'absolute',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    pointerEvents: 'none',
    zIndex: 9999
  });
  document.body.appendChild(overlay);
  const ctx = overlay.getContext('2d');

  // 2) Flash rápido (blanco → transparente)
  const tFlash0 = performance.now();
  (function flashStep() {
    const t = (performance.now() - tFlash0) / 240; // 240ms
    if (t <= 1) {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.fillStyle = `rgba(255,255,255,${1 - t})`;
      ctx.fillRect(0, 0, overlay.width, overlay.height);
      requestAnimationFrame(flashStep);
    }
  })();

  // 3) Anillo expansivo desde el centro
  const cx = overlay.width / 2, cy = overlay.height / 2;
  const maxR = Math.hypot(cx, cy);
  const tRing0 = performance.now();
  (function ringStep() {
    const tt = (performance.now() - tRing0) / 700; // 700ms
    if (tt <= 1.1) {
      const e = 1 - Math.pow(1 - Math.min(tt,1), 3); // easeOutCubic
      const r = e * maxR;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 8 * (1 - e) + 2;
      ctx.strokeStyle = `rgba(34,211,238,${0.35 + 0.35*(1-e)})`; // celeste
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      requestAnimationFrame(ringStep);
    }
  })();

  // 4) “Pop” en cascada de los tiles (escalado corto)
  const pops = tiles.map((t, i) => ({
    slot: t.slot, delay: i * 50, dur: 320,
    x: t.x, y: t.y, w: t.w, h: t.h, buf: t.bufferCanvas
  }));
  const tPop0 = performance.now();
  (function popStep() {
    const now = performance.now();
    // redibujá debajo el tablero para que el pop se mezcle visualmente
    drawBoard();

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    let any = false;
    for (const p of pops) {
      const tt = (now - tPop0 - p.delay) / p.dur;
      if (tt < 0) { any = true; continue; }
      if (tt <= 1) {
        any = true;
        const e = Math.sin(Math.PI * Math.max(0, Math.min(tt, 1))); // 0→1→0
        const s = 1 + 0.10 * e; // +10% pico
        const cxp = p.x + p.w / 2, cyp = p.y + p.h / 2;

        ctx.save();
        ctx.translate(cxp, cyp);
        ctx.scale(s, s);
        ctx.drawImage(p.buf, -p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        // Glow sutil
        ctx.save();
        ctx.globalAlpha = 0.18 * e;
        ctx.strokeStyle = '#FDE047';
        ctx.lineWidth = 6 * e;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.restore();
      }
    }
    if (any) requestAnimationFrame(popStep);
    else {
      // 5) Confetti final (ya tenías uno, lo reusamos sobre el mismo tablero)
      simpleConfettiOver(board, 1000);
      // Auto-remover overlay después del confetti
      setTimeout(() => overlay.remove(), 1100);
    }
  })();

  // 6) Vibración y ping opcional
  if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
  try {
    const ctxA = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctxA.createOscillator(); const g = ctxA.createGain();
    o.type = 'triangle'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctxA.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctxA.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + 0.25);
    o.connect(g).connect(ctxA.destination); o.start(); o.stop(ctxA.currentTime + 0.28);
  } catch {}
}


// esta funcion crea un canvas overlay a pantalla sobre un <canvas> dado
function __makeOverlayOver(canvasEl){
  const r = canvasEl.getBoundingClientRect();
  const ov = document.createElement('canvas');
  ov.width  = Math.round(r.width);
  ov.height = Math.round(r.height);
  Object.assign(ov.style, {
    position: 'absolute',
    left: `${r.left}px`,
    top:  `${r.top}px`,
    pointerEvents: 'none',
    zIndex: 9999
  });
  document.body.appendChild(ov);
  return ov;
}

////////////////////////// Export //////////////////////////
window.JuegoPegSolitaire = JuegoPegSolitaire;







/////////// bug para ganar si  jugar//////
