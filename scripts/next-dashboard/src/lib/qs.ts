export type QsSubjectRank = {
  subject: string;
  rank: number;
};

export type QsSchoolRanking = {
  world_rank: number | string | null;
  world_rank_display: string | null;
  subjects: QsSubjectRank[];
  qs_title?: string | null;
};

export type QsRankingData = {
  synced_at: string;
  source: string;
  schools: Record<string, QsSchoolRanking>;
};

export function formatWorldRank(rank: QsSchoolRanking['world_rank']) {
  if (rank === null || rank === undefined || rank === '') return null;
  const text = String(rank).replace(/^=+/, '');
  return `#${text}`;
}

export function formatSubjectRankLabel(subjects: QsSubjectRank[]) {
  if (!subjects.length) return null;
  const top = subjects.slice(0, 2);
  return top.map((s) => `${s.subject.split(' ')[0]} #${s.rank}`).join(' · ');
}

export function getBestSubjectSummary(subjects: QsSubjectRank[]) {
  if (!subjects.length) return '無資料';
  const best = [...subjects].sort((a, b) => a.rank - b.rank)[0];
  return `${best.subject} #${best.rank}`;
}
