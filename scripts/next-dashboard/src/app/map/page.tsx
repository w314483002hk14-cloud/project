import { getSchoolData } from '@/lib/nycu';
import { getQsRankings } from '@/lib/qs-data';
import MapView from '@/components/MapView';

export default async function MapPage() {
  const [schools, qsData] = await Promise.all([getSchoolData(), getQsRankings()]);
  return <MapView schools={schools} qsRankings={qsData.schools} />;
}
