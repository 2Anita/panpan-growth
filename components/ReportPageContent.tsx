'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ReportChart } from '@/components/ReportChart';
import { BottomNav } from '@/components/BottomNav';
import { TrendingUp, AlertCircle, CheckSquare, Calendar } from 'lucide-react';
import { WeeklyReportContent, CATEGORY_COLORS } from '@/types';

interface ReportPageContentProps {
  weeklyReport?: WeeklyReportContent;
  monthlyReport?: WeeklyReportContent;
}

export function ReportPageContent({ weeklyReport, monthlyReport }: ReportPageContentProps) {
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');

  const currentReport = activeTab === 'weekly' ? weeklyReport : monthlyReport;

  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">成长报告</h1>
        <p className="text-sm text-gray-500 mt-1">回顾你的成长轨迹</p>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'weekly' | 'monthly')}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="weekly" className="gap-2">
              <Calendar className="w-4 h-4" />
              周报
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <Calendar className="w-4 h-4" />
              月报
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly" className="mt-6 space-y-6">
            {weeklyReport ? (
              <ReportContent report={weeklyReport} />
            ) : (
              <EmptyState type="weekly" />
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-6 space-y-6">
            {monthlyReport ? (
              <ReportContent report={monthlyReport} />
            ) : (
              <EmptyState type="monthly" />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />
    </div>
  );
}

function ReportContent({ report }: { report: WeeklyReportContent }) {
  const categoryData = Object.entries(report.category_distribution || {}).map(
    ([name, value]) => ({
      name,
      value: value as number,
    })
  );

  return (
    <>
      <div className="text-center mb-6">
        <p className="text-sm text-gray-500">{report.period}</p>
        <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
          共 {report.total_records} 条复盘
        </p>
      </div>

      {categoryData.length > 0 && (
        <ReportChart data={categoryData} title="分类分布" />
      )}

      {report.top_progress && report.top_progress.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              本周最大进步
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.top_progress.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report.improvements && report.improvements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              待改进
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.improvements.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 text-sm font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <p className="text-sm text-gray-700 dark:text-gray-300">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {report.todo_summary && report.todo_summary.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-500" />
              行动 TODO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.todo_summary.map((todo, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-gray-700 dark:text-gray-300">{todo}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function EmptyState({ type }: { type: 'weekly' | 'monthly' }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center">
        <div className="text-5xl mb-4">{type === 'weekly' ? '📊' : '📈'}</div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          {type === 'weekly' ? '本周' : '本月'}还没有数据
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          继续保持记录的习惯<br />
          {type === 'weekly' ? '周末' : '月末'}将自动生成报告
        </p>
      </CardContent>
    </Card>
  );
}