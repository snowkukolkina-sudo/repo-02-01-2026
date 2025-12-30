const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');
const { parseStringPromise } = require('xml2js');
const path = require('path');
const fs = require('fs-extra');
const natural = require('natural');

const inventoryStore = require('../services/inventory_store');
const { logAudit } = require('../services/audit_logger');
const adminStateStore = require('../services/admin_state_store');

const router = express.Router();

const DIADOC_API = process.env.DIADOC_API_URL || 'https://diadoc-api.kontur.ru';
const DIADOC_CLIENT_ID = process.env.DIADOC_API_CLIENT_ID || '';
const DIADOC_BOX_ID = process.env.DIADOC_BOX_ID || '';
const CRYPTO_AGENT_URL = process.env.CRYPTO_AGENT_URL || '';
const EDO_DEMO_MODE = process.env.EDO_DEMO_MODE === 'true';
const ALLOWED_ROLES = (process.env.EDO_ALLOWED_ROLES || 'admin,accountant').split(',').map((role) => role.trim().toLowerCase()).filter(Boolean);
const AUDIT_ENABLED = process.env.EDO_AUDIT_DISABLED !== 'true';

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

const SAMPLE_DOCUMENTS = [
    {
        docflowId: 'demo-001',
        documentId: 'message-001',
        type: 'UniversalTransferDocument',
        status: 'incoming',
        counterparty: 'ООО «Демо Поставки»',
        date: '2025-02-10T09:30:00Z',
        total: 12500.23
    }
];

router.get('/health', async (req, res) => {
    if (!isDiadocConfigured()) {
        return res.status(400).json({
            ok: false,
            configured: false,
            error: 'Диадок не настроен. Укажите DIADOC_BOX_ID и DIADOC_API_TOKEN или OAuth/DIADOC_API_CLIENT_ID.'
        });
    }

    try {
        const resp = await axios.get(`${DIADOC_API}/GetMyOrganizations`, {
            headers: await diadocHeaders(),
            timeout: 15000
        });
        res.json({
            ok: true,
            configured: true,
            connected: true,
            service: 'diadoc',
            api: DIADOC_API,
            boxId: DIADOC_BOX_ID,
            organizations: Array.isArray(resp.data) ? resp.data.length : null,
            data: resp.data
        });
    } catch (e) {
        const status = e.response?.status || 502;
        const details = e.response?.data || e.message;
        res.status(status).json({
            ok: false,
            configured: true,
            connected: false,
            service: 'diadoc',
            api: DIADOC_API,
            boxId: DIADOC_BOX_ID,
            error: 'Не удалось подключиться к Диадоку',
            details
        });
    }
});

const SAMPLE_LINES = [
    {
        name: 'Сыр Моцарелла 45%',
        quantity: 10,
        unitName: 'кг',
        price: 820,
        subtotal: 8200,
        vatRate: '20%',
        barcode: '4601234000017'
    },
    {
        name: 'Соус томатный',
        quantity: 4,
        unitName: 'шт',
        price: 350,
        subtotal: 1400,
        vatRate: '10%',
        barcode: '4601234000024'
    }
];

function isDiadocConfigured() {
    // DIADOC_API_TOKEN может быть в .env, либо сохранён через OAuth (admin_state_store)
    // Здесь делаем быстрый sync-check по env + box_id.
    return Boolean((process.env.DIADOC_API_TOKEN || DIADOC_CLIENT_ID) && DIADOC_BOX_ID);
}

async function diadocHeaders(extra = {}) {
    const envToken = process.env.DIADOC_API_TOKEN || '';
    if (envToken) {
        return Object.assign({ Authorization: `Bearer ${envToken}` }, extra);
    }

    try {
        const stored = await adminStateStore.getKey('diadoc_oauth');
        const storedToken = stored?.access_token;
        if (storedToken) {
            return Object.assign({ Authorization: `Bearer ${storedToken}` }, extra);
        }
    } catch (e) {
        // ignore read errors and fallback to client id
    }

    if (DIADOC_CLIENT_ID) {
        return Object.assign({ Authorization: `DiadocAuth ddauth_api_client_id=${DIADOC_CLIENT_ID}` }, extra);
    }

    return extra;
}

async function runQuery(queryText, params = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(queryText, params);
        return result;
    } finally {
        client.release();
    }
}

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function upsertDocument(document) {
    if (!document?.docflowId) return null;
    const sql = `
        INSERT INTO edo_documents (
            docflow_id,
            type,
            status,
            counterparty,
            date,
            total,
            raw_xml,
            message_id,
            entity_id,
            counterparty_box_id,
            buyer_name,
            seller_name,
            document_number,
            entity_type,
            entity_version,
            document_version
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (docflow_id)
        DO UPDATE SET
            type = COALESCE(EXCLUDED.type, edo_documents.type),
            status = COALESCE(EXCLUDED.status, edo_documents.status),
            counterparty = COALESCE(EXCLUDED.counterparty, edo_documents.counterparty),
            date = COALESCE(EXCLUDED.date, edo_documents.date),
            total = COALESCE(EXCLUDED.total, edo_documents.total),
            raw_xml = COALESCE(EXCLUDED.raw_xml, edo_documents.raw_xml),
            message_id = COALESCE(EXCLUDED.message_id, edo_documents.message_id),
            entity_id = COALESCE(EXCLUDED.entity_id, edo_documents.entity_id),
            counterparty_box_id = COALESCE(EXCLUDED.counterparty_box_id, edo_documents.counterparty_box_id),
            buyer_name = COALESCE(EXCLUDED.buyer_name, edo_documents.buyer_name),
            seller_name = COALESCE(EXCLUDED.seller_name, edo_documents.seller_name),
            document_number = COALESCE(EXCLUDED.document_number, edo_documents.document_number),
            entity_type = COALESCE(EXCLUDED.entity_type, edo_documents.entity_type),
            entity_version = COALESCE(EXCLUDED.entity_version, edo_documents.entity_version),
            document_version = COALESCE(EXCLUDED.document_version, edo_documents.document_version),
            updated_at = NOW()
        RETURNING id
    `;
    const params = [
        document.docflowId,
        document.type || null,
        document.status || null,
        document.counterparty || null,
        toDate(document.date),
        toNumber(document.total),
        document.rawXml || null,
        document.messageId || null,
        document.entityId || null,
        document.counterpartyBoxId || null,
        document.buyerName || null,
        document.sellerName || null,
        document.documentNumber || null,
        document.entityType || null,
        document.entityVersion || null,
        document.documentVersion || null
    ];
    try {
        const result = await runQuery(sql, params);
        return result.rows[0].id;
    } catch (error) {
        console.warn('[EDO] Failed to upsert document', error.message);
        return null;
    }
}

