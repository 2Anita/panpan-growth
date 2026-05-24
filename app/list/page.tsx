import { Suspense } from 'react';
import { ListPageContent } from '@/components/ListPageContent';

function LoadingFallback() {
  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-6">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">复盘列表</h1>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </main>
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ListPageContent />
    </Suspense>
  );
}