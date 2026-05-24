-- Add is_favorite column to records table
ALTER TABLE records ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Add index for favorite queries
CREATE INDEX IF NOT EXISTS idx_records_is_favorite ON records(is_favorite) WHERE is_favorite = true;