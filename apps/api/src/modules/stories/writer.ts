/** Something that turns the weekly prompt into the writer's raw JSON reply. */
export interface StoryWriter {
  write(prompt: string, signal?: AbortSignal): Promise<unknown>;
}

/** Pulls the first JSON object out of a reply that may be wrapped in prose or a code fence. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{'),
    end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no json');
  return JSON.parse(text.slice(start, end + 1));
}

export interface ChatWriterOptions {
  /** Base URL of an OpenAI-compatible API, e.g. https://api.openai.com/v1 or http://ollama:11434/v1. */
  url: string;
  /** Sent as a Bearer token; local servers usually need none. */
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/**
 * Writes stories through any service that speaks the OpenAI chat-completions API (OpenAI, OpenRouter, Groq,
 * Ollama, vLLM, LM Studio and most gateways), so the provider is a matter of configuration.
 */
export function createChatWriter(opts: ChatWriterOptions): StoryWriter {
  const endpoint = opts.url.replace(/\/+$/, '') + '/chat/completions';
  const doFetch = opts.fetch ?? fetch;
  return {
    async write(prompt, signal) {
      const timeout = AbortSignal.timeout(opts.timeoutMs ?? 60_000);
      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: opts.model, messages: [{ role: 'user', content: prompt }] }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!res.ok) throw new Error(`story api ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('story api: no message content');
      return extractJson(content);
    },
  };
}
