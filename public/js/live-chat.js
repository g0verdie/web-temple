/**
 * public/js/live-chat.js
 * Client-side script handling live chat WebSocket connections, UI management,
 * reconnection strategies, REST fallbacks, and accessibility features.
 */

(function () {
    const chatPanel = document.getElementById('live-chat-panel');
    if (!chatPanel) return;

    const streamId = parseInt(chatPanel.getAttribute('data-stream-id'), 10);
    const isLoggedIn = chatPanel.getAttribute('data-logged-in') === 'true';
    const role = chatPanel.getAttribute('data-role') || 'guest';
    const isModerator = ['admin', 'rabbi', 'social_chair'].includes(role);

    let socket = null;
    let isChatPaused = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    const reconnectIntervals = [2000, 5000, 10000]; // 2s, 5s, 10s
    let reconnectTimer = null;

    let isPollingMode = false;
    let pollInterval = null;
    let lastMessageTime = null;

    let isA11yActive = true; // For screen reader announcements
    const postedMessageIds = new Set(); // Track messages sent by this client to avoid duplicates

    // Initialize display name validation and joining
    let displayName = sessionStorage.getItem('chat_guest_name') || '';

    if (!isLoggedIn && !displayName) {
        renderNamePrompt();
    } else {
        initChat();
    }

    function renderNamePrompt() {
        chatPanel.innerHTML = `
            <div class="chat-prompt-overlay">
                <h4>Join the Live Chat</h4>
                <p>Enter a display name to participate in the chat during this service.</p>
                <form class="chat-prompt-form" id="chat-name-form">
                    <input 
                        type="text" 
                        id="chat-guest-name-input" 
                        class="chat-input" 
                        placeholder="Display Name" 
                        maxlength="50" 
                        required 
                        aria-label="Display Name"
                        autocomplete="off"
                    />
                    <button type="submit" class="chat-btn-send">Join Chat</button>
                </form>
            </div>
        `;

        const nameForm = document.getElementById('chat-name-form');
        nameForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-guest-name-input');
            const name = input.value.trim();
            if (name) {
                displayName = name;
                sessionStorage.setItem('chat_guest_name', name);
                initChat();
            }
        });
    }

    function initChat() {
        renderChatLayout();
        connectWebSocket();
    }

    function renderChatLayout() {
        chatPanel.innerHTML = `
            <div class="chat-header">
                <h3>Live Chat</h3>
                <div class="chat-status" aria-live="polite">
                    <span class="status-dot status-connecting" id="chat-status-dot"></span>
                    <span id="chat-status-text">Connecting...</span>
                </div>
            </div>
            <div class="chat-a11y-bar">
                <span>Screen Reader Announcements:</span>
                <button class="a11y-toggle-btn" id="chat-a11y-toggle" aria-pressed="false">Active (Polite)</button>
            </div>
            ${isModerator ? `
            <div class="chat-mod-bar">
                <span>Moderator:</span>
                <button class="a11y-toggle-btn" id="chat-pause-btn" aria-pressed="false">Pause Chat</button>
            </div>` : ''}
            <div class="slow-connection-banner" id="chat-slow-banner" style="display: none;">
                Slow connection. Using polling fallback. 
                <button class="a11y-toggle-btn" id="chat-reconnect-btn">Try Reconnect</button>
            </div>
            <div class="chat-messages" id="chat-messages-container" aria-live="polite" aria-relevant="additions">
                <!-- Messages will appear here -->
            </div>
            <div class="chat-footer">
                <form class="chat-form" id="chat-message-form">
                    <input 
                        type="text" 
                        id="chat-message-input" 
                        class="chat-input" 
                        placeholder="Type a message..." 
                        maxlength="500" 
                        required 
                        aria-label="Chat message"
                        autocomplete="off"
                    />
                    <button type="submit" class="chat-btn-send" id="chat-send-btn">Send</button>
                </form>
            </div>
        `;

        // Restore cached input text if present
        const cachedInput = sessionStorage.getItem('chat_unsent_input');
        if (cachedInput) {
            document.getElementById('chat-message-input').value = cachedInput;
        }

        // Attach listeners
        document.getElementById('chat-message-form').addEventListener('submit', handleSendMessage);
        document.getElementById('chat-a11y-toggle').addEventListener('click', toggleA11yAnnouncements);
        document.getElementById('chat-reconnect-btn').addEventListener('click', manualReconnect);
        const pauseBtn = document.getElementById('chat-pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', handlePauseToggle);
        }
        document.getElementById('chat-message-input').addEventListener('input', (e) => {
            sessionStorage.setItem('chat_unsent_input', e.target.value);
        });
    }

    function updateStatus(status) {
        const dot = document.getElementById('chat-status-dot');
        const text = document.getElementById('chat-status-text');
        if (!dot || !text) return;

        dot.className = 'status-dot';
        if (status === 'connected') {
            dot.classList.add('status-connected');
            text.textContent = 'Live';
        } else if (status === 'connecting') {
            dot.classList.add('status-connecting');
            text.textContent = 'Connecting...';
        } else {
            dot.classList.add('status-disconnected');
            text.textContent = 'Disconnected';
        }
    }

    function connectWebSocket() {
        if (isPollingMode) return;

        updateStatus('connecting');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat?streamId=${streamId}&guestName=${encodeURIComponent(displayName)}`;

        if (socket) {
            try { socket.close(); } catch (e) {}
        }

        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            reconnectAttempts = 0;
            updateStatus('connected');
            document.getElementById('chat-slow-banner').style.display = 'none';
            document.getElementById('chat-message-input').removeAttribute('disabled');
            document.getElementById('chat-send-btn').removeAttribute('disabled');
            
            // Clear any active reconnect timers
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }

            // Fetch initial messages list via REST to populate feed
            fetchInitialMessages();
        };

        socket.onmessage = (event) => {
            try {
                const packet = JSON.parse(event.data);
                handleSocketPacket(packet);
            } catch (e) {
                console.error('Error parsing WS message:', e);
            }
        };

        socket.onclose = (event) => {
            updateStatus('disconnected');
            // If it was closed cleanly, don't auto-reconnect
            if (event.wasClean) return;

            attemptReconnection();
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            socket.close();
        };
    }

    function attemptReconnection() {
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = reconnectIntervals[reconnectAttempts];
            reconnectAttempts++;
            console.log(`WS Connection lost. Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms...`);
            updateStatus('connecting');

            reconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, delay);
        } else {
            console.warn('WS Reconnection failed 3 times. Transitioning to REST HTTP Polling...');
            switchToPollingMode();
        }
    }

    function manualReconnect() {
        console.log('Manual reconnect requested.');
        // Stop polling
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        isPollingMode = false;
        reconnectAttempts = 0;
        document.getElementById('chat-slow-banner').style.display = 'none';
        connectWebSocket();
    }

    function switchToPollingMode() {
        isPollingMode = true;
        document.getElementById('chat-slow-banner').style.display = 'block';
        updateStatus('disconnected');

        // Start polling immediately
        fetchMessagesPoll();
        pollInterval = setInterval(fetchMessagesPoll, 3000);
    }

    function handleSocketPacket(packet) {
        switch (packet.type) {
            case 'connection_established':
                console.log('WS connection confirmed.');
                break;
            case 'message_approved':
                appendMessage(packet.data);
                break;
            case 'message_posted':
                // Message we just posted is pending or approved
                appendMessage(packet.data, true);
                break;
            case 'message_deleted':
                removeMessageFromUI(packet.data.id);
                break;
            case 'chat_paused':
                handleChatPaused(packet.data.paused);
                break;
            case 'error':
                alert(`Error: ${packet.message}`);
                break;
        }
    }

    // Moderator-only: toggle the stream's chat pause state. The server rejects
    // this for non-moderator roles, and broadcasts chat_paused back to every
    // client (including us), which drives the UI update via handleChatPaused.
    function handlePauseToggle() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'pause_chat', paused: !isChatPaused }));
        } else {
            alert('Reconnect to the live chat to pause or resume it.');
        }
    }

    function handleChatPaused(isPaused) {
        isChatPaused = isPaused;
        const input = document.getElementById('chat-message-input');
        const btn = document.getElementById('chat-send-btn');
        if (input && btn) {
            if (isPaused) {
                input.setAttribute('disabled', 'true');
                btn.setAttribute('disabled', 'true');
                input.placeholder = 'Chat has been paused by moderator';
            } else {
                input.removeAttribute('disabled');
                btn.removeAttribute('disabled');
                input.placeholder = 'Type a message...';
            }
        }
        // Keep the moderator's own toggle label/state in sync with the broadcast.
        const pauseBtn = document.getElementById('chat-pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = isPaused ? 'Resume Chat' : 'Pause Chat';
            pauseBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
        }
    }

    function handleSendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-message-input');
        const text = input.value.trim();
        if (!text) return;

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'post_message',
                text: text
            }));
            input.value = '';
            sessionStorage.removeItem('chat_unsent_input');
        } else {
            // In Polling/REST Fallback Mode or socket is disconnected
            postMessageREST(text);
            input.value = '';
            sessionStorage.removeItem('chat_unsent_input');
        }
    }

    // Send message via REST POST
    async function postMessageREST(text) {
        try {
            // Need CSRF token
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
                || document.querySelector('input[name="_csrf"]')?.value
                || '';
            const response = await fetch('/api/chat/post', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken
                },
                body: JSON.stringify({
                    streamId: streamId,
                    displayName: displayName,
                    messageText: text
                })
            });

            if (!response.ok) {
                throw new Error('Failed to post message');
            }

            const result = await response.json();
            if (result.success) {
                appendMessage(result.data, true);
            }
        } catch (err) {
            console.error('REST post message failed:', err);
            alert('Failed to send message due to connection issues.');
        }
    }

    // Polling fetch approved messages
    async function fetchMessagesPoll() {
        try {
            let url = `/api/chat/poll?streamId=${streamId}`;
            if (lastMessageTime) {
                url += `&since=${encodeURIComponent(lastMessageTime)}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error('Polling fetch error');

            const result = await response.json();
            if (result.success && result.data.length > 0) {
                result.data.forEach(msg => {
                    appendMessage(msg);
                });
            }
        } catch (e) {
            console.error('Error during REST polling:', e);
        }
    }

    async function fetchInitialMessages() {
        try {
            const response = await fetch(`/api/chat/poll?streamId=${streamId}`);
            if (!response.ok) throw new Error('Initial fetch error');

            const result = await response.json();
            if (result.success) {
                // Don't clear the container: any message broadcast that arrived between
                // socket.onopen and this fetch resolving could be wiped, and the fetch's
                // snapshot may not include it yet. appendMessage dedupes via msg-${id}.
                result.data.forEach(msg => {
                    appendMessage(msg);
                });
            }
        } catch (e) {
            console.error('Error fetching initial chat messages:', e);
        }
    }

    function appendMessage(msg, isLocalPostReceipt = false) {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        // Prevent duplicate rendering
        const existingEl = document.getElementById(`msg-${msg.id}`);
        if (existingEl) {
            // Update status if it changed from pending to approved
            if (msg.status === 'approved') {
                const statusTag = existingEl.querySelector('.message-status-tag');
                if (statusTag) statusTag.remove();
            }
            return;
        }

        // If it's a local post receipt and we already have the approved version, skip
        if (isLocalPostReceipt && postedMessageIds.has(msg.id)) return;
        if (isLocalPostReceipt) postedMessageIds.add(msg.id);

        // Keep track of the latest message timestamp to filter polling responses
        const msgTime = new Date(msg.created_at);
        if (!lastMessageTime || msgTime > new Date(lastMessageTime)) {
            lastMessageTime = msg.created_at;
        }

        const msgDiv = document.createElement('div');
        msgDiv.id = `msg-${msg.id}`;
        msgDiv.className = 'chat-message';
        
        // Add self or moderator visual identifiers
        if (isLoggedIn && String(msg.user_id) === String(chatPanel.getAttribute('data-current-user-id'))) {
            msgDiv.classList.add('self');
        } else if (!isLoggedIn && isLocalPostReceipt) {
            msgDiv.classList.add('self');
        }

        // Add moderator styling helper
        const isModRole = ['admin', 'rabbi', 'social_chair'].includes(msg.role || '');
        if (isModRole) {
            msgDiv.classList.add('moderator');
        }

        const timeStr = msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Guests (no user_id) are tagged so a guest can't pass as clergy/staff
        // (e.g. choosing the display name "Rabbi David") without it being visible.
        const guestBadge = !msg.user_id ? '<span class="message-guest-badge">Guest</span>' : '';

        msgDiv.innerHTML = `
            <div class="message-meta">
                <span class="message-author">${escapeHTML(msg.display_name)}</span>
                ${guestBadge}
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-text">${escapeHTML(msg.message_text)}</div>
            ${msg.status === 'pending' ? '<span class="message-status-tag">Pending approval</span>' : ''}
            ${msg.status === 'deleted' ? '<span class="message-status-tag message-status-tag--filtered">Held for review</span>' : ''}
        `;

        // Check if container was scrolled to the bottom before appending
        const shouldScroll = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;

        container.appendChild(msgDiv);

        if (shouldScroll) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function removeMessageFromUI(messageId) {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.remove();
        }
    }

    function toggleA11yAnnouncements() {
        isA11yActive = !isA11yActive;
        const btn = document.getElementById('chat-a11y-toggle');
        const container = document.getElementById('chat-messages-container');

        if (isA11yActive) {
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = 'Active (Polite)';
            container.setAttribute('aria-live', 'polite');
        } else {
            btn.setAttribute('aria-pressed', 'true');
            btn.textContent = 'Paused';
            container.setAttribute('aria-live', 'off');
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
