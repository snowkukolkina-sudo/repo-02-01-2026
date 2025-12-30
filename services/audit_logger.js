const path = require('path');
const fs = require('fs-extra');

const AUDIT_DIR = path.join(process.cwd(), 'storage', 'logs');
const AUDIT_FILE = path.join(AUDIT_DIR, 'edo_audit.log');

async function ensureAuditFile() {
    await fs.ensureDir(AUDIT_DIR);
    if (!(await fs.pathExists(AUDIT_FILE))) {
        await fs.writeFile(AUDIT_FILE, '', 'utf8');
    }
}

async function logAudit(entry) {
    try {
        await ensureAuditFile();
        const record = {
            id: 'audit_' + Date.now(),
            timestamp: new Date().toISOString(),
            ...entry
        };
        await fs.appendFile(AUDIT_FILE, JSON.stringify(record) + '\n', 'utf8');
        return record;
    } catch (error) {
        console.warn('[EDO] audit log failed', error.message);
        return null;
    }
}

module.exports = {
    logAudit
};
