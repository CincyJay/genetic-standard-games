/**
 * The one-line prototype badge at the bottom of the 3D floor. The art's long label ("pass 05 + BJ
 * table") wrapped it to two lines on 384 px portrait, into the fps line; this short form fits 360 px.
 */
export function protoBadge(f: { pilot05: boolean; blackjackHero: boolean; wovenCarpet: boolean }): string {
  const art = !f.pilot05 ? '04' : ['05', f.blackjackHero && 'BJ', f.wovenCarpet && 'CARPET'].filter(Boolean).join('+');
  return `PROTOTYPE · ART ${art} · PLACEHOLDER PEOPLE`;
}
