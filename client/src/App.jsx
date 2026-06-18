import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { MessageCircle } from 'lucide-react';
import Landing from './components/Landing';
import ChatSession from './components/ChatSession';

export default function App() {
  const [view, setView] = useState('landing'); // 'landing' | 'chat'
  const [mode, setMode] = useState('text'); // 'text' | 'video'
  const [interests, setInterests] = useState([]);
  const [socket, setSocket] = useState(null);
  const [onlineCount, setOnlineCount] = useState(() => Math.floor(Math.random() * 80) + 540);
  const [connected, setConnected] = useState(false);

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

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header">
        <div className="logo" onClick={handleLeaveChat} style={{ cursor: 'pointer' }}>
          <MessageCircle size={28} style={{ color: 'var(--text-dark)' }} />
          Guff<span>adi</span>
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
        />
      ) : (
        <ChatSession
          socket={socket}
          mode={mode}
          interests={interests}
          onLeave={handleLeaveChat}
        />
      )}
    </div>
  );
}
