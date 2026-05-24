'use client';

import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORY_COLORS } from '@/types';

interface ReportChartProps {
  data: {
    name: string;
    value: number;
  }[];
  title?: string;
}

export function ReportChart({ data, title }: ReportChartProps) {
  const router = useRouter();

  const chartData = data.map((item) => ({
    name: item.name,
    value: item.value,
    color: CATEGORY_COLORS[item.name] || '#6B7280',
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const handlePieClick = (entry: any) => {
    if (entry && entry.name) {
      router.push(`/list?category=${encodeURIComponent(entry.name)}`);
    }
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => {
        if (data.length > 0) {
          router.push('/list');
        }
      }}
    >
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="pb-2">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                onClick={handlePieClick}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="transparent"
                    className="transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => {
                  const numValue = Number(value) || 0;
                  return [
                    `${((numValue / total) * 100).toFixed(1)}%`,
                    '',
                  ];
                }}
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value) => (
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 text-center text-sm text-gray-500">
          点击分类区块跳转到列表 · 共 {total} 条记录
        </div>
      </CardContent>
    </Card>
  );
}