async function replaceDocumentLines(documentId, lines) {
    if (!documentId) return;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM edo_lines WHERE edo_document_id = $1', [documentId]);
        for (const line of lines) {
            await client.query(
                `INSERT INTO edo_lines (edo_document_id, line_index, name, quantity, unit_name, price, subtotal, vat_rate, barcode, raw_json)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [
                    documentId,
                    line.index,
                    line.name,
                    line.quantity,
                    line.unitName,
                    line.price,
                    line.subtotal,
                    line.vatRate || null,
                    line.barcode || null,
                    JSON.stringify(line.raw || {})
                ]
            );
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.warn('[EDO] Failed to store lines', error.message);
    } finally {
        client.release();
    }
}

async function getDocumentRecord(docflowId) {
    const result = await runQuery('SELECT * FROM edo_documents WHERE docflow_id = $1', [docflowId]);
    return result.rows[0] || null;
}

async function updateDocumentStatus(docflowId, status) {
    await runQuery('UPDATE edo_documents SET status = $2, updated_at = NOW() WHERE docflow_id = $1', [
        docflowId,
        status
    ]);
}

async function insertSignatureRecord(documentId, signatureData) {
    if (!documentId) return;
    const query = `
        INSERT INTO edo_signatures (edo_document_id, signer, status, signature, thumbprint, certificate, external_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
    `;
    const params = [
        documentId,
        signatureData.signer || null,
        signatureData.status || null,
        signatureData.signatureBase64 ? Buffer.from(signatureData.signatureBase64, 'base64') : null,
        signatureData.thumbprint || null,
        signatureData.certificate || null,
        signatureData.externalId || null
    ];
    await runQuery(query, params);
}

async function ensureDocumentMeta(docflowId) {
    let record = await getDocumentRecord(docflowId);
    if (record?.message_id && record?.entity_id) {
        return record;
    }

    let resp;
    try {
        resp = await axios.get(
            `${DIADOC_API}/GetDocflows?boxId=${encodeURIComponent(DIADOC_BOX_ID)}&docflowId=${encodeURIComponent(docflowId)}`,
            { headers: await diadocHeaders() }
        );
    } catch (error) {
        console.warn('[EDO] ensureDocumentMeta error', error.message);
        return record;
    }

    const documents = resp.data?.Docflow?.Documents || [];
    const document = documents[0];
    if (!document) {
        return record;
    }

    const entity =
        (document.Entities || []).find((item) => item.AttachmentType === 'XmlTorg12') ||
        (document.Entities || []).find((item) => item.AttachmentType === 'UniversalTransferDocument') ||
        (document.Entities || [])[0];

    await upsertDocument({
        docflowId,
        type: document.Document?.DocumentType,
        status: document.Document?.DocflowStatus,
        counterparty: document.Document?.CounteragentName || document.Document?.CounterpartyBoxId,
        date: document.Document?.SendDateTime,
        total: document.Document?.TotalAmount,
        messageId: document.Document?.MessageId || null,
        entityId: entity?.EntityId || null,
        counterpartyBoxId: document.Document?.CounterpartyBoxId || null,
        entityType: entity?.AttachmentType || null,
        entityVersion: entity?.Version || entity?.AttachmentVersion || null,
        documentVersion: document.Document?.DocumentVersion || null
    });

    record = await getDocumentRecord(docflowId);
    return record;
}

function extractContentToSign(item) {
    return (
        item?.ContentToSign ||
        item?.BytesToSign ||
        item?.DataToSign ||
        item?.ToSignContent ||
        item?.Content ||
        null
    );
}

function mapDbDocument(row) {
    if (!row) return null;
    return {
        docflowId: row.docflow_id,
        type: row.type,
        status: row.status,
        counterparty: row.counterparty,
        counterpartyBoxId: row.counterparty_box_id,
        date: row.date,
        total: row.total,
        messageId: row.message_id,
        entityId: row.entity_id,
        buyerName: row.buyer_name,
        sellerName: row.seller_name,
        number: row.document_number,
        entityType: row.entity_type,
        entityVersion: row.entity_version,
        documentVersion: row.document_version,
        updatedAt: row.updated_at,
        createdAt: row.created_at
    };
}

let cachedRules = null;
let rulesLoadedAt = 0;
const RULE_CACHE_TTL = 60 * 1000; // 1 minute

async function loadMatchingRules(force = false) {
    if (!cachedRules || force || Date.now() - rulesLoadedAt > RULE_CACHE_TTL) {
        const result = await runQuery('SELECT * FROM matching_rules ORDER BY id');
        cachedRules = result.rows || [];
        rulesLoadedAt = Date.now();
    }
    return cachedRules;
}

async function invalidateMatchingRules() {
    cachedRules = null;
    rulesLoadedAt = 0;
}

async function getRulesForLine(line) {
    const rules = await loadMatchingRules();
    const name = (line.name || '').toLowerCase();
    const barcode = (line.barcode || '').toLowerCase();
    const article = (line.article || '').toLowerCase();
    return rules.filter((rule) => {
        if (rule.barcode && barcode && rule.barcode.toLowerCase() === barcode) {
            return true;
        }
        if (rule.article && article && rule.article.toLowerCase() === article) {
            return true;
        }
        if (rule.synonym && name) {
            const normalizedSyn = rule.synonym.toLowerCase();
            return name.includes(normalizedSyn) || normalizedSyn.includes(name);
        }
        return false;
    });
}

function normalizeString(value) {
    return (value || '').toString().toLowerCase().replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function computeNameScore(nameA, nameB) {
    if (!nameA || !nameB) return 0;
    const score = natural.JaroWinklerDistance(nameA, nameB, { ignoreCase: true });
    return Number.isFinite(score) ? score : 0;
}

async function buildCandidatesForLine(line) {
    const candidatesMap = new Map();
    const inventory = await inventoryStore.listProducts();
    const normalizedName = normalizeString(line.name);

    function pushCandidate(product, baseScore, source) {
        if (!product) return;
        const existing = candidatesMap.get(product.id);
        const score = Math.min(1, baseScore);
        if (!existing || existing.score < score) {
            candidatesMap.set(product.id, {
                id: product.id,
                name: product.name,
                type: product.type,
                barcode: product.barcode || '',
                article: product.article || '',
                vatRate: product.vatRate || null,
                score,
                source
            });
        }
    }

    if (line.barcode) {
        const exactBarcode = inventory.filter((item) => item.barcode && item.barcode === line.barcode);
        exactBarcode.forEach((product) => pushCandidate(product, 1, 'штрихкод'));
    }

    if (line.article) {
        const normArticle = line.article.toLowerCase();
        const articleMatches = inventory.filter((item) => item.article && item.article.toLowerCase() === normArticle);
        articleMatches.forEach((product) => pushCandidate(product, 0.95, 'артикул'));
    }

    const rules = await getRulesForLine(line);
    rules.forEach((rule) => {
        const product = inventory.find((item) => item.id === rule.product_id);
        if (product) {
            pushCandidate(product, 0.9, 'правило');
        }
    });

    inventory.forEach((product) => {
        const tokens = [product.name].concat(product.synonyms || []);
        let bestScore = 0;
        tokens.forEach((token) => {
            const normToken = normalizeString(token);
            const score = computeNameScore(normalizedName, normToken);
            if (score > bestScore) {
                bestScore = score;
            }
        });
        if (bestScore >= 0.6) {
            pushCandidate(product, bestScore, 'название');
        }
    });

    const list = Array.from(candidatesMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    return list;
}

async function listStoredDocuments(limit = 50) {
    const result = await runQuery(
        `SELECT * FROM edo_documents ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT $1`,
        [limit]
    );
    return result.rows.map(mapDbDocument);
}

async function refreshDocflow(docflowId) {
    const resp = await axios.get(
        `${DIADOC_API}/GetDocflows?boxId=${encodeURIComponent(DIADOC_BOX_ID)}&docflowId=${encodeURIComponent(docflowId)}`,
        { headers: await diadocHeaders() }
    );
    const documents = resp.data?.Docflow?.Documents || [];
    const document = documents[0];
    if (!document) return null;
    const normalized = normalizeDocument(document);
    if (normalized) {
        await upsertDocument({
            docflowId: normalized.docflowId,
            type: normalized.type,
            status: normalized.status,
            counterparty: normalized.counterparty,
            date: normalized.date,
            total: normalized.total,
            messageId: normalized.messageId || null,
            counterpartyBoxId: normalized.counterpartyBoxId || null,
            documentNumber: normalized.number,
            entityType: normalized.entityType,
            entityVersion: normalized.entityVersion,
            documentVersion: normalized.documentVersion
        });
    }
    return normalized;
}

function normalizeDocument(doc) {
    if (!doc) return null;
    const counterpartyName =
        doc.Document?.CounteragentName ||
        doc.Document?.CounterpartyName ||
        doc.Document?.CounterpartyFullName ||
        null;

    return {
        docflowId: doc.DocflowId || doc.docflowId || doc.id,
        documentId: doc.Document?.EntityId || doc.documentId,
        type: doc.Document?.DocumentType || doc.type,
        status: doc.Document?.DocflowStatus || doc.status,
        counterparty: counterpartyName || doc.Document?.CounterpartyBoxId || doc.counterparty,
        counterpartyName: counterpartyName,
        counterpartyBoxId: doc.Document?.CounterpartyBoxId || null,
        messageId: doc.Document?.MessageId || null,
        number: doc.Document?.DocumentNumber || null,
        date: doc.Document?.SendDateTime || doc.date,
        total: toNumber(doc.Document?.TotalAmount || doc.total),
        entityType:
            (doc.Entities && doc.Entities[0]?.AttachmentType) ||
            doc.Document?.DocumentType ||
            null,
        entityVersion:
            (doc.Entities && doc.Entities[0]?.Version) ||
            (doc.Entities && doc.Entities[0]?.AttachmentVersion) ||
            null,
        documentVersion: doc.Document?.DocumentVersion || null
    };
}

function normalizeLine(line, index) {
    return {
        index,
        name: line.Product || 'Позиция',
        quantity: Number(line.Quantity || 0),
        unitName: line.UnitName || '',
        price: Number(line.Price || 0),
        subtotal: Number(line.SubtotalWithVatExcluded || line.Subtotal || line.SubTotal || 0),
        vatRate: line.TaxRate || '',
        barcode: line.Gtin || line.ItemVendorCode || '',
        raw: line
    };
}

function getRequestRole(req) {
    const header = (req.headers['x-user-role'] || req.headers['x-role'] || '').toString().toLowerCase();
    if (!header) return null;
    return header.split(',').map((role) => role.trim()).find(Boolean) || null;
}

function isRoleAllowed(role) {
    if (!ALLOWED_ROLES.length) return true;
    if (!role) return false;
    return ALLOWED_ROLES.includes(role.toLowerCase());
}

router.use((req, res, next) => {
    if (!ALLOWED_ROLES.length) {
        return next();
    }
    const role = getRequestRole(req);
    if (!isRoleAllowed(role)) {
        return res.status(403).json({ ok: false, error: 'Недостаточно прав для работы с ЭДО' });
    }
    req.userRole = role;
    next();
});

async function writeAudit(req, action, docflowId, details) {
    if (!AUDIT_ENABLED) return;
    try {
        await logAudit({
            action,
            docflowId,
            details,
            role: req.userRole || null,
            ip: req.ip || null,
            userAgent: req.headers['user-agent'] || null
        });
    } catch (error) {
        console.warn('[EDO] failed to log audit', error.message);
    }
}

router.get('/config', (req, res) => {
    res.json({
        ok: true,
        diadocConfigured: isDiadocConfigured(),
        boxId: DIADOC_BOX_ID ? `${DIADOC_BOX_ID.slice(0, 6)}…` : null
    });
});

router.get('/documents/:docflowId/status', async (req, res) => {
    const { docflowId } = req.params;
    if (!docflowId) {
        return res.status(400).json({ ok: false, error: 'Не указан docflowId' });
    }

    if (!isDiadocConfigured()) {
        const record = await getDocumentRecord(docflowId);
        if (!record) {
            return res.status(404).json({ ok: false, error: 'Документ не найден в локальном хранилище' });
        }
        return res.json({ ok: true, doc: mapDbDocument(record), cached: true });
    }

    try {
        await refreshDocflow(docflowId);
        const record = await getDocumentRecord(docflowId);
        if (!record) {
            return res.status(404).json({ ok: false, error: 'Документ не найден' });
        }
        return res.json({ ok: true, doc: mapDbDocument(record), cached: false });
    } catch (error) {
        console.warn('[EDO] status sync error', error.message);
        const fallback = await getDocumentRecord(docflowId);
        if (fallback) {
            return res.json({
                ok: true,
                doc: mapDbDocument(fallback),
                cached: true,
                warning: 'Не удалось обновить статус из Диадока, возвращены сохранённые данные.'
            });
        }
        res.status(502).json({
            ok: false,
            error: 'Не удалось получить статус документа',
            details: error.message
        });
    }
});

router.post('/documents/:docflowId/sync', async (req, res) => {
    const { docflowId } = req.params;
    if (!docflowId) {
        return res.status(400).json({ ok: false, error: 'Не указан docflowId' });
    }

    if (!isDiadocConfigured()) {
        return res.status(400).json({ ok: false, error: 'Диадок не настроен в .env' });
    }

    try {
        const updated = await refreshDocflow(docflowId);
        const record = await getDocumentRecord(docflowId);
        await writeAudit(req, 'document_sync', docflowId, { updated: Boolean(updated) });
        res.json({ ok: true, doc: mapDbDocument(record), refreshed: Boolean(updated) });
    } catch (error) {
        console.warn('[EDO] manual sync error', error.message);
        const fallback = await getDocumentRecord(docflowId);
        if (fallback) {
            return res.json({
                ok: true,
                doc: mapDbDocument(fallback),
                refreshed: false,
                warning: 'Не удалось обновить статус, возвращены сохранённые данные.'
            });
        }
        res.status(502).json({
            ok: false,
            error: 'Не удалось синхронизировать документ',
            details: error.message
        });
    }
});

router.get('/documents/:docflowId/lines', async (req, res) => {
    const { docflowId } = req.params;
    const withCandidates = req.query.withCandidates === '1' || req.query.withCandidates === 'true';
    try {
        const rows = await fetchDocumentLines(docflowId);
        if (!rows.length) {
            return res.json({ ok: true, lines: [], empty: true });
        }
        const lines = await Promise.all(rows.map((row) => buildLinePayload(docflowId, row, withCandidates)));
        res.json({ ok: true, lines });
    } catch (error) {
        console.warn('[EDO] lines fetch error', error.message);
        if (EDO_DEMO_MODE) {
            const fallbackLines = SAMPLE_LINES.map((line, idx) => mapSampleLinePayload(idx, line, withCandidates));
            return res.json({ ok: true, lines: fallbackLines, demo: true });
        }
        res.status(502).json({ ok: false, error: 'Не удалось получить строки документа', details: error.message });
    }
});

router.post('/documents/:docflowId/lines/:lineIndex/match', async (req, res) => {
    const { docflowId, lineIndex } = req.params;
    const { productId, source, score, manual, comment } = req.body || {};
    const includeCandidates = req.query.withCandidates === '1' || req.query.withCandidates === 'true';
    if (!productId) {
        return res.status(400).json({ ok: false, error: 'Не указан productId для сопоставления' });
    }
    try {
        const payload = await saveLineMatch(docflowId, Number(lineIndex), productId, {
            source,
            score,
            manual,
            comment,
            includeCandidates
        });
        await writeAudit(req, 'line_match', docflowId, {
            lineIndex: Number(lineIndex),
            productId,
            source: source || null,
            manual: manual !== false
        });
        res.json({ ok: true, line: payload });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ ok: false, error: error.message || 'Не удалось сохранить сопоставление' });
    }
});

router.delete('/documents/:docflowId/lines/:lineIndex/match', async (req, res) => {
    const { docflowId, lineIndex } = req.params;
    const includeCandidates = req.query.withCandidates === '1' || req.query.withCandidates === 'true';
    try {
        const payload = await clearLineMatch(docflowId, Number(lineIndex), { includeCandidates });
        await writeAudit(req, 'line_match_clear', docflowId, { lineIndex: Number(lineIndex) });
        res.json({ ok: true, line: payload });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ ok: false, error: error.message || 'Не удалось сбросить сопоставление' });
    }
});

router.post('/documents/:docflowId/matches/auto', async (req, res) => {
    const { docflowId } = req.params;
    const threshold = typeof req.body?.threshold === 'number' ? req.body.threshold : 0.7;
    const includeCandidates = req.body?.withCandidates !== false;
    try {
        const rows = await fetchDocumentLines(docflowId);
        let matched = 0;
        for (const row of rows) {
            const linePayload = await buildLinePayload(docflowId, row, false);
            const candidates = await buildCandidatesForLine(linePayload);
            if (!candidates.length) continue;
            const best = candidates[0];
            if (best.score >= threshold) {
                await saveLineMatch(docflowId, row.line_index, best.id, {
                    source: best.source || 'auto',
                    score: best.score,
                    manual: false,
                    includeCandidates
                });
                matched += 1;
            }
        }
        const refreshedRows = await fetchDocumentLines(docflowId);
        const lines = await Promise.all(
            refreshedRows.map((row) => buildLinePayload(docflowId, row, includeCandidates))
        );
        await writeAudit(req, 'auto_match', docflowId, { matched });
        res.json({ ok: true, lines, matched });
    } catch (error) {
        console.warn('[EDO] auto-match error', error.message);
        res.status(500).json({ ok: false, error: 'Не удалось выполнить автосопоставление', details: error.message });
    }
});

router.get('/documents', async (req, res) => {
    if (!isDiadocConfigured()) {
        if (EDO_DEMO_MODE) {
            const cached = await listStoredDocuments();
            return res.json({ ok: true, docs: cached.length ? cached : SAMPLE_DOCUMENTS, demo: true, cached: Boolean(cached.length) });
        }
        return res.status(400).json({ ok: false, error: 'Диадок не настроен. Укажите DIADOC_BOX_ID и DIADOC_API_TOKEN или OAuth/DIADOC_API_CLIENT_ID.' });
    }
    try {
        const payload = { filter: { counteragentBoxId: null } };
        const response = await axios.post(
            `${DIADOC_API}/SearchDocflows?boxId=${encodeURIComponent(DIADOC_BOX_ID)}&count=50`,
            payload,
            { headers: await diadocHeaders({ 'Content-Type': 'application/json' }) }
        );
        const docflows = response.data?.Docflows || [];
        const docs = docflows.map(normalizeDocument).filter(Boolean);

        for (const doc of docs) {
            await upsertDocument({
                docflowId: doc.docflowId,
                type: doc.type,
                status: doc.status,
                counterparty: doc.counterpartyName || doc.counterparty,
                date: doc.date,
                total: doc.total,
                rawXml: null,
                messageId: doc.messageId || null,
                counterpartyBoxId: doc.counterpartyBoxId || null,
                documentNumber: doc.number || null,
                entityType: doc.entityType || null,
                entityVersion: doc.entityVersion || null,
                documentVersion: doc.documentVersion || null
            });
        }

        if (!docs.length) {
            const cached = await listStoredDocuments();
            return res.json({ ok: true, docs: cached, cached: true });
        }

        res.json({ ok: true, docs, cached: false });
    } catch (error) {
        console.warn('[EDO] SearchDocflows error', error.message);
        try {
            const cached = await listStoredDocuments();
            if (cached.length) {
                return res.json({
                    ok: true,
                    docs: cached,
                    cached: true,
                    warning: 'Не удалось обновить список из Диадока, возвращены сохранённые документы.'
                });
            }
        } catch (cacheError) {
            console.warn('[EDO] Fallback cache error', cacheError.message);
        }
        res.status(502).json({
            ok: false,
            error: 'Не удалось получить документы из Диадока',
            details: error.message
        });
    }
});

router.get('/documents/:docflowId/parse', async (req, res) => {
    const { docflowId } = req.params;
    if (!isDiadocConfigured()) {
        if (EDO_DEMO_MODE) {
            return res.json({ ok: true, items: SAMPLE_LINES, xml: '<demo>true</demo>', demo: true });
        }
        return res.status(400).json({ ok: false, error: 'Диадок не настроен. Укажите DIADOC_BOX_ID и DIADOC_API_TOKEN или OAuth/DIADOC_API_CLIENT_ID.' });
    }
    try {
        const docflowResp = await axios.get(
            `${DIADOC_API}/GetDocflows?boxId=${encodeURIComponent(DIADOC_BOX_ID)}&docflowId=${encodeURIComponent(docflowId)}`,
            { headers: await diadocHeaders() }
        );
        const documents = docflowResp.data?.Docflow?.Documents || [];
        const document = documents[0];
        if (!document) {
            return res.status(404).json({ ok: false, error: 'Документ не найден' });
        }
        const entity = (document.Entities || []).find((item) => {
            return item.AttachmentType === 'XmlTorg12' || item.AttachmentType === 'UniversalTransferDocument';
        });
        if (!entity) {
            return res.status(404).json({ ok: false, error: 'Титул продавца не найден' });
        }
        const contentResp = await axios.get(
            `${DIADOC_API}/GetEntityContent?boxId=${encodeURIComponent(DIADOC_BOX_ID)}&messageId=${encodeURIComponent(document.MessageId)}&entityId=${encodeURIComponent(entity.EntityId)}`,
            { headers: await diadocHeaders(), responseType: 'arraybuffer' }
        );
        const xmlBuffer = Buffer.from(contentResp.data);
        const parseResp = await axios.post(
            `${DIADOC_API}/ParseTitleXml?boxId=${encodeURIComponent(DIADOC_BOX_ID)}&documentTypeNamedId=${encodeURIComponent(entity.AttachmentType)}&documentFunction=default&documentVersion=${encodeURIComponent(entity.Version || 'utd970_05_03_01')}&titleIndex=0`,
            xmlBuffer,
            { headers: await diadocHeaders({ 'Content-Type': 'application/xml' }), responseType: 'arraybuffer' }
        );
        const parsedXml = Buffer.from(parseResp.data).toString('utf8');
        const parsed = await parseStringPromise(parsedXml, { explicitArray: false, mergeAttrs: true });
        const table = parsed.UniversalTransferDocument?.Table || parsed.Torg12?.Table;
        const itemsRaw = Array.isArray(table?.Item) ? table.Item : table?.Item ? [table.Item] : [];
        const items = itemsRaw.map(normalizeLine);

        const documentInfo = {
            docNumber:
                parsed.UniversalTransferDocument?.DocumentNumber ||
                parsed.UniversalTransferDocument?.InvoiceNumber ||
                parsed.Torg12?.DocumentNumber ||
                null,
            docDate:
                parsed.UniversalTransferDocument?.DocumentDate ||
                parsed.UniversalTransferDocument?.InvoiceDate ||
                parsed.Torg12?.DocumentDate ||
                null,
            seller:
                parsed.UniversalTransferDocument?.Seller?.OrganizationName ||
                parsed.Torg12?.Seller?.OrganizationName ||
                null,
            buyer:
                parsed.UniversalTransferDocument?.Buyer?.OrganizationName ||
                parsed.Torg12?.Consignee?.OrganizationName ||
                null,
            total:
                parsed.UniversalTransferDocument?.TotalAmountWithVatIncluded ||
                parsed.Torg12?.TotalAmountWithVatIncluded ||
                document.Document?.TotalAmount ||
                null
        };

        const documentId = await upsertDocument({
            docflowId,
            type: document.Document?.DocumentType,
            status: document.Document?.DocflowStatus,
            counterparty: documentInfo.seller || document.Document?.CounteragentName || document.Document?.CounterpartyBoxId,
            date: documentInfo.docDate || document.Document?.SendDateTime,
            total: documentInfo.total || document.Document?.TotalAmount,
            rawXml: parsedXml,
            messageId: document.MessageId || null,
            entityId: entity.EntityId || null,
            counterpartyBoxId: document.Document?.CounterpartyBoxId || null,
            buyerName: documentInfo.buyer || null,
            sellerName: documentInfo.seller || null,
            documentNumber: documentInfo.docNumber || document.Document?.DocumentNumber || null,
            entityType: entity.AttachmentType || null,
            entityVersion: entity.Version || entity.AttachmentVersion || null,
            documentVersion: document.Document?.DocumentVersion || null
        });
        await replaceDocumentLines(documentId, items);
        await writeAudit(req, 'parse_title', docflowId, {
            items: items.length,
            seller: documentInfo.seller || null,
            buyer: documentInfo.buyer || null,
            total: documentInfo.total || null
        });

        res.json({
            ok: true,
            items,
            xml: parsedXml,
            document: {
                number: documentInfo.docNumber,
                date: documentInfo.docDate,
                seller: documentInfo.seller,
                buyer: documentInfo.buyer,
                total: toNumber(documentInfo.total)
            }
        });
    } catch (error) {
        console.warn('[EDO] ParseTitleXml error', error.message);
        res.status(502).json({
            ok: false,
            error: 'Не удалось распарсить титул документа',
            details: error.message
        });
    }
});

router.post('/documents/:docflowId/receipt', async (req, res) => {
    const { docflowId } = req.params;
    const { warehouseId, lines } = req.body || {};
    if (!Array.isArray(lines) || !lines.length) {
        return res.status(400).json({ ok: false, error: 'Не переданы строки прихода' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const docResult = await client.query('SELECT id FROM edo_documents WHERE docflow_id = $1', [docflowId]);
        const edoDocumentId = docResult.rows[0]?.id || null;
        const receiptInsert = await client.query(
            `INSERT INTO receipts (edo_document_id, warehouse_id, status, created_at)
             VALUES ($1,$2,'draft',NOW())
             RETURNING id`,
            [edoDocumentId, warehouseId || 'default']
        );
        const receiptId = receiptInsert.rows[0].id;
        for (const line of lines) {
            await client.query(
                `INSERT INTO receipt_lines (receipt_id, product_id, qty, purchase_price, vat_rate, batch, expiry_at, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
                [
                    receiptId,
                    line.productId,
                    line.qty,
                    line.price,
                    line.vatRate || null,
                    line.batch || null,
                    line.expiry ? new Date(line.expiry) : null
                ]
            );
        }
        await client.query('COMMIT');
        await writeAudit(req, 'create_receipt', docflowId, {
            receiptId,
            warehouseId: warehouseId || 'default',
            lines: lines.length
        });
        res.json({ ok: true, receiptId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.warn('[EDO] Receipt creation error', error.message);
        res.status(500).json({ ok: false, error: 'Не удалось создать приход', details: error.message });
    } finally {
        client.release();
    }
});

router.post('/documents/:docflowId/sign', async (req, res) => {
    if (!isDiadocConfigured()) {
        return res.status(400).json({ ok: false, error: 'Диадок не настроен в .env' });
    }

    const { docflowId } = req.params;
    const { thumbprint, signer, algorithm, postImmediately = true } = req.body || {};

    try {
        const meta = await ensureDocumentMeta(docflowId);
        if (!meta?.message_id || !meta?.entity_id) {
            return res.status(404).json({ ok: false, error: 'Не удалось определить MessageId/EntityId для документа' });
        }

        const preparePayload = {
            Documents: [
                {
                    MessageId: meta.message_id,
                    EntityId: meta.entity_id
                }
            ]
        };

        const prepareResp = await axios.post(
            `${DIADOC_API}/PrepareDocumentsToSign?boxId=${encodeURIComponent(DIADOC_BOX_ID)}`,
            preparePayload,
            { headers: await diadocHeaders({ 'Content-Type': 'application/json' }) }
        );

        const documentsToSign =
            prepareResp.data?.DocumentsToSign ||
            prepareResp.data?.Documents ||
            prepareResp.data?.ToSign ||
            [];

        if (!documentsToSign.length) {
            return res.status(502).json({
                ok: false,
                error: 'Диадок не вернул данные для подписи',
                details: prepareResp.data
            });
        }

        if (!CRYPTO_AGENT_URL) {
            return res.status(202).json({
                ok: true,
                status: 'pending',
                message: 'Crypto provider не настроен. Подпишите содержимое вручную и отправьте через PostMessagePatch.',
                documentsToSign
            });
        }

        const cryptoBase = CRYPTO_AGENT_URL.trim();
        const cryptoEndpoint = cryptoBase.endsWith('/sign')
            ? cryptoBase
            : `${cryptoBase.replace(/\/$/, '')}/sign`;
        const signResults = [];

        for (const doc of documentsToSign) {
            const contentBase64 = extractContentToSign(doc);
            const entityId = doc?.EntityId || doc?.DocumentId || meta.entity_id;
            if (!contentBase64 || !entityId) {
                continue;
            }

            const cryptoRequest = {
                contentBase64,
                thumbprint: thumbprint || doc?.Thumbprint || null,
                detached: true,
                algorithm: algorithm || doc?.Algorithm || 'GOST3410_2012_256'
            };

            let cryptoResponse;
            try {
                cryptoResponse = await axios.post(cryptoEndpoint, cryptoRequest, {
                    timeout: 20000,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (cryptoError) {
                const status = cryptoError.response?.status;
                const details = cryptoError.response?.data || cryptoError.message;
                console.warn('[EDO] Crypto agent error', status || '', typeof details === 'string' ? details : JSON.stringify(details));
                const err = new Error('Крипто-провайдер не смог подписать документ');
                err.status = status || 502;
                err.details = details;
                throw err;
            }

            const signatureBase64 =
                cryptoResponse.data?.signatureBase64 ||
                cryptoResponse.data?.signature ||
                cryptoResponse.data?.Signature;

            if (!signatureBase64) {
                throw new Error('Крипто-провайдер вернул пустую подпись');
            }

            signResults.push({
                entityId,
                signatureBase64,
                signer: cryptoResponse.data?.signer || signer || 'crypto-agent',
                thumbprint: cryptoResponse.data?.thumbprint || thumbprint || null,
                certificate: cryptoResponse.data?.certificate || null
            });
        }

        if (!signResults.length) {
            return res.status(500).json({ ok: false, error: 'Не удалось сформировать подписи для документа' });
        }

        let patchResponse = null;
        let postErrorDetails = null;

        if (postImmediately) {
            const patchPayload = {
                MessageId: meta.message_id,
                Signatures: signResults.map((item) => ({
                    EntityId: item.entityId,
                    Signature: item.signatureBase64
                }))
            };

            try {
                patchResponse = await axios.post(
                    `${DIADOC_API}/PostMessagePatch?boxId=${encodeURIComponent(DIADOC_BOX_ID)}`,
                    patchPayload,
                    { headers: await diadocHeaders({ 'Content-Type': 'application/json' }) }
                );
                await updateDocumentStatus(docflowId, 'signed');
            } catch (postError) {
                console.warn('[EDO] PostMessagePatch error', postError.message);
                postErrorDetails = postError.response?.data || postError.message;
            }
        }

        const edoDocument = await getDocumentRecord(docflowId);
        for (const result of signResults) {
            await insertSignatureRecord(edoDocument?.id || null, {
                signer: result.signer,
                status: postImmediately && !postErrorDetails ? 'signed' : 'prepared',
                signatureBase64: result.signatureBase64,
                thumbprint: result.thumbprint,
                certificate: result.certificate,
                externalId: patchResponse?.data?.MessageId || null
            });
        }

        await writeAudit(req, 'sign_document', docflowId, {
            signatures: signResults.length,
            postError: postErrorDetails || null
        });

        res.json({
            ok: true,
            status: postImmediately && !postErrorDetails ? 'signed' : 'prepared',
            signatures: signResults.map((item) => ({
                entityId: item.entityId,
                signer: item.signer,
                thumbprint: item.thumbprint
            })),
            diadoc: patchResponse?.data || null,
            postError: postErrorDetails || null
        });
    } catch (error) {
        console.warn('[EDO] Sign error', error.message);
        res.status(error.status || 500).json({
            ok: false,
            error: 'Не удалось подписать документ',
            details: error.details || error.message
        });
    }
});

router.post('/documents/:docflowId/send', async (req, res) => {
    if (!isDiadocConfigured()) {
        return res.status(400).json({ ok: false, error: 'Диадок не настроен в .env' });
    }

    const { docflowId } = req.params;
    const {
        contentBase64: contentBase64FromClient,
        signatureBase64: signatureBase64FromClient,
        generationPayload,
        autoSign = false,
        thumbprint,
        signer,
        documentFunction = 'default',
        titleIndex = 1,
        algorithm
    } = req.body || {};

    try {
        const meta = await ensureDocumentMeta(docflowId);
        if (!meta?.message_id || !meta?.entity_id) {
            return res.status(404).json({ ok: false, error: 'Не найдены MessageId/EntityId для документа' });
        }

        const documentType = req.body?.documentTypeNamedId || meta?.entity_type || meta?.type || 'UniversalTransferDocument';
        const documentVersion = req.body?.documentVersion || meta?.document_version || meta?.entity_version || 'utd970_05_03_01';

        let contentBase64 = contentBase64FromClient || null;
        let signatureBase64 = signatureBase64FromClient || null;
        let unsignedXmlBase64 = null;
        let cryptoInfo = null;

        if (!contentBase64) {
            if (!generationPayload) {
                return res.status(400).json({
                    ok: false,
                    error: 'Передайте contentBase64/ signatureBase64 или укажите generationPayload для GenerateTitleXml'
                });
            }

            const query = new URLSearchParams({
                boxId: DIADOC_BOX_ID,
                documentTypeNamedId: documentType,
                documentFunction,
                documentVersion,
                titleIndex: String(titleIndex || 1)
            });

            const generateResp = await axios.post(
                `${DIADOC_API}/GenerateTitleXml?${query.toString()}`,
                generationPayload,
                { headers: await diadocHeaders({ 'Content-Type': 'application/json' }), responseType: 'arraybuffer' }
            );
            unsignedXmlBase64 = Buffer.from(generateResp.data).toString('base64');
            contentBase64 = unsignedXmlBase64;

            if (!autoSign) {
                return res.status(202).json({
                    ok: true,
                    status: 'generated',
                    message: 'Покупательский титул сгенерирован. Подпишите XML и повторите запрос, передав signatureBase64.',
                    contentBase64: unsignedXmlBase64
                });
            }
        }

        if (!signatureBase64) {
            if (!autoSign) {
                return res.status(400).json({
                    ok: false,
                    error: 'Не передана подпись (signatureBase64). Включите autoSign или подпишите XML на стороне клиента.'
                });
            }

            if (!CRYPTO_AGENT_URL) {
                return res.status(202).json({
                    ok: true,
                    status: 'generated',
                    message: 'Crypto agent не настроен. Подпишите XML вручную и повторите запрос.',
                    contentBase64
                });
            }

            const cryptoBase = CRYPTO_AGENT_URL.trim();
            const cryptoEndpoint = cryptoBase.endsWith('/sign')
                ? cryptoBase
                : `${cryptoBase.replace(/\/$/, '')}/sign`;

            const cryptoRequest = {
                contentBase64,
                thumbprint: thumbprint || null,
                detached: true,
                algorithm: algorithm || 'GOST3410_2012_256'
            };

            let cryptoResponse;
            try {
                cryptoResponse = await axios.post(cryptoEndpoint, cryptoRequest, {
                    timeout: 20000,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (cryptoError) {
                const status = cryptoError.response?.status;
                const details = cryptoError.response?.data || cryptoError.message;
                console.warn('[EDO] Crypto agent error', status || '', typeof details === 'string' ? details : JSON.stringify(details));
                return res.status(status || 502).json({
                    ok: false,
                    error: 'Крипто-провайдер не смог подписать XML',
                    details
                });
            }
            signatureBase64 =
                cryptoResponse.data?.signatureBase64 ||
                cryptoResponse.data?.signature ||
                cryptoResponse.data?.Signature;

            if (!signatureBase64) {
                throw new Error('Крипто-провайдер вернул пустую подпись');
            }

            cryptoInfo = {
                signer: cryptoResponse.data?.signer || signer || 'crypto-agent',
                thumbprint: cryptoResponse.data?.thumbprint || thumbprint || null,
                certificate: cryptoResponse.data?.certificate || null
            };
        }

        if (!contentBase64 || !signatureBase64) {
            return res.status(400).json({
                ok: false,
                error: 'Отсутствуют данные XML или подписи для отправки'
            });
        }

        const patchPayload = {
            BoxId: DIADOC_BOX_ID,
            MessageId: meta.message_id,
            EntityPatches: [
                {
                    ParentEntityId: meta.entity_id,
                    Content: {
                        DocumentTypeNamedId: documentType,
                        DocumentFunction: documentFunction,
                        DocumentVersion: documentVersion,
                        TitleIndex: Number(titleIndex || 1),
                        SignedContent: {
                            Content: contentBase64,
                            Signature: signatureBase64
                        }
                    }
                }
            ]
        };

        let postResponse = null;
        let postErrorDetails = null;

        try {
            postResponse = await axios.post(
                `${DIADOC_API}/PostMessagePatch?boxId=${encodeURIComponent(DIADOC_BOX_ID)}`,
                patchPayload,
                { headers: await diadocHeaders({ 'Content-Type': 'application/json' }) }
            );
            await updateDocumentStatus(docflowId, 'buyer_title_sent');
        } catch (postError) {
            console.warn('[EDO] PostMessagePatch send buyer title error', postError.message);
            postErrorDetails = postError.response?.data || postError.message;
        }

        const edoDocument = await getDocumentRecord(docflowId);
        await insertSignatureRecord(edoDocument?.id || null, {
            signer: (cryptoInfo && cryptoInfo.signer) || signer || 'buyer',
            status: postErrorDetails ? 'prepared' : 'sent',
            signatureBase64,
            thumbprint: (cryptoInfo && cryptoInfo.thumbprint) || thumbprint || null,
            certificate: cryptoInfo?.certificate || null,
            externalId: postResponse?.data?.MessageId || null
        });

        res.json({
            ok: true,
            status: postErrorDetails ? 'prepared' : 'sent',
            diadoc: postResponse?.data || null,
            postError: postErrorDetails,
            contentBase64: postErrorDetails ? contentBase64 : undefined
        });
        await writeAudit(req, 'send_document', docflowId, {
            postError: postErrorDetails || null
        });
    } catch (error) {
        console.warn('[EDO] send buyer title error', error.message);
        res.status(500).json({
            ok: false,
            error: 'Не удалось отправить титул покупателя',
            details: error.message
        });
    }
});

router.post('/documents/:docflowId/reject', async (req, res) => {
    if (!isDiadocConfigured()) {
        return res.status(400).json({ ok: false, error: 'Диадок не настроен в .env' });
    }

    const { docflowId } = req.params;
    const { reason, comment, code } = req.body || {};

    if (!reason) {
        return res.status(400).json({ ok: false, error: 'Не указана причина отказа (reason)' });
    }

    try {
        const meta = await ensureDocumentMeta(docflowId);
        if (!meta?.message_id || !meta?.entity_id) {
            return res.status(404).json({ ok: false, error: 'Не найдены MessageId/EntityId для документа' });
        }

        const payload = {
            BoxId: DIADOC_BOX_ID,
            MessageId: meta.message_id,
            EntityPatches: [
                {
                    ParentEntityId: meta.entity_id,
                    RevocationRequestInfo: {
                        Comment: comment || reason,
                        CustomData: code || reason,
                        RevocationReason: reason
                    }
                }
            ]
        };

        let postResponse = null;
        let postErrorDetails = null;
        try {
            postResponse = await axios.post(
                `${DIADOC_API}/PostMessagePatch?boxId=${encodeURIComponent(DIADOC_BOX_ID)}`,
                payload,
                { headers: await diadocHeaders({ 'Content-Type': 'application/json' }) }
            );
            await updateDocumentStatus(docflowId, 'rejected');
        } catch (error) {
            console.warn('[EDO] Reject patch error', error.message);
            postErrorDetails = error.response?.data || error.message;
        }

        res.json({
            ok: !postErrorDetails,
            status: postErrorDetails ? 'error' : 'rejected',
            diadoc: postResponse?.data || null,
            error: postErrorDetails || null
        });
        await writeAudit(req, 'reject_document', docflowId, { reason, postError: postErrorDetails || null });
    } catch (error) {
        console.warn('[EDO] Reject error', error.message);
        res.status(500).json({
            ok: false,
            error: 'Не удалось отправить отказ по документу',
            details: error.message
        });
    }
});

async function fetchDocumentLines(docflowId) {
    const result = await runQuery(
        `SELECT l.*, d.docflow_id, d.id AS document_id
         FROM edo_lines l
         INNER JOIN edo_documents d ON d.id = l.edo_document_id
         WHERE d.docflow_id = $1
         ORDER BY l.line_index ASC`,
        [docflowId]
    );
    return result.rows;
}

async function fetchSelectedMatch(lineId) {
    const result = await runQuery(
        `SELECT * FROM edo_line_matches
         WHERE edo_line_id = $1 AND is_selected = true
         ORDER BY updated_at DESC LIMIT 1`,
        [lineId]
    );
    return result.rows[0] || null;
}

async function getLineRecord(docflowId, lineIndex) {
    const result = await runQuery(
        `SELECT l.*, d.id AS document_id
         FROM edo_lines l
         INNER JOIN edo_documents d ON d.id = l.edo_document_id
         WHERE d.docflow_id = $1 AND l.line_index = $2
         LIMIT 1`,
        [docflowId, lineIndex]
    );
    return result.rows[0] || null;
}

async function saveLineMatch(docflowId, lineIndex, productId, options = {}) {
    const line = await getLineRecord(docflowId, lineIndex);
    if (!line) {
        const error = new Error('Строка документа не найдена');
        error.statusCode = 404;
        throw error;
    }
    const product = await inventoryStore.getProductById(productId);
    if (!product) {
        const error = new Error('Карточка номенклатуры не найдена');
        error.statusCode = 404;
        throw error;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('UPDATE edo_line_matches SET is_selected = false WHERE edo_line_id = $1', [line.id]);
        await client.query('DELETE FROM edo_line_matches WHERE edo_line_id = $1 AND product_id = $2', [line.id, productId]);
        await client.query(
            `INSERT INTO edo_line_matches (edo_line_id, product_id, match_score, match_source, is_selected, manual, comment, updated_at)
             VALUES ($1,$2,$3,$4,true,$5,$6,NOW())`,
            [
                line.id,
                productId,
                options.score === undefined ? null : Number(options.score),
                options.source || (options.manual ? 'manual' : 'auto'),
                options.manual === true,
                options.comment || null
            ]
        );
        await client.query(
            `UPDATE edo_lines SET matched_product_id = $1, match_status = $2, updated_at = NOW() WHERE id = $3`,
            [
                productId,
                options.manual ? 'manual' : (options.source === 'auto' ? 'auto' : 'matched'),
                line.id
            ]
        );
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
    line.matched_product_id = productId;
    line.match_status = options.manual ? 'manual' : (options.source === 'auto' ? 'auto' : 'matched');
    return buildLinePayload(docflowId, line, options.includeCandidates !== false);
}

async function clearLineMatch(docflowId, lineIndex, options = {}) {
    const line = await getLineRecord(docflowId, lineIndex);
    if (!line) {
        const error = new Error('Строка документа не найдена');
        error.statusCode = 404;
        throw error;
    }
    await runQuery('UPDATE edo_line_matches SET is_selected = false WHERE edo_line_id = $1', [line.id]);
    await runQuery('UPDATE edo_lines SET matched_product_id = NULL, match_status = $2, updated_at = NOW() WHERE id = $1', [line.id, 'pending']);
    line.matched_product_id = null;
    line.match_status = 'pending';
    return buildLinePayload(docflowId, line, options.includeCandidates !== false);
}

function mapSampleLinePayload(index, sampleLine, withCandidates) {
    const payload = {
        index,
        name: sampleLine.name,
        quantity: Number(sampleLine.quantity || 0),
        unitName: sampleLine.unitName || '',
        price: Number(sampleLine.price || 0),
        subtotal: Number(sampleLine.subtotal || 0),
        vatRate: sampleLine.vatRate || '',
        barcode: sampleLine.barcode || '',
        article: sampleLine.article || '',
        matchStatus: 'pending',
        match: null,
        matchedProductId: null,
        raw: sampleLine
    };
    if (withCandidates) {
        payload.candidates = [];
    }
    return payload;
}

async function buildLinePayload(docflowId, lineRow, withCandidates = true) {
    const matchRecord = await fetchSelectedMatch(lineRow.id);
    const raw = lineRow.raw_json || {};
    let match = null;
    if (matchRecord) {
        const product = await inventoryStore.getProductById(matchRecord.product_id);
        match = {
            productId: matchRecord.product_id,
            productName: product ? product.name : null,
            productType: product ? product.type : null,
            source: matchRecord.match_source,
            score: Number(matchRecord.match_score || 0),
            manual: Boolean(matchRecord.manual),
            comment: matchRecord.comment || null
        };
    } else if (lineRow.matched_product_id) {
        const product = await inventoryStore.getProductById(lineRow.matched_product_id);
        if (product) {
            match = {
                productId: product.id,
                productName: product.name,
                productType: product.type,
                source: lineRow.match_status === 'manual' ? 'manual' : 'persisted',
                score: 1,
                manual: lineRow.match_status === 'manual'
            };
        }
    }

    const base = {
        index: lineRow.line_index,
        name: lineRow.name,
        quantity: Number(lineRow.quantity || 0),
        unitName: lineRow.unit_name,
        price: Number(lineRow.price || 0),
        subtotal: Number(lineRow.subtotal || 0),
        vatRate: lineRow.vat_rate,
        barcode: lineRow.barcode,
        article: raw.ItemVendorCode || raw.VendorCode || raw.article || null,
        matchStatus: lineRow.match_status || (match ? 'matched' : 'pending'),
        match,
        matchedProductId: lineRow.matched_product_id || (match ? match.productId : null),
        raw
    };

    if (!withCandidates) {
        return base;
    }

    const candidates = await buildCandidatesForLine(base);
    base.candidates = candidates;
    return base;
}

router.get('/matching-rules', async (req, res) => {
    try {
        const rules = await loadMatchingRules(true);
        const enriched = await Promise.all(rules.map(async (rule) => {
            const product = await inventoryStore.getProductById(rule.product_id);
            return {
                id: rule.id,
                barcode: rule.barcode,
                article: rule.article,
                synonym: rule.synonym,
                productId: rule.product_id,
                note: rule.note,
                productName: product ? product.name : null,
                createdAt: rule.created_at
            };
        }));
        res.json({ ok: true, rules: enriched });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Не удалось загрузить правила сопоставления', details: error.message });
    }
});

router.post('/matching-rules', async (req, res) => {
    const { productId, barcode, article, synonym, note } = req.body || {};
    if (!productId) {
        return res.status(400).json({ ok: false, error: 'Не указан productId' });
    }
    const product = await inventoryStore.getProductById(productId);
    if (!product) {
        return res.status(404).json({ ok: false, error: 'Товар для правила не найден' });
    }
    try {
        const result = await runQuery(
            `INSERT INTO matching_rules (barcode, article, synonym, product_id, note, created_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             RETURNING *`,
            [barcode || null, article || null, synonym || null, productId, note || null]
        );
        await invalidateMatchingRules();
        await writeAudit(req, 'matching_rule_create', null, { productId, barcode, article, synonym });
        const rule = result.rows[0];
        res.json({
            ok: true,
            rule: {
                id: rule.id,
                barcode: rule.barcode,
                article: rule.article,
                synonym: rule.synonym,
                productId: rule.product_id,
                note: rule.note,
                productName: product.name,
                createdAt: rule.created_at
            }
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Не удалось создать правило', details: error.message });
    }
});

router.delete('/matching-rules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await runQuery('DELETE FROM matching_rules WHERE id = $1', [id]);
        await invalidateMatchingRules();
        await writeAudit(req, 'matching_rule_delete', null, { id });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Не удалось удалить правило', details: error.message });
    }
});

router.get('/inventory/products', async (req, res) => {
    try {
        const products = await inventoryStore.listProducts();
        res.json({ ok: true, products });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Не удалось загрузить список товаров', details: error.message });
    }
});

router.post('/inventory/products', async (req, res) => {
    const { name, type, barcode, article, synonyms, vatRate } = req.body || {};
    if (!name) {
        return res.status(400).json({ ok: false, error: 'Не указано имя товара' });
    }
    const payload = {
        id: req.body?.id || 'custom-' + Date.now(),
        name,
        type: type || 'ingredient',
        barcode: barcode || '',
        article: article || '',
        synonyms: Array.isArray(synonyms) ? synonyms : (synonyms ? [synonyms] : []),
        vatRate: vatRate || '',
        stock: 0
    };
    try {
        const product = await inventoryStore.createProduct(payload);
        await writeAudit(req, 'inventory_product_create', null, { productId: product.id, name: product.name });
        res.json({ ok: true, product });
    } catch (error) {
        res.status(500).json({ ok: false, error: 'Не удалось создать карточку товара', details: error.message });
    }
});

module.exports = router;

