'use client';

import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FABProps {
  onClick: () => void;
  className?: string;
}

export function FAB({ onClick, className }: FABProps) {
  return (
    <Button
      onClick={onClick}
      className={`fixed bottom-24 right-4 w-14 h-14 rounded-full shadow-lg bg-indigo-500 hover:bg-indigo-600 transition-transform hover:scale-105 active:scale-95 z-30 ${className || ''}`}
    >
      <Mic className="w-6 h-6 text-white" />
    </Button>
  );
}