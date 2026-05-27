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
import { getAuthToken } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BlockWithEntry {
  id: string;
  entry_id: string;
  category: string;
  content: string;
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

export function ListPageContent() {
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get('category') || null
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [blocks, setBlocks] = useState<BlockWithEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<BlockWithEntry | null>(null);

  const categories = DEFAULT_CATEGORIES;

  // Fetch blocks when filters change
  useEffect(() => {
    fetchBlocks();
  }, [selectedCategory, timeFilter]);

  const fetchBlocks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Only set category if one is explicitly selected
      if (selectedCategory) {
        params.set('category', selectedCategory);
      }

      params.set('blocks_only', 'true');

      if (timeFilter !== 'all') {
        params.set('time', timeFilter);
      }

      if (searchQuery.trim()) {
        params.set('q', searchQuery.trim());
      }

      // Get auth token for logged-in users
      const token = await getAuthToken();
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/records?${params.toString()}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setBlocks(data);
      } else {
        throw new Error('Failed to fetch');
      }
    } catch (error) {
      console.error('Failed to fetch blocks:', error);
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

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

  // Block-level favorite toggle - only affects THIS specific block
  const handleToggleBlockFavorite = async (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Optimistic UI update - immediately change the star color
    setBlocks(prev =>
      prev.map(b =>
        b.id === blockId ? { ...b, is_favorite: !b.is_favorite } : b
      )
    );

    // Update modal if open
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(prev => prev ? { ...prev, is_favorite: !prev.is_favorite } : null);
    }

    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/blocks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ block_id: blockId }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle favorite');
      }

      const updatedBlock = await response.json();

      // Update with server response
      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId ? { ...b, is_favorite: updatedBlock.is_favorite } : b
        )
      );

      if (selectedBlock?.id === blockId) {
        setSelectedBlock(prev => prev ? { ...prev, is_favorite: updatedBlock.is_favorite } : null);
      }

      toast.success(updatedBlock.is_favorite ? '已收藏' : '已取消收藏');
    } catch (error) {
      console.error('Failed to toggle block favorite:', error);
      // Revert optimistic update on error
      setBlocks(prev =>
        prev.map(b =>
          b.id === blockId ? { ...b, is_favorite: !b.is_favorite } : b
        )
      );
      if (selectedBlock?.id === blockId) {
        setSelectedBlock(prev => prev ? { ...prev, is_favorite: !prev.is_favorite } : null);
      }
      toast.error('操作失败');
    }
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setTimeFilter('all');
  };

  // Keyword-level favorite toggle - only affects THIS specific keyword
  const handleToggleKeywordFavorite = async (blockId: string, keyword: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const isCurrentlyFavorite = block.favorite_keywords?.includes(keyword);
    const newFavoriteState = !isCurrentlyFavorite;

    // Optimistic UI update
    setBlocks(prev =>
      prev.map(b => {
        if (b.id !== blockId) return b;
        const favKeywords = b.favorite_keywords || [];
        return {
          ...b,
          favorite_keywords: newFavoriteState
            ? [...favKeywords, keyword]
            : favKeywords.filter(k => k !== keyword),
        };
      })
    );

    // Update modal if open
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(prev => {
        if (!prev) return null;
        const favKeywords = prev.favorite_keywords || [];
        return {
          ...prev,
          favorite_keywords: newFavoriteState
            ? [...favKeywords, keyword]
            : favKeywords.filter(k => k !== keyword),
        };
      });
    }

    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/blocks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ block_id: blockId, keyword, is_favorite: newFavoriteState }),
      });

      if (!response.ok) throw new Error('Failed to toggle keyword favorite');

      toast.success(newFavoriteState ? '关键词已收藏' : '已取消收藏');
    } catch (error) {
      console.error('Failed to toggle keyword favorite:', error);
      // Revert optimistic update
      setBlocks(prev =>
        prev.map(b => {
          if (b.id !== blockId) return b;
          const favKeywords = b.favorite_keywords || [];
          return {
            ...b,
            favorite_keywords: isCurrentlyFavorite
              ? [...favKeywords, keyword]
              : favKeywords.filter(k => k !== keyword),
          };
        })
      );
      toast.error('操作失败');
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">知识碎片</h1>

          {/* Time Filter Tabs */}
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

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedCategory ? `在「${selectedCategory}」中搜索...` : '搜索所有碎片...'}
                className="pl-9 pr-9 bg-gray-100 dark:bg-gray-800 border-0"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    fetchBlocks();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </form>

          {/* Category Chips */}
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

          {/* Active Filter Indicator */}
          {selectedCategory && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-indigo-600 dark:text-indigo-400">
                筛选：{selectedCategory}
                {searchQuery && ` + 关键词"${searchQuery}"`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-gray-500 h-7"
              >
                清除
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Blocks List */}
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
              {selectedCategory && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={clearFilters}
                >
                  清除筛选
                </Button>
              )}
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
                  {/* Category Tag */}
                  <span
                    className="px-2 py-1 rounded-full text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[block.category] || '#6B7280'}20`,
                      color: CATEGORY_COLORS[block.category] || '#6B7280',
                    }}
                  >
                    {block.category}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                      {block.content}
                    </p>

                    {/* Keywords (max 3) */}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {block.keywords && block.keywords.length > 0 && (
                        <>
                          {block.keywords.slice(0, 3).map((kw, idx) => {
                            const isFav = block.favorite_keywords?.includes(kw);
                            return (
                              <button
                                key={idx}
                                onClick={(e) => handleToggleKeywordFavorite(block.id, kw, e)}
                                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                  isFav
                                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                #{kw} {isFav ? '★' : '☆'}
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(block.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Star button - only toggles THIS block's favorite */}
                        <button
                          onClick={(e) => handleToggleBlockFavorite(block.id, e)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              block.is_favorite
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-gray-400'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-indigo-600 dark:text-indigo-400">
                          展开
                        </span>
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

      {/* Block Detail Modal */}
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
                  onClick={(e) => handleToggleBlockFavorite(selectedBlock.id, e)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                >
                  <Star
                    className={`w-5 h-5 ${
                      selectedBlock.is_favorite
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-gray-400'
                    }`}
                  />
                </button>
              )}
            </div>
          </DialogHeader>

          {selectedBlock && (
            <div className="space-y-4">
              {/* Extracted Content (1句话总结) */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">
                  知识碎片
                </p>
                <p className="text-indigo-700 dark:text-indigo-300 text-base">
                  {selectedBlock.content}
                </p>
              </div>

              {/* Keywords */}
              {selectedBlock.keywords && selectedBlock.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBlock.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400"
                    >
                      #{kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Original Content */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <p className="text-xs text-gray-500 font-medium mb-2">
                  原始全文
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {selectedBlock.original_content}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}