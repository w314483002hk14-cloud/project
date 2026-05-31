import { Suspense } from 'react';
import { getSchoolData } from '@/lib/nycu';
import SocialView from '@/components/SocialView';

export default async function SocialPage() {
  const schools = await getSchoolData();
  return (
    <Suspense fallback={<div className="p-6 text-center text-slate-500">載入討論區…</div>}>
      <SocialView schools={schools} />
    </Suspense>
  );
}