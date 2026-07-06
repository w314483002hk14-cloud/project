import { getScholarships } from '@/lib/scholarships';
import ScholarshipsView from '@/components/scholarships/ScholarshipsView';

export default async function ScholarshipsPage() {
  const data = await getScholarships();
  return <ScholarshipsView initialItems={data.items} syncedAt={data.synced_at} source={data.source} />;
}
