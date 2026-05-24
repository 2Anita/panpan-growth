'use client';

import { useState, useEffect, useCallback } from 'react';
import { ReflectionRecord, RecordFilters } from '@/types';

interface UseRecordsOptions {
  userId?: string;
  autoFetch?: boolean;
}

export function useRecords({ userId, autoFetch = false }: UseRecordsOptions = {}) {
  const [records, setRecords] = useState<ReflectionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<RecordFilters>({});

  const fetchRecords = useCallback(async (recordFilters?: RecordFilters) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (recordFilters?.search) params.set('q', recordFilters.search);
      if (recordFilters?.date_from) params.set('date_from', recordFilters.date_from);
      if (recordFilters?.date_to) params.set('date_to', recordFilters.date_to);
      if (recordFilters?.tags?.length) {
        params.set('tag', recordFilters.tags.join(','));
      }

      const response = await fetch(`/api/records?${params}`);
      if (!response.ok) throw new Error('Failed to fetch records');

      const data = await response.json();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  const createRecord = useCallback(async (content: string, contentType: 'text' | 'voice' | 'image' = 'text') => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, content_type: contentType }),
      });

      if (!response.ok) throw new Error('Failed to create record');

      const newRecord = await response.json();
      setRecords((prev) => [newRecord, ...prev]);
      return newRecord;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRecord = useCallback(async (id: string, updates: Partial<ReflectionRecord>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update record');

      const updatedRecord = await response.json();
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? updatedRecord : r))
      );
      return updatedRecord;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/records/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete record');

      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchRecords(filters);
    }
  }, [autoFetch, fetchRecords, filters]);

  return {
    records,
    loading,
    error,
    filters,
    setFilters,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
  };
}