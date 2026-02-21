import React, { useEffect, useRef } from 'react';

interface MusicVisualizerProps {
  isPlaying: boolean;
  pacing?: 'slow' | 'normal' | 'fast';
  className?: string;
  colorTheme?: 'indigo' | 'rose' | 'emerald';
}

export const MusicVisualizer: React.FC<MusicVisualizerProps> = ({ 
  isPlaying, 
  pacing = 'normal',
  className = "",
  colorTheme = 'indigo'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    let animationId: number;
    const barCount = 60; // Number of bars
    let bars = new Array(barCount).fill(0);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / barCount;
      const centerY = canvas.height / 2;

      // Pacing multipliers
      let speedMultiplier = 0.15;
      let heightMultiplier = 0.7;

      if (pacing === 'fast') {
        speedMultiplier = 0.3;
        heightMultiplier = 0.9;
      } else if (pacing === 'slow') {
        speedMultiplier = 0.05;
        heightMultiplier = 0.4;
      }

      if (isPlaying) {
        bars = bars.map(prev => {
          // Generate a target height with some coherent noise/wave feel
          const target = Math.random() * (canvas.height * heightMultiplier);
          return prev + (target - prev) * speedMultiplier;
        });
      } else {
        bars = bars.map(prev => prev * 0.9); // Decay
      }

      bars.forEach((height, i) => {
        const x = i * barWidth;
        const h = Math.max(4, height);
        
        // Gradient color setup
        let colorStart = '#818cf8'; // Indigo-400
        let colorEnd = '#4f46e5';   // Indigo-600

        if (colorTheme === 'rose') {
            colorStart = '#fb7185'; 
            colorEnd = '#e11d48';
        } else if (colorTheme === 'emerald') {
            colorStart = '#34d399'; 
            colorEnd = '#059669';
        }

        const gradient = ctx.createLinearGradient(0, centerY - h/2, 0, centerY + h/2);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        // Rounded bars
        const radius = Math.min(barWidth / 2, 4);
        ctx.roundRect(x + 1, centerY - h / 2, barWidth - 2, h, radius);
        ctx.fill();
      });

      animationId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, [isPlaying, pacing, colorTheme]);

  return <canvas ref={canvasRef} className={className} />;
};