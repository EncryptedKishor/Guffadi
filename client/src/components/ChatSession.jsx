import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Video, VideoOff, Home, AlertCircle, Sparkles } from 'lucide-react';

let speechVoices = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    speechVoices = window.speechSynthesis.getVoices();
  };
}

function speakText(text, spokenText, gender, onEndCallback) {
  if (!('speechSynthesis' in window)) return;
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  const voices = speechVoices.length > 0 ? speechVoices : window.speechSynthesis.getVoices();
  
  const genderKey = gender === 'male' ? 'male' : 'female';
  const oppositeKey = gender === 'male' ? 'female' : 'male';
  
  // Find a Nepali, Hindi, or Indian English voice for natural South Asian pronunciation tone
  const chosenVoice = voices.find(v => v.lang.includes('ne') && v.name.toLowerCase().includes(genderKey)) ||
                      voices.find(v => v.lang.includes('ne') && !v.name.toLowerCase().includes(oppositeKey)) ||
                      voices.find(v => v.lang.includes('hi') && v.name.toLowerCase().includes(genderKey)) ||
                      voices.find(v => v.lang.includes('hi') && !v.name.toLowerCase().includes(oppositeKey)) ||
                      voices.find(v => v.lang.includes('en-IN') && v.name.toLowerCase().includes(genderKey)) ||
                      voices.find(v => v.lang.includes('en-IN') && !v.name.toLowerCase().includes(oppositeKey)) ||
                      voices.find(v => v.name.toLowerCase().includes(genderKey)) ||
                      voices.find(v => v.lang.includes('ne')) ||
                      voices.find(v => v.lang.includes('hi')) ||
                      voices.find(v => v.lang.includes('en-IN')) ||
                      voices[0];
                      
  // Fallback to Romanized text if chosen voice is not a South Asian language (Hindi, Nepali, Indian English).
  // This prevents English/Western voices from playing silence when fed Devanagari text.
  const isSouthAsianVoice = chosenVoice && (
    chosenVoice.lang.startsWith('ne') || 
    chosenVoice.lang.startsWith('hi') || 
    chosenVoice.lang.startsWith('en-IN')
  );
  
  const textToSpeak = isSouthAsianVoice ? (spokenText || text) : text;
  const finalUtterance = new SpeechSynthesisUtterance(textToSpeak);
                      
  if (chosenVoice) {
    finalUtterance.voice = chosenVoice;
    finalUtterance.lang = chosenVoice.lang;
  } else {
    finalUtterance.lang = 'ne-NP';
  }
  
  finalUtterance.pitch = gender === 'male' ? 0.95 : 1.15; // Slightly lower pitch for male, slightly higher for female
  finalUtterance.rate = 0.9;   // Friendly, normal speed
  finalUtterance.volume = 1.0; // Max volume
  
  if (onEndCallback) {
    finalUtterance.onend = onEndCallback;
    
    // Safety fallback timeout
    const safetyTimeout = setTimeout(() => {
      finalUtterance.onend = null;
      onEndCallback();
    }, textToSpeak.length * 120 + 2000);
    
    finalUtterance.onerror = () => {
      clearTimeout(safetyTimeout);
      onEndCallback();
    };
  }
  
  setTimeout(() => {
    window.speechSynthesis.speak(finalUtterance);
  }, 100);
}

