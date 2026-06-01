-- Migration: Update table names to match user's existing schema (entries, categories, tags)
-- Run this in your Supabase SQL Editor

-- 1. Create entries table if not exists
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT '其他',
  keywords TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create categories table if not exists
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📝',
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create tags table if not exists
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL UNIQUE,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (allow all operations for authenticated users)
DROP POLICY IF EXISTS "entries_policy" ON entries;
CREATE POLICY "entries_policy" ON entries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "categories_policy" ON categories;
CREATE POLICY "categories_policy" ON categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tags_policy" ON tags;
CREATE POLICY "tags_policy" ON tags FOR ALL USING (true) WITH CHECK (true);

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(user_id, category);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- 7. Insert default categories for existing users
INSERT INTO categories (user_id, name, color, icon, sort_order, is_system)
SELECT DISTINCT ON (user_id) user_id, name, color, icon, sort_order, true
FROM (
  VALUES
    ('创意灵感', '#8B5CF6', '💡', 1),
    ('问题解决', '#3B82F6', '🔧', 2),
    ('情绪变化', '#EC4899', '💗', 3),
    ('技术学习', '#10B981', '📚', 4),
    ('行动TODO', '#F97316', '✅', 5)
) AS defaults(name, color, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id = auth.uid())
ON CONFLICT (user_id, name) DO NOTHING;