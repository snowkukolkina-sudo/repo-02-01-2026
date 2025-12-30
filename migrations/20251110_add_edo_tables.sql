-- Table: edo_documents
CREATE TABLE IF NOT EXISTS edo_documents (
    id SERIAL PRIMARY KEY,
    docflow_id VARCHAR(80) UNIQUE NOT NULL,
    type VARCHAR(64),
    status VARCHAR(64),
    counterparty VARCHAR(160),
    date TIMESTAMP WITH TIME ZONE,
    total NUMERIC(14,2),
    raw_xml TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edo_documents_docflow ON edo_documents(docflow_id);

-- Table: edo_lines
CREATE TABLE IF NOT EXISTS edo_lines (
    id SERIAL PRIMARY KEY,
    edo_document_id INTEGER REFERENCES edo_documents(id) ON DELETE CASCADE,
    line_index INTEGER NOT NULL,
    name TEXT,
    quantity NUMERIC(14,4),
    unit_name VARCHAR(32),
    price NUMERIC(14,4),
    subtotal NUMERIC(14,4),
    vat_rate VARCHAR(16),
    barcode VARCHAR(64),
    raw_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edo_lines_document ON edo_lines(edo_document_id);

-- Table: edo_signatures
CREATE TABLE IF NOT EXISTS edo_signatures (
    id SERIAL PRIMARY KEY,
    edo_document_id INTEGER REFERENCES edo_documents(id) ON DELETE CASCADE,
    signer VARCHAR(160),
    status VARCHAR(32),
    signature BYTEA,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: edo_line_matches
CREATE TABLE IF NOT EXISTS edo_line_matches (
    id SERIAL PRIMARY KEY,
    edo_line_id INTEGER REFERENCES edo_lines(id) ON DELETE CASCADE,
    product_id VARCHAR(64),
    match_score NUMERIC(6,3),
    match_source VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: store manual rules
CREATE TABLE IF NOT EXISTS matching_rules (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(64),
    article VARCHAR(64),
    synonym TEXT,
    product_id VARCHAR(64),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure receipts table has edo_document reference
ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS edo_document_id INTEGER REFERENCES edo_documents(id);

