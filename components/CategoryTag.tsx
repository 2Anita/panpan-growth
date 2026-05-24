'use client';

import { Badge } from '@/components/ui/badge';
import { CATEGORY_COLORS } from '@/types';

interface CategoryTagProps {
  category: string;
  size?: 'sm' | 'md';
}

export function CategoryTag({ category, size = 'sm' }: CategoryTagProps) {
  const color = CATEGORY_COLORS[category] || '#6B7280';

  return (
    <Badge
      variant="secondary"
      className={`${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}
      style={{
        backgroundColor: `${color}20`,
        color: color,
      }}
    >
      {category}
    </Badge>
  );
}