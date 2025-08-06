/**
 * WebRTC Voice Call Service - Phase 2 Implementation
 * 
 * Handles WebRTC media stream integration for voice calls:
 * - Microphone access and audio stream management
 * - PeerConnection setup and ICE candidate exchange
 * - SDP offer/answer negotiation
 * - Call state management and error handling
 * 
 * Integration với NestJS backend through Socket.IO
 */

class VoiceCallService {
  constructor() {
    // WebRTC Components
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;

    // Socket Connection
    this.socket = null;
    this.isConnected = false;

    // Call State
    this.currentCallId = null;
    this.callState = 'idle'; // idle, initiating, ringing, active, ended
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;

    // ICE Candidate Queue (for candidates generated before callId is available)
    this.iceCandidateQueue = [];

    // Audio Context for visualization
    this.audioContext = null;
    this.localAnalyzer = null;
    this.remoteAnalyzer = null;

    // Configuration
    this.config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10
    };

    // Event callbacks (will be set by UI)
    this.onCallStateChanged = null;
    this.onIncomingCall = null;
    this.onCallEnded = null;
    this.onError = null;
    this.onDebugUpdate = null;

    this.log('info', 'VoiceCallService initialized');
  }

  /**
   * Connect to NestJS backend via Socket.IO
   */
  async connect(serverUrl, userId, authToken = null) {
    try {
      this.log('info', `Connecting to ${serverUrl} as user ${userId}`);
      this.log('debug', `Auth token provided: ${authToken ? 'Yes' : 'No'}`);

      const socketOptions = {
        transports: ['websocket', 'polling'],
        autoConnect: false
      };

      if (authToken) {
        socketOptions.auth = {
          token: authToken,
          userId: userId,
          deviceId: 'voice-call-test-' + Date.now(),
          deviceType: 'web',
          platform: 'web'
        };
        socketOptions.extraHeaders = {
          'Authorization': `Bearer ${authToken}`
        };
        this.log('debug', `Socket auth configured with token`);
      }

      this.socket = io(`${serverUrl}/chat`, socketOptions);

      // Setup socket event listeners
      this.setupSocketListeners();

      // Connect
      this.socket.connect();

      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.log('success', `Connected to server with socket ID: ${this.socket.id}`);
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          this.log('error', `Connection failed: ${error.message}`);
          reject(error);
        });

        this.socket.on('authenticated', () => {
          this.log('success', 'Socket authentication successful');
        });

        this.socket.on('authentication_failed', (error) => {
          this.log('error', `Socket authentication failed: ${error.message}`);
          reject(new Error('Authentication failed'));
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });

    } catch (error) {
      this.log('error', `Failed to connect: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected = false;
      this.log('info', 'Disconnected from server');
    }

    this.cleanup();
  }

  /**
   * Setup Socket.IO event listeners for call signaling
   */
  setupSocketListeners() {
    // Connection events
    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.log('warning', 'Disconnected from server');
    });

    // Call signaling events
    this.socket.on('call:initiated', (data) => {
      this.log('success', `Call initiated successfully: ${data.callId}`);
      this.currentCallId = data.callId;

      // Send any queued ICE candidates
      this.flushIceCandidateQueue();

      this.updateDebugInfo();
    });

    this.socket.on('call:incoming', (data) => {
      this.log('success', `📞 INCOMING CALL RECEIVED! From ${data.callerId}: ${data.callId}`);
      this.log('debug', `Incoming call data:`, JSON.stringify(data, null, 2));
      this.handleIncomingCall(data);
    });

    this.socket.on('call:accepted', (data) => {
      this.log('success', `Call accepted: ${data.callId}`);
      this.handleCallAccepted(data);
    });

    this.socket.on('call:declined', (data) => {
      this.log('warning', `Call declined: ${data.callId}`);
      this.handleCallDeclined(data);
    });

    this.socket.on('call:ended', (data) => {
      this.log('info', `Call ended: ${data.callId}`);
      this.handleCallHangup(data);
    });

    this.socket.on('call:timeout', (data) => {
      this.log('warning', `Call timeout: ${data.callId} - ${data.reason}`);
      this.handleCallHangup(data);
    });

    this.socket.on('call:ice_candidate', (data) => {
      this.log('debug', `ICE candidate received: ${data.callId}`);
      this.handleIceCandidate(data);
    });

    this.socket.on('call:error', (data) => {
      this.log('error', `Call error: ${data.message} (${data.code})`);
      if (this.onError) {
        this.onError(data);
      }
    });
  }

  /**
   * Test microphone access
   */
  async testMicrophone() {
    try {
      this.log('info', 'Testing microphone access...');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });

      this.log('success', 'Microphone access granted');

      // Test audio level
      this.setupAudioVisualization(stream, 'local');

      // Stop test stream after 3 seconds
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        this.log('info', 'Microphone test completed');
      }, 3000);

      return true;
    } catch (error) {
      this.log('error', `Microphone test failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initiate a voice call
   */
  async startCall(targetUserId) {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to server');
      }

      if (this.callState !== 'idle') {
        throw new Error('Already in a call');
      }

      this.log('info', `Starting voice call to user: ${targetUserId}`);
      this.callState = 'initiating';
      this.isInitiator = true;

      // Get user media
      await this.getUserMedia();

      // Create peer connection
      this.createPeerConnection();

      // Add local stream to peer connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
        this.log('debug', `Added ${track.kind} track to peer connection`);
      });

      // Create SDP offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      });

      await this.peerConnection.setLocalDescription(offer);
      this.log('debug', 'Local description (offer) set');

      // Send offer to server
      this.socket.emit('call:initiate', {
        targetUserId: targetUserId,
        callType: 'voice',
        sdpOffer: offer
      });

      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to start call: ${error.message}`);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callData) {
    try {
      this.log('info', `Answering call: ${callData.callId}`);
      this.currentCallId = callData.callId;
      this.callState = 'active';
      this.isInitiator = false;

      // Get user media
      await this.getUserMedia();

      // Create peer connection
      this.createPeerConnection();

      // Add local stream
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription(callData.sdpOffer);
      this.log('debug', 'Remote description (offer) set');

      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      this.log('debug', 'Local description (answer) set');

      // Send answer to server
      this.socket.emit('call:accept', {
        callId: this.currentCallId,
        sdpAnswer: answer
      });

      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to answer call: ${error.message}`);
      this.declineCall(this.currentCallId);
      throw error;
    }
  }

  /**
   * Decline an incoming call
   */
  declineCall(callId) {
    this.log('info', `Declining call: ${callId}`);

    this.socket.emit('call:decline', {
      callId: callId,
      reason: 'declined'
    });

    this.cleanup();
  }

  /**
   * Hang up current call
   */
  hangupCall() {
    if (!this.currentCallId) {
      this.log('warning', 'No active call to hang up');
      return;
    }

    this.log('info', `Hanging up call: ${this.currentCallId}`);

    this.socket.emit('call:hangup', {
      callId: this.currentCallId,
      reason: 'user_hangup'
    });

    this.cleanup();
  }

  /**
   * Toggle mute/unmute
   */
  toggleMute() {
    if (!this.localStream) {
      this.log('warning', 'No local stream to mute');
      return false;
    }

    this.isMuted = !this.isMuted;

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });

    this.log('info', `Audio ${this.isMuted ? 'muted' : 'unmuted'}`);
    return this.isMuted;
  }

  /**
   * Toggle speaker on/off
   */
  toggleSpeaker() {
    this.isSpeakerOn = !this.isSpeakerOn;

    // In web browsers, this would typically control audio output device
    // For now, we'll just log the state
    this.log('info', `Speaker ${this.isSpeakerOn ? 'on' : 'off'}`);
    return this.isSpeakerOn;
  }

  /**
   * Get user media (microphone)
   */
  async getUserMedia() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: false
      });

      this.log('success', 'Local audio stream acquired');
      this.setupAudioVisualization(this.localStream, 'local');

      return this.localStream;
    } catch (error) {
      this.log('error', `Failed to get user media: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create WebRTC peer connection
   */
  createPeerConnection() {
    this.peerConnection = new RTCPeerConnection(this.config);

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      this.log('success', 'Remote stream received');
      this.remoteStream = event.streams[0];

      // Play remote audio
      const remoteAudio = document.getElementById('remoteAudio');
      if (remoteAudio) {
        remoteAudio.srcObject = this.remoteStream;
      }

      this.setupAudioVisualization(this.remoteStream, 'remote');
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.log('debug', 'Local ICE candidate generated');

        if (this.currentCallId) {
          // Send immediately if we have callId
          this.socket.emit('call:ice_candidate', {
            callId: this.currentCallId,
            candidate: event.candidate
          });
        } else {
          // Queue candidate if callId not available yet
          this.log('debug', 'Queueing ICE candidate (waiting for callId)');
          this.iceCandidateQueue.push(event.candidate);
        }
      }
    };

    // Handle connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      this.log('info', `ICE connection state: ${state}`);

      if (state === 'connected' || state === 'completed') {
        this.callState = 'active';
        this.notifyStateChange();
      } else if (state === 'failed' || state === 'disconnected') {
        this.log('error', 'ICE connection failed');
        this.cleanup();
      }

      this.updateDebugInfo();
    };
  }

  /**
   * Handle incoming call event
   */
  handleIncomingCall(data) {
    this.log('success', `🚨 PROCESSING INCOMING CALL: ${data.callId}`);
    this.currentCallId = data.callId;
    this.callState = 'ringing';

    this.log('debug', `Setting call state to 'ringing' and calling onIncomingCall callback`);

    if (this.onIncomingCall) {
      this.log('debug', `onIncomingCall callback exists, calling it now`);
      this.onIncomingCall(data);
    } else {
      this.log('error', `❌ onIncomingCall callback is NOT SET!`);
    }

    this.notifyStateChange();
  }

  /**
   * Handle call accepted event (for initiator)
   */
  async handleCallAccepted(data) {
    try {
      this.currentCallId = data.callId;
      this.callState = 'active';

      // Set remote description (answer)
      if (data.sdpAnswer) {
        await this.peerConnection.setRemoteDescription(data.sdpAnswer);
        this.log('debug', 'Remote description (answer) set');
      }

      this.updateDebugInfo();
      this.notifyStateChange();

    } catch (error) {
      this.log('error', `Failed to handle call accepted: ${error.message}`);
    }
  }

  /**
   * Handle call declined event
   */
  handleCallDeclined(data) {
    this.log('warning', `Call declined by ${data.userId}`);
    this.cleanup();
  }

  /**
   * Handle call hangup event
   */
  handleCallHangup(data) {
    this.log('info', `Call ended by remote user: ${data.callId}`);
    this.cleanup();
  }

  /**
   * Handle ICE candidate from remote peer
   */
  async handleIceCandidate(data) {
    try {
      if (this.peerConnection && data.candidate) {
        await this.peerConnection.addIceCandidate(data.candidate);
        this.log('debug', 'Remote ICE candidate added');
      }
    } catch (error) {
      this.log('error', `Failed to add ICE candidate: ${error.message}`);
    }
  }

  /**
   * Setup audio visualization
   */
  setupAudioVisualization(stream, type) {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const analyser = this.audioContext.createAnalyser();
      const microphone = this.audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      microphone.connect(analyser);

      if (type === 'local') {
        this.localAnalyzer = { analyser, dataArray };
      } else {
        this.remoteAnalyzer = { analyser, dataArray };
      }

      this.startAudioVisualization();

    } catch (error) {
      this.log('debug', `Audio visualization setup failed: ${error.message}`);
    }
  }

  /**
   * Start audio level visualization
   */
  startAudioVisualization() {
    const updateVisualization = () => {
      if (this.localAnalyzer) {
        this.localAnalyzer.analyser.getByteFrequencyData(this.localAnalyzer.dataArray);
        const average = this.localAnalyzer.dataArray.reduce((a, b) => a + b) / this.localAnalyzer.dataArray.length;
        this.updateAudioLevel('local', average);
      }

      if (this.remoteAnalyzer) {
        this.remoteAnalyzer.analyser.getByteFrequencyData(this.remoteAnalyzer.dataArray);
        const average = this.remoteAnalyzer.dataArray.reduce((a, b) => a + b) / this.remoteAnalyzer.dataArray.length;
        this.updateAudioLevel('remote', average);
      }

      if (this.callState === 'active' || this.callState === 'initiating') {
        requestAnimationFrame(updateVisualization);
      }
    };

    updateVisualization();
  }

  /**
   * Update audio level visualization in UI
   */
  updateAudioLevel(type, level) {
    const waves = document.querySelectorAll(`#${type}AudioLevel .audio-wave`);
    const normalizedLevel = Math.min(level / 50, 1); // Normalize to 0-1

    waves.forEach((wave, index) => {
      const threshold = (index + 1) / waves.length;
      if (normalizedLevel > threshold) {
        wave.style.animationPlayState = 'running';
        wave.style.opacity = '1';
      } else {
        wave.style.animationPlayState = 'paused';
        wave.style.opacity = '0.3';
      }
    });
  }

  /**
   * Update debug information in UI
   */
  updateDebugInfo() {
    if (this.onDebugUpdate) {
      const debugInfo = {
        localDescription: this.peerConnection?.localDescription?.sdp || '',
        remoteDescription: this.peerConnection?.remoteDescription?.sdp || '',
        iceConnectionState: this.peerConnection?.iceConnectionState || 'new',
        callId: this.currentCallId,
        callState: this.callState
      };

      this.onDebugUpdate(debugInfo);
    }
  }

  /**
   * Notify UI of state changes
   */
  notifyStateChange() {
    if (this.onCallStateChanged) {
      this.onCallStateChanged({
        callId: this.currentCallId,
        state: this.callState,
        isInitiator: this.isInitiator,
        isMuted: this.isMuted,
        isSpeakerOn: this.isSpeakerOn
      });
    }
  }

  /**
   * Send queued ICE candidates when callId becomes available
   */
  flushIceCandidateQueue() {
    if (this.iceCandidateQueue.length > 0 && this.currentCallId) {
      this.log('info', `Sending ${this.iceCandidateQueue.length} queued ICE candidates`);

      this.iceCandidateQueue.forEach(candidate => {
        this.socket.emit('call:ice_candidate', {
          callId: this.currentCallId,
          candidate: candidate
        });
      });

      this.iceCandidateQueue = [];
    }
  }

  /**
   * Cleanup call resources
   */
  cleanup() {
    this.log('info', 'Cleaning up call resources');

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        this.log('debug', `Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
      this.log('debug', 'Peer connection closed');
    }

    // Reset state
    this.currentCallId = null;
    this.callState = 'idle';
    this.isInitiator = false;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.remoteStream = null;
    this.localAnalyzer = null;
    this.remoteAnalyzer = null;

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    // Notify UI
    this.notifyStateChange();
    this.updateDebugInfo();

    if (this.onCallEnded) {
      this.onCallEnded();
    }
  }

  /**
   * Logging utility
   */
  log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    console.log(logEntry);

    // Add to UI logs if available
    const logsElement = document.getElementById('logs');
    if (logsElement) {
      const logDiv = document.createElement('div');
      logDiv.className = `log-entry log-${level}`;
      logDiv.textContent = logEntry;
      logsElement.appendChild(logDiv);
      logsElement.scrollTop = logsElement.scrollHeight;
    }
  }

  /**
   * Get current call state
   */
  getCallState() {
    return {
      callId: this.currentCallId,
      state: this.callState,
      isConnected: this.isConnected,
      isInitiator: this.isInitiator,
      isMuted: this.isMuted,
      isSpeakerOn: this.isSpeakerOn
    };
  }
}
