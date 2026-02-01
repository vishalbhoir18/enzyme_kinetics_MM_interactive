import React, { useState, useEffect, useRef } from 'react';
import { Play, RefreshCw, Info, FlaskConical } from 'lucide-react';

const App = () => {
  // --- State ---
  const [vmax, setVmax] = useState(100);
  const [km, setKm] = useState(20);
  const [sConc, setSConc] = useState(10);

  // --- Constants ---
  const MAX_S_SLIDER = 200;
  const TOTAL_ENZYMES = 25;

  // --- Calculations ---
  // Michaelis-Menten Equation: V0 = (Vmax * [S]) / (Km + [S])
  const calculateRate = (s, v, k) => (v * s) / (k + s);

  const currentRate = calculateRate(sConc, vmax, km);
  const saturationFraction = (km + sConc) > 0 ? sConc / (km + sConc) : 0;
  const percentSaturation = (saturationFraction * 100).toFixed(1);

  // Target number of bound enzymes based on probability
  const targetBound = Math.round(TOTAL_ENZYMES * saturationFraction);

  // --- Canvas Simulation Logic ---
  const canvasRef = useRef(null);
  const requestRef = useRef();

  // Store simulation entities in refs to persist across renders
  const enzymesRef = useRef([]);
  const substratesRef = useRef([]);
  const productsRef = useRef([]);

  // Initialize Enzymes once
  useEffect(() => {
    const enzymes = [];
    for (let i = 0; i < TOTAL_ENZYMES; i++) {
      enzymes.push({
        x: Math.random() * 300,
        y: Math.random() * 300,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: 12,
        isBound: false,
        id: i
      });
    }
    enzymesRef.current = enzymes;
  }, []);

  // Update Substrate particles when [S] changes
  useEffect(() => {
    // Visual scaling: cap at 150 particles to keep canvas clean
    const desiredSubstrateCount = Math.min(Math.floor(sConc * 1.5), 150);
    const currentCount = substratesRef.current.length;

    if (desiredSubstrateCount > currentCount) {
      // Add particles
      for (let i = 0; i < desiredSubstrateCount - currentCount; i++) {
        substratesRef.current.push({
          x: Math.random() * 300,
          y: Math.random() * 300,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          radius: 3
        });
      }
    } else if (desiredSubstrateCount < currentCount) {
      // Remove particles
      substratesRef.current = substratesRef.current.slice(0, desiredSubstrateCount);
    }
  }, [sConc]);

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Handle high-DPI displays if needed, but keeping simple fixed logic for consistency
    const width = canvas.width;
    const height = canvas.height;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // --- 1. CATALYTIC TURNOVER (Dynamic Equilibrium) ---
      // The probability of a bound enzyme firing depends on Vmax
      const turnoverProbability = vmax / 3000;

      const boundEnzymesList = enzymesRef.current.filter(e => e.isBound);

      // Randomly fire bound enzymes to create Product (ES -> E + P)
      if (boundEnzymesList.length > 0 && Math.random() < turnoverProbability) {
         const firingEnzyme = boundEnzymesList[Math.floor(Math.random() * boundEnzymesList.length)];

         // 1. Unbind the enzyme
         firingEnzyme.isBound = false;

         // 2. Create Product at enzyme location (Triangle)
         productsRef.current.push({
           x: firingEnzyme.x,
           y: firingEnzyme.y,
           vx: (Math.random() - 0.5) * 2.5,
           vy: (Math.random() - 0.5) * 2.5,
           life: 1.0, // For opacity fade out
           radius: 5
         });
      }

      // --- 2. STATE REBALANCING ---
      // Ensure the population of Bound enzymes matches the Michaelis-Menten equilibrium
      let currentBoundCount = enzymesRef.current.filter(e => e.isBound).length;

      // If too few bound (e.g., after firing), bind new ones (E + S -> ES)
      if (currentBoundCount < targetBound) {
        const freeEnzymes = enzymesRef.current.filter(e => !e.isBound);
        if (freeEnzymes.length > 0) {
           const randomIdx = Math.floor(Math.random() * freeEnzymes.length);
           freeEnzymes[randomIdx].isBound = true;
        }
      }
      // If too many bound (e.g., user lowered [S]), unbind (ES -> E + S)
      else if (currentBoundCount > targetBound) {
        const boundEnzymes = enzymesRef.current.filter(e => e.isBound);
        if (boundEnzymes.length > 0) {
           const randomIdx = Math.floor(Math.random() * boundEnzymes.length);
           boundEnzymes[randomIdx].isBound = false;
        }
      }

      // --- 3. DRAWING ---

      // A. Substrates (Blue Circles)
      ctx.fillStyle = '#3b82f6';
      substratesRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // B. Products (Purple Triangles - Fading)
      productsRef.current = productsRef.current.filter(p => p.life > 0.01);
      productsRef.current.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.015; // Fade out speed

        ctx.globalAlpha = p.life;
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        // Triangle shape
        ctx.moveTo(p.x, p.y - p.radius);
        ctx.lineTo(p.x + p.radius, p.y + p.radius);
        ctx.lineTo(p.x - p.radius, p.y + p.radius);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // C. Enzymes (Green/Red)
      enzymesRef.current.forEach(e => {
        e.x += e.vx;
        e.y += e.vy;
        if (e.x < e.radius || e.x > width - e.radius) e.vx *= -1;
        if (e.y < e.radius || e.y > height - e.radius) e.vy *= -1;

        ctx.beginPath();
        if (!e.isBound) {
            ctx.fillStyle = '#22c55e'; // Green (Free)
            // Pacman mouth
            ctx.arc(e.x, e.y, e.radius, 0.2 * Math.PI, 1.8 * Math.PI);
            ctx.lineTo(e.x, e.y);
        } else {
            ctx.fillStyle = '#ef4444'; // Red (Bound)
            ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 1;
        ctx.stroke();

        // White dot inside bound enzyme representing substrate being processed
        if (e.isBound) {
             ctx.fillStyle = 'white';
             ctx.beginPath();
             ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
             ctx.fill();
        }
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [targetBound, vmax]);


  // --- Graph Rendering (SVG) ---
  const renderGraph = () => {
    const width = 400;
    const height = 250;
    const padding = 40;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    const maxY = vmax * 1.2;
    const maxX = MAX_S_SLIDER;

    const getX = (val) => padding + (val / maxX) * graphWidth;
    const getY = (val) => height - padding - (val / maxY) * graphHeight;

    // Build Curve Path
    let pathD = `M ${getX(0)} ${getY(0)}`;
    for (let s = 1; s <= maxX; s+=2) {
      const v = calculateRate(s, vmax, km);
      pathD += ` L ${getX(s)} ${getY(v)}`;
    }

    const currentX = getX(sConc);
    const currentY = getY(currentRate);
    const vmaxY = getY(vmax);
    const halfVmax = vmax / 2;
    const halfVmaxY = getY(halfVmax);
    const kmX = getX(km);

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible font-sans">
        {/* Axes */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="black" strokeWidth="2" />
        <line x1={padding} y1={height - padding} x2={padding} y2={padding} stroke="black" strokeWidth="2" />

        {/* Labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="#374151">[S] Substrate Concentration</text>
        <text x={10} y={height / 2} textAnchor="middle" fontSize="12" fill="#374151" transform={`rotate(-90, 10, ${height/2})`}>Velocity (V₀)</text>

        {/* Vmax Line */}
        <line x1={padding} y1={vmaxY} x2={width - padding} y2={vmaxY} stroke="#ef4444" strokeWidth="1" strokeDasharray="5,5" />
        <text x={width - padding} y={vmaxY - 5} textAnchor="end" fill="#ef4444" fontSize="10">Vmax</text>

        {/* The Curve */}
        <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" />

        {/* Current State Point */}
        <circle cx={currentX} cy={currentY} r="6" fill="#fbbf24" stroke="black" strokeWidth="2" />
        {/* Drop Lines */}
        <line x1={currentX} y1={currentY} x2={currentX} y2={height - padding} stroke="gray" strokeWidth="1" strokeDasharray="2,2" />
        <line x1={padding} y1={currentY} x2={currentX} y2={currentY} stroke="gray" strokeWidth="1" strokeDasharray="2,2" />

        {/* Km Indicators */}
        <line x1={padding} y1={halfVmaxY} x2={kmX} y2={halfVmaxY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,2" />
        <line x1={kmX} y1={halfVmaxY} x2={kmX} y2={height - padding} stroke="#10b981" strokeWidth="1" strokeDasharray="4,2" />
        <text x={kmX} y={height - padding + 15} textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">Km</text>
      </svg>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-800 p-4 md:p-8">

      {/* --- HEADER --- */}
      <div className="max-w-6xl mx-auto w-full mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
          <FlaskConical className="text-blue-600" size={32} />
          Interactive Enzyme Kinetics
        </h1>
        <p className="text-slate-600">
          Explore the Michaelis-Menten relationship between substrate concentration and reaction velocity.
          Adjust the parameters to see the graph and molecular simulation update in real-time.
        </p>
      </div>

      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* --- LEFT COLUMN: Controls & Equation (Span 5) --- */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Equation Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Michaelis-Menten Equation</div>
             <div className="flex items-center gap-4 text-2xl font-serif text-slate-800">
                <div className="flex items-baseline">
                   <span className="italic">V</span><span className="text-sm">0</span>
                </div>
                <span>=</span>
                <div className="flex flex-col items-center">
                   <div className="border-b-2 border-slate-800 px-4 pb-1 mb-1">
                      <span className="italic">V</span><span className="text-base">max</span> [S]
                   </div>
                   <div>
                      <span className="italic">K</span><span className="text-base">m</span> + [S]
                   </div>
                </div>
             </div>
          </div>

          {/* Controls Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
               <RefreshCw size={18} className="text-slate-500" /> Reaction Parameters
            </h2>

            <div className="space-y-8">
              {/* Vmax Control */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Vmax (Max Velocity)</label>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{vmax}</span>
                </div>
                <input
                  type="range" min="50" max="200" step="10"
                  value={vmax} onChange={(e) => setVmax(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Km Control */}
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Km (Michaelis Constant)</label>
                  <span className="text-sm font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">{km}</span>
                </div>
                <input
                  type="range" min="5" max="100" step="5"
                  value={km} onChange={(e) => setKm(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <p className="text-xs text-slate-400 mt-2">Lower Km = Higher Affinity</p>
              </div>

              <div className="h-px bg-slate-100 my-4"></div>

              {/* [S] Control */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between mb-2">
                  <label className="text-base font-bold text-blue-900">Current Substrate [S]</label>
                  <span className="text-base font-bold font-mono text-blue-700">{sConc} mM</span>
                </div>
                <input
                  type="range" min="0" max={MAX_S_SLIDER} step="1"
                  value={sConc} onChange={(e) => setSConc(Number(e.target.value))}
                  className="w-full h-3 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <p className="text-xs text-blue-600 mt-2 text-center font-medium">Drag to add substrate</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Visualizations (Span 7) --- */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 auto-rows-min">

          {/* 1. Graph Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-[400px]">
            <h2 className="text-lg font-semibold mb-2">Kinetics Plot</h2>
            <div className="flex-grow border border-slate-100 rounded-lg bg-white relative">
              {renderGraph()}
            </div>
            {/* Stats Row */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
               <div className="bg-slate-50 p-2 rounded border border-slate-100">
                 <div className="text-[10px] text-slate-500 uppercase font-bold">Velocity (V₀)</div>
                 <div className="text-lg font-mono text-slate-800">{currentRate.toFixed(1)}</div>
               </div>
               <div className="bg-slate-50 p-2 rounded border border-slate-100">
                 <div className="text-[10px] text-slate-500 uppercase font-bold">Saturation</div>
                 <div className="text-lg font-mono text-slate-800">{percentSaturation}%</div>
               </div>
            </div>
          </div>

          {/* 2. Simulation Card */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col h-[400px]">
             <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Play size={18} className="text-green-600"/> Molecular View
                </h2>
             </div>

             {/* Canvas Wrapper */}
             <div className="flex-grow relative bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-800">
                 <canvas
                    ref={canvasRef}
                    width={350}
                    height={350}
                    className="w-full h-full object-cover"
                 />
                 {/* Legend Overlay */}
                 <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-2 text-[10px] text-white grid grid-cols-2 gap-y-1 gap-x-2 border-t border-slate-700">
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div> Free Enzyme (E)
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white/50"></div> Bound (ES)
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-500"></div> Substrate (S)
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-purple-500"></div> Product (P)
                    </div>
                 </div>
             </div>
          </div>

          {/* 3. Observation Block (Full Width) */}
          <div className="col-span-1 md:col-span-2 bg-blue-50 p-5 rounded-xl border border-blue-100 text-blue-900 flex gap-4 items-start shadow-sm">
             <Info className="flex-shrink-0 mt-1" size={20} />
             <div>
               <h3 className="font-bold mb-1">Observation</h3>
               <div className="text-sm leading-relaxed">
                 {sConc < km ? (
                   <span>
                     When [S] is low (below Km), enzymes spend most of their time <span className="text-green-600 font-bold">Green</span> (waiting).
                     The reaction is limited by substrate availability.
                   </span>
                 ) : sConc > km * 4 ? (
                   <span>
                     At high [S], enzymes are saturated. They bind S, turn <span className="text-red-600 font-bold">Red</span>,
                     release <span className="text-purple-600 font-bold">Purple P</span>, and immediately find a new S.
                     Adding more substrate won't increase speed significantly (Vmax reached).
                   </span>
                 ) : (
                   <span>
                     Notice the cycle: <span className="text-green-600 font-bold">Green</span> → <span className="text-red-600 font-bold">Red</span> → Release <span className="text-purple-600 font-bold">Purple P</span> → <span className="text-green-600 font-bold">Green</span>.
                   </span>
                 )}
               </div>
             </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-200 text-center text-sm text-slate-500 pb-4">
        <a href="https://example.com" className="hover:text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors">Enzyme Kinetics Interactive App</a> © 2026 by <a href="https://linktr.ee/thebioway" className="hover:text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors">Vishal Bhoir</a> is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="hover:text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors">CC BY-SA 4.0</a>
        <span className="inline-flex items-center align-middle ml-1">
            <img src="https://mirrors.creativecommons.org/presskit/icons/cc.svg" alt="" style={{maxWidth: '1em', maxHeight: '1em', marginLeft: '.2em'}} />
            <img src="https://mirrors.creativecommons.org/presskit/icons/by.svg" alt="" style={{maxWidth: '1em', maxHeight: '1em', marginLeft: '.2em'}} />
            <img src="https://mirrors.creativecommons.org/presskit/icons/sa.svg" alt="" style={{maxWidth: '1em', maxHeight: '1em', marginLeft: '.2em'}} />
        </span>
      </div>

    </div>
  );
};

export default App;
