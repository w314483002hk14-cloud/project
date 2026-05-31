import { getSchoolData } from '@/lib/nycu';
import { getQsRankings } from '@/lib/qs-data';
import SchoolBrowser from '@/components/SchoolBrowser';

export default async function SchoolBrowserPage() {
  const [schools, qsData] = await Promise.all([getSchoolData(), getQsRankings()]);
  return <SchoolBrowser schools={schools} qsRankings={qsData.schools} />;
}
