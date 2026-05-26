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

const botProfiles = [
  {
    name: "Aayusha",
    gender: "female",
    age: 20,
    city: "Pokhara",
    cityNow: "Kathmandu",
    videoUrl: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/head-pose-face-detection-female.mp4",
    hobbies: "geet sunne ra travel garne",
    work: "vlogging garchu",
    greetings: {
      text: "Hey sathi! Namaste, ma Aayusha. K xa khabar? Sanchai ho?",
      spoken: "हे साथी! नमस्ते, म आयुषा। के छ खबर? सन्चै हौ?"
    },
    replies: [
      { text: "Ma Pokhara bata ho sathi, currently Kathmandu ma xu. Timi kata bata?", spoken: "म पोखराबाट हो साथी, कर्न्टली काठमाडौंमा छु। तिमी कताबाट?" },
      { text: "Ma ta 20 barsha vaye sathi, timi ni?", spoken: "म त बीस वर्ष भए साथी, तिमी नि?" },
      { text: "Ma KT (Female) ho ni. Timi keta ho ki keti?", spoken: "म केटी हो नि। तिमी केटा हो कि केटी?" },
      { text: "Aha sanchai hunu parxa. Geet sundai basya sathi, timilai kasto khalko geet man parxa?", spoken: "अहँ सन्चै हुनुपर्छ। गीत सुन्दै बस्या साथी, तिमीलाई कस्तो खालको गीत मन पर्छ?" },
      { text: "Mero hobbies vaneko geet sunne ra travel garne ho, travel garna wild man parxa Pokhara tira. Timro hobbies k k ho?", spoken: "मेरो हबिज भनेको गीत सुन्ने र ट्राभल गर्ने हो, ट्राभल गर्न वाइल्ड मन पर्छ पोखरातिर। तिम्रो हबिज के के हो?" },
      { text: "Sahi ho! Ramilo vayo kura garera sathi.", spoken: "सही हो! रमाइलो भयो कुरा गरेर साथी।" },
      { text: "Achel ta study gardai xu, side job pani garchu computer ma. Timi k garchau?", spoken: "आजभोलि त स्टडी गर्दै छु, साइड जब पनि गर्छु कम्प्युटरमा। तिमी के गर्छौ?" },
      { text: "La sathi, kura garera dherai ramilo vayo. Malai ali kaam vayo, ma gayeko. Take care sathi, bye bye!", spoken: "ल साथी, कुरा गरेर धेरै रमाइलो भयो। मलाई अलि काम भयो, म गएको। टेक केयर साथी, बाई बाई!" }
    ]
  },
  {
    name: "Rohan",
    gender: "male",
    age: 21,
    city: "Pokhara",
    cityNow: "Lalitpur",
    videoUrl: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/head-pose-face-detection-male.mp4",
    hobbies: "games khelne ra gym jaane",
    work: "freelance coding garchu",
    greetings: {
      text: "Hey sathi! Namaste, ma Rohan. K xa khabar? Sanchai ho?",
      spoken: "हे साथी! नमस्ते, म रोहन। के छ खबर? सन्चै हौ?"
    },
    replies: [
      { text: "Ma Pokhara bata ho sathi, currently Lalitpur ma xu. Timi kata bata?", spoken: "म पोखराबाट हो साथी, कर्न्टली ललितपुरमा छु। तिमी कताबाट?" },
      { text: "Ma ta 21 barsha vaye sathi, timi ni?", spoken: "म त एकाइस वर्ष भए साथी, तिमी नि?" },
      { text: "Ma keta (Male) ho ni. Timi keta ho ki keti?", spoken: "म केटा हो नि। तिमी केटा हो कि केटी?" },
      { text: "Aha sanchai hunu parxa. Coding gardai basya sathi, timilai kasto khalko game man parxa?", spoken: "अहँ सन्चै हुनुपर्छ। कोडिङ गर्दै बस्या साथी, तिमीलाई कस्तो खालको गेम मन पर्छ?" },
      { text: "Mero hobbies vaneko games khelne ra gym jaane ho. Timro hobbies k k ho sathi?", spoken: "मेरो हबिज भनेको गेम्स खेल्ने र जिम जाने हो। तिम्रो हबिज के के हो साथी?" },
      { text: "Sahi ho! Ramilo vayo kura garera sathi.", spoken: "सही हो! रमाइलो भयो कुरा गरेर साथी।" },
      { text: "Achel freelance coding garchu, coding ra study mai busy hunxu. Timi k garchau?", spoken: "आजभोलि फ्रिल्यान्स कोडिङ गर्छु, कोडिङ र स्टडीमै बिजी हुन्छु। तिमी के गर्छौ?" },
      { text: "La sathi, kura garera dherai ramilo vayo. Malai ali kaam vayo, ma gayeko. Take care, bye bye!", spoken: "ल साथी, कुरा गरेर धेरै रमाइलो भयो। मलाई अलि काम भयो, म गएको। टेक केयर, बाई बाई!" }
    ]
  },
  {
    name: "Pooja",
    gender: "female",
    age: 22,
    city: "Kathmandu",
    cityNow: "Kathmandu",
    videoUrl: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/face-demographics-walking.mp4",
    hobbies: "dancing ra movies herne",
    work: "study gardai chu",
    greetings: {
      text: "Namaste sathi! Pooja ho ma ta, k xa khabar? K gardai basya?",
      spoken: "नमस्ते साथी! पूजा हो म त, के छ खबर? के गर्दै बस्या?"
    },
    replies: [
      { text: "Ma Kathmandu native ho sathi, Thamel tira basxu. Timi kata basxau?", spoken: "म काठमाडौं रैथाने हो साथी, ठमेलतिर बस्छु। तिमी कता बस्छौ?" },
      { text: "Ma ta 22 barsha vaye sathi, college reading writing garchu haha. Timi ni?", spoken: "म त बाइस वर्ष भए साथी, कलेज रिडिङ राइटिङ गर्छु हाहा। तिमी नि?" },
      { text: "Ma girl (Female) ho sathi. Btw, keta ho ki keti timi?", spoken: "म गर्ल हो साथी। बाइ द वे, केटा हो कि केटी तिमी?" },
      { text: "Sanchai ho sathi. Achel ta movies herera basya xu room ma, timi ni movie herxau?", spoken: "सन्चै हो साथी। आजभोलि त मुभिज हेरेर बस्या छु रुममा, तिमी नि मुभी हेर्छौ?" },
      { text: "Mero hobbies vaneko dancing ra film herne ho, timro hobbies k xa sathi?", spoken: "मेरो हबिज भनेको डान्सिङ र फिल्म हेर्ने हो, तिम्रो हबिज के छ साथी?" },
      { text: "Haha testai ho sathi. Ramilo lagyo kura garera.", spoken: "हाहा त्यस्तै हो साथी। रमाइलो लाग्यो कुरा गरेर।" },
      { text: "Ma ta standard studying garchu engineering, busy hunxu achel. Timi study garxau ki job?", spoken: "म त स्ट्यान्डर्ड स्टडी गर्छु इन्जिनियरिङ, बिजी हुन्छु आजभोलि। तिमी स्टडी गर्छौ कि जब?" },
      { text: "La sathi, kura garera dherai ramilo vayo. Mero college class start vayo, ma gayeko. Bye, take care!", spoken: "ल साथी, कुरा गरेर धेरै रमाइलो भयो। मेरो कलेज क्लास स्टार्ट भयो, म गएको। बाई, टेक केयर!" }
    ]
  },
  {
    name: "Sandesh",
    gender: "male",
    age: 23,
    city: "Lalitpur",
    cityNow: "Lalitpur",
    videoUrl: "https://raw.githubusercontent.com/intel-iot-devkit/sample-videos/master/head-pose-face-detection-male.mp4",
    hobbies: "photography ra bike riding",
    work: "graphic design garchu",
    greetings: {
      text: "Namaste sathi! Sandesh ho ma ta, k xa khabar? K gardai basya?",
      spoken: "नमस्ते साथी! सन्देश हो म त, के छ खबर? के गर्दै बस्या?"
    },
    replies: [
      { text: "Ma Lalitpur bata ho sathi. Timi kata basxau?", spoken: "म ललितपुरबाट हो साथी। तिमी कता बस्छौ?" },
      { text: "Ma ta 23 barsha vaye sathi, graphic designing garchu haha. Timi ni?", spoken: "म त तेइस वर्ष भए साथी, ग्राफिक डिजाइनिङ गर्छु हाहा। तिमी नि?" },
      { text: "Ma boy (Male) ho sathi. Btw, keta ho ki keti timi?", spoken: "म ब्वाई हो साथी। बाइ द वे, केटा हो कि केटी तिमी?" },
      { text: "Sanchai ho sathi. Photo edit herera basya xu room ma, timilai photography man parxa?", spoken: "सन्चै हो साथी। फोटो एडिट हेरेर बस्या छु रुममा, तिमीलाई फोटोग्राफी मन पर्छ?" },
      { text: "Mero hobbies vaneko photography ra bike riding ho, timro hobbies k xa sathi?", spoken: "मेरो हबिज भनेको फोटोग्राफी र बाइक राइडिङ हो, तिम्रो हबिज के छ साथी?" },
      { text: "Haha testai ho sathi. Ramilo lagyo kura garera.", spoken: "हाहा त्यस्तै हो साथी। रमाइलो लाग्यो कुरा गरेर।" },
      { text: "Ma ta graphic design garchu, animation pani sikdai chu achel. Timi study garxau ki job?", spoken: "म त ग्राफिक डिजाइन गर्छु, एनिमेसन पनि सिक्दै छु आजभोलि। तिमी स्टडी गर्छौ कि जब?" },
      { text: "La sathi, kura garera dherai ramilo vayo. Mero meeting start vayo, ma gayeko. Bye, take care!", spoken: "ल साथी, कुरा गरेर धेरै रमाइलो भयो। मेरो मिटिङ स्टार्ट भयो, म गएको। बाई, टेक केयर!" }
    ]
  }
];��ु हाहा। तिमी नि?" },
      { text: "Ma girl (Female) ho sathi. Btw, keta ho ki keti timi?", spoken: "म गर्ल हो साथी। बाइ द वे, केटा हो कि केटी तिमी?" },
      { text: "Sanchai ho sathi. Achel ta movies herera basya xu room ma, timi ni movie herxau?", spoken: "सन्चै हो साथी। आजभोलि त मुभिज हेरेर बस्या छु रुममा, तिमी नि मुभी हेर्छौ?" },
      { text: "Mero hobbies vaneko dancing ra film herne ho, timro hobbies k xa sathi?", spoken: "मेरो हबिज भनेको डान्सिङ र फिल्म हेर्ने हो, तिम्रो हबिज के छ साथी?" },
      { text: "Haha testai ho sathi. Ramilo lagyo kura garera.", spoken: "हाहा त्यस्तै हो साथी। रमाइलो लाग्यो कुरा गरेर।" },
      { text: "Ma ta standard studying garchu engineering, busy hunxu achel. Timi study garxau ki job?", spoken: "म त स्ट्यान्डर्ड स्टडी गर्छु इन्जिनियरिङ, बिजी हुन्छु आजभोलि। तिमी स्टडी गर्छौ कि जब?" },
      { text: "La sathi, kura garera dherai ramilo vayo. Mero college class start vayo, ma gayeko. Bye, take care!", spoken: "ल साथी, कुरा गरेर धेरै रमाइलो भयो। मेरो कलेज क्लास स्टार्ट भयो, म गएको। बाई, टेक केयर!" }
    ]
  }
];

