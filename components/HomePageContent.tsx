'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { InputCard } from '@/components/InputCard';
import { BottomNav } from '@/components/BottomNav';
import { RecordCard } from '@/components/RecordCard';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { ReflectionRecord, DEFAULT_CATEGORIES, CATEGORY_COLORS } from '@/types';

export function HomePageContent() {
  const [records, setRecords] = useState<ReflectionRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { user, signInAnon, isAuthenticated, loading } = useAuth();

  const today = new Date();
  const greeting = getGreeting();

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecords();
    }
  }, [isAuthenticated]);

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/records?limit=10');
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to fetch records:', error);
    }
  };

  const handleSubmit = async (content: string) => {
    if (!isAuthenticated) {
      toast.error('请先登录');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          content_type: 'text',
          preferredCategory: selectedCategory
        }),
      });

      if (!response.ok) throw new Error('Failed to save record');

      const newRecord = await response.json();
      setRecords((prev) => [newRecord, ...prev]);
      toast.success('复盘已保存');
      setSelectedCategory(null);
      setPendingText('');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceClick = () => {
    if (!isAuthenticated) {
      toast.error('请先登录');
    }
  };

  const handleCategorySelect = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <div className="text-5xl mb-4">👋</div>
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
              欢迎使用盘盘成长
            </h3>
            <p className="text-sm text-gray-500 mt-2 mb-4">
              请先登录后再使用
            </p>
            <button
              onClick={signInAnon}
              className="px-6 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
            >
              匿名登录
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-6">
        <div className="max-w-lg mx-auto">
          <p className="text-sm text-gray-500">{formatDate(today.toISOString())}</p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
            {greeting}，今天你复盘了吗？
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Quick Category Buttons */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            {selectedCategory ? (
              <span className="text-indigo-600 dark:text-indigo-400">
                已选择「{selectedCategory}」分类，AI会优先归类到此分类
              </span>
            ) : (
              '选择分类可优先归类（可选）'
            )}
          </p>
          <div className="flex gap-2 flex-wrap">
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategorySelect(cat.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                  selectedCategory === cat.name
                    ? 'text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                style={
                  selectedCategory === cat.name
                    ? { backgroundColor: CATEGORY_COLORS[cat.name] || '#6366F1' }
                    : {}
                }
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {records.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-gray-500">最近的复盘</h2>
            {records.slice(0, 3).map((record) => (
              <RecordCard key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">🌱</div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                还没有复盘记录
              </h3>
              <p className="text-sm text-gray-500 mt-2">
                开始今天的第一次复盘吧<br />
                点击下方输入框或使用语音输入
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <InputCard
        onSubmit={handleSubmit}
        onVoiceClick={handleVoiceClick}
        isSubmitting={isSubmitting}
        initialText={pendingText}
      />

      <BottomNav />
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  if (hour < 22) return '晚上好';
  return '夜深了';
}