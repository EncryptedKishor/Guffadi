import React, { useState, useEffect, useRef } from 'react';
import { Home, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music, HelpCircle, ArrowRight, Sparkles } from 'lucide-react';

const playlist = [
  { name: 'Ambient Chill - Song 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: 'Peaceful Flow - Song 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { name: 'Zen Mind - Song 4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { name: 'Ethereal Space - Song 8', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

const sentences = [
  "Breathe in slowly, and let go of all your tension. Remember that you do not have to carry the weight of the entire world on your shoulders. You are doing the absolute best you can, and that is more than enough.",
  "In the journey of life, we often get so caught up in the destination that we forget to appreciate the quiet, beautiful moments along the way. Stop for a moment, take a deep breath, and look around you.",
  "Sometimes, the most productive thing you can do is relax. A quiet mind is able to hear the subtle whispers of wisdom that get drowned out by the noise of our daily struggles and endless rush.",
  "Gahiro saas leu ani chinta nagara. Yo sansar ma hamro bhanda thulo aru kehi chhaina; hareka chhaTa haru samaya sangai bilayera janchhan, ani naya bihani le sadhai naya aasa ra umanga bokera aauxa.",
  "You are not defined by your past mistakes or the failures you have encountered. You are defined by the courage you show in rising after every fall and moving forward with hope, one single step at a time.",
  "Aaja ko din naya aasa ra umanga sanga suru gara. Afno sapana haru lai sacho banauna pratidin thopadei mehnat gara, kina bhane safalta ekai din ma aaudaina tara ek din nischay nai aauxa.",
  "Do not rush your growth. Just like a beautiful flower takes time to bloom under the warm sun, your life will unfold beautifully if you give yourself the patience, time, and kindness you deserve.",
  "Happiness is not something you postpone for the future; it is something you design for the present. Find joy in the small things: a warm cup of tea, a sweet melody, or a quiet, peaceful breath.",
  "Hareko aailageko muskil haru timilai kamjor banauna haina, balki timro aatmabal ra saahas lai jhan kada banauna aayeka hun. Aafubhitra ko tyo sacho sakti ra atmabishwas lai china.",
  "Remember that it is completely okay to have bad days. Growth is not a straight line; it is a series of ups and downs. Be gentle with yourself as you navigate through the waves of life."
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
  const [displayedText, setDisplayedText] = useState('');
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [showMusicHint, setShowMusicHint] = useState(true);
  
  const audioRef = useRef(null);

  // 1. Manage Dynamic Typing Effect and Auto-Rotation Schedule
  useEffect(() => {
    let timer;
    let charIndex = 0;
    const fullText = sentences[sentenceIndex];
    setDisplayedText('');

    const typeChar = () => {
      if (charIndex < fullText.length) {
        setDisplayedText(fullText.substring(0, charIndex + 1));
        charIndex++;
        // Calculate delay: add soft pauses at commas/periods for organic reading speed
        const lastChar = fullText.charAt(charIndex - 1);
        let delay = 45; // baseline typing speed per character
        if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
          delay = 600; // longer pause at the end of a thought
        } else if (lastChar === ',') {
          delay = 300; // soft pause at commas
        }
        timer = setTimeout(typeChar, delay);
      } else {
        // Typing finished. If auto-scroll is enabled, schedule next transition after reading time
        if (autoRotate) {
          timer = setTimeout(() => {
            setFadeState('out');
            timer = setTimeout(() => {
              setSentenceIndex(prev => (prev + 1) % sentences.length);
              setFadeState('in');
            }, 800);
          }, 8000); // give the user 8 solid seconds of reading time after typing is done
        }
      }
    };

    // Slight delay before typing begins on a new sentence
    timer = setTimeout(typeChar, 400);

    return () => clearTimeout(timer);
  }, [sentenceIndex, autoRotate]);

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
          "{displayedText}"
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
