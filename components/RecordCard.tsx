'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Star, Loader2 } from 'lucide-react';
import { ReflectionRecord, ContentBlock, CATEGORY_COLORS } from '@/types';
import { formatDistanceToNow } from '@/lib/utils';
import { toast } from 'sonner';

interface RecordCardProps {
  record: ReflectionRecord & { blocks?: ContentBlock[] };
  onTagClick?: (tag: string) => void;
}

export function RecordCard({ record, onTagClick }: RecordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(record.is_favorite || false);
  const [isToggling, setIsToggling] = useState(false);

  const blocks = record.blocks || [];
  const primaryBlock = blocks[0];

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isToggling) return;

    setIsToggling(true);
    try {
      // Send PATCH request to toggle favorite for THIS specific record only
      const response = await fetch('/api/records', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: record.id,  // This ensures only this record is updated
          is_favorite: !isFavorite
        }),
      });

      if (response.ok) {
        const updated = await response.json();
        // Only update the local state for this specific record
        setIsFavorite(updated.is_favorite);
        toast.success(updated.is_favorite ? '已收藏' : '已取消收藏');
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      toast.error('操作失败');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <Card
      className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${
        isExpanded ? 'shadow-md' : ''
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="space-y-3">
        {/* Display primary block's content (1-2 lines summary) */}
        {primaryBlock ? (
          <div className="space-y-2">
            <p className="text-gray-800 dark:text-gray-200 text-base leading-relaxed">
              {primaryBlock.content}
            </p>
            {blocks.length > 1 && (
              <p className="text-xs text-gray-400">
                +{blocks.length - 1}个分类
              </p>
            )}
          </div>
        ) : (
          <p className="text-gray-500 text-sm italic">无精华内容</p>
        )}

        {/* Category Tags - Clickable */}
        {blocks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {blocks.map((block, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(block.category);
                }}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[block.category] || '#6B7280'}20`,
                  color: CATEGORY_COLORS[block.category] || '#6B7280',
                }}
              >
                {block.category}
              </button>
            ))}
          </div>
        )}

        {/* Keywords (max 3) */}
        {primaryBlock?.keywords && primaryBlock.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {primaryBlock.keywords.slice(0, 3).map((kw, idx) => (
              <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
                #{kw}
              </span>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(record.created_at)}
          </span>
          <button
            onClick={handleToggleFavorite}
            disabled={isToggling}
            className="p-1 -mr-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isToggling ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : (
              <Star
                className={`w-5 h-5 transition-colors ${
                  isFavorite
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                }`}
              />
            )}
          </button>
        </div>

        {/* Expanded Detail - Only shown when clicked */}
        {isExpanded && (
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
            {/* Original Content */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">原文</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{record.content}</p>
            </div>

            {/* All Blocks Detail */}
            {blocks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">分类精华</p>
                {blocks.map((block, idx) => (
                  <div key={idx} className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[block.category] || '#6B7280'}20`,
                          color: CATEGORY_COLORS[block.category] || '#6B7280',
                        }}
                      >
                        {block.category}
                      </span>
                    </div>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">{block.content}</p>
                    {block.keywords && block.keywords.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {block.keywords.slice(0, 3).map((kw, kidx) => (
                          <span key={kidx} className="text-xs text-indigo-400">#{kw}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-gray-400 text-right">
              {new Date(record.created_at).toLocaleString()}
            </div>
          </div>
        )}

        {/* Expand/Collapse Button */}
        <button className="w-full flex items-center justify-center gap-1 py-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              展开详情
            </>
          )}
        </button>
      </div>
    </Card>
  );
}