// Record types
export interface ReflectionRecord {
  id: string;
  user_id: string;
  content: string;  // 原始输入
  content_type: 'text' | 'voice' | 'image';
  summary: string | null;
  tags: string[];  // 分类标签
  categories: string[];
  todos: string[];
  raw_ai_response: Record<string, unknown> | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'classified';
}

// Content Blocks (AI提取的精华内容块)
export interface ContentBlock {
  id: string;
  user_id: string;
  entry_id: string;
  category: string;
  content: string;  // AI提取的一两句话精华
  keywords: string[];
  favorite_keywords: string[];  // 用户单独收藏的关键词
  is_manual: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

// User Categories (用户自定义分类)
export interface UserCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  is_system: boolean;
  description?: string;
  keywords?: string[];  // 分类关键词，用于AI匹配
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}

// UI State types
export type ContentType = 'text' | 'voice' | 'image';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

export interface RecordingResult {
  text: string;
  duration?: number;
}

// Filter types
export interface RecordFilters {
  date_from?: string;
  date_to?: string;
  tags?: string[];
  search?: string;
  category?: string;  // 按分类筛选
  keyword?: string;    // 按关键词筛选
}

// Weekly Report types
export interface WeeklyReportContent {
  period: string;
  total_records: number;
  category_distribution: Record<string, number>;
  top_progress: string[];
  improvements: string[];
  todo_summary: string[];
  generated_at: string;
}

// Category Statistics
export interface CategoryStats {
  category: string;
  block_count: number;
  percentage: number;
}

// Entry with Blocks (组合视图)
export interface EntryWithBlocks {
  entry_id: string;
  user_id: string;
  original_content: string;
  content_type: 'text' | 'voice' | 'image';
  entry_created_at: string;
  blocks: ContentBlock[];
}

// Default categories
export const DEFAULT_CATEGORIES: UserCategory[] = [
  { id: 'sys-1', user_id: 'system', name: '创意灵感', color: '#8B5CF6', icon: '💡', keywords: ['想法', '创意', '灵感', '脑洞', '创新', '新颖'], sort_order: 1, is_system: true, usage_count: 0, last_used_at: null, created_at: '' },
  { id: 'sys-2', user_id: 'system', name: '问题解决', color: '#3B82F6', icon: '🔧', keywords: ['问题', '解决', '处理', '办法', '方案', '优化'], sort_order: 2, is_system: true, usage_count: 0, last_used_at: null, created_at: '' },
  { id: 'sys-3', user_id: 'system', name: '情绪变化', color: '#EC4899', icon: '💗', keywords: ['感觉', '情绪', '心情', '感受', '开心', '难过'], sort_order: 3, is_system: true, usage_count: 0, last_used_at: null, created_at: '' },
  { id: 'sys-4', user_id: 'system', name: '技术学习', color: '#10B981', icon: '📚', keywords: ['学习', '技术', '知识', '代码', '编程', '教程'], sort_order: 4, is_system: true, usage_count: 0, last_used_at: null, created_at: '' },
  { id: 'sys-5', user_id: 'system', name: '内心感受', color: '#F59E0B', icon: '✨', keywords: ['感受', '内心', '心情', '情绪', '体会', '感悟'], sort_order: 5, is_system: true, usage_count: 0, last_used_at: null, created_at: '' },
  { id: 'sys-6', user_id: 'system', name: '行动TODO', color: '#F97316', icon: '✅', keywords: ['要做', '计划', '待办', '行动', '完成', '任务'], sort_order: 6, is_system: true, usage_count: 0, last_used_at: null, created_at: '' },
];

// Category color map
export const CATEGORY_COLORS: Record<string, string> = {
  '创意灵感': '#8B5CF6',
  '问题解决': '#3B82F6',
  '情绪变化': '#EC4899',
  '技术学习': '#10B981',
  '内心感受': '#F59E0B',
  '行动TODO': '#F97316',
  '其他': '#6B7280',
};