const xml2js = require('xml2js');
const iconv = require('iconv-lite');
const AdmZip = require('adm-zip');

function safeString(v) {
    if (v === undefined || v === null) return '';
    if (Array.isArray(v)) return safeString(v[0]);
    return String(v).trim();
}

function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function sniffXmlEncoding(buffer) {
    const head = buffer.slice(0, 256).toString('ascii');
    const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
    return m ? m[1].trim().toLowerCase() : null;
}

function decodeXmlBuffer(buffer) {
    const enc = sniffXmlEncoding(buffer);
    if (!enc) {
        return buffer.toString('utf8');
    }
    if (enc.includes('1251') || enc.includes('windows-1251') || enc.includes('win-1251') || enc.includes('cp1251')) {
        return iconv.decode(buffer, 'win1251');
    }
    if (enc.includes('utf-8') || enc.includes('utf8')) {
        return buffer.toString('utf8');
    }
    try {
        return iconv.decode(buffer, enc);
    } catch (_) {
        return buffer.toString('utf8');
    }
}

function findFirstNodeByKey(node, key) {
    if (!node || typeof node !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(node, key)) {
        return node[key];
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findFirstNodeByKey(item, key);
            if (found) return found;
        }
        return null;
    }
    for (const value of Object.values(node)) {
        const found = findFirstNodeByKey(value, key);
        if (found) return found;
    }
    return null;
}

function pickFirstValueByKeys(node, keys) {
    for (const key of keys) {
        const found = findFirstNodeByKey(node, key);
        if (found) {
            const val = safeString(found);
            if (val) return val;
        }
    }
    return '';
}

function safeNumber(value) {
    const str = safeString(value).replace(',', '.');
    const num = Number(str);
    return Number.isFinite(num) ? num : 0;
}

async function parseUtdOnNschfdopprXml(buffer) {
    const xmlText = decodeXmlBuffer(buffer);
    const doc = await xml2js.parseStringPromise(xmlText, { explicitArray: false, mergeAttrs: true });

    const table = findFirstNodeByKey(doc, 'ТаблСчФакт');
    if (!table) {
        return { ok: false, reason: 'no_table', meta: {}, lines: [] };
    }
    const rawLines = toArray(table.СведТов);

    const meta = {
        number: pickFirstValueByKeys(doc, ['НомерСчФ', 'НомерДок', 'НомерДокум', 'Номер', 'DocNumber', 'InvoiceNumber']),
        date: pickFirstValueByKeys(doc, ['ДатаСчФ', 'ДатаДок', 'ДатаДокум', 'Дата', 'DocDate', 'InvoiceDate']),
        supplier_name: '',
        supplier_inn: '',
        supplier_kpp: '',
        buyer_name: '',
        buyer_inn: '',
        buyer_kpp: ''
    };

    const seller = findFirstNodeByKey(doc, 'СвПрод') || findFirstNodeByKey(doc, 'Продавец');
    if (seller) {
        meta.supplier_name = pickFirstValueByKeys(seller, ['НаимОрг', 'Наим', 'ОргПрод', 'OrganizationName', 'Name']);
        const id = findFirstNodeByKey(seller, 'ИдСв') || seller;
        meta.supplier_inn = pickFirstValueByKeys(id, ['ИНН', 'Inn']);
        meta.supplier_kpp = pickFirstValueByKeys(id, ['КПП', 'Kpp']);
    }

    const buyer = findFirstNodeByKey(doc, 'СвПокуп') || findFirstNodeByKey(doc, 'Покупатель');
    if (buyer) {
        meta.buyer_name = pickFirstValueByKeys(buyer, ['НаимОрг', 'Наим', 'ОргПокуп', 'OrganizationName', 'Name']);
        const id = findFirstNodeByKey(buyer, 'ИдСв') || buyer;
        meta.buyer_inn = pickFirstValueByKeys(id, ['ИНН', 'Inn']);
        meta.buyer_kpp = pickFirstValueByKeys(id, ['КПП', 'Kpp']);
    }

    const lines = rawLines
        .filter(Boolean)
        .map((line) => {
            const extra = line.ДопСведТов || null;
            const skuExternal = safeString(line.КодТов) || safeString(extra?.КодТов) || '';
            const gtin = safeString(extra?.ГТИН) || '';
            const unit = safeString(line.НаимЕдИзм) || safeString(line.ОКЕИ_Тов) || '';
            return {
                line_index: safeNumber(line.НомСтр) || null,
                name: safeString(line.НаимТов),
                sku_external: skuExternal,
                gtin,
                unit,
                quantity_purchase: safeNumber(line.КолТов),
                purchase_price: safeNumber(line.ЦенаТов),
                total_without_vat: safeNumber(line.СтТовБезНДС),
                vat_rate: safeString(line.НалСт),
                vat_amount: safeNumber(line.СумНДС || line.СумНал),
                total_with_vat: safeNumber(line.СтТовУчНал),
                raw: line
            };
        });

    return { ok: true, format: 'ON_NSCHFDOPPR', meta, lines };
}

