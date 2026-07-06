import { getSchoolData } from '@/lib/nycu';
import { getQsRankings } from '@/lib/qs-data';
import MapView from '@/components/map/MapView';

export default async function Home() {
  const [schools, qsData] = await Promise.all([getSchoolData(), getQsRankings()]);
  return <MapView schools={schools} qsRankings={qsData.schools} />;
}
