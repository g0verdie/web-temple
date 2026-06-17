/** @jest-environment jsdom */

// Client-side coverage for the live-chat WebSocket -> polling fallback state
// machine, manual reconnect, and the moderator pause control. live-chat.js is
// an IIFE that runs on require and reads #live-chat-panel at eval time, so each
// test sets up the DOM, then requires the module fresh (jest.resetModules()).

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = global.TextEncoder || TextEncoder;
global.TextDecoder = global.TextDecoder || TextDecoder;
const { axe, toHaveNoViolations } = require('jest-axe');
expect.extend(toHaveNoViolations);

class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = MockWebSocket.CONNECTING;
        this.sent = [];
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        MockWebSocket.instances.push(this);
    }
    send(data) { this.sent.push(data); }
    close() { this.readyState = MockWebSocket.CLOSED; }

    // Test helpers
    static get last() { return MockWebSocket.instances[MockWebSocket.instances.length - 1]; }
    _open() {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) this.onopen();
    }
    _failClose() {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose({ wasClean: false });
    }
    _emit(obj) {
        if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
    }
}
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

const PANEL = (role) => `
    <div id="live-chat-panel"
         data-stream-id="10"
         data-logged-in="true"
         data-current-user-id="u1"
         data-role="${role}"></div>
`;

const loadModule = () => {
    jest.isolateModules(() => {
        require('../../public/js/live-chat.js');
    });
};

// Drive the reconnect loop to exhaustion (3 attempts) so it falls back to polling.
const exhaustReconnects = () => {
    // Initial socket failed by caller; then 3 scheduled reconnects each fail.
    [2000, 5000, 10000].forEach((delay) => {
        jest.advanceTimersByTime(delay);
        MockWebSocket.last._failClose();
    });
};

