import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Video, VideoOff, Home, AlertCircle, Sparkles, MessageSquare, X, MessageCircle } from 'lucide-react';
import RetroTv from './RetroTv';

const aiPersonas = [
  {
    name: 'Emily',
    age: 21,
    location: 'New York, USA',
    interests: ['music', 'travel', 'books', 'coffee'],
    videoUrl: '/videos/girl_intel.mp4'
  },
  {
    name: 'Sofia',
    age: 22,
    location: 'Barcelona, Spain',
    interests: ['surf', 'photo', 'beach', 'hiking'],
    videoUrl: '/videos/face_1.mp4'
  },
  {
    name: 'Priya',
    age: 20,
    location: 'Kathmandu, Nepal',
    interests: ['coding', 'art', 'anime', 'momos'],
    videoUrl: '/videos/face_2.mp4'
  },
  {
    name: 'Jessica',
    age: 23,
    location: 'London, UK',
    interests: ['gaming', 'design', 'tea', 'music'],
    videoUrl: '/videos/face_3.mp4'
  },
  {
    name: 'Chloe',
    age: 19,
    location: 'Toronto, Canada',
    interests: ['movies', 'fitness', 'dance', 'cats'],
    videoUrl: '/videos/face_4.mp4'
  },
  {
    name: 'Maya',
    age: 21,
    location: 'Delhi, India',
    interests: ['food', 'shopping', 'movies', 'dance'],
    videoUrl: '/videos/face_5.mp4'
  }
];

