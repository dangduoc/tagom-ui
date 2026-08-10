/**
 * The posters the idle screen cycles through while nobody is at the station.
 *
 * This is station content, not UI copy, so it isn't in i18n — the posters are
 * printed in Vietnamese and the text under them describes the real event. Only
 * the "Thời gian" / "Địa điểm" labels around it are translated.
 *
 * Placeholder: the design shows five slides, and we have artwork for one. It is
 * repeated three times so the pager and the rotation are exercised. Replace the
 * entries (and drop the repetition) as real posters arrive.
 */
export interface IdleSlide {
  /** Path under public/. Sized for a full-bleed 16:9-ish band. */
  image: string;
  caption: string;
  headline: string;
  time: string;
  date: string;
  place: string;
  address: string;
}

const POSTER: IdleSlide = {
  image: '/tagom/poster-1.jpg',
  caption: 'Hoạt động hàng tháng',
  headline: 'Ai vỏ chai vỏ lon lấy kẹo kéo đi',
  time: '9:00 - 19:00',
  date: '06/09/2026',
  place: 'Trạm TAGOM',
  address:
    'Dãy B1/105 Ng. 3 Đ. Khuất Duy Tiến, Khu tập thể Thanh Xuân Bắc, Thanh Xuân, Hà Nội, Việt Nam',
};

export const IDLE_SLIDES: IdleSlide[] = [POSTER, POSTER, POSTER];

/** How long each poster holds before the next one slides in. */
export const SLIDE_MS = 6000;
