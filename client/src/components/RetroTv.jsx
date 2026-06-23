import React, { useEffect, useRef } from 'react';

export default function RetroTv({ status }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Create offscreen noise pattern canvas once
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = 128;
    noiseCanvas.height = 128;
    const noiseCtx = noiseCanvas.getContext('2d');
    const noiseImgData = noiseCtx.createImageData(128, 128);
    const noiseData = noiseImgData.data;
    
    // Fill noise image data with random gray values
    for (let i = 0; i < noiseData.length; i += 4) {
      const val = Math.floor(Math.random() * 255);
      noiseData[i] = val;
      noiseData[i + 1] = val;
      noiseData[i + 2] = val;
      noiseData[i + 3] = 255;
    }
    noiseCtx.putImageData(noiseImgData, 0, 0);

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    
    window.addEventListener('resize', resize);

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      if (w > 0 && h > 0) {
        ctx.clearRect(0, 0, w, h);
        const pattern = ctx.createPattern(noiseCanvas, 'repeat');
        ctx.fillStyle = pattern;
        
        ctx.save();
        // Shift pattern randomly on every frame for static noise motion
        ctx.translate(Math.random() * 128, Math.random() * 128);
        ctx.fillRect(-128, -128, w + 256, h + 256);
        ctx.restore();
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#000' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div className="tv-scanlines"></div>
      <div className="tv-screen-shadow"></div>
      
      {/* On-screen status display */}
      <div className="tv-status-overlay">
        <div className="tv-channel">CH 01</div>
        <div className="tv-searching">
          {status === 'waiting' ? 'SEARCHING...' : 'CONNECTING...'}
        </div>
      </div>
    </div>
  );
}
