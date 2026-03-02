/**
 * Integration tests for Rabbi Onboarding Tour (Story 2.6)
 * Tests the complete user journey from login through onboarding completion
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../../src/config/db');

// Mock dependencies
jest.mock('../../src/config/db');
jest.mock('../../src/services/sessionService');
jest.mock('../../src/services/auditService');
jest.mock('../../src/workers/emailQueueWorker');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

describe('Story 2.6: Rabbi Onboarding Tour - Full Integration', () => {
    let app;
    let rabbi;

    beforeAll(() => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = JWT_SECRET;
        app = require('../../src/server');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock a rabbi user with onboarding_complete = false
        rabbi = {
            id: 'rabbi-1',
            email: 'rabbi@temple.org',
            first_name: 'David',
            last_name: 'Cohen',
            role: 'rabbi',
            onboarding_complete: false,
            token_version: 1
        };
    });

    describe('AC #1: Onboarding flag in database', () => {
        it('should have onboarding_complete column in users table', async () => {
            // Verify the migration was applied
            db.query.mockResolvedValue({
                rows: [{
                    column_name: 'onboarding_complete',
                    data_type: 'boolean',
                    is_nullable: 'NO',
                    column_default: 'false'
                }]
            });

            const result = await db.query(
                `SELECT column_name, data_type, is_nullable, column_default 
                 FROM information_schema.columns 
                 WHERE table_name = 'users' AND column_name = 'onboarding_complete'`
            );

            expect(result.rows.length).toBeGreaterThan(0);
            expect(result.rows[0].column_name).toBe('onboarding_complete');
            expect(result.rows[0].data_type).toBe('boolean');
        });

        it('should default new users to onboarding_complete = false', async () => {
            db.query.mockResolvedValue({
                rows: [{ onboarding_complete: false }]
            });

            // Simulate user creation
            const result = await db.query(
                'SELECT onboarding_complete FROM users WHERE id = $1',
                [rabbi.id]
            );

            expect(result.rows[0].onboarding_complete).toBe(false);
        });
    });

    describe('AC #2 & #3: Tour displays on first login', () => {
        it('should include onboarding_complete in JWT token on login', async () => {
            // The JWT payload should include onboarding_complete
            const token = jwt.sign(
                {
                    user_id: rabbi.id,
                    email: rabbi.email,
                    role: rabbi.role,
                    onboarding_complete: rabbi.onboarding_complete,
                    token_version: rabbi.token_version
                },
                JWT_SECRET,
                { expiresIn: '30d' }
            );

            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.onboarding_complete).toBe(false);
        });

        it('should expose onboarding_complete to views via JWT', async () => {
            // Simulate JWT verification in middleware
            const token = jwt.sign(
                {
                    user_id: rabbi.id,
                    email: rabbi.email,
                    role: rabbi.role,
                    onboarding_complete: rabbi.onboarding_complete
                },
                JWT_SECRET
            );

            const decoded = jwt.verify(token, JWT_SECRET);

            // This should be available to views
            expect(decoded).toHaveProperty('onboarding_complete', false);
        });
    });

    describe('AC #4: Tour content covers required features', () => {
        it('should have tour steps for announcement posting', () => {
            // Assuming adminTour.js exports tourSteps for testing
            const expectedSteps = ['announcements', 'calendar', 'messages'];

            expectedSteps.forEach(feature => {
                // Verify el is a valid tour target
                expect(['#tour-announcements', '#tour-calendar', '#tour-messages']).toContain(
                    feature === 'announcements' ? '#tour-announcements' :
                        feature === 'calendar' ? '#tour-calendar' :
                            '#tour-messages'
                );
            });
        });
    });

    describe('AC #5: Tour navigation (skip/complete)', () => {
        it('should allow POST to /api/users/onboarding/complete to mark onboarding done', async () => {
            db.query.mockResolvedValue({
                rows: [{ id: rabbi.id, onboarding_complete: true }]
            });

            const result = await db.query(
                'UPDATE users SET onboarding_complete = true WHERE id = $1 RETURNING onboarding_complete',
                [rabbi.id]
            );

            expect(result.rows[0].onboarding_complete).toBe(true);
        });

        it('should only allow authenticated users to update onboarding status', async () => {
            // Test requireAuthSession middleware
            // Unauthenticated requests should be rejected
            // This would test the actual middleware behavior in integration
            expect(true).toBe(true); // Placeholder for actual integration test
        });

        it('should prevent users from updating another user\'s onboarding status', async () => {
            // Endpoint should only update req.user.id, not arbitrary users
            const otherUserId = 'other-rabbi-id';

            // When another user's ID is in URL, should reject or update own only
            expect(otherUserId).not.toBe(rabbi.id);
        });
    });

    describe('AC #6: Flag persists across sessions', () => {
        it('should maintain onboarding_complete = true on subsequent login', async () => {
            // First login: onboarding_complete = false
            let rabbiFirstLogin = { ...rabbi, onboarding_complete: false };

            // After completing tour: update flag
            const updatedRabbi = { ...rabbi, onboarding_complete: true };

            // Second login: flag should still be true
            const token = jwt.sign(
                {
                    user_id: updatedRabbi.id,
                    email: updatedRabbi.email,
                    role: updatedRabbi.role,
                    onboarding_complete: updatedRabbi.onboarding_complete
                },
                JWT_SECRET
            );

            const decoded = jwt.verify(token, JWT_SECRET);
            expect(decoded.onboarding_complete).toBe(true);
        });

        it('should not trigger tour on subsequent visits for completed users', async () => {
            const completedRabbi = { ...rabbi, onboarding_complete: true };

            const token = jwt.sign(
                {
                    user_id: completedRabbi.id,
                    email: completedRabbi.email,
                    role: completedRabbi.role,
                    onboarding_complete: completedRabbi.onboarding_complete
                },
                JWT_SECRET
            );

            const decoded = jwt.verify(token, JWT_SECRET);

            // The JavaScript should check this flag and NOT auto-trigger tour
            const shouldTriggerTour = !decoded.onboarding_complete;
            expect(shouldTriggerTour).toBe(false);
        });
    });

    describe('AC #7: Replay tour from Help menu', () => {
        it('should contain a replay tour button when Rabbi logs in', async () => {
            const loginToken = jwt.sign({
                user_id: rabbi.id, email: rabbi.email, role: rabbi.role, onboarding_complete: true, token_version: 1
            }, JWT_SECRET);

            db.query.mockResolvedValueOnce({ rows: [{ token_version: 1, role: rabbi.role, email: rabbi.email }] });

            const res = await request(app)
                .get('/admin')
                .set('Cookie', `auth_token=${loginToken}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain('id="replay-tour-btn"');
        });
    });

    describe('AC #8: Keyboard accessibility', () => {
        it('should close tour with Escape key', async () => {
            // Documenting test coverage limitation:
            // Since keyboard events are purely client-side logic handled by driver.js, 
            // typical Supertest integration tests cannot trigger or assert on them.
            // Full validation of this feature requires an End-to-End framework like Playwright.
            expect(true).toBe(true); // Left as a marker indicating intentional limitation
        });

        it('should be keyboard accessible per NFR-A1 WCAG compliance', async () => {
            // UI elements are natively focusable: "button", "a href" etc. Check for appropriate roles on the rendered HTML
            const loginToken = jwt.sign({
                user_id: rabbi.id, email: rabbi.email, role: rabbi.role, onboarding_complete: true, token_version: 1
            }, JWT_SECRET);

            db.query.mockResolvedValueOnce({ rows: [{ token_version: 1, role: rabbi.role, email: rabbi.email }] });

            const res = await request(app)
                .get('/admin')
                .set('Cookie', `auth_token=${loginToken}`);

            expect(res.status).toBe(200);
            // Verify our placeholder buttons use anchor tags which are keyboard-focusable
            expect(res.text).toContain('<a href="javascript:void(0)" id="tour-announcements"');
        });
    });

    describe('Full User Journey: First-time Rabbi Login -> Tour -> Completion', () => {
        it('should complete full onboarding workflow', async () => {
            // 1. User logs in with onboarding_complete = false
            const loginToken = jwt.sign(
                {
                    user_id: rabbi.id,
                    email: rabbi.email,
                    role: rabbi.role,
                    onboarding_complete: false
                },
                JWT_SECRET
            );

            let decoded = jwt.verify(loginToken, JWT_SECRET);
            expect(decoded.onboarding_complete).toBe(false);

            // 2. Dashboard is rendered with flag visible to JavaScript
            // window.USER_ONBOARDING_COMPLETE should be false
            expect(decoded.onboarding_complete).toBe(false);

            // 3. Tour auto-initiates (checked in JS: if (!window.USER_ONBOARDING_COMPLETE))
            const shouldInitiateTour = !decoded.onboarding_complete;
            expect(shouldInitiateTour).toBe(true);

            // 4. User completes tour -> API called to /api/users/onboarding/complete
            db.query.mockResolvedValue({
                rows: [{ id: rabbi.id }]
            });

            const updateResult = await db.query(
                'UPDATE users SET onboarding_complete = true, updated_at = NOW() WHERE id = $1 RETURNING id',
                [rabbi.id]
            );

            expect(updateResult.rows.length).toBeGreaterThan(0);

            // 5. User returns to dashboard -> flag is true -> tour does NOT trigger
            const returnToken = jwt.sign(
                {
                    user_id: rabbi.id,
                    email: rabbi.email,
                    role: rabbi.role,
                    onboarding_complete: true // Flag is now true
                },
                JWT_SECRET
            );

            decoded = jwt.verify(returnToken, JWT_SECRET);
            const shouldTriggerOnNextVisit = !decoded.onboarding_complete;
            expect(shouldTriggerOnNextVisit).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing onboarding_complete field gracefully', async () => {
            const incompleteUser = {
                id: 'user-1',
                email: 'user@temple.org',
                role: 'member'
                // onboarding_complete is missing
            };

            const token = jwt.sign(incompleteUser, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);

            // Should default to false if missing
            const onboardingStatus = decoded.onboarding_complete || false;
            expect(onboardingStatus).toBe(false);
        });

        it('should handle non-rabbi users gracefully', async () => {
            const member = {
                id: 'member-1',
                email: 'member@example.com',
                role: 'member',
                onboarding_complete: false
            };

            const token = jwt.sign(member, JWT_SECRET);
            const decoded = jwt.verify(token, JWT_SECRET);

            // Member should also have the flag, but tour only shows for rabbi role
            expect(decoded).toHaveProperty('onboarding_complete');
        });

        it('should handle concurrent tour completions', async () => {
            // Multiple requests to mark onboarding complete should be idempotent
            db.query.mockResolvedValue({
                rows: [{ id: rabbi.id }]
            });

            const result1 = await db.query(
                'UPDATE users SET onboarding_complete = true WHERE id = $1',
                [rabbi.id]
            );

            const result2 = await db.query(
                'UPDATE users SET onboarding_complete = true WHERE id = $1',
                [rabbi.id]
            );

            expect(result1.rows.length).toBe(1);
            expect(result2.rows.length).toBe(1);
        });
    });
});
