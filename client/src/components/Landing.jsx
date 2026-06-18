import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Video, X, Camera, CameraOff } from 'lucide-react';

export default function Landing({ onlineCount, interests, setInterests, onStartChat }) {
  const [tagInput, setTagInput] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef(null);

  // Start local camera preview for the landing page
  useEffect(() => {
    let streamRef = null;
    async function startCamera() {
      try {
        setCameraError(false);
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        setLocalStream(stream);
        streamRef = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setCameraError(true);
      }
    }
    startCamera();

    return () => {
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Sync video source if element mounts/demounts or stream changes
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle adding an interest tag
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed]);
      setTagInput('');
    }
  };

  // Handle removing a tag
  const removeTag = (indexToRemove) => {
    setInterests(interests.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="landing-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div className="landing-grid">
        {/* Floating Badges */}
        <div className="sticker sticker-yellow" style={{ top: '-35px', left: '8%', transform: 'rotate(-5deg)' }}>100% Free &amp; Secure</div>
        <div className="sticker sticker-green" style={{ bottom: '-15px', left: '4%', transform: 'rotate(4deg)' }}>Talk to Strangers</div>
        <div className="sticker sticker-indigo" style={{ top: '-20px', right: '35%', transform: 'rotate(-3deg)' }}>Made in Nepal 🇳🇵</div>
        
        <div className="landing-left">
          <h1 className="landing-title">
            Talk to strangers,<br />
            <span>securely & instantly.</span>
          </h1>
          <p className="landing-subtitle">
            Meet new people from all around the world. Filter by your interests to match with like-minded individuals, or jump straight into a random text or video conversation!
          </p>
 
          <div className="landing-card">
            <div className="input-group">
              <label htmlFor="interests-input">Add your interests (optional)</label>
              <div className="interests-tag-box">
                {interests.map((tag, index) => (
                  <span key={index} className="interest-tag">
                    {tag}
                    <button onClick={() => removeTag(index)} aria-label={`Remove interest ${tag}`}>
                      <X size={14} />
                    </button>
                  </span>
                ))}
                <input
                  id="interests-input"
                  type="text"
                  placeholder={interests.length === 0 ? "e.g. coding, music, movies..." : "Add more..."}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={addTag}
                />
              </div>
            </div>
 
            <div className="action-buttons">
              <button 
                className="neon-button" 
                onClick={() => onStartChat('text')}
                style={{ backgroundColor: 'var(--yellow)' }}
              >
                <MessageSquare size={18} />
                Text Chat
              </button>
              <button 
                className="neon-button" 
                onClick={() => onStartChat('video')}
                style={{ backgroundColor: 'var(--indigo)' }}
              >
                <Video size={18} />
                Video Chat
              </button>
            </div>
          </div>
        </div>

        <div className="landing-right">
          <div className="preview-container">
            {cameraError ? (
              <div className="no-video-placeholder">
                <CameraOff size={48} className="text-muted" style={{ color: 'var(--rose)' }} />
                <h3>Webcam Disabled</h3>
                <p>To use video chat, please allow microphone and camera access in your browser settings.</p>
              </div>
            ) : localStream ? (
              <>
                <video 
                  ref={videoRef} 
                  className="preview-video" 
                  autoPlay 
                  playsInline 
                  muted
                />
                <div className="preview-overlay">
                  <div className="preview-overlay-info">
                    <Camera size={16} style={{ color: 'var(--secondary)' }} />
                    <span>Webcam Preview</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="no-video-placeholder">
                <div className="spinner"></div>
                <p style={{ marginTop: '10px' }}>Accessing camera preview...</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <footer className="app-footer">
        <p>Built with <span>❤️</span> in Nepal</p>
      </footer>
    </div>
  );
}
