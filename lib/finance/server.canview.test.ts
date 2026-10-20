import { afterEach, describe, expect, test } from 'bun:test';
import { canViewAdv } from './server';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** BE stub: the ADV belongs to someone else and sits only in this head's clearing-approval queue. */
function stubBe(clearQueue: string[]) {
  process.env.URL_API = 'http://be.test';
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.pathname.startsWith('/finance/advances/')) return json({ form_id: 'ADV-2610-031', requester: { employee_id: 'E1' } });
    if (url.pathname === '/finance/clear-approvals/pending') return json(clearQueue.map(form_id => ({ form_id })));
    return json([]);
  }) as typeof fetch;
}

describe('canViewAdv — clearing approvers', () => {
  test('a head with the ADV in their clearing queue may open it', async () => {
    stubBe(['ADV-2610-031']);
    expect(await canViewAdv({ employee_id: 'HEAD1', is_finance: false }, 'ADV-2610-031')).toBe(true);
  });
  test('someone unrelated still may not', async () => {
    stubBe([]);
    expect(await canViewAdv({ employee_id: 'OTHER9', is_finance: false }, 'ADV-2610-031')).toBe(false);
  });
});
