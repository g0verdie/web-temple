const {
    AppError,
    ValidationError,
    NotFoundError,
    AuthError,
    ProviderError,
    InternalError,
    mapError,
    GENERIC_ERROR_MESSAGE
} = require('../../src/errors');

describe('AppError hierarchy (R1-R4)', () => {
    it('base AppError carries name, statusCode, clientMessage, expose and captures a stack', () => {
        const err = new AppError('internal detail', {
            statusCode: 500,
            clientMessage: 'safe',
            expose: false,
            details: { foo: 1 }
        });
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('AppError');
        expect(err.statusCode).toBe(500);
        expect(err.clientMessage).toBe('safe');
        expect(err.expose).toBe(false);
        expect(err.details).toEqual({ foo: 1 });
        expect(typeof err.stack).toBe('string');
        expect(err.message).toBe('internal detail');
    });

    it('ValidationError maps to 400 and exposes its message (RESOLVED: 400 not 422)', () => {
        const err = new ValidationError('Title is required');
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(400);
        expect(err.expose).toBe(true);
        expect(err.clientMessage).toBe('Title is required');
        expect(err.name).toBe('ValidationError');
    });

    it('NotFoundError maps to 404 and exposes its message', () => {
        const err = new NotFoundError('User not found');
        expect(err.statusCode).toBe(404);
        expect(err.expose).toBe(true);
        expect(err.clientMessage).toBe('User not found');
    });

    it('AuthError defaults to 401 and supports 403 via a status option (R3)', () => {
        const unauth = new AuthError('Invalid email or password');
        expect(unauth.statusCode).toBe(401);
        expect(unauth.expose).toBe(true);
        expect(unauth.clientMessage).toBe('Invalid email or password');

        const forbidden = new AuthError('Access denied', { statusCode: 403 });
        expect(forbidden.statusCode).toBe(403);
    });

    it('ProviderError maps to 502 (R14 / AE5)', () => {
        const err = new ProviderError('Payment provider is unavailable');
        expect(err.statusCode).toBe(502);
        expect(err.expose).toBe(true);
        expect(err.clientMessage).toBe('Payment provider is unavailable');
    });

    it('InternalError maps to 500 and does NOT expose its message', () => {
        const err = new InternalError('pg_dump failed: /secret/path');
        expect(err.statusCode).toBe(500);
        expect(err.expose).toBe(false);
        expect(err.clientMessage).toBe(GENERIC_ERROR_MESSAGE);
        // internal message retained for logging
        expect(err.message).toBe('pg_dump failed: /secret/path');
    });

    it('separates internal detail from the client-safe message (R4)', () => {
        const err = new ValidationError('Bio must be 500 characters or fewer', {
            details: { field: 'bio', length: 900 }
        });
        expect(err.clientMessage).toBe('Bio must be 500 characters or fewer');
        expect(err.details).toEqual({ field: 'bio', length: 900 });
    });
});

describe('mapError central mapping (R5)', () => {
    it('maps a ValidationError by its own fields', () => {
        expect(mapError(new ValidationError('bad input'))).toEqual({
            statusCode: 400,
            clientMessage: 'bad input',
            expose: true
        });
    });

    it('maps a NotFoundError to 404 with its safe message', () => {
        expect(mapError(new NotFoundError('User not found'))).toEqual({
            statusCode: 404,
            clientMessage: 'User not found',
            expose: true
        });
    });

    it('maps a ProviderError to 502 (AE5)', () => {
        const mapped = mapError(new ProviderError('Provider down'));
        expect(mapped.statusCode).toBe(502);
        expect(mapped.clientMessage).toBe('Provider down');
    });

    it('maps a bare Error to 500 with a generic message and expose:false (AE2)', () => {
        const mapped = mapError(new Error('pg_dump failed: /secret/path'));
        expect(mapped).toEqual({
            statusCode: 500,
            clientMessage: GENERIC_ERROR_MESSAGE,
            expose: false
        });
    });

    it('never leaks a non-exposed AppError clientMessage', () => {
        const err = new InternalError('sensitive internals', { clientMessage: 'still sensitive' });
        const mapped = mapError(err);
        expect(mapped.statusCode).toBe(500);
        expect(mapped.expose).toBe(false);
        expect(mapped.clientMessage).toBe(GENERIC_ERROR_MESSAGE);
    });

    it('maps null / undefined thrown values safely to 500 generic', () => {
        expect(mapError(null).statusCode).toBe(500);
        expect(mapError(undefined).clientMessage).toBe(GENERIC_ERROR_MESSAGE);
    });
});
