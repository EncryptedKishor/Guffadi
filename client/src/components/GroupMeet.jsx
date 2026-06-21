import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  Monitor, MonitorOff, 
  PhoneOff, Copy, Check, 
  Users, Share2 
} from 'lucide-react';

export default function GroupMeet({ socket, roomId, onLeave }) {
  const [username, setUsername] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]); // [{ socketId, name, stream }]
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const peerNamesRef = useRef({}); // socketId -> name
  const streamRef = useRef(null); // Keep a ref to localStream for event listener closure safety

  // Update local stream ref
  useEffect(() => {
    streamRef.current = localStream;
  }, [localStream]);

  // Copy shareable link to clipboard
  const handleCopyLink = () => {
    const meetUrl = `${window.location.origin}/meet/${roomId}`;
    navigator.clipboard.writeText(meetUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error('Failed to copy text: ', err));
  };

  // Join meeting when name is provided
  const handleJoin = async (e) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setUsername(trimmed);
  };

  // Initialize media and signaling once username is set
  useEffect(() => {
    if (!username) return;

    let activeLocalStream = null;

    async function initMeet() {
      try {
        // Request both audio and video
        activeLocalStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          }
        });
        setLocalStream(activeLocalStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = activeLocalStream;
        }

        // Join room on signaling server
        socket.emit('join-group-room', { roomId, name: username });

        // Setup signaling listeners
        socket.on('room-users', handleRoomUsers);
        socket.on('user-joined', handleUserJoined);
        socket.on('group-signal:offer', handleReceiveOffer);
        socket.on('group-signal:answer', handleReceiveAnswer);
        socket.on('group-signal:ice-candidate', handleReceiveIceCandidate);
        socket.on('user-left', handleUserLeft);

      } catch (err) {
        console.error('Error accessing media devices:', err);
        setPermissionError(true);
      }
    }

    initMeet();

    // Clean up connections on leave or unmount
    return () => {
      // Disconnect local stream tracks
      if (activeLocalStream) {
        activeLocalStream.getTracks().forEach(track => track.stop());
      }
      // Disconnect screen sharing if active
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      
      // Close all peer connections
      Object.keys(peersRef.current).forEach(socketId => {
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].close();
        }
      });
      peersRef.current = {};
      peerNamesRef.current = {};

      // Remove listeners
      socket.off('room-users');
      socket.off('user-joined');
      socket.off('group-signal:offer');
      socket.off('group-signal:answer');
      socket.off('group-signal:ice-candidate');
      socket.off('user-left');
      
      socket.emit('leave-group-room');
    };
  }, [username]);

  // Initialize a peer connection
  const createPeer = (targetSocketId, stream, isInitiator) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Add local tracks to peer connection
    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group-signal:ice-candidate', {
          to: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      const peerName = peerNamesRef.current[targetSocketId] || 'Stranger';
      setRemoteStreams(prev => {
        const exists = prev.some(p => p.socketId === targetSocketId);
        if (exists) {
          return prev.map(p => p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p);
        }
        return [...prev, { socketId: targetSocketId, name: peerName, stream: remoteStream }];
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeer(targetSocketId);
      }
    };

    peersRef.current[targetSocketId] = pc;

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('group-signal:offer', {
            to: targetSocketId,
            offer: pc.localDescription
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    return pc;
  };

  const closePeer = (socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
    setRemoteStreams(prev => prev.filter(p => p.socketId !== socketId));
  };

  // --- Socket Event Handlers ---
  
  const handleRoomUsers = ({ users }) => {
    users.forEach(user => {
      peerNamesRef.current[user.socketId] = user.name;
      // We are the initiator because we just joined, and they were already there
      createPeer(user.socketId, streamRef.current, true);
    });
  };

  const handleUserJoined = ({ socketId, name }) => {
    peerNamesRef.current[socketId] = name;
    // We are not the initiator because they just joined, they will send us an offer
    createPeer(socketId, streamRef.current, false);
  };

  const handleReceiveOffer = async ({ fromSocketId, offer }) => {
    let pc = peersRef.current[fromSocketId];
    if (!pc) {
      pc = createPeer(fromSocketId, streamRef.current, false);
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('group-signal:answer', {
        to: fromSocketId,
        answer: pc.localDescription
      });
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleReceiveAnswer = async ({ fromSocketId, answer }) => {
    const pc = peersRef.current[fromSocketId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('Error setting remote description from answer:', err);
      }
    }
  };

  const handleReceiveIceCandidate = async ({ fromSocketId, candidate }) => {
    const pc = peersRef.current[fromSocketId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    }
  };

  const handleUserLeft = ({ socketId }) => {
    closePeer(socketId);
  };

  // --- Toolbar Action Handlers ---

  const toggleMic = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(screen);
      setIsScreenSharing(true);
      
      const screenTrack = screen.getVideoTracks()[0];
      
      // Replace webcam video track with screen track in all peer connections
      Object.values(peersRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }
      });

      // Update local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screen;
      }

      // Handle user stopping screen share via native browser bar
      screenTrack.onended = () => {
        stopScreenShare(screen);
      };
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const stopScreenShare = (streamToStop) => {
    const activeScreenStream = streamToStop || screenStream;
    if (activeScreenStream) {
      activeScreenStream.getTracks().forEach(track => track.stop());
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    // Revert to webcam track
    const webcamTrack = localStream ? localStream.getVideoTracks()[0] : null;
    if (webcamTrack) {
      Object.values(peersRef.current).forEach(pc => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(webcamTrack);
        }
      });
    }

    // Reset local preview
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  };

  // Pre-join state name request
  if (!username) {
    return (
      <div className="meet-join-container">
        <div className="landing-card meet-join-card">
          <h2 className="meet-join-title">Join Group Video Call</h2>
          <p className="meet-join-desc">
            You are joining a room with code: <span className="room-code-tag">{roomId}</span>
          </p>
          <form onSubmit={handleJoin} className="meet-join-form">
            <div className="input-group">
              <label htmlFor="meet-name-input">Your Display Name</label>
              <input 
                id="meet-name-input"
                type="text" 
                placeholder="e.g. Ram Bahadur" 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                autoFocus
                className="meet-join-input"
              />
            </div>
            <div className="meet-join-actions">
              <button 
                type="button" 
                onClick={onLeave} 
                className="neon-button"
                style={{ backgroundColor: 'var(--rose)' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="neon-button"
                style={{ backgroundColor: 'var(--green)' }}
              >
                Join Room
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Display permission error
  if (permissionError) {
    return (
      <div className="meet-join-container">
        <div className="landing-card meet-join-card error-card">
          <h2 className="meet-join-title" style={{ color: 'var(--rose)' }}>Camera Access Required</h2>
          <p className="meet-join-desc">
            Please allow Guffadi to access your microphone and camera to join this group video call.
          </p>
          <div className="meet-join-actions" style={{ justifyContent: 'center' }}>
            <button 
              onClick={onLeave} 
              className="neon-button"
              style={{ backgroundColor: 'var(--yellow)' }}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Count total participants in the meeting (remote + you)
  const participantCount = remoteStreams.length + 1;

  // Grid style class based on participant counts
  const getGridClass = () => {
    if (participantCount === 1) return 'grid-cols-1';
    if (participantCount === 2) return 'grid-cols-2-split';
    if (participantCount <= 4) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  return (
    <div className="meet-wrapper">
      <div className="meet-header-bar">
        <div className="meet-info-badge">
          <Users size={16} />
          <span>{participantCount} Participant{participantCount === 1 ? '' : 's'}</span>
        </div>
        <div className="meet-room-badge">
          <span>Room Code: <strong>{roomId}</strong></span>
        </div>
      </div>

      <div className={`meet-video-grid ${getGridClass()}`}>
        {/* Local Stream (You) */}
        <div className="video-card local-video-card">
          <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`video-element ${!isCameraOn && !isScreenSharing ? 'video-hidden' : ''}`}
          />
          {(!isCameraOn && !isScreenSharing) && (
            <div className="video-avatar">
              {username.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="video-label-tag">
            <span>You {isScreenSharing ? '(Screen Sharing)' : ''}</span>
            <div className="video-label-icons">
              {!isMicOn && <MicOff size={14} className="icon-alert" />}
            </div>
          </div>
        </div>

        {/* Remote Streams */}
        {remoteStreams.map((peer) => (
          <div key={peer.socketId} className="video-card remote-video-card">
            <RemoteVideo stream={peer.stream} />
            <div className="video-label-tag">
              <span>{peer.name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Copy link sidebar box */}
      <div className="meet-sidebar-info">
        <div className="sidebar-info-card">
          <h4>Invite Friends</h4>
          <p>Share this link to let others join this meeting:</p>
          <div className="copy-link-input-group">
            <input 
              type="text" 
              readOnly 
              value={`${window.location.origin}/meet/${roomId}`} 
              className="copy-link-input"
            />
            <button 
              onClick={handleCopyLink} 
              className="copy-link-btn"
              title="Copy link"
            >
              {copied ? <Check size={16} style={{ color: 'var(--green)' }} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Meeting Controls */}
      <div className="meet-controls-bar">
        <button 
          onClick={toggleMic} 
          className={`control-btn ${!isMicOn ? 'btn-off' : ''}`}
          title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        <button 
          onClick={toggleCamera} 
          className={`control-btn ${!isCameraOn ? 'btn-off' : ''}`}
          title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          disabled={isScreenSharing}
        >
          {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button 
          onClick={isScreenSharing ? () => stopScreenShare() : startScreenShare} 
          className={`control-btn ${isScreenSharing ? 'btn-active' : ''}`}
          title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        <button 
          onClick={onLeave} 
          className="control-btn leave-btn"
          title="Leave Meeting"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

// Subcomponent to handle mounting/updating remote video stream source
function RemoteVideo({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      className="video-element"
    />
  );
}
