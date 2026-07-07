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
  ): Promise<EnrollResponse> {
    const form = new FormData();
    form.append('employee_code', employeeCode);
    form.append('full_name', fullName);
    if (department) form.append('department', department);
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
}
