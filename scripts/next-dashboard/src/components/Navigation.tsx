import Link from 'next/link';

export default function Navigation() {
  return (
    <nav className="bg-gray-900 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">NYCU Exchange Dashboard</h1>
        <div className="space-x-4">
          <Link href="/map" className="hover:text-gray-300">地圖</Link>
          <Link href="/school-browser" className="hover:text-gray-300">瀏覽學校</Link>
          <Link href="/wishlist" className="hover:text-gray-300">收藏</Link>
          <Link href="/social" className="hover:text-gray-300">社群</Link>
          <Link href="/scholarships" className="hover:text-gray-300">獎學金</Link>
        </div>
      </div>
    </nav>
  );
}