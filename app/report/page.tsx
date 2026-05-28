import { ReportPageContent } from '@/components/ReportPageContent';
import { getAuthToken } from '@/lib/supabase/client';

async function fetchReport(token: string, type: 'weekly' | 'monthly') {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/report?type=${type}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to fetch report:', error);
  }
  return null;
}

export default async function ReportPage() {
  return <ReportPageContent />;
}