import React, { useState, useEffect, useRef } from 'react';
import { Home, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music, HelpCircle, ArrowRight, Sparkles, ArrowDown, ArrowUp } from 'lucide-react';

const playlist = [
  { name: 'Ambient Chill - Song 1', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { name: 'Peaceful Flow - Song 2', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { name: 'Zen Mind - Song 4', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { name: 'Ethereal Space - Song 8', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' }
];

const bookParagraphs = [
  {
    book: "The Great Gatsby by F. Scott Fitzgerald",
    text: "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since. 'Whenever you feel like criticizing any one,' he told me, 'just remember that all the people in this world haven't had the advantages that you've had.' He didn't say any more, but we've always been unusually communicative in a reserved way, and I understood that he meant a great deal more than that. In consequence, I'm inclined to reserve all judgments, a habit that has opened up many curious natures to me and also made me the victim of not a few veteran bores. The abnormal mind is quick to detect and attach itself to this quality when it appears in a normal person, and so it came about that in college I was unjustly accused of being a politician, because I was privy to the secret griefs of wild, unknown men. Most of the confidences were unsought—frequently I have feigned sleep, preoccupation, or a hostile levity when I realized by some unmistakable sign that an intimate revelation was quivering on the horizon; for the intimate revelations of young men, or at least the terms in which they express them, are usually plagiaristic and marred by obvious suppressions. Reserving judgments is a matter of infinite hope. I am still a little afraid of missing something if I forget that, as my father snobbishly suggested, and I snobbishly repeat, a sense of the fundamental decencies is parcelled out unequally at birth. And, after boasting this way of my tolerance, I come to the admission that it has a limit. Conduct may be founded on the hard rock or the wet marshes, but after a certain point I don't care what it's founded on. When I came back from the East last autumn I felt that I wanted the world to be in uniform and at a sort of moral attention forever; I wanted no more riotous excursions with privileged glimpses into the human heart. Only Gatsby, the man who gives his name to this book, was exempt from my reaction—Gatsby, who represented everything for which I have an unaffected scorn."
  },
  {
    book: "Alice's Adventures in Wonderland by Lewis Carroll",
    text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversations?' So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid) whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her. There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, 'Oh dear! Oh dear! I shall be late!' (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge. In another moment down went Alice after it, never once considering how in the world she was to get out again. The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well. Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves."
  },
  {
    book: "Moby-Dick by Herman Melville",
    text: "Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation. Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; whenever I find myself involuntarily pausing before coffin warehouses, and bringing up the rear of every funeral I meet; and especially whenever my hypos get such an upper hand of me, that it requires a strong moral principle to prevent me from deliberately stepping into the street, and methodically knocking people's hats off—then, I account it high time to get to sea as soon as I can. This is my substitute for pistol and ball. With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship. There is nothing surprising in this. If they but knew it, almost all men in their degree, some time or other, cherish very nearly the same feelings towards the ocean with me. There now is your insular city of the Manhattoes, belted round by wharves as Indian isles by coral reefs—commerce surrounds it with her surf. Right and left, the streets take you waterward. Its extreme downtown is the Battery, where that noble mole is washed by waves, and cooled by breezes, which a few hours previous were out of sight of land. Look at the crowds of water-gazers there. Circumambulate the city of a dreamy Sabbath afternoon. Go from Corlears Hook to Coenties Slip, and from thence, by Whitehall, northward. What do you see?—Posted like silent sentinels all around the town, thousands upon thousands of mortal men fixed in ocean reveries. Some leaning against the spiles; some seated upon the pier-heads; some looking over the bulwarks of ships from China; some high aloft in the rigging, as if striving to get a still better seaward peep. But these are all landsmen; of week days pent up in lath and plaster—tied to counters, nailed to benches, clinched to desks."
  },
  {
    book: "Pride and Prejudice by Jane Austen",
    text: "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters. 'My dear Mr. Bennet,' said his lady to him one day, 'have you heard that Netherfield Park is let at last?' Mr. Bennet replied that he had not. 'But it is,' returned she; 'for Mrs. Long has just been here, and she told me all about it.' Mr. Bennet made no answer. 'Do you not want to know who has taken it?' cried his wife impatiently. 'You want to tell me, and I have no objection to hearing it.' This was invitation enough. 'Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week.' 'What is his name?' 'Bingley.' 'Is he married or single?' 'Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year. What a fine thing for our girls!' 'How so? How can it affect them?' 'My dear Mr. Bennet,' replied his wife, 'how can you be so tiresome! You must know that I am thinking of his marrying one of them.' 'Is that his design in settling here?' 'Design! Nonsense, how can you talk so! But it is very likely that he may fall in love with one of them, and therefore you must visit him as soon as he comes.' Mr. Bennet was among the earliest of those who waited on Mr. Bingley. He had always intended to visit him, though to the last always assuring his wife that he should not go; and till after the evening was over, she had no knowledge of it."
  }
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
  const [scrollSpeed, setScrollSpeed] = useState(1); // 1 = slow, 2 = medium, 0 = paused
  
  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(true); // Default to true (auto play music when loading ReadFlow)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [volume, setVolume] = useState(0.4);
  const [isMuted, setIsMuted] = useState(false);
  const [showMusicHint, setShowMusicHint] = useState(false); // Music starts auto, no hint needed
  
  const audioRef = useRef(null);
  const textScrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // 1. Trigger Auto Play on Component Mount and Interaction
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.warn("Autoplay blocked. Awaiting user gesture for audio context release.", err);
        // Fallback: If blocked, listen to first touch/click inside page to kick off music
        const forcePlay = () => {
          if (audioRef.current) {
            audioRef.current.play().then(() => {
              setIsPlaying(true);
              document.removeEventListener('click', forcePlay);
              document.removeEventListener('touchstart', forcePlay);
            }).catch(e => console.error(e));
          }
        };
        document.addEventListener('click', forcePlay);
        document.addEventListener('touchstart', forcePlay);
      });
    }
  }, []);

  // 2. Manage Automated Smooth Paragraph Auto-Scrolling
  useEffect(() => {
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    if (scrollSpeed === 0) return;

    const scrollContainer = textScrollContainerRef.current;
    if (!scrollContainer) return;

    // Reset scroll positions on index change
    scrollContainer.scrollTop = 0;

    const delayTimer = setTimeout(() => {
      scrollIntervalRef.current = setInterval(() => {
        if (!scrollContainer) return;
        
        // Auto scroll down pixel by pixel
        scrollContainer.scrollTop += 0.5 * scrollSpeed;

        // Check if we hit the bottom of the long paragraph
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (scrollContainer.scrollTop >= maxScroll - 1 && autoRotate) {
          // Pause scrolling briefly, fade out and switch paragraph
          clearInterval(scrollIntervalRef.current);
          setTimeout(() => {
            setFadeState('out');
            setTimeout(() => {
              setSentenceIndex(prev => (prev + 1) % bookParagraphs.length);
              setFadeState('in');
            }, 800);
          }, 3500); // 3.5s pause at the end of the text
        }
      }, 30); // 30ms scroll ticks for buttery smooth movement
    }, 2000); // Wait 2s before starting to scroll a new paragraph

    return () => {
      clearTimeout(delayTimer);
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [sentenceIndex, scrollSpeed, autoRotate]);

  // 3. Audio Control Effects
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
    setFadeState('out');
    setTimeout(() => {
      setSentenceIndex(prev => (prev + 1) % bookParagraphs.length);
      setFadeState('in');
    }, 400);
  };

  const handlePrevSentence = () => {
    setFadeState('out');
    setTimeout(() => {
      setSentenceIndex(prev => (prev - 1 + bookParagraphs.length) % bookParagraphs.length);
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
        <div className="readflow-book-title">
          {bookParagraphs[sentenceIndex].book}
        </div>

        {/* Scrollable Text Viewport */}
        <div 
          ref={textScrollContainerRef} 
          className={`readflow-scroll-box ${fadeState === 'in' ? 'fade-in' : 'fade-out'}`}
        >
          <div className="readflow-scroll-content">
            {bookParagraphs[sentenceIndex].text}
          </div>
        </div>
        
        {/* Navigation Buttons for Sentences and Scroll Speeds */}
        <div className="readflow-controls-row">
          <button 
            type="button" 
            onClick={handlePrevSentence} 
            className="readflow-nav-btn"
            title="Previous chapter/passage"
          >
            <SkipBack size={18} />
          </button>
          
          <div className="scroll-speed-selector">
            <button 
              type="button" 
              onClick={() => setScrollSpeed(0)} 
              className={`speed-btn ${scrollSpeed === 0 ? 'active' : ''}`}
            >
              Pause
            </button>
            <button 
              type="button" 
              onClick={() => setScrollSpeed(1)} 
              className={`speed-btn ${scrollSpeed === 1 ? 'active' : ''}`}
            >
              <ArrowDown size={14} /> Slow
            </button>
            <button 
              type="button" 
              onClick={() => setScrollSpeed(2)} 
              className={`speed-btn ${scrollSpeed === 2 ? 'active' : ''}`}
            >
              <ArrowDown size={14} /> Medium
            </button>
          </div>

          <button 
            type="button" 
            onClick={handleNextSentence} 
            className="readflow-nav-btn"
            title="Next chapter/passage"
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
