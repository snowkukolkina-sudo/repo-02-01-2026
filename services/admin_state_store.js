const path = require('path');
const fs = require('fs-extra');

const defaultState = require('../config/admin-default-state.json');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'admin');
const STATE_FILE = path.join(STORAGE_DIR, 'state.json');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergeWithDefault(state = {}) {
    const merged = clone(defaultState);
    Object.keys(state || {}).forEach((key) => {
        merged[key] = state[key];
    });
    return merged;
}

async function ensureState() {
    await fs.ensureDir(STORAGE_DIR);
    if (!(await fs.pathExists(STATE_FILE))) {
        const initial = clone(defaultState);
        await fs.writeJson(STATE_FILE, initial, { spaces: 2 });
        return initial;
    }
    const data = await fs.readJson(STATE_FILE);
    return mergeWithDefault(data);
}

async function saveState(state) {
    await fs.writeJson(STATE_FILE, state, { spaces: 2 });
    return state;
}

function sanitizeKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized || !/^[a-zA-Z0-9_-]+$/.test(normalized)) {
        throw new Error('Недопустимое имя ключа');
    }
    return normalized;
}

async function getState() {
    return ensureState();
}

async function getKey(key) {
    const safeKey = sanitizeKey(key);
    const state = await ensureState();
    if (typeof state[safeKey] === 'undefined') {
        const defaults = mergeWithDefault({});
        return typeof defaults[safeKey] === 'undefined' ? null : defaults[safeKey];
    }
    return state[safeKey];
}

async function setKey(key, value) {
    const safeKey = sanitizeKey(key);
    const state = await ensureState();
    state[safeKey] = clone(value);
    await saveState(state);
    return state[safeKey];
}

module.exports = {
    getState,
    getKey,
    setKey
};

