import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { MessageCircle } from 'lucide-react';
import Landing from './components/Landing';
import ChatSession from './components/ChatSession';
import GroupMeet from './components/GroupMeet';
import ReadFlow from './components/ReadFlow';

export default function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'chat' | 'meet'
  const [mode, setMode] = useState('text'); // 'text' | 'video'
  const [meetRoomId, setMeetRoomId] = useState('');
  const [interests, setInterests] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(() => Math.floor(Math.random() * 80) + 540);
  const [connected, setConnected] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // PWA Install Prompt Handler
  useEffect(() => {
    // 1. Check if already running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      console.log('App is running in standalone mode.');
      return;
    }

    // 2. Check if user dismissed the banner previously
    const isDismissed = localStorage.getItem('guffadi_install_dismissed') === 'true';
    if (isDismissed) {
      return;
    }

    // 3. Detect mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    if (!isMobile) {
      return;
    }

    // 4. Handle beforeinstallprompt (Android / Chrome)
    const handleInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    // 5. iOS detection (no beforeinstallprompt event, show banner directly)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      setShowInstallBanner(true);
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to PWA prompt: ${outcome}`);
    
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  const handleDismissInstall = () => {
    localStorage.setItem('guffadi_install_dismissed', 'true');
    setShowInstallBanner(false);
  };

  // Initialize socket connection on load
  useEffect(() => {
    // Vite proxies /socket.io automatically, so connecting to empty arg (current host) works
    const socketConnection = io({
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000
    });

    socketConnection.on('connect', () => {
      console.log('Connected to signaling server');
      setConnected(true);
    });

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from signaling server');
      setConnected(false);
    });

    socketConnection.on('stats', ({ onlineCount: actualCount }) => {
      // Simulate > 500 online users based on actual server connections
      setOnlineCount(530 + actualCount * 7 + Math.floor(Math.random() * 15));
    });

    setSocket(socketConnection);

    return () => {
      socketConnection.disconnect();
    };
  }, []);

  // Subtle client-side fluctuation to make the online user badge feel dynamic and active
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(prev => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const newCount = prev + delta;
        return newCount < 500 ? 500 : newCount;
      });
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  // Handle direct link entry and popstate routing
  useEffect(() => {
    const checkPath = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/meet\/([^/]+)$/);
      if (match) {
        setMeetRoomId(match[1]);
        setView('meet');
      } else if (path === '/readflow') {
        setView('readflow');
      } else {
        setView('landing');
      }
    };
    checkPath();
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  const handleStartChat = (selectedMode) => {
    // Unlock SpeechSynthesis for mobile/Safari by playing a silent string synchronously in click handler
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    }
    setMode(selectedMode);
    setView('chat');
  };

  const handleLeaveChat = () => {
    if (socket) {
      socket.emit('disconnect-chat');
    }
    setView('landing');
  };

  const handleStartMeet = (roomId) => {
    setMeetRoomId(roomId);
    window.history.pushState({}, '', `/meet/${roomId}`);
    setView('meet');
  };

  const handleLeaveMeet = () => {
    if (socket) {
      socket.emit('leave-group-room');
    }
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  const handleStartReadFlow = () => {
    window.history.pushState({}, '', '/readflow');
    setView('readflow');
  };

  const handleLeaveReadFlow = () => {
    window.history.pushState({}, '', '/');
    setView('landing');
  };

  return (
    <>
      {view === 'landing' && showInstallBanner && (
        <div className="install-banner">
          <div className="install-banner-content">
            <span className="install-text">⚡ Add Guffadi to your Home Screen for a faster, full-screen experience!</span>
            <div className="install-banner-actions">
              <button onClick={handleInstallClick} className="install-btn-action">Install App</button>
              <button onClick={handleDismissInstall} className="install-close-btn" aria-label="Close">✕</button>
            </div>
          </div>
          {showIOSInstructions && (
            <div className="ios-instructions-modal">
              <div className="ios-instructions-content">
                <h3>Install Guffadi on iOS</h3>
                <p>1. Tap the <strong>Share</strong> button (box with an up arrow) at the bottom of Safari.</p>
                <p>2. Scroll down and select <strong>Add to Home Screen</strong>.</p>
                <button onClick={() => setShowIOSInstructions(false)} className="glass-button" style={{ backgroundColor: 'var(--yellow)', marginTop: '10px', width: '100%' }}>Got it</button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className={`app-container ${view === 'chat' ? 'in-chat' : ''} ${view === 'chat' && mode === 'video' ? 'in-video-chat' : ''} ${view === 'meet' ? 'in-meet' : ''} ${view === 'readflow' ? 'in-readflow' : ''}`}>
        {/* Premium Header */}
        <header className="app-header">
          <div className="logo" onClick={view === 'meet' ? handleLeaveMeet : (view === 'readflow' ? handleLeaveReadFlow : handleLeaveChat)} style={{ cursor: 'pointer' }}>
            <MessageCircle size={28} style={{ color: 'var(--text-dark)' }} />
            Guffadi
          </div>
          <div className="online-badge">
            <div className="pulse-dot" style={{ backgroundColor: connected ? 'var(--green)' : 'var(--rose)' }}></div>
            <span>
              {connected 
                ? `${onlineCount} Stranger${onlineCount === 1 ? '' : 's'} Online` 
                : 'Reconnecting to Server...'}
            </span>
          </div>
        </header>

        {/* Main View Manager */}
        {view === 'landing' ? (
          <Landing
            onlineCount={onlineCount}
            interests={interests}
            setInterests={setInterests}
            onStartChat={handleStartChat}
            onStartMeet={handleStartMeet}
            onStartReadFlow={handleStartReadFlow}
          />
        ) : view === 'chat' ? (
          <ChatSession
            socket={socket}
            mode={mode}
            interests={interests}
            onLeave={handleLeaveChat}
          />
        ) : view === 'meet' ? (
          <GroupMeet
            socket={socket}
            roomId={meetRoomId}
            onLeave={handleLeaveMeet}
          />
        ) : (
          <ReadFlow
            onLeave={handleLeaveReadFlow}
          />
        )}
      </div>
    </>
  );
}
