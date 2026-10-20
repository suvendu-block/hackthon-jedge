import { test, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_API_URL || 'http://localhost:3000/api';
const stamp = Date.now();   // unique emails so re-runs don't collide

// helper: call the API
const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
};

// fail fast with a clear message if server isn't running
before(async () => {
    const { status } = await api('/health').catch(() => ({ status: 0 }));
    if (status !== 200) {
        throw new Error(`Server not reachable at ${BASE} — start it first: npm run dev`);
    }
});

const validUser = () => ({
    name: 'Test User',
    email: `test+${stamp}@example.com`,
    password: 'password123',
    role: 'organizer'
});

// REGISTER 
test('register: creates user and returns token', async () => {
    const { status, data } = await api('/auth/register', {
        method: 'POST', body: validUser()
    });
    assert.equal(status, 201);
    assert.ok(data.token, 'token must be returned');
    assert.equal(data.email, `test+${stamp}@example.com`);
    assert.equal(data.role, 'organizer');
    assert.equal(data.password, undefined, 'password must NEVER be in response');
    assert.equal(data.passwordHash, undefined, 'hash must NEVER be in response');
});

test('register: duplicate email rejected', async () => {
    await api('/auth/register', { method: 'POST', body: validUser() }); // 1st: ok
    const { status, data } = await api('/auth/register', {
        method: 'POST', body: validUser()
    }); // 2nd: duplicate
    assert.equal(status, 400);
    assert.equal(data.error.code, 'Email Already Taken');
});

test('register: short password rejected', async () => {
    const { status, data } = await api('/auth/register', {
        method: 'POST', body: { ...validUser(), password: '123' }
    });
    assert.equal(status, 400);
    assert.match(data.error.message, /at least 8/i);
});

test('register: missing fields rejected', async () => {
    const { status, data } = await api('/auth/register', {
        method: 'POST', body: { email: `x+${stamp}@example.com` }
    });
    assert.equal(status, 400);
    assert.equal(data.error.code, 'MISSING FIELDS');
});

// LOGIN 
test('login: correct credentials return token', async () => {
    await api('/auth/register', { method: 'POST', body: validUser() });
    const { status, data } = await api('/auth/login', {
        method: 'POST',
        body: { email: validUser().email, password: 'password123' }
    });
    assert.equal(status, 200);
    assert.ok(data.token);
    assert.equal(data.password, undefined);
});

test('login: wrong password → 401', async () => {
    await api('/auth/register', { method: 'POST', body: validUser() });
    const { status, data } = await api('/auth/login', {
        method: 'POST',
        body: { email: validUser().email, password: 'wrongpassword' }
    });
    assert.equal(status, 401);
    assert.equal(data.error.code, 'Invalid Credentials');
});

test('login: unknown email → 401 (same message, no user enumeration)', async () => {
    const { status, data } = await api('/auth/login', {
        method: 'POST',
        body: { email: `nobody+${stamp}@example.com`, password: 'password123' }
    });
    assert.equal(status, 401);
    assert.equal(data.error.code, 'Invalid Credentials');
});

// PROTECTED ROUTE 
test('me: no token → 401', async () => {
    const { status } = await api('/auth/me');
    assert.equal(status, 401);
});

test('me: garbage token → 401', async () => {
    const { status } = await api('/auth/me', { token: 'not.a.jwt' });
    assert.equal(status, 401);
});

test('me: valid token returns the logged-in user', async () => {
    await api('/auth/register', { method: 'POST', body: validUser() });
    const { data: loginData } = await api('/auth/login', {
        method: 'POST',
        body: { email: validUser().email, password: 'password123' }
    });
    const { status, data } = await api('/auth/me', { token: loginData.token });
    assert.equal(status, 200);
    assert.equal(data.email, validUser().email);
    assert.equal(data.passwordHash, undefined, 'no hash leaked');
});

//LOGOUT 
test('logout: protected → 200', async () => {
    await api('/auth/register', { method: 'POST', body: validUser() });
    const { data: loginData } = await api('/auth/login', {
        method: 'POST',
        body: { email: validUser().email, password: 'password123' }
    });
    const { status } = await api('/auth/logout', {
        method: 'POST', token: loginData.token
    });
    assert.equal(status, 200);
});

test('logout: without token → 401', async () => {
    const { status } = await api('/auth/logout', { method: 'POST' });
    assert.equal(status, 401);
});
