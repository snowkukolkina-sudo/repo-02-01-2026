const path = require('path');
const fs = require('fs-extra');
const { distance } = require('fastest-levenshtein');
const diadocImporter = require('./diadoc_importer');
const inventoryStore = require('./inventory_store');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'inventory');
const RECEIPTS_FILE = path.join(STORAGE_DIR, 'receipts.json');
const DISCREPANCIES_FILE = path.join(STORAGE_DIR, 'discrepancies.json');

async function ensureStorage() {
    await fs.ensureDir(STORAGE_DIR);
    if (!(await fs.pathExists(RECEIPTS_FILE))) await fs.writeJson(RECEIPTS_FILE, [], { spaces: 2 });
    if (!(await fs.pathExists(DISCREPANCIES_FILE))) await fs.writeJson(DISCREPANCIES_FILE, [], { spaces: 2 });
}

function scoreNameMatch(a = '', b = '') {
    a = String(a || '').toLowerCase();
    b = String(b || '').toLowerCase();
    if (!a || !b) return { dist: Infinity, ratio: 1 };
    const dist = distance(a, b);
    const ratio = dist / Math.max(a.length, b.length);
    return { dist, ratio };
}

async function mapInvoiceBuffer(buffer) {
    const parsed = await diadocImporter.parseInvoiceXml(buffer);
    const products = await inventoryStore.listProducts();
    const lines = parsed.lines.map((ln) => {
        const name = ln.name || '';
        const code = ln.code || '';
        const quantity = Number(ln.quantity || 0);
        const price = Number(ln.price || 0);

        // Try exact matches by article or barcode
        let matches = [];
        if (code) {
            const byArticle = products.filter((p) => p.article && p.article.toLowerCase() === String(code).toLowerCase());
            if (byArticle.length) matches = byArticle.map((p) => ({ id: p.id, name: p.name, score: 0 }));
            const byBarcode = products.filter((p) => p.barcode && p.barcode === String(code));
            if (byBarcode.length) matches = matches.concat(byBarcode.map((p) => ({ id: p.id, name: p.name, score: 0 })));
        }

        // Fuzzy name match
        if (!matches.length && name) {
            const scored = products.map((p) => {
                const s = scoreNameMatch(name, p.name || p.article || p.synonyms?.[0] || '');
                return { id: p.id, name: p.name, dist: s.dist, ratio: s.ratio };
            });
            scored.sort((a, b) => a.ratio - b.ratio);
            // Accept best if ratio < 0.45
            if (scored.length && scored[0].ratio < 0.45) {
                matches.push({ id: scored[0].id, name: scored[0].name, score: scored[0].ratio });
            }
        }

        const matched = matches.length ? matches[0] : null;
        const discrepancy = !matched; // if not matched, mark as discrepancy

        return {
            raw: ln,
            name,
            code,
            quantity,
            price,
            matches,
            matched_id: matched ? matched.id : null,
            discrepancy
        };
    });

    const receipt = {
        id: `rcpt-${Date.now()}`,
        number: parsed.meta.number || null,
        date: parsed.meta.date || new Date().toISOString(),
        supplier: parsed.meta.supplier || null,
        created_at: new Date().toISOString(),
        lines
    };

    return { receipt, parsed };
}

async function saveReceiptDraft(receipt) {
    await ensureStorage();
    const list = await fs.readJson(RECEIPTS_FILE);
    list.push(receipt);
    await fs.writeJson(RECEIPTS_FILE, list, { spaces: 2 });
    return receipt;
}

async function createDiscrepancyAct(receipt) {
    await ensureStorage();
    const acts = await fs.readJson(DISCREPANCIES_FILE);
    const act = {
        id: `act-${Date.now()}`,
        receipt_id: receipt.id,
        supplier: receipt.supplier,
        date: new Date().toISOString(),
        lines: receipt.lines.filter((l) => l.discrepancy),
        created_at: new Date().toISOString()
    };
    acts.push(act);
    await fs.writeJson(DISCREPANCIES_FILE, acts, { spaces: 2 });
    return act;
}

module.exports = {
    mapInvoiceBuffer,
    saveReceiptDraft,
    createDiscrepancyAct
};