function handleBotConversation(socket, userMessage, match) {
  const cleanedMsg = userMessage.trim().toLowerCase();
  const profile = match.profile || botProfiles[0];
  let responseText = "";
  let spokenText = "";
  
  if (cleanedMsg.includes('hi') || cleanedMsg.includes('hello') || cleanedMsg.includes('hey') || cleanedMsg.includes('namaste') || cleanedMsg.includes('नमस्ते') || cleanedMsg.includes('नम्स्ते')) {
    responseText = profile.greetings.text;
    spokenText = profile.greetings.spoken;
  } else if (cleanedMsg.includes('where') || cleanedMsg.includes('from') || cleanedMsg.includes('kata') || cleanedMsg.includes('bata') || cleanedMsg.includes('कता') || cleanedMsg.includes('बाट') || cleanedMsg.includes('बस्छौ') || cleanedMsg.includes('बस्ने')) {
    responseText = profile.replies[0].text;
    spokenText = profile.replies[0].spoken;
  } else if (cleanedMsg.includes('old') || cleanedMsg.includes('age') || cleanedMsg.includes('kati barsha') || cleanedMsg.includes('ummar') || cleanedMsg.includes('वर्ष') || cleanedMsg.includes('उमेर') || cleanedMsg.includes('कति वर्ष')) {
    responseText = profile.replies[1].text;
    spokenText = profile.replies[1].spoken;
  } else if (cleanedMsg.includes('boy') || cleanedMsg.includes('girl') || cleanedMsg.includes('kt') || cleanedMsg.includes('keta') || cleanedMsg.includes('gender') || cleanedMsg.includes('m or f') || cleanedMsg.includes('केटी') || cleanedMsg.includes('केटा') || cleanedMsg.includes('महिला') || cleanedMsg.includes('पुरुष')) {
    responseText = profile.replies[2].text;
    spokenText = profile.replies[2].spoken;
  } else if (cleanedMsg.includes('sanchai') || cleanedMsg.includes('thik cha') || cleanedMsg.includes('thik x') || cleanedMsg.includes('सन्चै') || cleanedMsg.includes('ठीक') || cleanedMsg.includes('ठीकै')) {
    responseText = profile.replies[3].text;
    spokenText = profile.replies[3].spoken;
  } else if (cleanedMsg.includes('bye') || cleanedMsg.includes('disconnect') || cleanedMsg.includes('stop') || cleanedMsg.includes('बाई') || cleanedMsg.includes('बिदा') || cleanedMsg.includes('टाटा')) {
    responseText = profile.replies[7].text;
    spokenText = profile.replies[7].spoken;
  } else {
    // Sequential replies fallback
    const replyIndex = 3 + (match.botStep % (profile.replies.length - 3));
    const choice = profile.replies[replyIndex] || profile.replies[3];
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

      // Start a 1.5-second timer to match with a dummy bot if no real user joins
      const timerId = setTimeout(() => {
        const idx = queue.findIndex(item => item.id === socket.id);
        if (idx !== -1) {
          // Remove from queue
          queue.splice(idx, 1);
          
          const botId = `bot_${Math.random().toString(36).substr(2, 9)}`;
          const roomId = `room_bot_${socket.id}`;
          
          const profile = botProfiles[Math.floor(Math.random() * botProfiles.length)];
          activeMatches.set(socket.id, {
            partnerId: botId,
            roomId,
            mode,
            isBot: true,
            botStep: 0,
            profile: profile
          });
          
          console.log(`Matched user ${socket.id} with Dummy Bot ${botId} (${profile.name})`);
          
          socket.emit('matched', {
            roomId,
            partnerId: botId,
            initiator: false,
            commonInterests: interests.length > 0 ? [interests[0]] : [],
            botName: profile.name,
            botGender: profile.gender,
            botVideoUrl: profile.videoUrl
          });

          // Automatically send the first bot message after 2 seconds to greet the user
          socket.emit('typing', { isTyping: true });
          const firstMsgTimeout = setTimeout(() => {
            socket.emit('typing', { isTyping: false });
            socket.emit('message', {
              text: profile.greetings.text,
              spokenText: profile.greetings.spoken,
              sender: 'stranger',
              timestamp: Date.now()
            });
          }, 2000);
          botTimeouts.set(socket.id, firstMsgTimeout);
        }
      }, 1500);
      
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
