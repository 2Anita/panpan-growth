-- Migration: Add content_blocks and user_categories for atomic search
-- Run this AFTER the initial migration

-- 1. Rename old categories table to user_categories
ALTER TABLE categories RENAME TO user_categories;

-- 2. Create content_blocks table (stores AI-extracted精华)
CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES records(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,  -- AI提取的一两句话精华
  keywords TEXT[] DEFAULT '{}',
  is_manual BOOLEAN DEFAULT false,  -- 是否用户手动添加
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_content_blocks_user_id ON content_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_entry_id ON content_blocks(entry_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_category ON content_blocks(user_id, category);
CREATE INDEX IF NOT EXISTS idx_content_blocks_created_at ON content_blocks(created_at DESC);

-- Create GIN index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_content_blocks_content_gin ON content_blocks USING gin(to_tsvector('simple', content));

-- Create GIN index for keywords array
CREATE INDEX IF NOT EXISTS idx_content_blocks_keywords ON content_blocks USING gin(keywords);

-- Add foreign key constraint for content_blocks
ALTER TABLE content_blocks ADD CONSTRAINT fk_content_blocks_entry_id
  FOREIGN KEY (entry_id) REFERENCES records(id) ON DELETE CASCADE;

-- Enable RLS on content_blocks
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

-- Policy for content_blocks
CREATE POLICY "Users can CRUD their own content_blocks"
  ON content_blocks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Update user_categories to be more flexible
-- Add new columns
ALTER TABLE user_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE user_categories ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT '{}';
ALTER TABLE user_categories ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0;
ALTER TABLE user_categories ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Update system categories with new keywords
UPDATE user_categories SET keywords = ARRAY[
  CASE name
    WHEN '创意灵感' THEN '想法,创意,灵感,脑洞,创新,新颖'
    WHEN '问题解决' THEN '问题,解决,处理,办法,方案,优化'
    WHEN '情绪变化' THEN '感觉,情绪,心情,感受,开心,难过'
    WHEN '技术学习' THEN '学习,技术,知识,代码,编程,教程'
    WHEN '行动TODO' THEN '要做,计划,待办,行动,完成'
    WHEN '其他' THEN '其他'
  END
] WHERE is_system = true;

-- 4. Create function to update category usage stats
CREATE OR REPLACE FUNCTION update_category_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_categories
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE user_id = NEW.user_id AND name = NEW.category;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats when content_block is created
CREATE TRIGGER update_category_usage
  AFTER INSERT ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION update_category_usage_stats();

-- 5. Create function to search content_blocks by category or keyword
CREATE OR REPLACE FUNCTION search_content_blocks(
  p_user_id UUID,
  p_category TEXT DEFAULT NULL,
  p_keyword TEXT DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  entry_id UUID,
  category TEXT,
  content TEXT,
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.id,
    cb.entry_id,
    cb.category,
    cb.content,
    cb.keywords,
    cb.created_at
  FROM content_blocks cb
  WHERE cb.user_id = p_user_id
    AND (p_category IS NULL OR cb.category = p_category)
    AND (
      p_keyword IS NULL OR
      p_keyword = ANY(cb.keywords) OR
      EXISTS (SELECT 1 FROM unnest(cb.keywords) kw WHERE kw LIKE '%' || p_keyword || '%')
    )
    AND (
      p_search_text IS NULL OR
      to_tsvector('simple', cb.content) @@ plainto_tsquery('simple', p_search_text)
    )
  ORDER BY cb.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create function to get category statistics
CREATE OR REPLACE FUNCTION get_category_stats(p_user_id UUID, p_days INT DEFAULT 30)
RETURNS TABLE (
  category TEXT,
  block_count BIGINT,
  percentage NUMERIC
) AS $$
DECLARE
  total_blocks BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_blocks
  FROM content_blocks
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN QUERY
  SELECT
    cb.category,
    COUNT(*) as block_count,
    ROUND((COUNT(*)::NUMERIC / total_blocks::NUMERIC) * 100, 1) as percentage
  FROM content_blocks cb
  WHERE cb.user_id = p_user_id
    AND cb.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY cb.category
  ORDER BY block_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger for updating updated_at on content_blocks
CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Create view for combined entry with blocks (for UI display)
CREATE OR REPLACE VIEW entries_with_blocks AS
SELECT
  r.id as entry_id,
  r.user_id,
  r.content as original_content,
  r.content_type,
  r.created_at as entry_created_at,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'id', cb.id,
      'category', cb.category,
      'content', cb.content,
      'keywords', cb.keywords
    ) ORDER BY cb.created_at)
    FROM content_blocks cb WHERE cb.entry_id = r.id),
    '[]'::jsonb
  ) as blocks
FROM records r;

-- Grant select on view
GRANT SELECT ON entries_with_blocks TO anon;