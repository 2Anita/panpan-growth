'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BottomNav } from '@/components/BottomNav';
import { Search, X, Calendar, ChevronRight, Star, ArrowLeft } from 'lucide-react';
import { ContentBlock, CATEGORY_COLORS, DEFAULT_CATEGORIES } from '@/types';
import { formatDistanceToNow, formatDate } from '@/lib/utils';
import { getAuthToken } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
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
  created_at: string;
  original_content: string;
  is_favorite?: boolean;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<BlockWithEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlock, setSelectedBlock] = useState<BlockWithEntry | null>(null);

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/records?limit=100', { headers });
      if (response.ok) {
        const records = await response.json();
        // Filter to only favorites
        const favoriteRecords = records.filter((r: any) => r.is_favorite);

        // Extract blocks from favorite records
        const favoriteBlocks: BlockWithEntry[] = [];
        favoriteRecords.forEach((record: any) => {
          if (record.blocks && Array.isArray(record.blocks)) {
            record.blocks.forEach((block: any) => {
              favoriteBlocks.push({
                ...block,
                original_content: record.content,
                is_favorite: record.is_favorite,
              });
            });
          }
        });

        // Sort by created_at desc
        favoriteBlocks.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setBlocks(favoriteBlocks);
      }
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
      toast.error('获取收藏失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfavorite = async (blockId: string) => {
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/blocks', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ block_id: blockId, is_favorite: false }),
      });

      if (response.ok) {
        toast.success('已取消收藏');
        // Remove from list
        setBlocks(prev => prev.filter(b => b.id !== blockId));
      }
    } catch (error) {
      console.error('Failed to unfavorite:', error);
      toast.error('操作失败');
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">我的收藏</h1>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1 ml-10">
            {blocks.length} 条收藏记录
          </p>
        </div>
      </header>

      {/* Favorites List */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : blocks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">⭐</div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                还没有收藏内容
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                点击记录卡片的星星图标即可收藏
              </p>
              <Button
                className="mt-4 bg-indigo-500 hover:bg-indigo-600"
                onClick={() => router.push('/')}
              >
                去复盘
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <div
                key={block.id}
                className="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow"
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
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(block.created_at)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUnfavorite(block.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                        >
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </button>
                        <button
                          onClick={() => setSelectedBlock(block)}
                          className="text-indigo-600 dark:text-indigo-400 text-xs"
                        >
                          展开
                        </button>
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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
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
          </DialogHeader>

          {selectedBlock && (
            <div className="space-y-4">
              {/* Extracted Content */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-2">
                  知识碎片
                </p>
                <p className="text-indigo-700 dark:text-indigo-300">
                  {selectedBlock.content}
                </p>
              </div>

              {/* Keywords */}
              {selectedBlock.keywords && selectedBlock.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedBlock.keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400"
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