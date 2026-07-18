import { useEffect, useRef, useState } from 'react';

type GameState = 'MENU' | 'PLAYING' | 'GAME_OVER' | 'VICTORY';

export default function Galaga() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let animationId: number;
    let isRunning = true;

    // --- GAME ENGINE STATE ---
    const cw = canvas.width;
    const ch = canvas.height;

    const player = { x: cw / 2 - 16, y: ch - 50, w: 32, h: 32, speed: 6, cooldown: 0 };
    let bullets: {x: number, y: number, w: number, h: number}[] = [];
    let enemyBullets: {x: number, y: number, w: number, h: number}[] = [];
    let enemies: {x: number, y: number, w: number, h: number, type: string, alive: boolean}[] = [];
    let particles: {x: number, y: number, vx: number, vy: number, life: number, color: string}[] = [];
    let currentScore = 0;

    const keys = { left: false, right: false, space: false };
    const fleet = { dir: 1, speed: 1.2, moveDown: false };

    // Starfield background
    const stars = Array.from({length: 80}).map(() => ({
      x: Math.random() * cw,
      y: Math.random() * ch,
      s: Math.random() * 2 + 0.5,
      r: Math.random() * 2 + 1
    }));

    // Initialize Enemies (Grid)
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 11; col++) {
        enemies.push({
          x: 80 + col * 45,
          y: 50 + row * 35,
          w: 24, h: 24,
          type: row === 0 ? 'top' : row < 3 ? 'mid' : 'bot',
          alive: true
        });
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'Space') keys.space = true;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'Space') keys.space = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const spawnExplosion = (x: number, y: number, color: string) => {
      for(let i=0; i<15; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8,
          life: 1.0,
          color
        });
      }
    };

    const update = () => {
      if (!isRunning) return;

      // Update stars
      stars.forEach(s => { 
        s.y += s.s; 
        if (s.y > ch) s.y = 0; 
      });

      // Player movement bounds check
      if (keys.left && player.x > 10) player.x -= player.speed;
      if (keys.right && player.x + player.w < cw - 10) player.x += player.speed;

      // Player Shooting
      if (player.cooldown > 0) player.cooldown--;
      if (keys.space && player.cooldown <= 0) {
        bullets.push({ x: player.x + player.w/2 - 2, y: player.y, w: 4, h: 12 });
        player.cooldown = 12; // Time between shots
      }

      // Update Bullets
      bullets.forEach(b => b.y -= 12);
      enemyBullets.forEach(b => b.y += 6);
      bullets = bullets.filter(b => b.y > 0);
      enemyBullets = enemyBullets.filter(b => b.y < ch);

      // Fleet logic
      let aliveEnemies = enemies.filter(e => e.alive);
      if (aliveEnemies.length === 0) {
        isRunning = false;
        setScore(currentScore);
        setGameState('VICTORY');
        return;
      }

      let minX = Math.min(...aliveEnemies.map(e => e.x));
      let maxX = Math.max(...aliveEnemies.map(e => e.x + e.w));
      
      if (maxX >= cw - 20) { fleet.dir = -1; fleet.moveDown = true; }
      else if (minX <= 20) { fleet.dir = 1; fleet.moveDown = true; }

      let speedMult = 1 + (55 - aliveEnemies.length) * 0.06; // Gets faster as enemies die

      aliveEnemies.forEach(e => {
        e.x += fleet.dir * fleet.speed * speedMult;
        if (fleet.moveDown) e.y += 20;
        
        // Random Enemy shooting
        if (Math.random() < 0.0015 * speedMult) {
           enemyBullets.push({ x: e.x + e.w/2 - 2, y: e.y + e.h, w: 4, h: 12 });
        }
      });
      fleet.moveDown = false;

      // Collision: Enemy body touches player
      aliveEnemies.forEach(e => {
        if (e.y + e.h >= player.y && e.x < player.x + player.w && e.x + e.w > player.x) {
           isRunning = false;
           spawnExplosion(player.x + player.w/2, player.y + player.h/2, '#f59e0b');
           setScore(currentScore);
           setGameState('GAME_OVER');
        }
      });

      // Collisions: Player Bullets -> Enemies
      bullets.forEach(b => {
        aliveEnemies.forEach(e => {
          if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
             e.alive = false;
             b.y = -100; // Move offscreen to be filtered
             currentScore += (e.type === 'top' ? 30 : e.type === 'mid' ? 20 : 10);
             spawnExplosion(e.x + e.w/2, e.y + e.h/2, '#475569');
             
             // Update DOM score display
             const scoreEl = document.getElementById('score-display');
             if (scoreEl) scoreEl.innerText = String(currentScore).padStart(6, '0');
          }
        });
      });

      // Collisions: Enemy Bullets -> Player
      enemyBullets.forEach(b => {
        if (b.x < player.x + player.w && b.x + b.w > player.x && b.y < player.y + player.h && b.y + b.h > player.y) {
           isRunning = false;
           spawnExplosion(player.x + player.w/2, player.y + player.h/2, '#f59e0b');
           setScore(currentScore);
           setGameState('GAME_OVER');
        }
      });

      // Update Particles
      particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.03; });
      particles = particles.filter(p => p.life > 0);
    };

    const draw = () => {
      // Clear background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cw, ch);

      // Draw Stars
      ctx.fillStyle = '#ffffff';
      stars.forEach(s => {
         ctx.globalAlpha = s.s / 3;
         ctx.fillRect(s.x, s.y, s.r, s.r);
      });
      ctx.globalAlpha = 1.0;

      if (!isRunning && gameState !== 'PLAYING') return;

      // Draw Player Ship (Triangle)
      ctx.fillStyle = '#f59e0b';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(player.x + player.w/2, player.y);
      ctx.lineTo(player.x + player.w, player.y + player.h);
      ctx.lineTo(player.x, player.y + player.h);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw Bullets
      ctx.fillStyle = '#f59e0b';
      bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

      ctx.fillStyle = '#ef4444';
      enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

      // Draw Enemies (Sophisticated Dark Style)
      enemies.filter(e => e.alive).forEach(e => {
        ctx.fillStyle = '#475569';
        let offsetX = Math.sin(Date.now() / 500 + e.y) * 5;
        ctx.fillRect(e.x + offsetX, e.y, e.w, e.h);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x + offsetX + 6, e.y + 6, 12, 6);
      });

      // Draw Particles
      particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
      });
      ctx.globalAlpha = 1.0;
      
      // Removed canvas score drawing; handled by HTML UI.
    };

    const loop = () => {
      update();
      draw();
      if (isRunning) {
        animationId = requestAnimationFrame(loop);
      }
    };

    // Start engine
    animationId = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  return (
    <div className="w-full max-w-[1024px] h-[768px] mx-auto bg-[#02040a] text-slate-300 font-sans flex overflow-hidden relative border-[12px] border-[#0a0f1a] shadow-2xl">
      <aside className="w-72 border-r border-slate-800 flex flex-col p-8 z-10 bg-[#02040a] shrink-0">
        <div className="mb-12">
          <h1 className="text-4xl font-serif text-amber-500 italic leading-none">Void<br/>Hunter</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 mt-2">Sector 07 Tactical Unit</p>
        </div>
        
        <div className="flex-1 space-y-8">
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-4">Status</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs font-serif italic">Score</span>
                <span className="text-xl font-mono text-white" id="score-display">
                  {String(gameState === 'PLAYING' ? score : (gameState === 'MENU' ? 0 : score)).padStart(6, '0')}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xs font-serif italic">High Score</span>
                <span className="text-xl font-mono text-amber-500">{String(highScore).padStart(6, '0')}</span>
              </div>
            </div>
          </section>
          
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-4">Hull Integrity</h2>
            <div className="h-1 w-full bg-slate-900 overflow-hidden">
              <div className={`h-full bg-amber-600 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000 ${gameState === 'PLAYING' ? 'w-4/5' : 'w-full'}`}></div>
            </div>
            <div className="flex justify-between mt-2 text-[10px] font-mono">
              <span className="text-amber-500">{gameState === 'PLAYING' ? 'ACTIVE' : 'STABLE'}</span>
              <span>{gameState === 'PLAYING' ? '80%' : '100%'}</span>
            </div>
          </section>
          
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-4">Arsenal</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="aspect-square border border-slate-800 bg-slate-900/50 flex items-center justify-center">
                <div className="w-1 h-4 bg-amber-500"></div>
              </div>
              <div className="aspect-square border border-slate-800 bg-slate-900/50 flex items-center justify-center opacity-30">
                <div className="w-4 h-4 rounded-full border border-slate-400"></div>
              </div>
              <div className="aspect-square border border-slate-800 bg-slate-900/50 flex items-center justify-center opacity-30">
                <div className="w-3 h-3 bg-slate-400 rotate-45"></div>
              </div>
            </div>
          </section>
        </div>
        
        <div className="mt-auto pt-8 border-t border-slate-800">
          <p className="text-[9px] leading-relaxed text-slate-600">DEPLOYED VIA GITHUB PAGES<br/>SERVERLESS ARCHITECTURE V4.2<br/>STATION: FRONTEND-PRIMARY</p>
        </div>
      </aside>

      <main className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        <canvas 
          ref={canvasRef} 
          width={712} 
          height={744} 
          className="block bg-black w-full h-full object-cover shadow-[0_0_50px_rgba(0,0,0,1)]"
        />
        
        <div className="absolute top-8 right-8 text-right pointer-events-none">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">High Score</div>
          <div className="text-2xl font-serif text-white italic">{String(highScore).padStart(6, '0')}</div>
          <div className="text-[10px] text-amber-500 mt-2 font-mono">PILOT: ARCHON_X</div>
        </div>
        
        <div className="absolute bottom-8 left-8 flex items-center space-x-4 opacity-50 pointer-events-none">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Navigation</div>
          <div className="flex space-x-1">
            <div className="px-2 py-1 border border-slate-700 text-[10px]">A</div>
            <div className="px-2 py-1 border border-slate-700 text-[10px]">D</div>
            <div className="px-2 py-1 border border-slate-700 text-[10px]">SPACE</div>
          </div>
        </div>

        {gameState !== 'PLAYING' && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center p-6 z-20 backdrop-blur-sm">
            {gameState === 'MENU' && (
               <>
                  <h1 className="text-5xl font-serif text-amber-500 italic mb-4 tracking-wider drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    GALAGA
                  </h1>
                  <p className="text-slate-400 text-xs mb-12 uppercase tracking-[0.3em]">
                     Tactical Engagement Simulator
                  </p>
               </>
            )}
            
            {gameState === 'GAME_OVER' && (
               <>
                  <h1 className="text-5xl font-serif text-red-500 italic mb-4 tracking-wider drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    MISSION FAILED
                  </h1>
                  <p className="text-slate-300 text-sm mb-8 font-mono">FINAL SCORE: <span className="text-amber-500">{String(score).padStart(6, '0')}</span></p>
               </>
            )}
            
            {gameState === 'VICTORY' && (
               <>
                  <h1 className="text-5xl font-serif text-emerald-500 italic mb-4 tracking-wider drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    MISSION CLEAR
                  </h1>
                  <p className="text-slate-300 text-sm mb-8 font-mono">FINAL SCORE: <span className="text-amber-500">{String(score).padStart(6, '0')}</span></p>
               </>
            )}

            <button
               onClick={() => {
                 setScore(0);
                 setGameState('PLAYING');
                 const scoreEl = document.getElementById('score-display');
                 if (scoreEl) scoreEl.innerText = '000000';
               }}
               className="px-8 py-3 bg-transparent border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-all text-xs uppercase tracking-widest cursor-pointer font-mono"
            >
               {gameState === 'MENU' ? 'INITIALIZE (START)' : 'RE-ENGAGE'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
