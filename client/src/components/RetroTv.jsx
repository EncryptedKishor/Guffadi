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
    <div className="retro-tv-wrapper">
      <div className="retro-tv-container">
        {/* Antenna */}
        <div className="tv-antenna">
          <div className="antenna-rod left"></div>
          <div className="antenna-rod right"></div>
          <div className="antenna-base"></div>
        </div>

        {/* Cabinet */}
        <div className="tv-cabinet">
          {/* Bezel */}
          <div className="tv-bezel">
            {/* Screen Glass */}
            <div className="tv-screen">
              <canvas ref={canvasRef} className="tv-static-canvas" />
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
          </div>

          {/* Control Panel */}
          <div className="tv-controls">
            <div className="tv-brand">GUFFADI</div>
            
            <div className="tv-knob-group">
              <div className="tv-knob-container">
                <div className="tv-knob-label">VOL</div>
                <div className="tv-knob"></div>
              </div>
              <div className="tv-knob-container">
                <div className="tv-knob-label">CH</div>
                <div className="tv-knob rotated"></div>
              </div>
            </div>

            <div className="tv-grill">
              <div className="grill-slot"></div>
              <div className="grill-slot"></div>
              <div className="grill-slot"></div>
              <div className="grill-slot"></div>
              <div className="grill-slot"></div>
            </div>

            <div className="tv-power">
              <div className="power-led"></div>
              <div className="power-label">POWER</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
