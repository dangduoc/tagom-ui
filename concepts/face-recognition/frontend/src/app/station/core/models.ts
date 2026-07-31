export type Lang = 'vn' | 'en';

export type Screen =
  | 'idle'
  | 'identify'
  | 'confirmed'
  | 'unknown'
  | 'register'
  | 'profile'
  | 'category'
  | 'weigh'
  | 'summary';

export type Overlay = null | 'help' | 'keypad' | 'noface';

export type ErrorKind = null | 'scale' | 'network' | 'camera';

/** sorted = pick a material each time; quick = one unsorted bag, no category step. */
export type Mode = 'sorted' | 'quick';

export type Phase = 'idle' | 'settling' | 'stable' | 'locked';

export type CategoryKey = 'nhua' | 'giay' | 'kimloai' | 'thuytinh' | 'vai' | 'chuaphanloai';

export interface Category {
  color: string;
  vn: string;
  en: string;
}

/** Category colours are a deliberate exception to the two-colour brand: materials
 *  must be instantly distinguishable. Keep these identical across the tile, the
 *  rail dot, the weigh chip and the summary. */
export const CATEGORIES: Record<CategoryKey, Category> = {
  nhua: { color: '#2f6f92', vn: 'Nhựa', en: 'Plastic' },
  giay: { color: '#c07d1e', vn: 'Giấy', en: 'Paper' },
  kimloai: { color: '#5f7078', vn: 'Kim loại', en: 'Metal' },
  thuytinh: { color: '#2c7a7b', vn: 'Thủy tinh', en: 'Glass' },
  vai: { color: '#a85c4b', vn: 'Vải', en: 'Fabric' },
  chuaphanloai: { color: '#6b6f52', vn: 'Chưa phân loại', en: 'Unsorted' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

/** Everything weighed in quick mode lands here. */
export const UNSORTED: CategoryKey = 'chuaphanloai';

export interface LineItem {
  id: number;
  key: CategoryKey;
  weight: number; // kg
}

export interface Person {
  fullName: string;
  /** Masked for display, e.g. "090 ••• 47". */
  phone: string;
  age?: string;
  city?: string;
  ward?: string;
  address?: string;
  citizenId?: string;
  /** Backend employee_code the face embeddings are enrolled against, when known. */
  code?: string;
}

/** Person = a real account · 'anon' = deliberately skipped · null = not identified yet. */
export type Identity = Person | 'anon' | null;

export interface WeighSession {
  date: string;
  items: { key: CategoryKey; weight: number }[];
}

export function sessionTotal(session: WeighSession): number {
  return session.items.reduce((sum, i) => sum + i.weight, 0);
}

export function isAccount(identity: Identity): identity is Person {
  return identity !== null && identity !== 'anon';
}

export function catName(key: CategoryKey, lang: Lang): string {
  const c = CATEGORIES[key];
  return lang === 'vn' ? c.vn : c.en;
}

/** "0901234567" -> "090 ••• 67". Kept out of the display path for raw input. */
export function maskPhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 5) return phone ?? '';
  return `${digits.slice(0, 3)} ••• ${digits.slice(-2)}`;
}

/** Item weights always show 2 decimals. */
export function fmtWeight(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** Big cumulative totals use locale grouping and 1 decimal. */
export function fmtTotal(n: number, lang: Lang): string {
  return n.toLocaleString(lang === 'vn' ? 'vi-VN' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
