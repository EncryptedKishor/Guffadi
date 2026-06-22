import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, SkipForward, SkipBack, ArrowDown, ArrowUp } from 'lucide-react';

const bookParagraphs = [
  {
    book: "The Great Gatsby by F. Scott Fitzgerald",
    level: "B2 Level",
    sentences: [
      "In my younger and more vulnerable years my father gave me some advice.",
      "It is advice that I have been turning over in my mind ever since.",
      "'Whenever you feel like criticizing any one,' he told me, 'just remember that all the people in this world haven't had the advantages that you've had.'",
      "He didn't say any more, but we've always been communicative in a reserved way.",
      "I understood that he meant a great deal more than that.",
      "In consequence, I'm inclined to reserve all judgments.",
      "This habit has opened up many curious natures to me, but also made me the victim of not a few veteran bores.",
      "The abnormal mind is quick to detect and attach itself to this quality when it appears in a normal person.",
      "In college I was unjustly accused of being a politician.",
      "This was because I was privy to the secret griefs of wild, unknown men.",
      "Reserving judgments is a matter of infinite hope.",
      "I am still a little afraid of missing something if I forget that, as my father suggested, a sense of the fundamental decencies is parcelled out unequally at birth."
    ]
  },
  {
    book: "Alice's Adventures in Wonderland by Lewis Carroll",
    level: "B1 Level",
    sentences: [
      "Alice was beginning to get very tired of sitting by her sister on the bank.",
      "She had nothing to do.",
      "Once or twice she had peeped into the book her sister was reading.",
      "But it had no pictures or conversations in it.",
      "'And what is the use of a book,' thought Alice, 'without pictures or conversations?'",
      "So she was considering in her own mind whether the pleasure of making a daisy-chain would be worth the trouble.",
      "Suddenly, a White Rabbit with pink eyes ran close by her.",
      "There was nothing so very remarkable in that.",
      "Nor did Alice think it so very much out of the way to hear the Rabbit say to itself: 'Oh dear! Oh dear! I shall be late!'",
      "But when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet.",
      "It flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it.",
      "Burning with curiosity, she ran across the field after it.",
      "Fortunately, she was just in time to see it pop down a large rabbit-hole under the hedge.",
      "In another moment down went Alice after it, never once considering how in the world she was to get out again."
    ]
  },
  {
    book: "Moby-Dick by Herman Melville",
    level: "B2 Level",
    sentences: [
      "Call me Ishmael.",
      "Some years ago—never mind how long precisely—having little or no money in my purse, I thought I would sail about a little.",
      "I wanted to see the watery part of the world.",
      "It is a way I have of driving off the spleen and regulating the circulation.",
      "Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul...",
      "Whenever I find myself involuntarily pausing before coffin warehouses...",
      "And especially whenever it requires a strong moral principle to prevent me from deliberately stepping into the street...",
      "Then, I account it high time to get to sea as soon as I can.",
      "This is my substitute for pistol and ball.",
      "With a philosophical flourish Cato throws himself upon his sword; I quietly take to the ship.",
      "There is nothing surprising in this.",
      "If they but knew it, almost all men cherish very nearly the same feelings towards the ocean with me.",
      "Belted round by wharves as Indian isles by coral reefs, commerce surrounds it with her surf.",
      "Posted like silent sentinels all around the town, thousands upon thousands of mortal men are fixed in ocean reveries."
    ]
  },
  {
    book: "Pride and Prejudice by Jane Austen",
    level: "B1 Level",
    sentences: [
      "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
      "However little known the feelings or views of such a man may be on his first entering a neighbourhood...",
      "This truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.",
      "'My dear Mr. Bennet,' said his lady to him one day, 'have you heard that Netherfield Park is let at last?'",
      "Mr. Bennet replied that he had not.",
      "'But it is,' returned she; 'for Mrs. Long has just been here, and she told me all about it.'",
      "Mr. Bennet made no answer.",
      "'Do you not want to know who has taken it?' cried his wife impatiently.",
      "'You want to tell me, and I have no objection to hearing it.'",
      "This was invitation enough.",
      "'Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England.'",
      "'Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year.'",
      "'What a fine thing for our girls!'",
      "'How so? How can it affect them?'",
      "'My dear Mr. Bennet,' replied his wife, 'how can you be so tiresome! You must know that I am thinking of his marrying one of them.'"
    ]
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
  
  const textScrollContainerRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  // Manage Automated Smooth Paragraph Auto-Scrolling
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
      {/* Top Navigation Bar exactly matching the reference image layout */}
      <div className="readflow-top-bar">
        <button 
          type="button" 
          onClick={onLeave} 
          className="readflow-back-btn"
          title="Back to Home"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="readflow-header-info">
          <h2 className="readflow-main-title">Reading Challenge!</h2>
          <span className="readflow-level-tag">({bookParagraphs[sentenceIndex].level})</span>
        </div>
        
        {/* Invisible spacer to maintain centered header symmetry */}
        <div style={{ width: '40px' }} aria-hidden="true"></div>
      </div>

      {/* Background Zen Floating Particles (highly translucent) */}
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

      {/* Floating Main Content Card (completely borderless and transparent) */}
      <div className="readflow-card-display">
        {/* Scrollable Text Viewport */}
        <div 
          ref={textScrollContainerRef} 
          className={`readflow-scroll-box ${fadeState === 'in' ? 'fade-in' : 'fade-out'}`}
        >
          <div className="readflow-scroll-content">
            {/* Show book title inside reading scroll list as starting cue */}
            <div style={{ fontSize: '1rem', fontStyle: 'italic', color: '#78716c', marginBottom: '3.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              — From {bookParagraphs[sentenceIndex].book} —
            </div>

            {bookParagraphs[sentenceIndex].sentences.map((sentence, idx) => (
              <div key={idx} className="readflow-sentence-block">
                {sentence}
              </div>
            ))}
          </div>
        </div>
        
        {/* Navigation Buttons and Scroll Speed pill selector */}
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
    </div>
  );
}
