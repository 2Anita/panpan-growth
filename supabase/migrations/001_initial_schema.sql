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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user_id and created_at for efficient querying
CREATE INDEX IF NOT EXISTS idx_records_user_id ON records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_user_created ON records(user_id, created_at DESC);

-- Categories table (custom categories per user)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📝',
  sort_order INT DEFAULT 0,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create index for user categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Category adjustments table (tracks user corrections for AI learning)
CREATE TABLE IF NOT EXISTS category_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id UUID REFERENCES records(id) ON DELETE CASCADE,
  original_categories TEXT[] NOT NULL,
  adjusted_categories TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for user adjustments
CREATE INDEX IF NOT EXISTS idx_category_adjustments_user_id ON category_adjustments(user_id);

-- Weekly reports table
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  category_stats JSONB DEFAULT '{}',
  top_progress JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  todo_summary TEXT[] DEFAULT '{}',
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Create index for user reports
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_id ON weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_week ON weekly_reports(user_id, week_start DESC);

-- Monthly reports table
CREATE TABLE IF NOT EXISTS monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  category_stats JSONB DEFAULT '{}',
  top_progress JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  todo_summary TEXT[] DEFAULT '{}',
  content JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month)
);

-- Create index for user monthly reports
CREATE INDEX IF NOT EXISTS idx_monthly_reports_user_id ON monthly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(user_id, month DESC);

-- Row Level Security (RLS) policies
ALTER TABLE records ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Records policies
CREATE POLICY "Users can CRUD their own records"
  ON records FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Categories policies
CREATE POLICY "Users can CRUD their own categories"
  ON categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Category adjustments policies
CREATE POLICY "Users can CRUD their own category adjustments"
  ON category_adjustments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Weekly reports policies
CREATE POLICY "Users can CRUD their own weekly reports"
  ON weekly_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Monthly reports policies
CREATE POLICY "Users can CRUD their own monthly reports"
  ON monthly_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to insert default categories for new users
CREATE OR REPLACE FUNCTION insert_default_categories(new_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO categories (user_id, name, color, icon, sort_order, is_system)
  VALUES
    (new_user_id, '创意灵感', '#8B5CF6', '💡', 0, true),
    (new_user_id, '问题解决', '#3B82F6', '🔧', 1, true),
    (new_user_id, '情绪变化', '#EC4899', '💗', 2, true),
    (new_user_id, '技术学习', '#10B981', '📚', 3, true),
    (new_user_id, '行动TODO', '#F59E0B', '✅', 4, true),
    (new_user_id, '其他', '#6B7280', '📝', 5, true);
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