describe('live-chat client behavior', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        // Pin reconnect jitter to 0 so the fixed-interval reconnect tests stay
        // deterministic; the jitter test overrides this per-case.
        jest.spyOn(Math, 'random').mockReturnValue(0);
        MockWebSocket.instances = [];
        global.WebSocket = MockWebSocket;
        global.alert = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: [] })
        });
        document.body.innerHTML = '';
        window.sessionStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllMocks();
        jest.restoreAllMocks();
        delete global.WebSocket;
        delete global.fetch;
        delete global.alert;
    });

    it('opens a WebSocket on load for a logged-in viewer', () => {
        document.body.innerHTML = PANEL('member');
        loadModule();

        expect(MockWebSocket.instances).toHaveLength(1);
        expect(MockWebSocket.last.url).toContain('/ws/chat?streamId=10');
    });

    it('falls back to polling after 3 failed reconnect attempts', () => {
        document.body.innerHTML = PANEL('member');
        loadModule();

        // Fail the initial connection, then exhaust the 3 backoff reconnects.
        MockWebSocket.last._failClose();
        exhaustReconnects();

        const banner = document.getElementById('chat-slow-banner');
        expect(banner.style.display).toBe('block');
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/chat/poll?streamId=10'));

        // The 3s poll interval keeps fetching.
        const callsAfterSwitch = global.fetch.mock.calls.length;
        jest.advanceTimersByTime(3000);
        expect(global.fetch.mock.calls.length).toBe(callsAfterSwitch + 1);
    });

    it('adds randomized jitter to the reconnect backoff to avoid a thundering herd', () => {
        // 0.5 * 1000ms jitter = +500ms, so the first reconnect fires at 2500ms, not 2000ms.
        Math.random.mockReturnValue(0.5);
        document.body.innerHTML = PANEL('member');
        loadModule();

        MockWebSocket.last._failClose();

        jest.advanceTimersByTime(2000);
        expect(MockWebSocket.instances).toHaveLength(1); // base interval alone does not fire

        jest.advanceTimersByTime(500);
        expect(MockWebSocket.instances).toHaveLength(2); // jittered delay fires the reconnect
    });

    it('manual reconnect leaves polling mode and reopens a WebSocket', () => {
        document.body.innerHTML = PANEL('member');
        loadModule();

        MockWebSocket.last._failClose();
        exhaustReconnects();
        expect(document.getElementById('chat-slow-banner').style.display).toBe('block');

        const countBeforeReconnect = MockWebSocket.instances.length;
        document.getElementById('chat-reconnect-btn').click();

        expect(MockWebSocket.instances.length).toBe(countBeforeReconnect + 1);
        expect(document.getElementById('chat-slow-banner').style.display).toBe('none');
    });

    it('renders a moderator pause control and sends pause_chat over the socket', () => {
        document.body.innerHTML = PANEL('rabbi');
        loadModule();

        MockWebSocket.last._open();

        const pauseBtn = document.getElementById('chat-pause-btn');
        expect(pauseBtn).not.toBeNull();

        pauseBtn.click();

        const sentPause = MockWebSocket.last.sent
            .map((s) => JSON.parse(s))
            .find((p) => p.type === 'pause_chat');
        expect(sentPause).toEqual({ type: 'pause_chat', paused: true });

        // Server echoes chat_paused to everyone; the toggle reflects the state.
        MockWebSocket.last._emit({ type: 'chat_paused', data: { paused: true } });
        expect(pauseBtn.textContent).toContain('Resume');
        expect(document.getElementById('chat-message-input').getAttribute('disabled')).toBe('true');
    });

    it('does not render the pause control for non-moderator viewers', () => {
        document.body.innerHTML = PANEL('member');
        loadModule();

        expect(document.getElementById('chat-pause-btn')).toBeNull();
    });

    it('tags guest-authored messages with a Guest badge but not authenticated ones', () => {
        document.body.innerHTML = PANEL('member');
        loadModule();
        MockWebSocket.last._open();

        MockWebSocket.last._emit({ type: 'message_approved', data: { id: 501, display_name: 'Rabbi David', message_text: 'hi', status: 'approved', user_id: null, created_at: '2026-06-14T12:00:00Z' } });
        MockWebSocket.last._emit({ type: 'message_approved', data: { id: 502, display_name: 'Real Member', message_text: 'hello', status: 'approved', user_id: 'u-9', created_at: '2026-06-14T12:01:00Z' } });

        const guestMsg = document.getElementById('msg-501');
        const authMsg = document.getElementById('msg-502');
        expect(guestMsg.querySelector('.message-guest-badge')).not.toBeNull();
        expect(guestMsg.querySelector('.message-guest-badge').textContent).toBe('Guest');
        expect(authMsg.querySelector('.message-guest-badge')).toBeNull();
    });

    it('never applies moderator styling from a message payload role (defends against forged role)', () => {
        document.body.innerHTML = PANEL('member');
        loadModule();
        MockWebSocket.last._open();

        // A guest message that smuggles a role field must NOT be styled as a moderator.
        MockWebSocket.last._emit({ type: 'message_approved', data: { id: 601, display_name: 'Sneaky', message_text: 'hi', status: 'approved', user_id: null, role: 'rabbi', created_at: '2026-06-14T12:00:00Z' } });

        const msg = document.getElementById('msg-601');
        expect(msg.classList.contains('moderator')).toBe(false);
        // The guest badge is still shown — unmistakably a guest.
        expect(msg.querySelector('.message-guest-badge').textContent).toBe('Guest');
    });

    it('the rendered moderator chat UI has no WCAG AA violations', async () => {
        document.body.innerHTML = PANEL('rabbi');
        loadModule();
        MockWebSocket.last._open();

        // axe-core uses real timers internally; the chat UI is fully rendered by now.
        jest.useRealTimers();
        const results = await axe(document.getElementById('live-chat-panel'), {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
        });
        expect(results).toHaveNoViolations();
    });
});
