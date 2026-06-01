'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/BottomNav';
import { Search, X, ChevronRight, Star, Loader2 } from 'lucide-react';
import { CATEGORY_COLORS, DEFAULT_CATEGORIES } from '@/types';
import { formatDistanceToNow, formatDate } from '@/lib/utils';
import { getAuthToken, supabase } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const LOCAL_STORAGE_KEY = 'panpan_entries';

interface LocalEntry {
  id: string;
  content: string;
  summary: string;
  categories: string[];
  keywords: string[];
  is_favorite: boolean;
  created_at: string;
  synced: boolean;
}

interface BlockWithEntry {
  id: string;
  entry_id: string;
  category: string;
  content: string;
  summary?: string;
  keywords: string[];
  favorite_keywords: string[];
  created_at: string;
  original_content: string;
  is_favorite: boolean;
}

type TimeFilter = 'all' | 'today' | 'week' | 'month';

const TIME_FILTER_LABELS: Record<TimeFilter, string> = {
  all: '全部',
  today: '今日',
  week: '本周',
  month: '本月',
};

function loadFromLocalStorage(): LocalEntry[] {
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(entries: LocalEntry[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

export function ListPageContent() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [blocks, setBlocks] = useState<BlockWithEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<BlockWithEntry | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const categories = DEFAULT_CATEGORIES;

  // Check login status
  useEffect(() => {
    const checkLogin = async () => {
      const token = await getAuthToken();
      setIsLoggedIn(!!token);
    };
    checkLogin();
  }, []);

  // Listen for auth changes
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsLoggedIn(!!session?.user);
      fetchBlocks();
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();

      if (token) {
        // Logged in: fetch from cloud
        const params = new URLSearchParams();
        params.set('limit', '100');
        if (selectedCategory) params.set('category', selectedCategory);
        if (timeFilter !== 'all') params.set('time', timeFilter);
        if (searchQuery) params.set('q', searchQuery);

        const response = await fetch(`/api/records?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setBlocks(data);
        }
      } else {
        // Not logged in: load from localStorage
        const localEntries = loadFromLocalStorage();
        let filtered = localEntries;

        if (selectedCategory) {
          filtered = filtered.filter(e => e.categories?.includes(selectedCategory));
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(e =>
            e.content.toLowerCase().includes(q) ||
            e.keywords?.some((k: string) => k.toLowerCase().includes(q))
          );
        }

        const blockEntries: BlockWithEntry[] = filtered.map(entry => ({
          id: entry.id,
          entry_id: entry.id,
          category: entry.categories?.[0] || '其他',
          content: entry.summary || entry.content?.slice(0, 50) || '',
          summary: entry.summary,
          keywords: entry.keywords || [],
          favorite_keywords: [],
          created_at: entry.created_at,
          original_content: entry.content,
          is_favorite: entry.is_favorite || false,
        }));

        setBlocks(blockEntries);
      }
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  // Fetch when filters change
  useEffect(() => {
    fetchBlocks();
  }, [selectedCategory, timeFilter, isLoggedIn]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBlocks();
  };

  const handleCategoryClick = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
    }
  };

  const handleTimeFilterClick = (filter: TimeFilter) => {
    setTimeFilter(filter);
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setTimeFilter('all');
  };

  const handleToggleBlockFavorite = async (blockId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Optimistic UI update
    const currentBlock = blocks.find(b => b.id === blockId);
    const newFavoriteState = !currentBlock?.is_favorite;

    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, is_favorite: newFavoriteState } : b));
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(prev => prev ? { ...prev, is_favorite: newFavoriteState } : null);
    }

    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/blocks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ block_id: blockId, is_favorite: newFavoriteState }),
      });

      if (response.ok) {
        toast.success(newFavoriteState ? '已收藏' : '已取消收藏');

        // Update localStorage if not logged in
        if (!token) {
          const entries = loadFromLocalStorage();
          const entry = entries.find(e => e.id === blockId);
          if (entry) {
            entry.is_favorite = newFavoriteState;
            saveToLocalStorage(entries);
          }
        }
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      // Revert on error
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, is_favorite: !newFavoriteState } : b));
      if (selectedBlock?.id === blockId) {
        setSelectedBlock(prev => prev ? { ...prev, is_favorite: !newFavoriteState } : null);
      }
      toast.error('操作失败');
    }
  };

  const handleToggleKeywordFavorite = async (blockId: string, keyword: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Keyword favorite not supported in local mode yet
    toast.info('请登录后使用关键词收藏');
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">知识碎片</h1>

          <div className="flex gap-1 mt-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(Object.keys(TIME_FILTER_LABELS) as TimeFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => handleTimeFilterClick(filter)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                  timeFilter === filter
                    ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {TIME_FILTER_LABELS[filter]}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索..."
                className="pl-9 pr-9 bg-gray-100 dark:bg-gray-800 border-0"
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(''); fetchBlocks(); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </form>

          <ScrollArea className="mt-3 w-full">
            <div className="flex gap-2 pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex-shrink-0 ${
                    selectedCategory === cat.name
                      ? 'text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}
                  style={
                    selectedCategory === cat.name
                      ? { backgroundColor: CATEGORY_COLORS[cat.name] || CATEGORY_COLORS['其他'] }
                      : {}
                  }
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>

          {selectedCategory && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-indigo-600 dark:text-indigo-400">
                筛选：{selectedCategory}
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 h-7">
                清除
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : blocks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {selectedCategory ? `「${selectedCategory}」分类下没有内容` : '还没有找到相关碎片'}
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                {selectedCategory ? '尝试其他分类或时间筛选' : '尝试不同的关键词或分类'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                onClick={() => setSelectedBlock(block)}
                className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[block.category] || '#6B7280'}20`,
                      color: CATEGORY_COLORS[block.category] || '#6B7280',
                    }}
                  >
                    {block.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {block.content}
                    </p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {block.keywords?.slice(0, 3).map((kw, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          #{kw}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(block.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleToggleBlockFavorite(block.id, e)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                          <Star className={`w-4 h-4 ${block.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
                        </button>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400">展开</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!selectedBlock} onOpenChange={() => setSelectedBlock(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${CATEGORY_COLORS[selectedBlock?.category || ''] || '#6B7280'}20`,
                    color: CATEGORY_COLORS[selectedBlock?.category || ''] || '#6B7280',
                  }}
                >
                  {selectedBlock?.category}
                </span>
                <DialogTitle className="text-base font-normal">
                  {selectedBlock && formatDate(selectedBlock.created_at)}
                </DialogTitle>
              </div>
              {selectedBlock && (
                <button
                  onClick={() => handleToggleBlockFavorite(selectedBlock.id)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <Star className={`w-5 h-5 ${selectedBlock.is_favorite ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
                </button>
              )}
            </div>
          </DialogHeader>

          {selectedBlock && (
            <div className="space-y-4">
              {selectedBlock.summary && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2">一句话总结</p>
                  <p className="text-amber-700 dark:text-amber-300">{selectedBlock.summary}</p>
                </div>
              )}

              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">知识碎片</p>
                <p className="text-indigo-700 dark:text-indigo-300">{selectedBlock.content}</p>
              </div>

              {selectedBlock.keywords && selectedBlock.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBlock.keywords.map((kw, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400">
                      #{kw}
                    </span>
                  ))}
                </div>
              )}

              {selectedBlock.original_content && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-500 font-medium mb-2">原始全文</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{selectedBlock.original_content}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}