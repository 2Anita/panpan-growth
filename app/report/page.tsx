import { ReportPageContent } from '@/components/ReportPageContent';
import { WeeklyReportContent } from '@/types';

export default async function ReportPage() {
  // For demo purposes, we'll show empty state since we don't have auth set up yet
  const weeklyReport: WeeklyReportContent | undefined = undefined;
  const monthlyReport: WeeklyReportContent | undefined = undefined;

  return <ReportPageContent weeklyReport={weeklyReport} monthlyReport={monthlyReport} />;
}