import React, { useState, useEffect, useRef } from 'react';
import { Home, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';

const playlist = [
  { name: 'Ambient Chill - Song 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: 'Peaceful Flow - Song 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { name: 'Zen Mind - Song 4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { name: 'Ethereal Space - Song 8', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

const sentences = [
  "Breathe in, breathe out. You are doing just fine.",
  "Every storm passes. Your sky will clear up too.",
  "Focus on the step in front of you, not the whole staircase.",
  "You don't have to be perfect to be amazing.",
  "Be kind to your mind. You are growing at your own pace.",
  "Your energy is your superpower. Guard it wisely.",
  "Slow down. The best things in life take time.",
  "Sangaichhau hami, chinta nagara.",
  "Aaja naya suruaat garne ho!",
  "Gahiro saas leu, sabai thik hunxa.",
  "Today is a good day to have a good day.",
  "You are stronger than the challenges you face.",
  "Be proud of how hard you are trying.",
  "Quiet minds find the most beautiful paths.",
  "One day at a time. One breath at a time.",
  "Let go of what you cannot control.",
  "Your potential is limitless. Keep going.",
  "Celebrate the small wins. They lead to big victories.",
  "Aaja ko din timro ho.",
  "Success is a series of tiny daily habits."
];

// Generate simple floating particles
const particlesArray = Array.from({ length: 15 }).map((_, i) => ({
  id: i,
  size: Math.random() * 20 + 10,
  left: Math.random() * 100,
  delay: Math.random() * 8,
  duration: Math.random() * 12 + 10
}));

export default function ReadFlow({ onLeave }) {
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [fadeState, setFadeState] = useState('in');
  const [autoRotate, setAutoRotate] = useState(true);
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [showMusicHint, setShowMusicHint] = useState(true);
  
  const audioRef = useRef(null);
  const autoRotateIntervalRef = useRef(null);

  // 1. Manage Sentence Auto-Rotation
  useEffect(() => {
    if (!autoRotate) {
      if (autoRotateIntervalRef.current) clearInterval(autoRotateIntervalRef.current);
      return;
    }

    autoRotateIntervalRef.current = setInterval(() => {
      setFadeState('out');
      setTimeout(() => {
        setSentenceIndex(prev => (prev + 1) % sentences.length);
        setFadeState('in');
      }, 800);
    }, 7000);

    return () => {
      if (autoRotateIntervalRef.current) clearInterval(autoRotateIntervalRef.current);
    };
  }, [autoRotate]);

  // 2. Audio Control Effects
  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        console.warn("Audio autoplay blocked by browser policy until interaction.", err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowMusicHint(false);
  };

  const handleNextTrack = () => {
    setCurrentTrackIndex(prev => (prev + 1) % playlist.length);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    setCurrentTrackIndex(prev => (prev - 1 + playlist.length) % playlist.length);
    setIsPlaying(true);
  };

  const handleNextSentence = () => {
    setAutoRotate(false); // Pause auto-rotate on manual click
    setFadeState('out');
    setTimeout(() => {
      setSentenceIndex(prev => (prev + 1) % sentences.length);
      setFadeState('in');
    }, 400);
  };

  const handlePrevSentence = () => {
    setAutoRotate(false); // Pause auto-rotate on manual click
    setFadeState('out');
    setTimeout(() => {
      setSentenceIndex(prev => (prev - 1 + sentences.length) % sentences.length);
      setFadeState('in');
    }, 400);
  };

  return (
    <div className="readflow-container">
      {/* Background Zen Floating Particles */}
      <div className="readflow-particles-layer">
        {particlesArray.map(p => (
          <div 
            key={p.id}
            className="readflow-particle"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`
            }}
          />
        ))}
      </div>

      {/* Floating Audio Playback Hint */}
      {showMusicHint && !isPlaying && (
        <div className="readflow-music-hint">
          <Sparkles size={16} />
          <span>Click play below to listen to ambient music</span>
        </div>
      )}

      {/* Floating Main Content Card */}
      <div className="readflow-card-display">
        <div className={`readflow-text ${fadeState === 'in' ? 'fade-in' : 'fade-out'}`}>
          "{sentences[sentenceIndex]}"
        </div>
        
        {/* Navigation Buttons for Sentences */}
        <div className="readflow-controls-row">
          <button 
            type="button" 
            onClick={handlePrevSentence} 
            className="readflow-nav-btn"
            title="Previous thought"
          >
            <SkipBack size={18} />
          </button>
          
          <button 
            type="button" 
            onClick={() => setAutoRotate(!autoRotate)} 
            className={`readflow-state-btn ${autoRotate ? 'active' : ''}`}
            title={autoRotate ? "Pause auto-scroll" : "Resume auto-scroll"}
          >
            {autoRotate ? "Auto-Scroll: On" : "Auto-Scroll: Off"}
          </button>

          <button 
            type="button" 
            onClick={handleNextSentence} 
            className="readflow-nav-btn"
            title="Next thought"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      {/* Cool Interactive Neobrutalist Audio Controller */}
      <div className="readflow-player-card">
        <div className="track-info">
          <Music size={16} className="music-icon" style={{ animation: isPlaying ? 'spin 6s linear infinite' : 'none' }} />
          <span className="track-name">{playlist[currentTrackIndex].name}</span>
        </div>
        
        <div className="player-controls">
          <button type="button" onClick={handlePrevTrack} className="player-btn">
            <SkipBack size={16} />
          </button>
          
          <button type="button" onClick={handlePlayPause} className="player-play-btn">
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          
          <button type="button" onClick={handleNextTrack} className="player-btn">
            <SkipForward size={16} />
          </button>

          <div className="separator"></div>

          <button type="button" onClick={() => setIsMuted(!isMuted)} className="player-btn">
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05"
            value={volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              setIsMuted(false);
            }}
            className="player-volume-slider"
            aria-label="Volume slider"
          />
        </div>

        <audio 
          ref={audioRef}
          src={playlist[currentTrackIndex].url}
          loop
          onEnded={handleNextTrack}
        />
      </div>

      {/* Back to Landing Home button */}
      <button 
        type="button" 
        onClick={onLeave} 
        className="readflow-home-btn"
      >
        <Home size={18} />
        <span>Exit ReadFlow</span>
      </button>
    </div>
  );
}