export default function ChatSession({ socket, mode, interests, onLeave }) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'waiting' | 'matched' | 'disconnected'
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [stopButtonState, setStopButtonState] = useState('standard'); // 'standard' | 'confirm' | 'new'
  const [localStreamReady, setLocalStreamReady] = useState(mode !== 'video');
  const [isBotMatch, setIsBotMatch] = useState(false);
  const [botVideoUrl, setBotVideoUrl] = useState('');
  const [botName, setBotName] = useState('Stranger');
  const [botGender, setBotGender] = useState('female');
  const botGenderRef = useRef('female');
  const [isListening, setIsListening] = useState(false);
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const voiceModeActiveRef = useRef(false);
  const recognitionRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const chatEndRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const confirmTimeoutRef = useRef(null);
  const partnerIdRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);

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

  // 2. Join the matchmaking queue
  useEffect(() => {
    if (!socket) return;
    if (mode === 'video' && !localStreamReady) return;

    // Reset components states
    setMessages([{ key: 'system-init', sender: 'system', text: 'Connecting to server...' }]);
    setStatus('connecting');
    setStopButtonState('standard');

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
    });

    socket.on('matched', async ({ roomId, partnerId, initiator, commonInterests, botName: incomingBotName, botGender: incomingBotGender, botVideoUrl: incomingBotVideoUrl }) => {
      setStatus('matched');
      setIsPartnerTyping(false);
      setStopButtonState('standard');
      partnerIdRef.current = partnerId;
      
      const isBot = partnerId.startsWith('bot_');
      setIsBotMatch(isBot);

      const currentBotGender = incomingBotGender || 'female';
      setBotGender(currentBotGender);
      botGenderRef.current = currentBotGender;

      // Reset Voice Mode on new match
      setVoiceModeActive(false);
      voiceModeActiveRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }

      const introMessages = [
        { key: 'match-1', sender: 'system', text: isBot ? 'You are now chatting with a random Nepali friend!' : 'You are now chatting with a random stranger!' }
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
        if (isBot) {
          setBotVideoUrl(incomingBotVideoUrl);
          setBotName(incomingBotName || 'Stranger');
        } else {
          setBotName('Stranger');
          setBotVideoUrl('');
          setupPeerConnection(initiator);
        }
      } else {
        if (isBot) {
          setBotName(incomingBotName || 'Stranger');
        } else {
          setBotName('Stranger');
        }
      }
    });

    socket.on('message', (msg) => {
      setIsPartnerTyping(false);
      setMessages(prev => [...prev, { ...msg, key: `msg-${Date.now()}-${Math.random()}` }]);

      // Trigger text-to-speech if matched with a bot
      if (partnerIdRef.current && partnerIdRef.current.startsWith('bot_')) {
        speakText(msg.text, msg.spokenText, botGenderRef.current, () => {
          // If voice mode is active, resume listening
          if (voiceModeActiveRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {}
          }
        });
      }
    });

    socket.on('typing', ({ isTyping }) => {
      setIsPartnerTyping(isTyping);
    });

    socket.on('partner-disconnected', () => {
      setStatus('disconnected');
      setIsPartnerTyping(false);
      setStopButtonState('new');
      closePeerConnection();
      setBotVideoUrl('');
      setIsBotMatch(false);
      setBotName('Stranger');
      setMessages(prev => [
        ...prev,
        { key: `disc-${Date.now()}`, sender: 'system', text: 'Stranger has disconnected.' }
      ]);
    });

    // Handle WebSocket signaling messages
    socket.on('signal:offer', async ({ offer }) => {
      const pc = peerConnectionRef.current;
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
      if (!pc) return;
      if (pc.remoteDescription && pc.remoteDescription.type) {
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
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
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
  }, [stopButtonState, status]);

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
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
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
    
    // Stop voice mode on close
    setVoiceModeActive(false);
    voiceModeActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  // Trigger loading and playing the bot video reactively when the source URL changes
  useEffect(() => {
    if (isBotMatch && botVideoUrl && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null; // Clear any active WebRTC stream
      remoteVideoRef.current.src = botVideoUrl;
      remoteVideoRef.current.load();
      remoteVideoRef.current.play().catch(e => {
        console.warn("Bot video autoplay failed:", e);
      });
    }
  }, [botVideoUrl, isBotMatch]);

  // Speech Recognition hook for Hands-free Voice Mode
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'ne-NP'; // Default to Nepali speech recognition

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
      // Restart if voice mode is still active and TTS is not currently speaking
      setTimeout(() => {
        if (voiceModeActiveRef.current && !window.speechSynthesis.speaking) {
          try {
            rec.start();
          } catch (e) {}
        }
      }, 500);
    };

    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim() && socket && status === 'matched') {
        socket.emit('send-message', { text: transcript });
        setMessages(prev => [
          ...prev,
          { key: `msg-you-${Date.now()}`, sender: 'you', text: transcript, timestamp: Date.now() }
        ]);
      }
    };

    rec.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      setIsListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch (err) {}
    };
  }, [socket, status]);

  const toggleVoiceMode = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Safari.");
      return;
    }

    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }

    const nextState = !voiceModeActive;
    setVoiceModeActive(nextState);
    voiceModeActiveRef.current = nextState;

    if (nextState) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Speech recognition start failed:", e);
      }
    } else {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  // Typing event sender (debounced)
  const handleInputChange = (e) => {
    setInputText(e.target.value);
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
    if (!text || !socket || status !== 'matched') return;

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

  // Multi-state Stop Button Handler
  const handleStopAction = () => {
    if (stopButtonState === 'standard') {
      // Prompt for confirmation
      setStopButtonState('confirm');
      
      // Auto cancel confirmation after 3 seconds
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => {
        setStopButtonState('standard');
      }, 3000);
    } else if (stopButtonState === 'confirm') {
      // User confirmed disconnect
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (socket) {
        socket.emit('disconnect-chat');
      }
      setStatus('disconnected');
      setIsPartnerTyping(false);
      setStopButtonState('new');
      closePeerConnection();
      setBotVideoUrl('');
      setIsBotMatch(false);
      setBotName('Stranger');
      setMessages(prev => [
        ...prev,
        { key: `disc-${Date.now()}`, sender: 'system', text: 'You disconnected.' }
      ]);
    } else if (stopButtonState === 'new') {
      // Find a new match
      if (socket) {
        setMessages([{ key: 'system-reinit', sender: 'system', text: 'Connecting to server...' }]);
        setStatus('connecting');
        setStopButtonState('standard');
        setBotVideoUrl('');
        setIsBotMatch(false);
        setBotName('Stranger');
        socket.emit('join-queue', { mode, interests });
      }
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
        <div className="video-section">
          {/* Partner Video Panel */}
          <div className="video-card">
            {status === 'matched' ? (
              <video 
                ref={remoteVideoRef} 
                className="video-stream" 
                autoPlay 
                playsInline 
                muted={isBotMatch}
                loop={isBotMatch}
              />
            ) : (
              <div className="video-spinner">
                <div className="spinner"></div>
                <span>Waiting for partner...</span>
              </div>
            )}
            <div className="video-label">
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
              <span>{isBotMatch ? botName : 'Stranger'}</span>
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
              <div className="pulse-dot"></div>
              <span>You</span>
            </div>
          </div>
        </div>
      ) : (
        /* Text Mode Side Panel styling */
        <div className="glass-panel text-side-card" style={{ display: 'flex', flexDirection: 'column', padding: '30px', justifyContent: 'center', height: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <AlertCircle size={48} style={{ color: 'var(--primary)', margin: '0 auto 15px auto' }} />
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '10px' }}>Random Text Chat</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              You are connected via WebSockets. Conversations are completely private, peer-to-peer (signaling), and self-contained.
            </p>
          </div>
          <button className="glass-button" onClick={onLeave} style={{ alignSelf: 'center' }}>
            <Home size={16} /> Go Home
          </button>
        </div>
      )}

      {/* Chat Section */}
      <div className="glass-panel chat-section">
        <div className="chat-header">
          <span>Conversation Feed</span>
          <span className="chat-status">
            Status: <strong style={{ color: status === 'matched' ? 'var(--success)' : 'var(--warning)' }}>{status}</strong>
          </span>
        </div>

        {/* Chat Feed */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.key} className={`message ${msg.sender}`}>
              {msg.sender !== 'system' && (
                <span className="message-label">
                  {msg.sender === 'you' ? 'You' : (isBotMatch ? botName : 'Stranger')}
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
              {(isBotMatch ? botName : 'Stranger')} is typing
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
              className={`stop-btn ${
                stopButtonState === 'confirm' 
                  ? 'confirm' 
                  : stopButtonState === 'new' 
                  ? 'new-match' 
                  : 'standard'
              }`}
            >
              {stopButtonState === 'confirm' 
                ? 'Really?' 
                : stopButtonState === 'new' 
                ? 'New Match' 
                : 'Stop'}
            </button>

            {isBotMatch && (
              <button
                type="button"
                onClick={toggleVoiceMode}
                className={`voice-mode-btn ${voiceModeActive ? 'active' : ''}`}
                title={voiceModeActive ? "Disable Hands-Free Voice Mode" : "Enable Hands-Free Voice Mode"}
                style={{
                  background: voiceModeActive 
                    ? 'linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '0 15px',
                  height: '46px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  marginRight: '8px',
                  transition: 'all 0.3s ease',
                  boxShadow: voiceModeActive ? '0 0 15px var(--accent)' : 'none'
                }}
              >
                <Mic size={18} className={isListening ? 'pulse-mic' : ''} />
                <span className="voice-btn-text" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  {voiceModeActive ? 'Voice: ON' : 'Voice Mode'}
                </span>
              </button>
            )}

            <div className="chat-input-container">
              <input
                type="text"
                placeholder={
                  status !== 'matched' 
                    ? "Waiting for match..." 
                    : isListening 
                    ? "🎤 Listening to your voice... Speak now!" 
                    : voiceModeActive 
                    ? "🎙️ Waiting for AI response..." 
                    : "Type a message or press Esc to skip..."
                }
                value={inputText}
                onChange={handleInputChange}
                disabled={status !== 'matched' || voiceModeActive}
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