export default function ChatSession({ socket, mode, interests, onLeave }) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'waiting' | 'matched' | 'disconnected'
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [localStreamReady, setLocalStreamReady] = useState(mode !== 'video');
  const [remoteStream, setRemoteStream] = useState(null);
  const [currentPersona, setCurrentPersona] = useState(null);

  const isMobileChatOpenRef = useRef(false);
  const aiPersonaRef = useRef(null);
  const chatStepRef = useRef(0);
  const aiResponseTimeoutRef = useRef(null);
  const aiMatchTimeoutRef = useRef(null);
  const aiFallbackTimeoutRef = useRef(null);

  useEffect(() => {
    isMobileChatOpenRef.current = isMobileChatOpen;
    if (isMobileChatOpen) {
      setHasUnread(false);
    }
  }, [isMobileChatOpen]);


  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const chatEndRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const autoMatchTimeoutRef = useRef(null);
  const partnerIdRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartXRef.current || !touchStartYRef.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartXRef.current - touchEndX;
    const diffY = touchStartYRef.current - touchEndY;
    // Check if horizontal swipe is dominant and exceeds threshold (70px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 70) {
      handleStopAction();
    }
    touchStartXRef.current = 0;
    touchStartYRef.current = 0;
  };

  // 1. Initial local video setup (if in video mode)
  useEffect(() => {
    let streamObj = null;

    async function setupLocalStream() {
      if (mode !== 'video') return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: true
        });
        localStreamRef.current = stream;
        streamObj = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setLocalStreamReady(true);
      } catch (err) {
        console.error('Error obtaining audio/video stream:', err);
        setMessages(prev => [
          ...prev,
          {
            key: `err-${Date.now()}`,
            sender: 'system',
            text: 'Could not access webcam/microphone. Video chat requires permissions.'
          }
        ]);
      }
    }

    setupLocalStream();

    // Clean up local camera stream on unmount
    return () => {
      if (streamObj) {
        streamObj.getTracks().forEach(track => track.stop());
      }
      closePeerConnection();
    };
  }, [mode]);



  const triggerAiResponse = (userMsg) => {
    if (aiResponseTimeoutRef.current) clearTimeout(aiResponseTimeoutRef.current);

    const persona = aiPersonaRef.current;
    if (!persona) return;

    chatStepRef.current += 1;
    const currentStep = chatStepRef.current;
    const msg = userMsg.toLowerCase().trim();

    let reply = '';
    
    if (msg.match(/\b(m\s*or\s*f|m\/f|f\s*or\s*m|gender|girl|boy|guy|female|male)\b/)) {
      reply = `f, you?`;
    } else if (msg.match(/\b(age|old|how\s*old)\b/)) {
      reply = `${persona.age}, hbu?`;
    } else if (msg.match(/\b(where|location|from|country|wru|city)\b/)) {
      reply = `i'm from ${persona.location}, what about you?`;
    } else if (msg.match(/\b(name|who\s*are\s*you|your\s*name)\b/)) {
      reply = `my name is ${persona.name} :) what's yours?`;
    } else if (msg.match(/\b(snap|snapchat|insta|instagram|socials|number|whatsapp|phone)\b/)) {
      reply = `sure, my instagram is @${persona.name.toLowerCase()}_${persona.age} or we can chat here first?`;
    } else if (msg.match(/\b(hi|hey|hello|yo|sup|whats\s*up|greeting)\b/)) {
      reply = `hey! how are you?`;
    } else if (msg.match(/\b(hru|how\s*are\s*you|how\s*u|how\s*r\s*u)\b/)) {
      reply = `i'm doing good! just relaxing, you?`;
    } else if (msg.match(/\b(what\s*are\s*you\s*doing|what\s*u\s*doing|doing|whats\s*up|what\s*up|hobbies|hobby|like\s*to\s*do)\b/)) {
      reply = `i love ${persona.interests.join(', ')}. right now just checking out guffadi! what about you?`;
    } else if (msg.match(/\b(bye|gtg|leaving|exit)\b/)) {
      reply = `aw okay, nice chatting with you! bye!`;
    } else {
      switch (currentStep) {
        case 1:
          reply = `hey! m or f?`;
          break;
        case 2:
          reply = `cool. where are you from?`;
          break;
        case 3:
          reply = `ah nice! what do you like to do for fun?`;
          break;
        case 4:
          reply = `that sounds fun. i'm really into ${persona.interests.slice(0, 2).join(' and ')} lol`;
          break;
        case 5:
          reply = `are you looking for anyone specific on here? so many weirdos usually haha`;
          break;
        case 6:
          reply = `true, glad I matched with someone normal. do you use snap or insta?`;
          break;
        case 7:
          reply = `nice, we should add each other. i'm pretty active on insta`;
          break;
        default:
          const randomReplies = [
            "haha cool",
            "that's interesting! tell me more?",
            "aw that's nice",
            "oh really? cool",
            "i see. hbu?",
            "sorry, what did you say?",
            "nice haha"
          ];
          reply = randomReplies[Math.floor(Math.random() * randomReplies.length)];
          break;
      }
    }

    const delay = Math.max(1000, reply.length * 40 + Math.random() * 400);
    setIsPartnerTyping(true);

    aiResponseTimeoutRef.current = setTimeout(() => {
      setIsPartnerTyping(false);
      setMessages(prev => [
        ...prev,
        {
          key: `msg-ai-${Date.now()}-${Math.random()}`,
          sender: 'stranger',
          text: reply,
          timestamp: Date.now()
        }
      ]);
      if (!isMobileChatOpenRef.current) {
        setHasUnread(true);
      }
    }, delay);
  };

  // 2. Join the matchmaking queue
  useEffect(() => {
    if (!socket) return;
    if (mode === 'video' && !localStreamReady) return;

    // Reset components states
    setMessages([{ key: 'system-init', sender: 'system', text: 'Connecting to server...' }]);
    setStatus('connecting');

    socket.emit('join-queue', { mode, interests });

    // WebSockets Event Listeners
    socket.on('waiting', () => {
      setStatus('waiting');
      setMessages([
        { key: 'waiting-1', sender: 'system', text: 'Looking for a stranger...' },
        interests.length > 0
          ? { key: 'waiting-2', sender: 'system', text: `Searching for matches with interests: ${interests.join(', ')}` }
          : { key: 'waiting-2', sender: 'system', text: 'Matching randomly...' }
      ]);

      // Clear any existing fallback timer
      if (aiFallbackTimeoutRef.current) clearTimeout(aiFallbackTimeoutRef.current);

      // Start randomized fallback timer between 4 and 7 seconds
      const fallbackDelay = 4000 + Math.random() * 3000;
      aiFallbackTimeoutRef.current = setTimeout(() => {
        console.log("No real stranger found in queue. Fallback to AI stranger...");
        
        // 1. Leave server queue
        socket.emit('leave-queue');

        // 2. Pick AI Persona
        let selectedPersona = null;
        if (interests.length > 0) {
          const matching = aiPersonas.filter(p => 
            p.interests.some(i => interests.map(ui => ui.toLowerCase()).includes(i.toLowerCase()))
          );
          if (matching.length > 0) {
            selectedPersona = matching[Math.floor(Math.random() * matching.length)];
          }
        }
        
        if (!selectedPersona) {
          selectedPersona = aiPersonas[Math.floor(Math.random() * aiPersonas.length)];
        }

        setCurrentPersona(selectedPersona);
        aiPersonaRef.current = selectedPersona;
        setStatus('matched');

        const introMessages = [
          { key: 'match-1', sender: 'system', text: 'You are now chatting with a random stranger!' }
        ];

        const common = selectedPersona.interests.filter(i => 
          interests.map(ui => ui.toLowerCase()).includes(i.toLowerCase())
        );

        if (common.length > 0) {
          introMessages.push({
            key: 'match-2',
            sender: 'system',
            text: `🎉 You both like: ${common.join(', ')}`
          });
        }
        setMessages(introMessages);

        // Trigger first greeting after 1.2s
        setIsPartnerTyping(true);
        aiResponseTimeoutRef.current = setTimeout(() => {
          setIsPartnerTyping(false);
          
          const greetings = ["hey!", "hi", "hey there", "hi u"];
          const selectedGreeting = greetings[Math.floor(Math.random() * greetings.length)];

          setMessages(prev => [
            ...prev,
            {
              key: `msg-ai-greet`,
              sender: 'stranger',
              text: selectedGreeting,
              timestamp: Date.now()
            }
          ]);
        }, 1200);

      }, fallbackDelay);
    });

    socket.on('matched', async ({ roomId, partnerId, initiator, commonInterests }) => {
      // Clear AI fallback timer immediately
      if (aiFallbackTimeoutRef.current) clearTimeout(aiFallbackTimeoutRef.current);

      setStatus('matched');
      setIsPartnerTyping(false);
      partnerIdRef.current = partnerId;

      const introMessages = [
        { key: 'match-1', sender: 'system', text: 'You are now chatting with a random stranger!' }
      ];

      if (commonInterests && commonInterests.length > 0) {
        introMessages.push({
          key: 'match-2',
          sender: 'system',
          text: `🎉 You both like: ${commonInterests.join(', ')}`
        });
      }
      setMessages(introMessages);

      // WebRTC Setup (if video mode)
      if (mode === 'video') {
        setupPeerConnection(initiator);
      }
    });

    socket.on('message', (msg) => {
      setIsPartnerTyping(false);
      setMessages(prev => [...prev, { ...msg, key: `msg-${Date.now()}-${Math.random()}` }]);
      if (!isMobileChatOpenRef.current) {
        setHasUnread(true);
      }
    });

    socket.on('typing', ({ isTyping }) => {
      setIsPartnerTyping(isTyping);
    });

    socket.on('partner-disconnected', () => {
      setIsPartnerTyping(false);
      closePeerConnection();
      setMessages(prev => [
        ...prev,
        { key: `disc-${Date.now()}`, sender: 'system', text: 'Stranger disconnected. Finding a new match...' }
      ]);
      
      // Auto-rejoin queue after 1 second
      if (autoMatchTimeoutRef.current) clearTimeout(autoMatchTimeoutRef.current);
      autoMatchTimeoutRef.current = setTimeout(() => {
        if (socket) {
          setStatus('connecting');
          socket.emit('join-queue', { mode, interests });
        }
      }, 1000);
    });

    // Handle WebSocket signaling messages
    socket.on('signal:offer', async ({ offer }) => {
      let pc = peerConnectionRef.current;
      if (!pc) {
        await setupPeerConnection(false);
        pc = peerConnectionRef.current;
      }
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal:answer', { answer });
        await processIceQueue();
      } catch (err) {
        console.error('Error handling RTC offer:', err);
      }
    });

    socket.on('signal:answer', async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await processIceQueue();
      } catch (err) {
        console.error('Error handling RTC answer:', err);
      }
    });

    socket.on('signal:ice-candidate', async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding RTC candidate:', err);
        }
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    });

    return () => {
      if (autoMatchTimeoutRef.current) clearTimeout(autoMatchTimeoutRef.current);
      if (aiFallbackTimeoutRef.current) clearTimeout(aiFallbackTimeoutRef.current);
      if (aiMatchTimeoutRef.current) clearTimeout(aiMatchTimeoutRef.current);
      if (aiResponseTimeoutRef.current) clearTimeout(aiResponseTimeoutRef.current);
      socket.off('waiting');
      socket.off('matched');
      socket.off('message');
      socket.off('typing');
      socket.off('partner-disconnected');
      socket.off('signal:offer');
      socket.off('signal:answer');
      socket.off('signal:ice-candidate');
      socket.emit('leave-queue');
    };
  }, [socket, mode, interests, localStreamReady]);

  // 3. Autoscroll to bottom when chat updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPartnerTyping]);

  // 4. Keyboard Listener: Escape key controls matching state
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Disallow escape-matching if the user is typing in the input
        if (document.activeElement.tagName === 'INPUT') {
          return;
        }
        handleStopAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, socket]);

  // WebRTC Connection Setup Function
  const setupPeerConnection = async (isInitiator) => {
    closePeerConnection();

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Add local stream tracks to WebRTC
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle remote track received
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle ICE Candidate gathering
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('signal:ice-candidate', { candidate: event.candidate });
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal:offer', { offer });
      }
    } catch (err) {
      console.error('WebRTC setup error:', err);
    }
  };

  const processIceQueue = async () => {
    const pc = peerConnectionRef.current;
    if (!pc || !pc.remoteDescription) return;
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding queued RTC candidate:', err);
      }
    }
  };

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.src = "";
      remoteVideoRef.current.removeAttribute('src');
    }
    iceCandidatesQueueRef.current = [];
    setRemoteStream(null);
  };

  // Bind remote stream to video element when it is ready and video element mounts
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => {
        console.warn("Error playing remote video:", err);
      });
    }
  }, [remoteStream, status]);



  // Typing event sender (debounced)
  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (aiPersonaRef.current) return;
    if (!socket || status !== 'matched') return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', { isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing', { isTyping: false });
    }, 1500);
  };

  // Send message
  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || status !== 'matched') return;

    if (aiPersonaRef.current) {
      setMessages(prev => [
        ...prev,
        { key: `msg-you-${Date.now()}`, sender: 'you', text, timestamp: Date.now() }
      ]);
      setInputText('');
      triggerAiResponse(text);
      return;
    }

    if (!socket) return;

    // Send to partner
    socket.emit('send-message', { text });

    // Append local message
    setMessages(prev => [
      ...prev,
      { key: `msg-you-${Date.now()}`, sender: 'you', text, timestamp: Date.now() }
    ]);
    setInputText('');

    // Reset typing flags
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    socket.emit('typing', { isTyping: false });
  };

  // Instant Skip/Stop Reconnection Handler
  const handleStopAction = () => {
    if (autoMatchTimeoutRef.current) clearTimeout(autoMatchTimeoutRef.current);
    if (aiMatchTimeoutRef.current) clearTimeout(aiMatchTimeoutRef.current);
    if (aiResponseTimeoutRef.current) clearTimeout(aiResponseTimeoutRef.current);
    if (aiFallbackTimeoutRef.current) clearTimeout(aiFallbackTimeoutRef.current);

    setIsPartnerTyping(false);
    setCurrentPersona(null);
    aiPersonaRef.current = null;
    chatStepRef.current = 0;

    if (socket) {
      socket.emit('disconnect-chat');
    }
    closePeerConnection();
    
    // Instantly start matching again
    if (socket) {
      setMessages([{ key: 'system-reinit', sender: 'system', text: 'Connecting to server...' }]);
      setStatus('connecting');
      socket.emit('join-queue', { mode, interests });
    }
  };

  // Toggle Video track
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoDisabled(!videoTrack.enabled);
      }
    }
  };

  // Toggle Audio track
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <div className="chat-screen-layout">
      {/* Video Grid Section */}
      {mode === 'video' ? (
        <div 
          className="video-section" 
          onTouchStart={handleTouchStart} 
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile brand logo overlay */}
          <div className="mobile-logo-overlay" onClick={onLeave}>
            <MessageCircle size={20} style={{ color: 'var(--text-dark)' }} />
            <span>Guffadi</span>
          </div>

          {/* Partner Video Panel */}
          <div className="video-card">
            {status === 'matched' ? (
              currentPersona ? (
                <video 
                  className="video-stream" 
                  src={currentPersona.videoUrl}
                  autoPlay 
                  playsInline 
                  loop
                  muted
                />
              ) : (
                <video 
                  ref={remoteVideoRef} 
                  className="video-stream" 
                  autoPlay 
                  playsInline 
                />
              )
            ) : (
              <RetroTv status={status} />
            )}
            <div className="video-label">
              <Sparkles size={14} style={{ color: 'var(--indigo)' }} />
              <span>Stranger</span>
            </div>
          </div>

          {/* Local Video Panel */}
          <div className="video-card">
            <video 
              ref={localVideoRef} 
              className="video-stream mirror" 
              autoPlay 
              playsInline 
              muted 
            />
            
            {/* Control Bar Overlay */}
            <div className="video-overlay-controls">
              <button 
                onClick={toggleMic} 
                className={`control-btn ${micMuted ? 'active' : ''}`}
                title={micMuted ? "Unmute Mic" : "Mute Mic"}
              >
                {micMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button 
                onClick={toggleVideo} 
                className={`control-btn ${videoDisabled ? 'active' : ''}`}
                title={videoDisabled ? "Enable Video" : "Disable Video"}
              >
                {videoDisabled ? <VideoOff size={16} /> : <Video size={16} />}
              </button>
            </div>

            <div className="video-label">
              <div className="pulse-dot" style={{ backgroundColor: 'var(--green)' }}></div>
              <span>You</span>
            </div>
          </div>
          
          {/* Mobile Overlay Sidebar & Controls */}
          <div className="mobile-chat-controls">
            <button 
              type="button"
              onClick={handleStopAction} 
              className="mobile-control-btn skip-btn"
              aria-label="Skip match"
            >
              Skip
            </button>
            <button 
              type="button"
              className="mobile-control-btn chat-disabled-btn"
              disabled
              aria-label="Chat disabled on mobile/tablet"
            >
              <MessageSquare size={20} />
            </button>
          </div>
        </div>
      ) : (
        /* Text Mode Side Panel styling */
        <div className="text-side-card">
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <AlertCircle size={48} style={{ color: 'var(--yellow)', margin: '0 auto 15px auto' }} />
            <h2>Random Text Chat</h2>
            <p>
              You are connected via WebSockets. Conversations are completely private, peer-to-peer (signaling), and self-contained.
            </p>
          </div>
          <button className="glass-button" onClick={onLeave}>
            <Home size={16} /> Go Home
          </button>
        </div>
      )}

      {/* Chat Section */}
      <div className={`chat-section ${isMobileChatOpen ? 'mobile-open' : ''}`}>
        <div className="chat-header">
          <span>Conversation Feed</span>
          <span className="chat-status">
            Status: <strong style={{ color: status === 'matched' ? 'var(--green)' : 'var(--yellow)' }}>{status}</strong>
            <button 
              type="button"
              onClick={() => setIsMobileChatOpen(false)} 
              className="mobile-close-drawer"
              aria-label="Close Chat"
            >
              <X size={18} />
            </button>
          </span>
        </div>

        {/* Chat Feed */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.key} className={`message ${msg.sender}`}>
              {msg.sender !== 'system' && (
                <span className="message-label">
                  {msg.sender === 'you' ? 'You' : 'Stranger'}
                </span>
              )}
              {msg.sender === 'system' ? (
                <div className="message-system-text" dangerouslySetInnerHTML={{ __html: msg.text }}></div>
              ) : (
                <div className="message-text">{msg.text}</div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isPartnerTyping && (
            <div className="typing-indicator">
              Stranger is typing
              <div className="typing-dots">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Footer Input Form */}
        <div className="chat-footer">
          <form onSubmit={handleSendMessage} className="chat-input-form">
            <button
              type="button"
              onClick={handleStopAction}
              className="stop-btn standard"
            >
              Skip
            </button>

            <div className="chat-input-container">
              <input
                type="text"
                placeholder={
                  status !== 'matched' 
                    ? "Waiting for match..." 
                    : "Type a message or press Esc to skip..."
                }
                value={inputText}
                onChange={handleInputChange}
                disabled={status !== 'matched'}
              />
            </div>

            <button 
              type="submit" 
              className="send-btn" 
              disabled={status !== 'matched' || !inputText.trim()}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
