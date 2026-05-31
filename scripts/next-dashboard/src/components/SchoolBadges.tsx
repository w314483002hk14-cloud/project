import type { QsSchoolRanking } from '@/lib/qs';
import {
  formatQsRankingDetail,
  formatQsWorldLabel,
  formatSubjectBadge,
  normalizeQsWorldRank,
} from '@/lib/qs-display';

export function PioneerBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-violet-600/90 px-2.5 py-0.5 text-[11px] font-semibold text-white ${className}`}
    >
      拓荒者計畫
    </span>
  );
}

export function QsRankBadges({
  ranking,
  maxSubjects = 2,
  wrap = false,
}: {
  ranking?: QsSchoolRanking | null;
  maxSubjects?: number;
  /** Allow multi-line badges (school browser) */
  wrap?: boolean;
}) {
  const worldRank = normalizeQsWorldRank(ranking?.world_rank);
  const subjects = ranking?.subjects ?? [];

  if (!worldRank && subjects.length === 0) return null;

  const badgeText = wrap ? 'text-[11px] font-normal leading-tight' : 'text-[11px] font-semibold leading-snug';
  const badgePad = wrap ? 'px-2 py-0.5' : 'px-2.5 py-1';

  const badgeClass = wrap
    ? `inline-flex max-w-full items-start rounded-lg bg-amber-500/90 ${badgePad} ${badgeText} text-slate-950 whitespace-normal break-words`
    : `inline-flex w-fit max-w-full items-start rounded-lg bg-amber-500/90 ${badgePad} ${badgeText} text-slate-950 whitespace-normal break-words`;

  const worldBadgeClass = wrap
    ? `inline-flex w-fit items-center rounded-full bg-amber-500 ${badgePad} ${badgeText} text-slate-950`
    : `inline-flex w-fit shrink-0 items-center rounded-full bg-amber-500 ${badgePad} ${badgeText} text-slate-950`;

  return (
    <div className={`flex gap-1.5 ${wrap ? 'flex-col items-start' : 'flex-row flex-wrap items-start'}`}>
      {worldRank ? (
        <span className={worldBadgeClass}>QS世界 #{worldRank}</span>
      ) : ranking?.qs_title ? (
        <span
          className={`inline-flex w-fit shrink-0 items-center rounded-full bg-amber-500/70 ${badgePad} ${badgeText} text-slate-950`}
          title="此校在 QS 資料庫中但未列入 2026 世界排名榜"
        >
          QS世界 未列入
        </span>
      ) : null}
      {subjects.slice(0, maxSubjects).map((subject) => (
        <span key={subject.subject} className={badgeClass}>
          {formatSubjectBadge(subject.subject, subject.rank)}
        </span>
      ))}
    </div>
  );
}

export function SchoolMetaBadges({
  isPioneer,
  ranking,
  maxSubjects = 2,
  wrap = false,
}: {
  isPioneer?: boolean;
  ranking?: QsSchoolRanking | null;
  maxSubjects?: number;
  wrap?: boolean;
}) {
  if (!isPioneer && !ranking?.world_rank && !ranking?.subjects?.length && !ranking?.qs_title) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {isPioneer ? <PioneerBadge className="w-fit" /> : null}
      <QsRankBadges ranking={ranking} maxSubjects={maxSubjects} wrap={wrap} />
    </div>
  );
}

export function QsDetailBlock({ ranking }: { ranking?: QsSchoolRanking | null }) {
  return (
    <div className="whitespace-pre-line text-sm leading-6 text-stone-600">
      {formatQsRankingDetail(ranking)}
    </div>
  );
}

export function QsRankingDetailValue({ ranking }: { ranking?: QsSchoolRanking | null }) {
  return formatQsRankingDetail(ranking);
}

/** @deprecated use formatQsWorldLabel from qs-display */
export { formatQsWorldLabel };
