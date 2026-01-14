const { distance } = require('fastest-levenshtein');

const REFERENCE_PRODUCTS = [
    { id: 'p1', name: 'Пицца Маргарита', category: 'pizza', barcode: '4620001234567' },
    { id: 'p2', name: 'Пицца Пепперони', category: 'pizza', barcode: '4620009876543' },
    { id: 'c1', name: 'Комбо «Ролл-дей»', category: 'combo', barcode: null },
    { id: 'd1', name: 'Газировка', category: 'drink', barcode: '4601234500001' },
    { id: 'r1', name: 'Ролл с крабом', category: 'roll', barcode: '4680001112233' }
];

const STOP_SUFFIXES = ['ами', 'ями', 'ками', 'ский', 'ыми', 'ими', 'ого', 'его', 'ому', 'ему', 'ах', 'ях', 'ов', 'ев', 'ая', 'яя', 'ий', 'ый', 'ой', 'ей', 'ых', 'их', 'ия', 'ие'];

function normalize(text) {
    if (!text) return '';
    const base = String(text)
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[^a-z0-9\u0400-\u04FF\s]/g, ' ');
    const tokens = base.split(/\s+/).filter(Boolean).map(stemToken);
    return tokens.join(' ');
}

function stemToken(token) {
    if (!token) return token;
    let result = token;
    for (const suffix of STOP_SUFFIXES) {
        if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
            result = token.slice(0, token.length - suffix.length);
            break;
        }
    }
    return result;
}

function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 0;
    const dist = distance(a, b);
    return Math.max(0, 1 - dist / maxLen);
}

function tokenize(text) {
    return normalize(text).split(' ').filter(Boolean);
}

function tokenOverlapScore(a, b) {
    const tokensA = new Set(tokenize(a));
    const tokensB = new Set(tokenize(b));
    if (!tokensA.size || !tokensB.size) return 0;
    let match = 0;
    tokensA.forEach((tok) => {
        if (tokensB.has(tok)) match += 1;
    });
    return match / Math.max(tokensA.size, tokensB.size);
}

function candidateScore(source, candidate) {
    const normSource = normalize(source);
    const normCandidate = normalize(candidate.name || candidate.title || candidate);
    const lev = similarity(normSource, normCandidate);
    const overlap = tokenOverlapScore(source, candidate.name || candidate.title || candidate);
    return Number(((lev * 0.6) + (overlap * 0.4)).toFixed(3));
}

function detectBarcodeFromRow(row) {
    for (const cell of row) {
        if (!cell) continue;
        const digits = String(cell).replace(/[^0-9]/g, '');
        if (digits.length === 13 || digits.length === 12) {
            return digits.slice(0, 13);
        }
    }
    return null;
}

function suggestForRows(rows, headers, reference = REFERENCE_PRODUCTS) {
    const nameIndex = findNameColumn(headers);
    const suggestions = [];
    let matchedRows = 0;
    let scoreSum = 0;
    let barcodeHits = 0;

    rows.forEach((row, rowIndex) => {
        const sourceName = nameIndex !== -1 ? row[nameIndex] : (row.find((cell) => typeof cell === 'string' && cell.trim().length > 0) || '');
        const normalizedSource = normalize(sourceName);
        const candidates = reference.map((candidate) => {
            const score = candidateScore(sourceName, candidate);
            return {
                id: candidate.id,
                name: candidate.name,
                category: candidate.category,
                barcode: candidate.barcode,
                score,
                reason: score >= 0.6 ? 'Высокое совпадение' : score >= 0.4 ? 'Похожее название' : 'Низкая похожесть'
            };
        }).sort((a, b) => b.score - a.score).slice(0, 3);

        const best = candidates[0];
        const rowBarcode = detectBarcodeFromRow(row);
        if (rowBarcode) {
            barcodeHits += 1;
        }
        if (best && best.score >= 0.35) {
            matchedRows += 1;
            scoreSum += best.score;
        }

        suggestions.push({
            rowIndex,
            sourceName,
            normalizedSource,
            barcode: rowBarcode,
            candidates,
            bestMatch: best,
            status: best && best.score >= 0.6 ? 'confident' : best && best.score >= 0.35 ? 'review' : 'unmatched'
        });
    });

    const metrics = {
        rowsTotal: rows.length,
        withSuggestions: matchedRows,
        unmatchedRows: rows.length - matchedRows,
        avgScore: matchedRows ? Number((scoreSum / matchedRows).toFixed(3)) : 0,
        barcodeHits,
        timestamp: new Date().toISOString()
    };

    return { suggestions, metrics };
}

function findNameColumn(headers) {
    if (!Array.isArray(headers)) return -1;
    const lower = headers.map((header, idx) => ({ idx, header: String(header || '').toLowerCase() }));
    const candidate = lower.find(({ header }) => header.includes('name') || header.includes('наимен') || header.includes('товар'));
    return candidate ? candidate.idx : -1;
}

function analyseDataset(headers, rows, referenceCatalog) {
    const targetReference = Array.isArray(referenceCatalog) && referenceCatalog.length ? referenceCatalog : REFERENCE_PRODUCTS;
    return suggestForRows(rows || [], headers || [], targetReference);
}

module.exports = {
    analyseDataset,
    normalize
};
