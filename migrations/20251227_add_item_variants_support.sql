-- Migration: Add support for parent-child item relationships (display-only items with variants)
-- This allows grouping pizza sizes: parent card (display_only=1) + child variants (parent_id set)

-- Add display_only field: true means the item is for display only, stock is not tracked
ALTER TABLE items ADD COLUMN display_only INTEGER DEFAULT 0;

-- Add parent_id field: if set, this item is a variant of the parent item
ALTER TABLE items ADD COLUMN parent_id INTEGER;

-- Add foreign key constraint for parent_id
-- Note: SQLite doesn't support ADD CONSTRAINT, so we'll create an index instead
CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id);

-- Add index for display_only for faster queries
CREATE INDEX IF NOT EXISTS idx_items_display_only ON items(display_only);

-- Update existing items to have display_only = 0 (not display-only)
UPDATE items SET display_only = 0 WHERE display_only IS NULL;

-- Add validation: display_only items cannot have parent_id
-- SQLite doesn't support CHECK constraints on ALTER TABLE, so we'll enforce this in API
-- But we can create a trigger for additional safety
CREATE TRIGGER IF NOT EXISTS check_display_only_parent
BEFORE INSERT ON items
BEGIN
    SELECT CASE
        WHEN NEW.display_only = 1 AND NEW.parent_id IS NOT NULL THEN
            RAISE(ABORT, 'Display-only items cannot have parent_id')
    END;
END;

CREATE TRIGGER IF NOT EXISTS check_display_only_parent_update
BEFORE UPDATE ON items
BEGIN
    SELECT CASE
        WHEN NEW.display_only = 1 AND NEW.parent_id IS NOT NULL THEN
            RAISE(ABORT, 'Display-only items cannot have parent_id')
    END;
END;

