/** Original Velvet Ace far-cabinet copy. Art-only: no production wiring.
 * Keys are the uppercase display names supplied by HERO_THEMES.
 * Short copy is deliberate: the 256px atlas is viewed at long distances.
 */
export const FAR_CABINET_THEME_COPY = Object.freeze({
  'VELVET ACE': Object.freeze({ subtitle: 'THE HOUSE FAVORITE', footer: 'PLAY IN STYLE' }),
  'LUCKY SEVENS': Object.freeze({ subtitle: 'TRIPLE SEVEN', footer: 'CHASE THE JACKPOT' }),
  'LUCKY LANTERNS': Object.freeze({ subtitle: 'LIGHT THE NIGHT', footer: 'FORTUNE SHINES' }),
  "PHARAOH'S GOLD": Object.freeze({ subtitle: 'ROYAL TREASURES', footer: 'UNLOCK THE VAULT' }),
  'DEEP BLUE': Object.freeze({ subtitle: 'OCEAN FORTUNES', footer: 'DIVE FOR GOLD' }),
  'GOLD RUSH': Object.freeze({ subtitle: 'STRIKE IT RICH', footer: 'GOLD AWAITS' }),
  "DRAGON'S HOARD": Object.freeze({ subtitle: 'FIRE AND FORTUNE', footer: 'CLAIM THE HOARD' }),
  'DIAMOND EMPIRE': Object.freeze({ subtitle: 'SPARKLING RICHES', footer: 'SHINE BRIGHT' }),
  'THUNDER PEAK': Object.freeze({ subtitle: 'STORM THE SUMMIT', footer: 'FEEL THE POWER' }),
  "TIGER'S TREASURE": Object.freeze({ subtitle: 'WILD FORTUNE', footer: 'ROAR FOR MORE' }),
  'COSMIC FORTUNE': Object.freeze({ subtitle: 'STELLAR REWARDS', footer: 'REACH THE STARS' })
});
export function getFarCabinetThemeCopy(title) {
  return FAR_CABINET_THEME_COPY[String(title ?? '').trim().toUpperCase()] ?? null;
}
