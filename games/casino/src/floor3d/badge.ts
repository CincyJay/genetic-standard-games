/**
 * The one-line prototype badge at the bottom of the 3D floor. The art's long label ("pass 05 + BJ
 * table") wrapped it to two lines on 384 px portrait, into the fps line; this short form fits 360 px.
 */
export function protoBadge(f: { pilot05: boolean; blackjackHero: boolean; wovenCarpet: boolean }): string {
  const art = !f.pilot05 ? '04' : ['05', f.blackjackHero && 'BJ', f.wovenCarpet && 'CARPET'].filter(Boolean).join('+');
  return `PROTOTYPE · ART ${art} · PLACEHOLDER PEOPLE`;
}

/**
 * The fps readout as two short lines. As one line (about 46 characters) it ran under the walk
 * joystick on 360 px portrait; each line here stays under 24 characters, so both fit the
 * right-hand strip beside the joystick.
 */
export function perfText(s: { fps: number; intervalP95Ms: number; cpuAvgMs: number; drawCalls: number }): string {
  return `${s.fps.toFixed(0)} fps · p95 ${s.intervalP95Ms.toFixed(1)} ms\ncpu ${s.cpuAvgMs.toFixed(1)} ms · ${s.drawCalls} calls`;
}
