import { getSchoolData } from '@/lib/nycu';
import WishlistView from '@/components/WishlistView';

export default async function WishlistPage() {
  const schools = await getSchoolData();
  return <WishlistView schools={schools} />;
}