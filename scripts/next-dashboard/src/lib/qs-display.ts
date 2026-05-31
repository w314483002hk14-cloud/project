/** Common typos / aliases for QS Algolia lookup */
export function getQsSearchAliases(name: string, nameEn: string): string[] {
  const terms = new Set<string>();

  for (const raw of [name, nameEn]) {
    if (!raw) continue;
    const fixed = raw
      .replace(/Univeristy/gi, 'University')
      .replace(/\s+/g, ' ')
      .trim();
    terms.add(fixed);

    if (/Illinois.*Urbana/i.test(fixed)) {
      terms.add('University of Illinois Urbana-Champaign');
      terms.add('University of Illinois at Urbana-Champaign');
    }
    if (/French Polynesia/i.test(fixed)) {
      terms.add('University of French Polynesia');
    }
    if (/Sepuluh Nopember|ITS Surabaya/i.test(fixed)) {
      terms.add('Institut Teknologi Sepuluh Nopember');
    }
  }

  return Array.from(terms).filter(Boolean);
}

export function normalizeQsWorldRank(rank: unknown): string | null {
  if (rank === null || rank === undefined || rank === '') return null;
  const text = String(rank).trim();
  if (text === '-' || text === 'N/A' || text === 'n/a') return null;
  return text.replace(/^=+/, '');
}

export function formatQsWorldLabel(rank: unknown): string {
  const normalized = normalizeQsWorldRank(rank);
  if (!normalized) return '未列入 QS 2026';
  return `#${normalized}`;
}

export function formatSubjectBadge(subject: string, rank: number) {
  return `${subject} #${rank}`;
}

export function formatQsRankingDetail(
  ranking?: {
    world_rank?: unknown;
    subjects?: { subject: string; rank: number }[];
    qs_title?: string | null;
  } | null
): string {
  if (!ranking) {
    return 'QS 世界排名 2026：無匹配資料\nQS 科目排名 2026：無匹配資料';
  }

  const worldLabel = normalizeQsWorldRank(ranking.world_rank);
  const lines: string[] = [
    worldLabel
      ? `QS 世界排名 2026 ${formatQsWorldLabel(ranking.world_rank)}`
      : ranking.qs_title
        ? 'QS 世界排名 2026：未列入'
        : 'QS 世界排名 2026：無匹配資料',
  ];

  const subjects = ranking.subjects ?? [];
  if (subjects.length > 0) {
    for (const subject of subjects.slice(0, 4)) {
      lines.push(`QS 科目排名 2026 ${formatSubjectBadge(subject.subject, subject.rank)}`);
    }
  } else {
    lines.push('QS 科目排名 2026：未列入或未同步');
  }

  return lines.join('\n');
}