function extractXmlFromZip(buffer) {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    return entries
        .filter((e) => {
            if (e.isDirectory) return false;
            const name = (e.entryName || '').toLowerCase();
            if (!name) return false;
            if (name.endsWith('.pdf')) return false;
            if (!name.endsWith('.xml')) return false;
            if (name.endsWith('.sig')) return false;
            if (name.includes('_sgn_')) return false;
            if (name.includes('signature')) return false;
            // Prefer UTD invoices
            if (name.includes('on_nschfdoppr')) return true;
            // fallback: keep xml, parser will decide
            return true;
        })
        .map((e) => ({ name: e.entryName, buffer: e.getData() }));
}

async function parseDiadocPackage(buffer, filename = '') {
    const lower = (filename || '').toLowerCase();
    const xmlFiles = lower.endsWith('.zip') ? extractXmlFromZip(buffer) : [{ name: filename || 'upload.xml', buffer }];
    const results = [];
    for (const item of xmlFiles) {
        try {
            const parsed = await parseUtdOnNschfdopprXml(item.buffer);
            if (parsed.ok && parsed.lines.length) {
                results.push({ filename: item.name, ...parsed });
                continue;
            }
        } catch (_) {
            // ignore and fallback
        }

        try {
            const fallback = await parseInvoiceXml(item.buffer);
            if (fallback?.lines?.length) {
                results.push({ filename: item.name, ok: true, format: 'heuristic', meta: fallback.meta || {}, lines: fallback.lines || [] });
            }
        } catch (e) {
            results.push({ filename: item.name, ok: false, error: e.message });
        }
    }
    return results;
}

function looksLikeLine(item) {
    if (!item || typeof item !== 'object') return false;
    const keys = Object.keys(item).map((k) => k.toLowerCase());
    const hasName = keys.some((k) => /name|наименование|description|descr|title/.test(k));
    const hasQty = keys.some((k) => /qty|quantity|кол|количество/.test(k));
    const hasPrice = keys.some((k) => /price|цена|sum/.test(k));
    return hasName && (hasQty || hasPrice);
}

function findArrays(obj) {
    const found = [];
    function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            if (node.length > 0 && typeof node[0] === 'object') found.push(node);
            node.forEach(walk);
            return;
        }
        Object.values(node).forEach(walk);
    }
    walk(obj);
    return found;
}

async function parseInvoiceXml(buffer) {
    const text = decodeXmlBuffer(buffer);
    const doc = await xml2js.parseStringPromise(text, { explicitArray: false, mergeAttrs: true });

    // Try to find candidate arrays that look like invoice lines
    const arrays = findArrays(doc);
    let lines = [];
    for (const arr of arrays) {
        // arr might be array or object
        const items = Array.isArray(arr) ? arr : arr.item ? (Array.isArray(arr.item) ? arr.item : [arr.item]) : null;
        if (!items) continue;
        const sample = items[0];
        if (looksLikeLine(sample)) {
            // normalize items
            lines = items.map((it) => {
                const obj = {};
                // find name-like
                for (const k of Object.keys(it)) {
                    const lk = k.toLowerCase();
                    if (/name|наименование|descr|description|title/.test(lk)) obj.name = safeString(it[k]);
                    if (/qty|quantity|кол|количество/.test(lk)) obj.quantity = parseFloat(safeString(it[k]).replace(',', '.')) || 0;
                    if (/unit|единиц|edizm/.test(lk)) obj.unit = safeString(it[k]);
                    if (/price|цена/.test(lk)) obj.price = parseFloat(safeString(it[k]).replace(',', '.')) || 0;
                    if (/code|артикул|код/.test(lk)) obj.code = safeString(it[k]);
                }
                // fallback attempts
                obj.name = obj.name || safeString(it['Наименование'] || it['Name'] || it['Description'] || it['ItemName']);
                obj.quantity = obj.quantity || parseFloat(safeString(it['Количество'] || it['Quantity']) || 0) || obj.quantity || 0;
                obj.price = obj.price || parseFloat(safeString(it['Цена'] || it['Price']) || 0) || obj.price || 0;
                return obj;
            });
            if (lines.length) break;
        }
    }

    // Metadata: try common tags
    const meta = {};
    function pickFirst(keys) {
        for (const k of keys) {
            const v = (doc && doc[k]) || (doc?.Document && doc.Document[k]);
            if (v) return safeString(v);
        }
        return '';
    }
    meta.number = pickFirst(['Номер', 'Number', 'InvoiceNumber', 'DocNumber']);
    meta.date = pickFirst(['Дата', 'Date', 'InvoiceDate', 'DocDate']);
    meta.supplier = pickFirst(['Supplier', 'Поставщик', 'Seller', 'Organization']);

    return { meta, lines };
}

module.exports = {
    parseInvoiceXml,
    parseUtdOnNschfdopprXml,
    parseDiadocPackage
};
