-- Extend edo_lines with matching metadata
ALTER TABLE edo_lines
    ADD COLUMN IF NOT EXISTS matched_product_id VARCHAR(64),
    ADD COLUMN IF NOT EXISTS match_status VARCHAR(32) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_edo_lines_status ON edo_lines(match_status);
CREATE INDEX IF NOT EXISTS idx_edo_lines_matched_product ON edo_lines(matched_product_id);

-- Enhance edo_line_matches to track manual decisions
ALTER TABLE edo_line_matches
    ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS manual BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS comment TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_edo_line_matches_selected ON edo_line_matches(edo_line_id, is_selected);

-- Ensure edo_documents timestamps are refreshed automatically
ALTER TABLE edo_documents
    ALTER COLUMN updated_at SET DEFAULT NOW();
