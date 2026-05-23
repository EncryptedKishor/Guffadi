import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Video, VideoOff, Home, AlertCircle, Sparkles } from 'lucide-react';

export default function ChatSession({ socket, mode, interests, onLeave }) {
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'waiting' | 'matched' | 'disconnected'
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoDisabled, setVideoDisabled] = useState(false);
  const [stopButtonState, setStopButtonState] = useState('standard'); // 'standard' | 'confirm' | 'new'

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const chatEndRef = useRef(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const confirmTimeoutRef = useRef(null);

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

    socket.on('matched', async ({ roomId, partnerId, initiator, commonInterests }) => {
      setStatus('matched');
      setIsPartnerTyping(false);
      setStopButtonState('standard');

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
    });

    socket.on('typing', ({ isTyping }) => {
      setIsPartnerTyping(isTyping);
    });

    socket.on('partner-disconnected', () => {
      setStatus('disconnected');
      setIsPartnerTyping(false);
      setStopButtonState('new');
      closePeerConnection();
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
      } catch (err) {
        console.error('Error handling RTC offer:', err);
      }
    });

    socket.on('signal:answer', async ({ answer }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Error handling RTC answer:', err);
      }
    });

    socket.on('signal:ice-candidate', async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding RTC candidate:', err);
      }
    });

    return () => {
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
  }, [socket, mode, interests]);

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

  const closePeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
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
      if (socket) {
        socket.emit('disconnect-chat');
      }
      setStatus('disconnected');
      setIsPartnerTyping(false);
      setStopButtonState('new');
      closePeerConnection();
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
              />
            ) : (
              <div className="video-spinner">
                <div className="spinner"></div>
                <span>Waiting for partner...</span>
              </div>
            )}
            <div className="video-label">
              <Sparkles size={14} style={{ color: 'var(--accent)' }} />
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

            <div className="chat-input-container">
              <input
                type="text"
                placeholder={status === 'matched' ? "Type a message or press Esc to skip..." : "Waiting for match..."}
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
