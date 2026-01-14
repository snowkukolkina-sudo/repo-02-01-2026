const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const STORAGE_ROOT = process.env.IMPORT_STORAGE_PATH || path.join(process.cwd(), 'storage', 'imports');

async function ensureStorage() {
    await fs.ensureDir(STORAGE_ROOT);
}

async function createJob(metadata = {}) {
    const id = uuidv4();
    const jobDir = path.join(STORAGE_ROOT, id);
    await fs.ensureDir(jobDir);

    const meta = {
        id,
        createdAt: new Date().toISOString(),
        ...metadata
    };

    await fs.writeJson(path.join(jobDir, 'meta.json'), meta, { spaces: 2 });

    return { id, jobDir, meta };
}

async function getJobDir(jobId) {
    const jobDir = path.join(STORAGE_ROOT, jobId);
    const exists = await fs.pathExists(jobDir);
    return exists ? jobDir : null;
}

async function saveOriginalFile(jobDir, buffer, originalName) {
    const filename = originalName || 'upload.bin';
    const filePath = path.join(jobDir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
}

async function writeResult(jobDir, payload) {
    await fs.writeJson(path.join(jobDir, 'result.json'), payload, { spaces: 2 });
}

async function writePublishResult(jobDir, payload) {
    await fs.writeJson(path.join(jobDir, 'publish.json'), payload, { spaces: 2 });
}

async function writeMetrics(jobDir, metrics) {
    if (!metrics) return;
    await fs.writeJson(path.join(jobDir, 'metrics.json'), metrics, { spaces: 2 });
}

async function readMetrics(jobDir) {
    const filePath = path.join(jobDir, 'metrics.json');
    const exists = await fs.pathExists(filePath);
    if (!exists) return null;
    return fs.readJson(filePath);
}

async function writeMatches(jobDir, matches) {
    if (!matches) return;
    await fs.writeJson(path.join(jobDir, 'matches.json'), matches, { spaces: 2 });
}

async function readMatches(jobDir) {
    const filePath = path.join(jobDir, 'matches.json');
    const exists = await fs.pathExists(filePath);
    if (!exists) return null;
    return fs.readJson(filePath);
}

async function readResult(jobDir) {
    const filePath = path.join(jobDir, 'result.json');
    const exists = await fs.pathExists(filePath);
    if (!exists) return null;
    return fs.readJson(filePath);
}

async function appendLog(jobDir, entry) {
    const logPath = path.join(jobDir, 'log.json');
    const exists = await fs.pathExists(logPath);
    const logs = exists ? await fs.readJson(logPath) : [];
    const record = {
        timestamp: new Date().toISOString(),
        ...entry
    };
    logs.push(record);
    await fs.writeJson(logPath, logs, { spaces: 2 });
    return logs;
}

async function readLog(jobDir) {
    const logPath = path.join(jobDir, 'log.json');
    const exists = await fs.pathExists(logPath);
    if (!exists) return [];
    return fs.readJson(logPath);
}

module.exports = {
    ensureStorage,
    createJob,
    getJobDir,
    saveOriginalFile,
    writeResult,
    writePublishResult,
    writeMetrics,
    readMetrics,
    writeMatches,
    readMatches,
    readResult,
    appendLog,
    readLog,
    STORAGE_ROOT
};

