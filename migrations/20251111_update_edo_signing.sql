-- Extend edo_documents with Diadoc metadata required for signatures
ALTER TABLE edo_documents
    ADD COLUMN IF NOT EXISTS message_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS entity_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS counterparty_box_id VARCHAR(80),
    ADD COLUMN IF NOT EXISTS buyer_name TEXT,
    ADD COLUMN IF NOT EXISTS seller_name TEXT,
    ADD COLUMN IF NOT EXISTS document_number VARCHAR(80),
    ADD COLUMN IF NOT EXISTS entity_type VARCHAR(64),
    ADD COLUMN IF NOT EXISTS entity_version VARCHAR(32),
    ADD COLUMN IF NOT EXISTS document_version VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_edo_documents_message ON edo_documents(message_id);

-- Store additional info about collected signatures
ALTER TABLE edo_signatures
    ADD COLUMN IF NOT EXISTS thumbprint VARCHAR(128),
    ADD COLUMN IF NOT EXISTS certificate TEXT,
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(80);

