'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { Plus, Trash2, Sun, Moon, FileText, Database, AlertTriangle, Star, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CATEGORY_COLORS, DEFAULT_CATEGORIES } from '@/types';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#6B7280',
];

const PRESET_ICONS = ['💡', '🔧', '💗', '📚', '✨', '✅', '🎯', '🌟', '📝', '🔥', '💪', '🎨'];

interface CategoryItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
  keywords?: string[];
  sort_order?: number;
  usage_count?: number;
  last_used_at?: string | null;
}

export function SettingsPageContent() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES as CategoryItem[]);
  const [isDark, setIsDark] = useState(theme === 'dark');
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Add/Edit category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6');
  const [newCategoryIcon, setNewCategoryIcon] = useState('💡');
  const [savingCategory, setSavingCategory] = useState(false);

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Export loading
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setIsDark(theme === 'dark');
    loadCategories();
  }, [theme]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/records?categories_only=true');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setCategories(data);
        }
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleToggleTheme = () => {
    toggleTheme();
  };

  // Open add category modal
  const handleAddCategory = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryColor('#8B5CF6');
    setNewCategoryIcon('💡');
    setShowCategoryModal(true);
  };

  // Open edit category modal
  const handleEditCategory = (category: CategoryItem) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setNewCategoryColor(category.color);
    setNewCategoryIcon(category.icon);
    setShowCategoryModal(true);
  };

  // Save category (add or update) - now persists to API
  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('请输入分类名称');
      return;
    }

    setSavingCategory(true);
    try {
      const response = await fetch('/api/categories', {
        method: editingCategory ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCategory?.id,
          name: newCategoryName,
          color: newCategoryColor,
          icon: newCategoryIcon,
        }),
      });

      if (!response.ok) throw new Error('Failed to save category');

      toast.success(editingCategory ? '分类已更新' : '标签已同步至 AI 脑库');

      // Reload categories
      await loadCategories();
      setShowCategoryModal(false);
    } catch (error) {
      console.error('Failed to save category:', error);
      toast.error('保存分类失败');
    } finally {
      setSavingCategory(false);
    }
  };

  // Open delete confirmation
  const handleDeleteClick = (category: CategoryItem) => {
    setCategoryToDelete(category);
    setShowDeleteModal(true);
  };

  // Confirm delete category
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    setDeletingCategory(true);
    try {
      const response = await fetch(`/api/categories?id=${categoryToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok && response.status !== 204) throw new Error('Failed to delete');

      toast.success('分类已删除');

      // Reload categories
      await loadCategories();
      setShowDeleteModal(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast.error('删除分类失败');
    } finally {
      setDeletingCategory(false);
    }
  };

  // Export as Markdown
  const handleExportMarkdown = async () => {
    setExporting(true);
    toast.info('正在导出...');
    try {
      const response = await fetch('/api/records?limit=1000');
      const records = await response.json();

      let markdown = '# 盘盘成长复盘数据导出\n\n';
      markdown += `导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
      markdown += `共 ${records.length} 条复盘记录\n\n`;

      // Group by date
      const groupedByDate: Record<string, typeof records> = {};
      records.forEach((record: any) => {
        const date = new Date(record.created_at).toLocaleDateString('zh-CN');
        if (!groupedByDate[date]) groupedByDate[date] = [];
        groupedByDate[date].push(record);
      });

      for (const [date, dateRecords] of Object.entries(groupedByDate)) {
        markdown += `## ${date}\n\n`;
        dateRecords.forEach((record: any) => {
          const categories = record.blocks?.map((b: any) => b.category).join(', ') || '其他';
          markdown += `### ${categories}\n\n`;
          markdown += `${record.content}\n\n`;
          if (record.summary) {
            markdown += `> 精华：${record.summary}\n\n`;
          }
          // Add keywords if any
          const keywords = record.blocks?.[0]?.keywords;
          if (keywords && keywords.length > 0) {
            markdown += `关键词：${keywords.map((k: string) => '#' + k).join(' ')}\n\n`;
          }
          markdown += '---\n\n';
        });
      }

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `盘盘成长复盘导出_${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  // Export as JSON
  const handleExportJSON = async () => {
    setExporting(true);
    toast.info('正在导出...');
    try {
      const response = await fetch('/api/records?limit=1000');
      const records = await response.json();

      const exportData = {
        exported_at: new Date().toISOString(),
        total_records: records.length,
        categories: categories.map(c => ({
          name: c.name,
          color: c.color,
          icon: c.icon,
          is_system: c.is_system,
        })),
        records: records.map((record: any) => ({
          id: record.id,
          content: record.content,
          content_type: record.content_type,
          categories: record.categories,
          summary: record.summary,
          is_favorite: record.is_favorite,
          created_at: record.created_at,
          blocks: record.blocks?.map((b: any) => ({
            category: b.category,
            content: b.content,
            keywords: b.keywords,
          })),
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `盘盘成长复盘导出_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">设置</h1>
        <p className="text-sm text-gray-500 mt-1">管理你的个性化偏好</p>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Theme Toggle */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              外观
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  深色模式
                </p>
                <p className="text-xs text-gray-500">
                  {isDark ? '已开启' : '已关闭'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sun className={`w-4 h-4 ${!isDark ? 'text-amber-500' : 'text-gray-400'}`} />
                <Switch checked={isDark} onCheckedChange={handleToggleTheme} />
                <Moon className={`w-4 h-4 ${isDark ? 'text-indigo-500' : 'text-gray-400'}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Management */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">分类管理</CardTitle>
                <CardDescription>自定义你的复盘分类</CardDescription>
              </div>
              <Button size="sm" onClick={handleAddCategory}>
                <Plus className="w-4 h-4 mr-1" />
                添加
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingCategories ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无分类</p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    {category.icon}
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {category.name}
                  </span>
                  {category.is_system && (
                    <span className="text-xs text-gray-400 px-2">系统</span>
                  )}
                  {!category.is_system && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditCategory(category)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(category)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">数据管理</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleExportMarkdown}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              导出为 Markdown
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={handleExportJSON}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              导出为 JSON
            </Button>
          </CardContent>
        </Card>

        {/* Favorites */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              我的收藏
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={() => router.push('/favorites')}
            >
              <span className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                查看所有收藏
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">关于盘盘成长</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-500">
            <p>版本 1.0.0</p>
            <p>一款极简的个人成长复盘工具</p>
            <p className="text-xs mt-4 text-gray-400">
              通过极低摩擦的方式记录日常思考、学习和情绪，
              由 AI 自动结构化分类、总结，生成周/月成长报告。
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Add/Edit Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? '编辑分类' : '添加新分类'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>分类名称</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="输入分类名称"
              />
            </div>
            <div className="space-y-2">
              <Label>选择颜色</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewCategoryColor(color)}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      newCategoryColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>选择图标</Label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewCategoryIcon(icon)}
                    className={`w-10 h-10 rounded-lg text-xl transition-colors ${
                      newCategoryIcon === icon
                        ? 'bg-indigo-100 dark:bg-indigo-900'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
              取消
            </Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory}>
              {savingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              确认删除
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-700 dark:text-gray-300">
              确定要删除分类 "{categoryToDelete?.name}" 吗？
            </p>
            <p className="text-sm text-gray-500 mt-2">
              删除后，该分类下的所有记录将自动移至"其他"分类。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingCategory}>
              {deletingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}