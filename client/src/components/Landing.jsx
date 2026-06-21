import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Video, X, Camera, CameraOff } from 'lucide-react';

export default function Landing({ onlineCount, interests, setInterests, onStartChat, onStartMeet }) {
  const [tagInput, setTagInput] = useState('');
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [cameraError, setCameraError] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(() => {
    try {
      return localStorage.getItem('camera_granted') === 'true';
    } catch (e) {
      return false;
    }
  });
  const videoRef = useRef(null);
  const activeStreamRef = useRef(null);

  const startCamera = async () => {
    try {
      setCameraError(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setLocalStream(stream);
      activeStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      try {
        localStorage.setItem('camera_granted', 'true');
      } catch (e) {}
      setCameraRequested(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(true);
    }
  };

  // Start local camera preview if already granted
  useEffect(() => {
    if (cameraRequested) {
      startCamera();
    }
    return () => {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraRequested]);

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

          {/* Group Video Call Card */}
          <div className="landing-card group-meet-card" style={{ marginTop: '1.5rem', backgroundColor: 'var(--bg-lavender)' }}>
            <div className="input-group">
              <label>Group Video Call</label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                Create a private room to invite friends, or enter a room code/link to join.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexDirection: window.innerWidth < 640 ? 'column' : 'row' }}>
                <button 
                  className="neon-button"
                  onClick={() => {
                    // Generate random room code like abc-defg-hij
                    const r = () => Math.random().toString(36).substring(2, 6);
                    const roomCode = `${r()}-${r()}-${r()}`;
                    onStartMeet(roomCode);
                  }}
                  style={{ backgroundColor: 'var(--green)', flex: 1, padding: '0.6rem 1rem', fontSize: '0.95rem', justifyContent: 'center' }}
                >
                  Create Room
                </button>
                <div style={{ display: 'flex', flex: 1.5, border: 'var(--border-width) solid var(--border-color)', boxShadow: 'var(--shadow-sm)', background: 'var(--bg-white)', borderRadius: '4px', overflow: 'hidden' }}>
                  <input 
                    type="text" 
                    placeholder="Enter room code/link"
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value)}
                    style={{ flex: 1, border: 'none', padding: '0.5rem 0.75rem', outline: 'none', fontStyle: 'italic', fontSize: '0.9rem' }}
                  />
                  <button 
                    onClick={() => {
                      const trimmed = joinRoomCode.trim();
                      if (!trimmed) return;
                      let roomId = trimmed;
                      if (trimmed.includes('/meet/')) {
                        const parts = trimmed.split('/meet/');
                        roomId = parts[parts.length - 1];
                      }
                      roomId = roomId.split('?')[0].split('#')[0];
                      if (roomId) {
                        onStartMeet(roomId);
                      }
                    }}
                    style={{ background: 'var(--yellow)', borderLeft: 'var(--border-width) solid var(--border-color)', padding: '0.5rem 1rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Join
                  </button>
                </div>
              </div>
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
                <button 
                  className="glass-button" 
                  onClick={startCamera}
                  style={{ marginTop: '15px', backgroundColor: 'var(--yellow)' }}
                >
                  Retry Enable Camera
                </button>
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
                    <Camera size={16} />
                    <span>Webcam Preview</span>
                  </div>
                </div>
              </>
            ) : !cameraRequested ? (
              <div className="no-video-placeholder">
                <Camera size={48} className="text-muted" style={{ color: 'var(--indigo)' }} />
                <h3>Enable Webcam Preview</h3>
                <p>See how you look before matching with strangers.</p>
                <button 
                  className="glass-button" 
                  onClick={startCamera}
                  style={{ marginTop: '15px', backgroundColor: 'var(--yellow)' }}
                >
                  Enable Camera
                </button>
              </div>
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
