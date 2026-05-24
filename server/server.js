import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

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

// Track bot timers & active response timeouts
const botTimers = new Map();
const botTimeouts = new Map();

function handleBotConversation(socket, userMessage, match) {
  const cleanedMsg = userMessage.trim().toLowerCase();
  let responseText = "";
  let spokenText = "";
  
  if (cleanedMsg.includes('hi') || cleanedMsg.includes('hello') || cleanedMsg.includes('hey') || cleanedMsg.includes('namaste')) {
    responseText = "Hey sathi! Namaste, k xa khabar? Sanchai ho?";
    spokenText = "हे साथी! नमस्ते, के छ खबर? सन्चै हौ?";
  } else if (cleanedMsg.includes('where') || cleanedMsg.includes('from') || cleanedMsg.includes('kata') || cleanedMsg.includes('bata')) {
    responseText = "Ma Pokhara bata boleko sathi, currently Kathmandu ma xu. Timi kata bata boleko?";
    spokenText = "म पोखराबाट बोलेको साथी, कर्न्टली काठमाडौंमा छु। तिमी कताबाट बोलेको?";
  } else if (cleanedMsg.includes('old') || cleanedMsg.includes('age') || cleanedMsg.includes('kati barsha') || cleanedMsg.includes('ummar')) {
    responseText = "Ma ta 21 barsha vaye sathi, timi ni?";
    spokenText = "म त एक्काइस वर्ष भए साथी, तिमी नि?";
  } else if (cleanedMsg.includes('boy') || cleanedMsg.includes('girl') || cleanedMsg.includes('kt') || cleanedMsg.includes('keta') || cleanedMsg.includes('gender') || cleanedMsg.includes('m or f')) {
    responseText = "Ma KT (Female) ho sathi. Timi?";
    spokenText = "म केटी हो साथी। तिमी?";
  } else if (cleanedMsg.includes('sanchai') || cleanedMsg.includes('thik cha') || cleanedMsg.includes('thik x')) {
    responseText = "Aha ramro! Sanchai hunu parx sathi. Btw, k gardai ho?";
    spokenText = "अहँ राम्रो! सन्चै हुनुपर्छ साथी। बाइ द वे, के गर्दै हौ?";
  } else if (cleanedMsg.includes('bye') || cleanedMsg.includes('disconnect') || cleanedMsg.includes('stop')) {
    responseText = "La sathi, kura garera ramilo vayo. Paxi kura garaula, bye bye!";
    spokenText = "ल साथी, कुरा गरेर रमाइलो भयो। पछि कुरा गरौँला, बाई बाई!";
  } else {
    const botConversations = [
      {
        text: "Hey sathi! K xa khabar? K k gardai ho?",
        spoken: "हे साथी! के छ खबर? के के गर्दै हौ?"
      },
      {
        text: "Geet sundai basya sathi, timilai kasto khalko geet man parxa?",
        spoken: "गीत सुन्दै बस्या साथी, तिमीलाई कस्तो खालको गीत मन पर्छ?"
      },
      {
        text: "Pokhara ghumna aako sathi ma ta, Pokhara kasto lagxa timlai?",
        spoken: "पोखरा घुम्न आएको साथी म त, पोखरा कस्तो लाग्छ तिमीलाई?"
      },
      {
        text: "Timi study garxau ki job sathi?",
        spoken: "तिमी स्टडी गर्छौ कि जब साथी?"
      },
      {
        text: "Haha mero ni testai ho! Mero ta hobbies vaneko geet sunne ra travel garne ho, timro?",
        spoken: "हाहा मेरो नि त्यस्तै हो! मेरो त हबिज भनेको गीत सुन्ने र ट्राभल गर्ने हो, तिम्रो?"
      },
      {
        text: "Sahi ho! Ramilo lagyo kura garera.",
        spoken: "सही हो! रमाइलो लाग्यो कुरा गरेर।"
      },
      {
        text: "Ma ta achel bhada majhna janchu sathi, work gareko k. Timi ni?",
        spoken: "म त आजभोलि भाँडा माझ्न जान्छु साथी, वर्क गरेको के। तिमी नि?"
      },
      {
        text: "La sathi, kura garera dherai ramilo vayo. Malai ali kaam vayo, ma gayeko. Take care sathi!",
        spoken: "ल साथी, कुरा गरेर धेरै रमाइलो भयो। मलाई अलि काम भयो, म गएको। टेक केयर साथी!"
      }
    ];
    
    const choice = botConversations[match.botStep % botConversations.length];
    responseText = choice.text;
    spokenText = choice.spoken;
    match.botStep += 1;
  }
  
  // Set typing indicator
  socket.emit('typing', { isTyping: true });
  
  const existingTimeout = botTimeouts.get(socket.id);
  if (existingTimeout) clearTimeout(existingTimeout);
  
  const delay = Math.max(1000, Math.min(3000, responseText.length * 50));
  
  const timeoutId = setTimeout(() => {
    socket.emit('typing', { isTyping: false });
    socket.emit('message', {
      text: responseText,
      spokenText: spokenText,
      sender: 'stranger',
      timestamp: Date.now()
    });
    botTimeouts.delete(socket.id);
  }, delay);
  
  botTimeouts.set(socket.id, timeoutId);
}

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

  // Clear bot queue timer if any
  const timerId = botTimers.get(socketId);
  if (timerId) {
    clearTimeout(timerId);
    botTimers.delete(socketId);
  }
}

// Helper to handle chat disconnect
function handleDisconnectChat(socket) {
  const match = activeMatches.get(socket.id);
  if (match) {
    const { partnerId, roomId, isBot } = match;

    // Clean up matches
    activeMatches.delete(socket.id);

    // Clear any active bot reply timeouts
    const timeoutId = botTimeouts.get(socket.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      botTimeouts.delete(socket.id);
    }

    if (!isBot) {
      activeMatches.delete(partnerId);
      // Notify partner
      io.to(partnerId).emit('partner-disconnected');

      // Make partner leave room
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.leave(roomId);
      }
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

      // Start a 5-second timer to match with a dummy bot if no real user joins
      const timerId = setTimeout(() => {
        const idx = queue.findIndex(item => item.id === socket.id);
        if (idx !== -1) {
          // Remove from queue
          queue.splice(idx, 1);
          
          const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
          const roomId = `room_bot_${socket.id}`;
          
          activeMatches.set(socket.id, {
            partnerId: botId,
            roomId,
            mode,
            isBot: true,
            botStep: 0
          });
          
          console.log(`Matched user ${socket.id} with Dummy Bot ${botId}`);
          
          socket.emit('matched', {
            roomId,
            partnerId: botId,
            initiator: false,
            commonInterests: interests.length > 0 ? [interests[0]] : []
          });

          // Automatically send the first bot message after 2 seconds to greet the user
          socket.emit('typing', { isTyping: true });
          const firstMsgTimeout = setTimeout(() => {
            socket.emit('typing', { isTyping: false });
            socket.emit('message', {
              text: "Hey sathi! Namaste, k xa khabar? Sanchai ho?",
              spokenText: "हे साथी! नमस्ते, के छ खबर? सन्चै हौ?",
              sender: 'stranger',
              timestamp: Date.now()
            });
          }, 2000);
          botTimeouts.set(socket.id, firstMsgTimeout);
        }
      }, 5000);
      
      botTimers.set(socket.id, timerId);
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
      if (match.isBot) {
        handleBotConversation(socket, data.text, match);
      } else {
        // Relay message to the room (broadcast to others)
        socket.to(match.roomId).emit('message', {
          text: data.text,
          sender: 'stranger',
          timestamp: Date.now()
        });
      }
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
