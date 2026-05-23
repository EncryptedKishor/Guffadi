import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // In development, allow any origin. Vite defaults to port 5173.
    methods: ['GET', 'POST']
  }
});

// Port configuration
const PORT = process.env.PORT || 3000;

// Matchmaking queues
// Structure of queue item: { id, socket, interests, timestamp }
const textQueue = [];
const videoQueue = [];

// Track active matches: socketId -> { partnerId, roomId, mode }
const activeMatches = new Map();

// Helper: Normalize interest strings
function normalizeInterests(interestsArray) {
  if (!Array.isArray(interestsArray)) return [];
  return interestsArray
    .map(i => i.trim().toLowerCase())
    .filter(i => i.length > 0);
}

// Matchmaking Engine
function findMatch(socket, mode, userInterests) {
  const queue = mode === 'video' ? videoQueue : textQueue;
  const normalizedUserInterests = normalizeInterests(userInterests);
  
  if (queue.length === 0) return null;

  let bestMatchIndex = -1;
  let maxCommonCount = -1;
  let bestCommonInterests = [];

  const now = Date.now();

  // 1. Try to find the best interest match
  if (normalizedUserInterests.length > 0) {
    for (let i = 0; i < queue.length; i++) {
      const candidate = queue[i];
      // Skip self (safety check)
      if (candidate.id === socket.id) continue;

      const candidateInterests = normalizeInterests(candidate.interests);
      const common = candidateInterests.filter(val => normalizedUserInterests.includes(val));

      if (common.length > maxCommonCount && common.length > 0) {
        maxCommonCount = common.length;
        bestCommonInterests = common;
        bestMatchIndex = i;
      }
    }
  }

  // 2. If we found an interest match, return it
  if (bestMatchIndex !== -1) {
    const matchedItem = queue.splice(bestMatchIndex, 1)[0];
    return {
      partner: matchedItem,
      commonInterests: bestCommonInterests
    };
  }

  // 3. Fallback: Check if the user can match randomly
  // If the user has no interests, they can match with anyone who has no interests, OR anyone who has been waiting for more than 4 seconds.
  // If the user has interests, but no interest match was found, they can match with someone else if they or the other person has been waiting for a bit.
  // To keep matching fast, we will allow matching with the first available person in the queue if:
  // - Either the user has no interests, OR the candidate in the queue has no interests, OR the candidate has been waiting for > 4 seconds.
  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i];
    if (candidate.id === socket.id) continue;

    const candidateInterests = normalizeInterests(candidate.interests);
    const waitingTime = now - candidate.timestamp;

    // Match if:
    // - incoming user has no interests
    // - OR candidate has no interests
    // - OR candidate has been waiting > 4 seconds (fallback to prevent infinite waiting)
    if (normalizedUserInterests.length === 0 || candidateInterests.length === 0 || waitingTime > 4000) {
      const matchedItem = queue.splice(i, 1)[0];
      return {
        partner: matchedItem,
        commonInterests: []
      };
    }
  }

  return null;
}

// Helper to remove a socket from all queues
function removeFromQueues(socketId) {
  const textIdx = textQueue.findIndex(item => item.id === socketId);
  if (textIdx !== -1) textQueue.splice(textIdx, 1);

  const videoIdx = videoQueue.findIndex(item => item.id === socketId);
  if (videoIdx !== -1) videoQueue.splice(videoIdx, 1);
}

// Helper to handle chat disconnect
function handleDisconnectChat(socket) {
  const match = activeMatches.get(socket.id);
  if (match) {
    const { partnerId, roomId } = match;

    // Clean up matches
    activeMatches.delete(socket.id);
    activeMatches.delete(partnerId);

    // Notify partner
    io.to(partnerId).emit('partner-disconnected');

    // Make both leave room
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.leave(roomId);
    }
    socket.leave(roomId);

    console.log(`Match ended: Room ${roomId} dissolved.`);
  }
}

// Socket Connection Handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Send overall statistics
  io.emit('stats', { onlineCount: io.engine.clientsCount });

  // Handle matchmaking request
  socket.on('join-queue', (data) => {
    const { mode, interests } = data; // mode: 'text' | 'video', interests: string[]
    
    // Safety check: disconnect from existing match first
    handleDisconnectChat(socket);
    removeFromQueues(socket.id);

    console.log(`User ${socket.id} joining ${mode} queue with interests:`, interests);

    // Search for match
    const matchResult = findMatch(socket, mode, interests);

    if (matchResult) {
      const { partner, commonInterests } = matchResult;
      const roomId = `room_${socket.id}_${partner.id}`;

      // Join both to the socket room
      socket.join(roomId);
      partner.socket.join(roomId);

      // Save match state
      activeMatches.set(socket.id, { partnerId: partner.id, roomId, mode });
      activeMatches.set(partner.id, { partnerId: socket.id, roomId, mode });

      console.log(`Matched! Room: ${roomId}. Common interests:`, commonInterests);

      // Notify clients
      // Partner gets initiator: true, Socket gets initiator: false (or vice versa)
      // This is crucial for WebRTC to know who starts the offer
      socket.emit('matched', {
        roomId,
        partnerId: partner.id,
        initiator: true,
        commonInterests
      });

      partner.socket.emit('matched', {
        roomId,
        partnerId: socket.id,
        initiator: false,
        commonInterests
      });
    } else {
      // Add to queue
      const queue = mode === 'video' ? videoQueue : textQueue;
      queue.push({
        id: socket.id,
        socket,
        interests,
        timestamp: Date.now()
      });
      socket.emit('waiting');
      console.log(`${mode} queue length: ${queue.length}`);
    }
  });

  // Handle leaving queue
  socket.on('leave-queue', () => {
    removeFromQueues(socket.id);
    console.log(`User ${socket.id} left queue.`);
  });

  // Handle leaving active chat session
  socket.on('disconnect-chat', () => {
    handleDisconnectChat(socket);
  });

  // Handle messages
  socket.on('send-message', (data) => {
    const match = activeMatches.get(socket.id);
    if (match) {
      // Relay message to the room (broadcast to others)
      socket.to(match.roomId).emit('message', {
        text: data.text,
        sender: 'stranger',
        timestamp: Date.now()
      });
    }
  });

  // Handle typing state
  socket.on('typing', (data) => {
    const match = activeMatches.get(socket.id);
    if (match) {
      socket.to(match.roomId).emit('typing', {
        isTyping: data.isTyping
      });
    }
  });

  // --- WebRTC Signaling Relay ---
  socket.on('signal:offer', (data) => {
    const match = activeMatches.get(socket.id);
    if (match) {
      socket.to(match.roomId).emit('signal:offer', {
        offer: data.offer
      });
    }
  });

  socket.on('signal:answer', (data) => {
    const match = activeMatches.get(socket.id);
    if (match) {
      socket.to(match.roomId).emit('signal:answer', {
        answer: data.answer
      });
    }
  });

  socket.on('signal:ice-candidate', (data) => {
    const match = activeMatches.get(socket.id);
    if (match) {
      socket.to(match.roomId).emit('signal:ice-candidate', {
        candidate: data.candidate
      });
    }
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    removeFromQueues(socket.id);
    handleDisconnectChat(socket);
    io.emit('stats', { onlineCount: io.engine.clientsCount });
  });
});

// Start Express + Socket server
server.listen(PORT, () => {
  console.log(`Guffadi signaling server running on http://localhost:${PORT}`);
});
