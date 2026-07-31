import { Injectable } from '@angular/core';

export interface RecognizedMatch {
  employee_code: string;
  full_name: string;
  department: string | null;
  similarity: number;
}

export interface RecognizeResponse {
  match: RecognizedMatch | null;
  closest?: { employee_code: string; similarity: number } | null;
  reason: string | null;
  det_score?: number;
}

export interface EnrollFileResult {
  file: string;
  ok: boolean;
  error?: string;
  det_score?: number;
}

export interface EnrollResponse {
  employee_id: number;
  employee_code: string;
  enrolled_photos: number;
  files: EnrollFileResult[];
}

export interface EmployeeInfo {
  id: number;
  employee_code: string;
  full_name: string;
  department: string | null;
  embedding_count: number;
  created_at: string;
}

/** Depositor record as the station API returns it. */
export interface PersonDto {
  code: string;
  full_name: string;
  phone: string | null;
  age: string | null;
  city: string | null;
  ward: string | null;
  address: string | null;
  citizen_id: string | null;
  member_since: string;
  has_face_data: boolean;
}

export interface SessionDto {
  id: number;
  date: string;
  total: number;
  items: { category: string; weight: number }[];
}

export interface PersonBundle {
  person: PersonDto;
  sessions: SessionDto[];
  personal_total: number;
  session_count: number;
}

export interface StatsDto {
  community_total: number;
  community_base: number;
  community_goal: number;
}

/** Fields the register/profile screens can write. Omit one to leave it as it
 *  is; send an empty string to clear it. */
export interface ProfilePatch {
  full_name?: string;
  phone?: string;
  age?: string;
  city?: string;
  ward?: string;
  address?: string;
  citizen_id?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = '/api';

  async recognize(face: Blob): Promise<RecognizeResponse> {
    const form = new FormData();
    form.append('file', face, 'face.jpg');
    const res = await fetch(`${this.base}/recognize`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`recognize failed: HTTP ${res.status}`);
    return res.json();
  }

  async enroll(
    employeeCode: string,
    fullName: string,
    department: string,
    photos: Blob[],
    profile: ProfilePatch = {},
  ): Promise<EnrollResponse> {
    const form = new FormData();
    form.append('employee_code', employeeCode);
    form.append('full_name', fullName);
    if (department) form.append('department', department);
    for (const [key, value] of Object.entries(profile)) {
      if (key !== 'full_name' && value !== undefined) form.append(key, value);
    }
    photos.forEach((p, i) => form.append('files', p, `photo-${i + 1}.jpg`));
    const res = await fetch(`${this.base}/enroll`, { method: 'POST', body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message =
        body?.detail?.message ?? body?.detail ?? `enroll failed: HTTP ${res.status}`;
      throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
    }
    return res.json();
  }

  async listEmployees(): Promise<EmployeeInfo[]> {
    const res = await fetch(`${this.base}/employees`);
    if (!res.ok) throw new Error(`list employees failed: HTTP ${res.status}`);
    return res.json();
  }

  async deleteEmployee(employeeCode: string): Promise<void> {
    const res = await fetch(`${this.base}/employees/${encodeURIComponent(employeeCode)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`delete failed: HTTP ${res.status}`);
  }

  // ── Recycling station ──

  /** Profile + weigh history + lifetime total. Null when nobody holds that code. */
  async getPerson(code: string): Promise<PersonBundle | null> {
    const res = await fetch(`${this.base}/people/${encodeURIComponent(code)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`get person failed: HTTP ${res.status}`);
    return res.json();
  }

  /** Register without face photos — `enroll` covers the with-photos case. */
  async createPerson(code: string, fullName: string, profile: ProfilePatch): Promise<PersonDto> {
    return this.sendJson(`${this.base}/people`, 'POST', {
      ...profile,
      code,
      full_name: fullName,
    });
  }

  async updatePerson(code: string, patch: ProfilePatch): Promise<PersonDto> {
    return this.sendJson(`${this.base}/people/${encodeURIComponent(code)}`, 'PUT', patch);
  }

  /** `code` null = anonymous visit: counted for the station, attributed to nobody. */
  async recordSession(
    code: string | null,
    items: { category: string; weight: number }[],
  ): Promise<{ session_id: number; total: number; community_total: number }> {
    const res = await fetch(`${this.base}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, items }),
    });
    if (!res.ok) throw new Error(`record session failed: HTTP ${res.status}`);
    return res.json();
  }

  async getStats(): Promise<StatsDto> {
    const res = await fetch(`${this.base}/stats`);
    if (!res.ok) throw new Error(`stats failed: HTTP ${res.status}`);
    return res.json();
  }

  private async sendJson<T>(url: string, method: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${url} failed: HTTP ${res.status}`);
    const json = await res.json();
    return json.person ?? json;
  }
}
