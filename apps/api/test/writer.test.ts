import { describe, expect, it } from 'vitest';
import { createChatWriter } from '../src/modules/stories/writer';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe('chat writer', () => {
  it('asks an OpenAI-compatible API and reads the JSON out of the reply', async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: 'بفرما:\n```json\n{"title":"هفته"}\n```' } }] });
    const w = createChatWriter({ url: 'https://llm.example/v1/', apiKey: 'k', model: 'm', fetch: f.fn });
    expect(await w.write('prompt')).toEqual({ title: 'هفته' });
    expect(f.calls[0].url).toBe('https://llm.example/v1/chat/completions');
    const headers = f.calls[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer k');
    expect(JSON.parse(f.calls[0].init.body as string)).toEqual({
      model: 'm',
      messages: [{ role: 'user', content: 'prompt' }],
    });
  });

  it('sends no key to a local server', async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: '{}' } }] });
    await createChatWriter({ url: 'http://ollama:11434/v1', model: 'm', fetch: f.fn }).write('p');
    expect((f.calls[0].init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('fails on an error status or an empty reply, so the app falls back to its local story', async () => {
    const bad = createChatWriter({ url: 'http://x/v1', model: 'm', fetch: fakeFetch(401, 'nope').fn });
    await expect(bad.write('p')).rejects.toThrow('401');
    const empty = createChatWriter({ url: 'http://x/v1', model: 'm', fetch: fakeFetch(200, { choices: [] }).fn });
    await expect(empty.write('p')).rejects.toThrow();
  });
});
