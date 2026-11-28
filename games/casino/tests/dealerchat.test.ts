import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const { tidyReply } = createRequire(import.meta.url)('../firebase/functions/tidy.js') as {
  tidyReply: (text: string, limit?: number, cutOff?: boolean) => string;
};

describe('dealer replies', () => {
  it('leaves a short reply alone', () => {
    expect(tidyReply('Place your bets.', 240)).toBe('Place your bets.');
  });

  it('ends a long reply at its last full sentence', () => {
    expect(tidyReply('He won. Naturally. Then he tipped the whole table.', 30)).toBe('He won. Naturally.');
  });

  it('keeps a sentence that ends right at the limit', () => {
    expect(tidyReply('He won. Then he left.', 7)).toBe('He won.');
  });

  it('ends at a whole word when no sentence fits', () => {
    const out = tidyReply('and then he tipped me with a single gold chip', 20);
    expect(out).toBe('and then he tipped…');
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it('trims a reply the model ran out of room for', () => {
    expect(tidyReply('He won. Then he tipp', 240, true)).toBe('He won.');
  });
});
