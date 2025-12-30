-- Add missing 'markup' column to recipes table
-- This fixes the error: "SQLSTATE[HY000]: General error: 1 table recipes has no column named markup"

ALTER TABLE recipes ADD COLUMN markup DECIMAL(10,2) DEFAULT 0;

-- Add index for better performance if needed
CREATE INDEX IF NOT EXISTS idx_recipes_markup ON recipes(markup);
