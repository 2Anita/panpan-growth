-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Records table (main table for reflection entries)
CREATE TABLE IF NOT EXISTS records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'voice', 'image')),
  summary TEXT,
  keywords TEXT[] DEFAULT '{}',
  categories TEXT[] DEFAULT '{}',
  todos TEXT[] DEFAULT '{}',
  raw_ai_response JSONB,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user_id and created_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_user_created ON records(user_id, created_at DESC);

-- Content blocks table (AI extracted knowledge blocks)
CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES records(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT '其他',
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  favorite_keywords TEXT[] DEFAULT '{}',
  is_manual BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for content blocks
CREATE INDEX IF NOT EXISTS idx_content_blocks_user_id ON content_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_entry_id ON content_blocks(entry_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_category ON content_blocks(user_id, category);
CREATE INDEX IF NOT EXISTS idx_content_blocks_created_at ON content_blocks(created_at DESC);

-- User categories table (custom categories per user)
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📝',
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  keywords TEXT[] DEFAULT '{}',
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create index for user categories
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);

-- Row Level Security (RLS) policies
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

-- Records policies
CREATE POLICY "Users can CRUD their own records"
  ON records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Content blocks policies
CREATE POLICY "Users can CRUD their own content blocks"
  ON content_blocks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User categories policies
CREATE POLICY "Users can CRUD their own categories"
  ON user_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to insert default categories for new users
CREATE OR REPLACE FUNCTION insert_default_categories(new_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO user_categories (user_id, name, color, icon, sort_order, is_system)
  VALUES
    (new_user_id, '创意灵感', '#8B5CF6', '💡', 1, true),
    (new_user_id, '问题解决', '#3B82F6', '🔧', 2, true),
    (new_user_id, '情绪变化', '#EC4899', '💗', 3, true),
    (new_user_id, '技术学习', '#10B981', '📚', 4, true),
    (new_user_id, '行动TODO', '#F59E0B', '✅', 5, true),
    (new_user_id, '其他', '#6B7280', '📝', 6, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to insert default categories when a new user is created
CREATE OR REPLACE FUNCTION on_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM insert_default_categories(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION on_auth_user_created();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_records_updated_at
  BEFORE UPDATE ON records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();