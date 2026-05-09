import React, { useEffect, useRef } from 'react';

// Aurora / animated gradient overlay
export function AuroraEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vh] rounded-full opacity-[0.06] blur-[120px] animate-aurora-1"
        style={{ background: 'radial-gradient(circle, hsl(187,92%,48%), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 w-[70vw] h-[70vh] rounded-full opacity-[0.05] blur-[100px] animate-aurora-2"
        style={{ background: 'radial-gradient(circle, hsl(263,70%,58%), transparent 70%)' }}
      />
      <div
        className="absolute top-1/3 left-1/2 w-[50vw] h-[50vh] rounded-full opacity-[0.04] blur-[80px] animate-aurora-3"
        style={{ background: 'radial-gradient(circle, hsl(142,71%,45%), transparent 70%)' }}
      />
    </div>
  );
}

// CRT scanlines
export function ScanlineEffect() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[999] opacity-[0.025]"
      style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.8) 2px, rgba(0,0,0,0.8) 4px)',
      }}
    />
  );
}

// Neon cursor trail
export function NeonCursor() {
  const trailRef = useRef([]);
  const dotsRef = useRef([]);

  useEffect(() => {
    const TRAIL_LENGTH = 12;
    const dots = [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        position: fixed; width: ${6 - i * 0.3}px; height: ${6 - i * 0.3}px;
        border-radius: 50%; pointer-events: none; z-index: 9999;
        background: hsl(187,92%,${70 - i * 4}%);
        opacity: ${1 - i / TRAIL_LENGTH};
        box-shadow: 0 0 ${8 - i}px hsl(187,92%,48%);
        transform: translate(-50%, -50%);
        transition: opacity 0.1s;
      `;
      document.body.appendChild(dot);
      dots.push({ el: dot, x: 0, y: 0 });
    }
    dotsRef.current = dots;

    let mouseX = 0, mouseY = 0;
    const onMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener('mousemove', onMove);

    const positions = Array(TRAIL_LENGTH).fill({ x: 0, y: 0 });
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      positions.unshift({ x: mouseX, y: mouseY });
      positions.pop();
      dots.forEach((dot, i) => {
        if (positions[i]) {
          dot.el.style.left = positions[i].x + 'px';
          dot.el.style.top = positions[i].y + 'px';
        }
      });
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMove);
      dots.forEach(d => d.el.remove());
    };
  }, []);

  return null;
}

// Tilt card wrapper — wraps children with 3D mouse-tilt effect
export function TiltCard({ children, className = '', intensity = 15 }) {
  const ref = useRef(null);

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const rotY = ((x - cx) / cx) * intensity;
    const rotX = -((y - cy) / cy) * intensity;
    el.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
  };

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)';
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.15s ease', transformStyle: 'preserve-3d', willChange: 'transform' }}
    >
      {children}
    </div>
  );
}

// Glitch text effect
export function GlitchText({ text, className = '' }) {
  return (
    <span className={`relative inline-block ${className}`} data-text={text} style={{
      textShadow: 'none',
    }}>
      <span className="relative z-10">{text}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 text-primary opacity-70 animate-glitch-1"
        style={{ clipPath: 'inset(20% 0 60% 0)', transform: 'skewX(-5deg)' }}
      >{text}</span>
      <span
        aria-hidden="true"
        className="absolute inset-0 text-secondary opacity-70 animate-glitch-2"
        style={{ clipPath: 'inset(60% 0 10% 0)', transform: 'skewX(3deg)' }}
      >{text}</span>
    </span>
  );
}

// Floating orbs background
export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {[
        { size: 300, x: '10%', y: '20%', color: 'hsl(187,92%,48%)', delay: '0s' },
        { size: 200, x: '80%', y: '60%', color: 'hsl(263,70%,58%)', delay: '2s' },
        { size: 150, x: '50%', y: '80%', color: 'hsl(142,71%,45%)', delay: '4s' },
        { size: 100, x: '30%', y: '50%', color: 'hsl(38,92%,50%)', delay: '1s' },
      ].map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-[0.04] blur-[80px]"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: orb.color,
            animation: `float-orb 8s ease-in-out infinite`,
            animationDelay: orb.delay,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
