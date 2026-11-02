/**
 * The only place the app talks to the server. Same-origin JSON over fetch; the session lives in an
 * httpOnly cookie, so nothing secret is ever held in JavaScript.
 */
import type { Account, InsightFeedback, Story, StoryRequest, SyncedEntry, SyncResponse } from '@daroon/shared';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
  get offline(): boolean {
    return this.status === 0;
  }
}

async function call<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + '/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    throw new ApiError(0, 'offline');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'error');
  return data as T;
}

export const api = {
  authConfig: () => call<{ google: string | null; email: boolean }>('GET', '/auth/config'),
  requestCode: (email: string) => call<void>('POST', '/auth/email/request', { email }),
  verifyCode: (email: string, code: string, name?: string) =>
    call<{ account: Account }>('POST', '/auth/email/verify', { email, code, name }),
  google: (credential: string) => call<{ account: Account }>('POST', '/auth/google', { credential }),
  logout: () => call<void>('POST', '/auth/logout'),
  me: () => call<{ account: Account }>('GET', '/me'),
  deleteAccount: () => call<void>('DELETE', '/me'),
  sync: (since: number, changes: SyncedEntry[], feedback: InsightFeedback[] = []) =>
    call<SyncResponse>('POST', '/sync', { since, changes, feedback }),
  stories: () => call<{ stories: Story[]; writer: boolean }>('GET', '/stories'),
  writeStory: (req: StoryRequest, signal?: AbortSignal) => call<{ story: Story }>('POST', '/stories', req, signal),
};
