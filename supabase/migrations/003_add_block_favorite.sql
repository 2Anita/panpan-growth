-- Migration: Add is_favorite to content_blocks and fix category persistence
-- Run this to add favorite functionality at block level

-- 1. Add is_favorite column to content_blocks
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

-- 2. Create index for favorite queries
CREATE INDEX IF NOT EXISTS idx_content_blocks_is_favorite ON content_blocks(is_favorite) WHERE is_favorite = true;

-- 3. Update RLS policy to allow favorite toggle
DROP POLICY IF EXISTS "Users can CRUD their own content_blocks" ON content_blocks;
CREATE POLICY "Users can CRUD their own content_blocks"
  ON content_blocks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Create update function for toggling block favorite
CREATE OR REPLACE FUNCTION toggle_block_favorite(p_block_id UUID)
RETURNS content_blocks AS $$
DECLARE
  v_current_favorite BOOLEAN;
  v_updated_block content_blocks;
BEGIN
  -- Get current favorite status
  SELECT is_favorite INTO v_current_favorite
  FROM content_blocks
  WHERE id = p_block_id;

  -- Toggle it
  UPDATE content_blocks
  SET is_favorite = NOT v_current_favorite,
      updated_at = NOW()
  WHERE id = p_block_id
  RETURNING * INTO v_updated_block;

  RETURN v_updated_block;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant execute on function
GRANT EXECUTE ON FUNCTION toggle_block_favorite TO anon;