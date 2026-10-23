import Anthropic from '@anthropic-ai/sdk';

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

export function createClaudeWriter(apiKey: string, model: string): StoryWriter {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 });
  return {
    async write(prompt, signal) {
      const msg = await client.messages.create(
        { model, max_tokens: 1600, messages: [{ role: 'user', content: prompt }] },
        { signal },
      );
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      return extractJson(text);
    },
  };
}
