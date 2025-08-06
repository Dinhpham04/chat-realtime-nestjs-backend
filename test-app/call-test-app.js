/**
 * Call Test Application - Phase 1 Local Development
 * Tests the call lifecycle management and error handling implementation
 * 
 * Features:
 * - Call initiation and lifecycle management
 * - Real-time status tracking
 * - Error handling testing
 * - API endpoint testing
 * - Call statistics and logs
 */

class CallTestApp {
  constructor() {
    this.apiBaseUrl = '';
    this.authToken = '';
    this.currentUser = null;
    this.currentCall = null;
    this.isConnected = false;
    this.callStartTime = null;
    this.callDurationInterval = null;

    // Statistics
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      callDurations: []
    };

    this.initializeApp();
  }

  initializeApp() {
    this.bindEvents();
    this.showLoginModal();
    this.log('info', 'Application initialized - Phase 1 Call Testing');
  }

  bindEvents() {
    // Login
    document.getElementById('loginBtn').addEventListener('click', () => this.showLoginModal());
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));

    // Call actions
    document.getElementById('initiateCallBtn').addEventListener('click', () => this.initiateCall());
    document.getElementById('acceptCallBtn').addEventListener('click', () => this.acceptCall());
    document.getElementById('declineCallBtn').addEventListener('click', () => this.declineCall());
    document.getElementById('hangupBtn').addEventListener('click', () => this.hangupCall());

    // Call controls
    document.getElementById('muteBtn').addEventListener('click', () => this.toggleMute());
    document.getElementById('speakerBtn').addEventListener('click', () => this.toggleSpeaker());

    // API testing
    document.getElementById('getUserStatusBtn').addEventListener('click', () => this.getUserStatus());
    document.getElementById('healthCheckBtn').addEventListener('click', () => this.healthCheck());
    document.getElementById('clearLogsBtn').addEventListener('click', () => this.clearLogs());
  }

  showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
  }

  hideLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
  }

  async handleLogin(e) {
    e.preventDefault();

    const apiBaseUrl = document.getElementById('apiBaseUrl').value.trim();
    const userId = document.getElementById('userId').value.trim();
    const accessToken = document.getElementById('accessToken').value.trim();

    if (!apiBaseUrl || !userId) {
      this.showToast('Vui lòng nhập đầy đủ thông tin', 'error');
      return;
    }

    if (!accessToken) {
      this.showToast('Vui lòng nhập Access Token', 'error');
      return;
    }

    // Basic validation for access token format
    if (accessToken.length < 10) {
      this.showToast('Access Token quá ngắn, vui lòng kiểm tra lại', 'error');
      return;
    }

    this.apiBaseUrl = apiBaseUrl;
    this.currentUser = { id: userId, username: userId };
    this.authToken = accessToken;

    this.log('info', `Connecting to API: ${apiBaseUrl}`);
    this.log('info', `User: ${userId}`);
    this.log('info', `Using access token: ${accessToken.substring(0, 20)}...`);

    try {
      // Test connection với health check
      const response = await this.makeApiCall('GET', '/calls/health', null, false);

      if (response.success) {
        this.isConnected = true;
        this.updateConnectionStatus('connected');
        this.hideLoginModal();
        this.showMainContent();
        this.updateUserInfo();
        this.showToast('Kết nối thành công!', 'success');
        this.log('success', 'Connected to API successfully');

        // Start polling user status
        this.startStatusPolling();
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      this.log('error', `Connection failed: ${error.message}`);
      this.showToast('Không thể kết nối đến API', 'error');
    }
  }

  showMainContent() {
    document.getElementById('mainContent').style.display = 'grid';
  }

  updateConnectionStatus(status) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');

    statusDot.className = 'w-3 h-3 rounded-full status-indicator';

    switch (status) {
      case 'connected':
        statusDot.classList.add('bg-green-500', 'status-active');
        statusText.textContent = 'Connected';
        break;
      case 'connecting':
        statusDot.classList.add('bg-yellow-500', 'status-connecting');
        statusText.textContent = 'Connecting...';
        break;
      case 'disconnected':
        statusDot.classList.add('bg-gray-500', 'status-idle');
        statusText.textContent = 'Disconnected';
        break;
    }
  }

  updateUserInfo() {
    document.getElementById('currentUserId').textContent = this.currentUser.id;

    // Display access token (first 20 characters + ...)
    const tokenDisplay = this.authToken ?
      `${this.authToken.substring(0, 20)}...` :
      'Not connected';
    document.getElementById('accessTokenDisplay').textContent = tokenDisplay;
  }

  startStatusPolling() {
    // Poll user status every 5 seconds
    setInterval(() => {
      if (this.isConnected) {
        this.getUserStatus(true); // silent mode
      }
    }, 5000);
  }

  async makeApiCall(method, endpoint, data = null, requireAuth = true) {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const config = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      config.body = JSON.stringify(data);
    }

    this.log('info', `${method} ${endpoint}`, data);

    try {
      const response = await fetch(url, config);
      const result = await response.json();

      if (response.ok) {
        this.log('success', `${method} ${endpoint} - Success`, result);
        return result;
      } else {
        this.log('error', `${method} ${endpoint} - Error ${response.status}`, result);
        return result;
      }
    } catch (error) {
      this.log('error', `${method} ${endpoint} - Network Error: ${error.message}`);
      throw error;
    }
  }

  async initiateCall() {
    const targetUserId = document.getElementById('targetUserId').value.trim();
    const callType = document.getElementById('callType').value;

    if (!targetUserId) {
      this.showToast('Vui lòng nhập Target User ID', 'error');
      return;
    }

    if (targetUserId === this.currentUser.id) {
      this.showToast('Không thể gọi cho chính mình', 'error');
      return;
    }

    try {
      const response = await this.makeApiCall('POST', '/calls/initiate', {
        targetUserId,
        callType
      });

      if (response.success) {
        this.currentCall = response.data;
        this.stats.totalCalls++;
        this.updateStats();
        this.showActiveCallInterface();
        this.updateCallStatus('ringing');
        this.showToast('Cuộc gọi đã được khởi tạo', 'success');
        this.startCallTimer();

        // Simulate call progression for demo
        this.simulateCallProgression();
      } else {
        this.handleCallError(response.error);
      }
    } catch (error) {
      this.log('error', `Failed to initiate call: ${error.message}`);
      this.showToast('Lỗi khi khởi tạo cuộc gọi', 'error');
    }
  }

  simulateCallProgression() {
    // Simulate different call scenarios for testing
    const scenarios = ['accept', 'decline', 'timeout'];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

    this.log('info', `Simulating scenario: ${scenario}`);

    setTimeout(() => {
      switch (scenario) {
        case 'accept':
          this.simulateCallAccept();
          break;
        case 'decline':
          this.simulateCallDecline();
          break;
        case 'timeout':
          this.simulateCallTimeout();
          break;
      }
    }, 3000 + Math.random() * 5000); // 3-8 seconds
  }

  async simulateCallAccept() {
    this.log('info', 'Simulating call accept by remote user');
    this.updateCallStatus('connecting');

    setTimeout(async () => {
      try {
        const response = await this.makeApiCall('PATCH', `/calls/${this.currentCall.callId}/connected`);
        if (response.success) {
          this.updateCallStatus('active');
          this.stats.successfulCalls++;
          this.updateStats();
          this.showToast('Cuộc gọi đã kết nối!', 'success');

          // Auto end call after 10-30 seconds for demo
          setTimeout(() => {
            this.hangupCall();
          }, 10000 + Math.random() * 20000);
        }
      } catch (error) {
        this.log('error', `Failed to mark call as connected: ${error.message}`);
      }
    }, 2000);
  }

  simulateCallDecline() {
    this.log('info', 'Simulating call decline by remote user');
    this.updateCallStatus('ended');
    this.endCall('declined');
  }

  simulateCallTimeout() {
    this.log('warning', 'Simulating call timeout');
    this.updateCallStatus('ended');
    this.endCall('timeout');
  }

  async acceptCall() {
    if (!this.currentCall) return;

    try {
      const response = await this.makeApiCall('PATCH', `/calls/${this.currentCall.callId}/accept`);
      if (response.success) {
        this.updateCallStatus('connecting');
        this.showToast('Đã chấp nhận cuộc gọi', 'success');
      } else {
        this.handleCallError(response.error);
      }
    } catch (error) {
      this.log('error', `Failed to accept call: ${error.message}`);
    }
  }

  async declineCall() {
    if (!this.currentCall) return;

    try {
      const response = await this.makeApiCall('PATCH', `/calls/${this.currentCall.callId}/decline`);
      if (response.success) {
        this.endCall('declined');
        this.showToast('Đã từ chối cuộc gọi', 'info');
      } else {
        this.handleCallError(response.error);
      }
    } catch (error) {
      this.log('error', `Failed to decline call: ${error.message}`);
    }
  }

  async hangupCall() {
    if (!this.currentCall) return;

    try {
      const response = await this.makeApiCall('PATCH', `/calls/${this.currentCall.callId}/hangup`);
      if (response.success) {
        this.endCall('hangup');
        this.showToast('Cuộc gọi đã kết thúc', 'info');
      } else {
        this.handleCallError(response.error);
      }
    } catch (error) {
      this.log('error', `Failed to hangup call: ${error.message}`);
    }
  }

  endCall(reason) {
    if (this.callDurationInterval) {
      clearInterval(this.callDurationInterval);
      this.callDurationInterval = null;
    }

    if (this.callStartTime) {
      const duration = (Date.now() - this.callStartTime) / 1000;
      this.stats.callDurations.push(duration);
      this.updateStats();
    }

    this.currentCall = null;
    this.callStartTime = null;
    this.showCallForm();
    this.log('info', `Call ended: ${reason}`);
  }

  showActiveCallInterface() {
    document.getElementById('callForm').classList.add('hidden');
    document.getElementById('activeCallInterface').classList.remove('hidden');
    document.getElementById('incomingCallInterface').classList.add('hidden');
  }

  showIncomingCallInterface() {
    document.getElementById('callForm').classList.add('hidden');
    document.getElementById('activeCallInterface').classList.add('hidden');
    document.getElementById('incomingCallInterface').classList.remove('hidden');
  }

  showCallForm() {
    document.getElementById('callForm').classList.remove('hidden');
    document.getElementById('activeCallInterface').classList.add('hidden');
    document.getElementById('incomingCallInterface').classList.add('hidden');
  }

  updateCallStatus(status) {
    const statusText = document.getElementById('callStatusText');
    const participantName = document.getElementById('callParticipantName');

    if (this.currentCall) {
      participantName.textContent = this.currentCall.targetUserId || 'Unknown User';
    }

    switch (status) {
      case 'ringing':
        statusText.textContent = 'Đang gọi...';
        break;
      case 'connecting':
        statusText.textContent = 'Đang kết nối...';
        break;
      case 'active':
        statusText.textContent = 'Đang trong cuộc gọi';
        break;
      case 'ended':
        statusText.textContent = 'Cuộc gọi đã kết thúc';
        break;
    }
  }

  startCallTimer() {
    this.callStartTime = Date.now();
    this.callDurationInterval = setInterval(() => {
      const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      document.getElementById('callDuration').textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  toggleMute() {
    const muteBtn = document.getElementById('muteBtn');
    const isMuted = muteBtn.classList.contains('bg-red-600');

    if (isMuted) {
      muteBtn.classList.remove('bg-red-600');
      muteBtn.classList.add('bg-gray-600');
      muteBtn.textContent = '🎤';
      this.log('info', 'Microphone unmuted');
    } else {
      muteBtn.classList.remove('bg-gray-600');
      muteBtn.classList.add('bg-red-600');
      muteBtn.textContent = '🔇';
      this.log('info', 'Microphone muted');
    }
  }

  toggleSpeaker() {
    const speakerBtn = document.getElementById('speakerBtn');
    const isSpeakerOn = speakerBtn.classList.contains('bg-blue-600');

    if (isSpeakerOn) {
      speakerBtn.classList.remove('bg-blue-600');
      speakerBtn.classList.add('bg-gray-600');
      speakerBtn.textContent = '🔊';
      this.log('info', 'Speaker off');
    } else {
      speakerBtn.classList.remove('bg-gray-600');
      speakerBtn.classList.add('bg-blue-600');
      speakerBtn.textContent = '📢';
      this.log('info', 'Speaker on');
    }
  }

  async getUserStatus(silent = false) {
    try {
      const response = await this.makeApiCall('GET', '/calls/user/status');
      if (response.success) {
        const status = response.data.status;
        const currentCallId = response.data.currentCallId;

        document.getElementById('userCallStatus').textContent = status;
        document.getElementById('currentCallId').textContent = currentCallId || '-';

        if (!silent) {
          this.showToast(`User Status: ${status}`, 'info');
        }
      } else {
        this.handleApiError(response.error);
      }
    } catch (error) {
      if (!silent) {
        this.log('error', `Failed to get user status: ${error.message}`);
      }
    }
  }

  async healthCheck() {
    try {
      const response = await this.makeApiCall('GET', '/calls/health', null, false);
      if (response.success) {
        this.showToast('Health Check: All systems operational', 'success');
        this.log('success', 'Health check passed', response.data);
      } else {
        this.showToast('Health Check: Some issues detected', 'warning');
        this.log('warning', 'Health check issues', response.error);
      }
    } catch (error) {
      this.showToast('Health Check: Failed to connect', 'error');
      this.log('error', `Health check failed: ${error.message}`);
    }
  }

  handleCallError(error) {
    this.stats.failedCalls++;
    this.updateStats();

    const title = error.userFriendly?.title || 'Lỗi cuộc gọi';
    const message = error.userFriendly?.message || error.message;

    this.showToast(`${title}: ${message}`, 'error');
    this.log('error', `Call Error [${error.type}]: ${error.message}`);

    if (this.currentCall) {
      this.endCall('error');
    }
  }

  handleApiError(error) {
    const title = error.userFriendly?.title || 'Lỗi API';
    const message = error.userFriendly?.message || error.message;

    this.showToast(`${title}: ${message}`, 'error');
    this.log('error', `API Error [${error.type}]: ${error.message}`);
  }

  updateStats() {
    document.getElementById('totalCalls').textContent = this.stats.totalCalls;
    document.getElementById('successfulCalls').textContent = this.stats.successfulCalls;
    document.getElementById('failedCalls').textContent = this.stats.failedCalls;

    const avgDuration = this.stats.callDurations.length > 0
      ? Math.round(this.stats.callDurations.reduce((a, b) => a + b, 0) / this.stats.callDurations.length)
      : 0;
    document.getElementById('avgDuration').textContent = `${avgDuration}s`;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logsContainer = document.getElementById('logsContainer');

    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${level}`;

    let logText = `<span class="text-gray-400">[${timestamp}]</span> ${message}`;
    if (data) {
      logText += `<br><span class="text-gray-500">${JSON.stringify(data, null, 2)}</span>`;
    }

    logEntry.innerHTML = logText;
    logsContainer.appendChild(logEntry);

    // Auto scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Keep only last 100 logs
    while (logsContainer.children.length > 100) {
      logsContainer.removeChild(logsContainer.firstChild);
    }
  }

  clearLogs() {
    const logsContainer = document.getElementById('logsContainer');
    logsContainer.innerHTML = '<div class="log-entry log-info"><span class="text-gray-400">[System]</span> Logs cleared</div>';
  }

  showToast(message, type = 'info') {
    const bgColors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      style: {
        background: bgColors[type] || bgColors.info,
        borderRadius: "8px",
        fontFamily: "system-ui"
      }
    }).showToast();
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  new CallTestApp();
});
