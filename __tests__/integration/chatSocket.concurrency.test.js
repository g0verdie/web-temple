process.env.JWT_SECRET = 'test-jwt-secret';

// Concurrency / capacity evidence for the live chat WebSocket using the REAL
// `ws` library (this file intentionally does NOT jest.mock('ws')) against a
// real http.Server on an ephemeral port. db and ChatService are stubbed so no
// Postgres/Redis is needed. This is the automated stand-in for the PRD's
// "live chat stable with 15+ concurrent users" launch criterion and proves the
// connection-cap TOCTOU fix holds under genuinely concurrent handshakes.

const http = require('http');
const WebSocket = require('ws');

jest.mock('../../src/config/db', () => ({
    query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('../../src/services/ChatService', () => ({
    createMessage: jest.fn().mockResolvedValue({
        id: 1, stream_id: 1, display_name: 'Guest', message_text: 'shalom',
        status: 'approved', user_id: null, created_at: new Date().toISOString(),
    }),
    approveMessage: jest.fn(),
    deleteMessage: jest.fn(),
    containsReservedName: (displayName) => {
        const lower = String(displayName).toLowerCase();
        return ['rabbi', 'cantor', 'admin', 'moderator'].some((w) => lower.includes(w));
    },
}));

const chatSocketServer = require('../../src/services/chatSocketServer');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, timeout = 3000) => {
    const start = Date.now();
    while (!fn()) {
        if (Date.now() - start > timeout) throw new Error('waitFor timed out');
        await wait(10);
    }
};

describe('Chat WebSocket concurrency (real ws)', () => {
    let server;
    let port;

    beforeAll((done) => {
        server = http.createServer();
        chatSocketServer.initChatSocketServer(server);
        server.listen(0, '127.0.0.1', () => {
            port = server.address().port;
            done();
        });
    });

    afterEach(() => {
        chatSocketServer.closeAllConnections();
    });

    afterAll((done) => {
        chatSocketServer.closeAllConnections();
        server.close(done);
    });

    const connect = (streamId, name) => new Promise((resolve, reject) => {
        const c = new WebSocket(
            `ws://127.0.0.1:${port}/ws/chat?streamId=${streamId}&guestName=${encodeURIComponent(name)}`
        );
        c.on('open', () => resolve(c));
        c.on('unexpected-response', (_req, res) => {
            c.terminate();
            reject(new Error(`HTTP ${res.statusCode}`));
        });
        c.on('error', (err) => {
            c.terminate();
            reject(err);
        });
    });

    it('admits exactly 50 of 65 concurrent upgrades — cap never exceeded under load', async () => {
        const attempts = 65;
        const results = await Promise.allSettled(
            Array.from({ length: attempts }, (_, i) => connect(101, `g${i}`))
        );
        const opened = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(opened.length).toBe(50);
        expect(rejected.length).toBe(attempts - 50);
        expect(chatSocketServer.getActiveConnectionCount(101)).toBe(50);

        opened.forEach((r) => r.value.close());
        await waitFor(() => chatSocketServer.getActiveConnectionCount(101) === 0);
    }, 20000);

    it('fans an approved message out to 20 concurrent clients on the same stream', async () => {
        const N = 20;
        const sockets = await Promise.all(
            Array.from({ length: N }, (_, i) => connect(102, `g${i}`))
        );
        expect(chatSocketServer.getActiveConnectionCount(102)).toBe(N);

        const approvedSeen = sockets.map((s) => new Promise((resolve) => {
            s.on('message', (data) => {
                const p = JSON.parse(data.toString());
                if (p.type === 'message_approved') resolve(true);
            });
        }));

        sockets[0].send(JSON.stringify({ type: 'post_message', text: 'shalom' }));

        const got = await Promise.all(
            approvedSeen.map((p) => Promise.race([p, wait(3000).then(() => false)]))
        );
        expect(got.every(Boolean)).toBe(true);

        sockets.forEach((s) => s.close());
        await waitFor(() => chatSocketServer.getActiveConnectionCount(102) === 0);
    }, 20000);

    it('cleans up the connection set after concurrent clients disconnect', async () => {
        const sockets = await Promise.all(
            Array.from({ length: 15 }, (_, i) => connect(103, `g${i}`))
        );
        expect(chatSocketServer.getActiveConnectionCount(103)).toBe(15);

        sockets.forEach((s) => s.close());
        await waitFor(() => chatSocketServer.getActiveConnectionCount(103) === 0);
        expect(chatSocketServer.getActiveConnectionCount(103)).toBe(0);
    }, 20000);
});
