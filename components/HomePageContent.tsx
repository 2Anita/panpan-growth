'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { InputCard } from '@/components/InputCard';
import { BottomNav } from '@/components/BottomNav';
import { RecordCard } from '@/components/RecordCard';
import { toast } from 'sonner';
import { formatDate } from '@/lib/utils';
import { DEFAULT_CATEGORIES, CATEGORY_COLORS } from '@/types';
import { getAuthToken, supabase } from '@/lib/supabase/client';

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

function groupBlocksByEntry(blocks: any[]) {
  const entryMap = new Map<string, any>();
  blocks.forEach(block => {
    if (!entryMap.has(block.entry_id)) {
      entryMap.set(block.entry_id, {
        id: block.entry_id,
        content: block.original_content || '',
        summary: block.content,
        keywords: block.keywords,
        categories: [block.category],
        created_at: block.created_at,
        blocks: [],
      });
    }
    entryMap.get(block.entry_id).blocks.push(block);
  });
  return Array.from(entryMap.values());
}

export function HomePageContent() {
  const [records, setRecords] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const today = new Date();
  const greeting = getGreeting();

  useEffect(() => {
    const init = async () => {
      const token = await getAuthToken();
      setIsLoggedIn(!!token);

      if (token) {
        await fetchCloudData();
      } else {
        await fetchLocalData();
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const isNowLoggedIn = !!session?.user;
      setIsLoggedIn(isNowLoggedIn);

      if (isNowLoggedIn) {
        await fetchCloudData();
      } else {
        await fetchLocalData();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchCloudData = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch('/api/records?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const grouped = groupBlocksByEntry(data);
        setRecords(grouped);

        const localEntries: LocalEntry[] = grouped.map(r => ({
          id: r.id,
          content: r.content,
          summary: r.summary,
          categories: r.categories,
          keywords: r.keywords,
          is_favorite: r.is_favorite || false,
          created_at: r.created_at,
          synced: true,
        }));
        saveToLocalStorage(localEntries);
      }
    } catch (error) {
      console.error('Failed to fetch cloud data:', error);
    }
  };

  const fetchLocalData = async () => {
    const localEntries = loadFromLocalStorage();
    const localRecords = localEntries.map(entry => ({
      id: entry.id,
      content: entry.content,
      summary: entry.summary,
      keywords: entry.keywords,
      categories: entry.categories,
      created_at: entry.created_at,
      blocks: [],
    }));
    setRecords(localRecords.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
  };

  const handleSubmit = async (content: string) => {
    if (!content.trim()) {
      toast.error('请输入内容');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/records', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          content_type: 'text',
          preferredCategory: selectedCategory
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const newRecord = await response.json();

      if (token) {
        const grouped = [{ ...newRecord, blocks: newRecord.blocks || [] }];
        setRecords(prev => [grouped[0], ...prev]);
      } else {
        const localEntries = loadFromLocalStorage();
        const newEntry: LocalEntry = {
          id: newRecord.id,
          content: newRecord.content,
          summary: newRecord.summary,
          categories: newRecord.categories,
          keywords: newRecord.keywords,
          is_favorite: false,
          created_at: newRecord.created_at,
          synced: false,
        };
        localEntries.unshift(newEntry);
        saveToLocalStorage(localEntries);

        const localRecord = {
          id: newRecord.id,
          content: newRecord.content,
          summary: newRecord.summary,
          keywords: newRecord.keywords,
          categories: newRecord.categories,
          created_at: newRecord.created_at,
          blocks: [],
        };
        setRecords(prev => [localRecord, ...prev]);
      }

      toast.success('复盘已保存');
      setSelectedCategory(null);
      setPendingText('');
    } catch {
      toast.error('保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceClick = () => {};

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