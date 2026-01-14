const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');

const CONFIG_DIR = path.join(process.cwd(), 'config');
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const USERS_FILE = path.join(CONFIG_DIR, 'auth-users.json');
const SESSIONS_FILE = path.join(STORAGE_DIR, 'auth-sessions.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 часов

async function ensureSessionsFile() {
    await fs.ensureDir(STORAGE_DIR);
    if (!(await fs.pathExists(SESSIONS_FILE))) {
        await fs.writeJson(SESSIONS_FILE, {}, { spaces: 2 });
    }
}

async function readUsers() {
    try {
        const users = await fs.readJson(USERS_FILE);
        return Array.isArray(users) ? users : [];
    } catch (error) {
        console.warn('[auth] Не удалось загрузить auth-users.json', error);
        return [];
    }
}

async function readSessions() {
    await ensureSessionsFile();
    try {
        const sessions = await fs.readJson(SESSIONS_FILE);
        return sessions && typeof sessions === 'object' ? sessions : {};
    } catch (error) {
        console.warn('[auth] Не удалось прочитать auth-sessions.json', error);
        return {};
    }
}

async function writeSessions(sessions) {
    await ensureSessionsFile();
    await fs.writeJson(SESSIONS_FILE, sessions, { spaces: 2 });
}

function sanitizeUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
        role: user.role || 'viewer'
    };
}

function safeCompare(a = '', b = '') {
    const bufferA = Buffer.from(String(a));
    const bufferB = Buffer.from(String(b));
    if (bufferA.length !== bufferB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufferA, bufferB);
}

function hashPassword(password, salt) {
    return crypto
        .pbkdf2Sync(password, salt, 20000, 64, 'sha512')
        .toString('hex');
}

function verifyPassword(user, password) {
    if (!password) return false;
    if (user.password_hash && user.password_salt) {
        const hashed = hashPassword(password, user.password_salt);
        return safeCompare(hashed, user.password_hash);
    }
    if (user.password) {
        return safeCompare(user.password, password);
    }
    return false;
}

async function findUserByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    const users = await readUsers();
    return users.find((user) => String(user.email || '').toLowerCase() === normalized) || null;
}

async function getUserById(id) {
    if (!id) return null;
    const users = await readUsers();
    return users.find((user) => user.id === id) || null;
}

function generateToken() {
    return crypto.randomBytes(48).toString('hex');
}

async function createSession(user) {
    const sessions = await readSessions();
    const token = generateToken();
    const now = Date.now();
    const session = {
        token,
        user_id: user.id,
        role: user.role,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + SESSION_TTL_MS).toISOString()
    };
    sessions[token] = session;
    await writeSessions(sessions);
    return { token, session };
}

async function purgeExpiredSessions(sessions) {
    const now = Date.now();
    let mutated = false;
    Object.entries(sessions).forEach(([token, entry]) => {
        if (!entry.expires_at || new Date(entry.expires_at).getTime() <= now) {
            delete sessions[token];
            mutated = true;
        }
    });
    if (mutated) {
        await writeSessions(sessions);
    }
}

async function getSession(token) {
    if (!token) return null;
    const sessions = await readSessions();
    await purgeExpiredSessions(sessions);
    const entry = sessions[token];
    if (!entry) {
        return null;
    }
    const now = Date.now();
    if (!entry.expires_at || new Date(entry.expires_at).getTime() <= now) {
        delete sessions[token];
        await writeSessions(sessions);
        return null;
    }
    const user = await getUserById(entry.user_id);
    if (!user) {
        delete sessions[token];
        await writeSessions(sessions);
        return null;
    }
    return {
        token,
        user: sanitizeUser(user),
        session: entry
    };
}

async function invalidateSession(token) {
    if (!token) return;
    const sessions = await readSessions();
    if (sessions[token]) {
        delete sessions[token];
        await writeSessions(sessions);
    }
}

async function login(email, password) {
    const user = await findUserByEmail(email);
    if (!user || !verifyPassword(user, password)) {
        return null;
    }
    const { token, session } = await createSession(user);
    return {
        token,
        user: sanitizeUser(user),
        session
    };
}

async function logout(token) {
    await invalidateSession(token);
}

module.exports = {
    login,
    logout,
    getSession,
    sanitizeUser,
    verifyPassword
};

