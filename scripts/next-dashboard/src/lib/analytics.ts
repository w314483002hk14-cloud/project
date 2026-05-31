import type { School } from '@/lib/nycu';

export type AnalyticsEventType = 'view' | 'favorite' | 'unfavorite' | 'comment';

export type AnalyticsPayload = {
  event_type: AnalyticsEventType;
  school_id: number;
  school_name: string;
  country: string;
  region: string;
  extra?: string;
};

export function trackAnalytics(payload: AnalyticsPayload) {
  if (typeof window === 'undefined') return;
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export function trackSchoolView(school: School, region: string) {
  trackAnalytics({
    event_type: 'view',
    school_id: school.id,
    school_name: school.name,
    country: school.country,
    region,
  });
}

export function trackFavorite(school: School, region: string, favorited: boolean) {
  trackAnalytics({
    event_type: favorited ? 'favorite' : 'unfavorite',
    school_id: school.id,
    school_name: school.name,
    country: school.country,
    region,
  });
}

export function trackComment(school: School, region: string, category: string) {
  trackAnalytics({
    event_type: 'comment',
    school_id: school.id,
    school_name: school.name,
    country: school.country,
    region,
    extra: category,
  });
}
