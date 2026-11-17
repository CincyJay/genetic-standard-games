/**
 * Dragon Fire tall side-insert art, v3. Original vector illustration.
 * Designed for the measured ~0.61m x 1.80m ruby panel (aspect 1:2.95).
 * All visible strokes stay within the inner safe region of the tapering panel.
 * The head faces left in image coordinates; the engine may mirror the +X side.
 * No typography, external assets, filters, <use>, scripts or image references.
 * Intended for Claude's isolated insertFaceDecal preview, NOT production.
 */
export const DRAGON_INSERT_ASPECT = 0.61 / 1.80;
export const DRAGON_INSERT_SIZE = Object.freeze({width: 704,height: 2080});
export function dragonTallSvg({width=704,height=2080}={}) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)
    throw new RangeError('Expected positive SVG dimensions');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 704 2080">
<defs>
 <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0b5"/><stop offset=".25" stop-color="#dca648"/><stop offset=".56" stop-color="#704016"/><stop offset=".82" stop-color="#e5b95f"/><stop offset="1" stop-color="#fff0bc"/></linearGradient>
 <linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9d986"/><stop offset=".52" stop-color="#a65e2b"/><stop offset="1" stop-color="#3c1520"/></linearGradient>
 <linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f9d782"/><stop offset=".45" stop-color="#b87a32"/><stop offset=".8" stop-color="#633419"/><stop offset="1" stop-color="#f0c46b"/></linearGradient>
 <pattern id="scales" width="31" height="34" patternUnits="userSpaceOnUse"><path d="M0 3 Q15 22 31 3 M-15 19 Q0 38 15 19 M15 19 Q30 38 45 19" fill="none" stroke="#ffecb0" stroke-width="2.3" opacity=".64"/></pattern>
 <clipPath id="bodyclip"><path d="M352 275 C275 336 267 475 348 573 C438 674 462 759 368 842 C278 926 231 1001 292 1113 C355 1226 487 1287 449 1406 C412 1525 269 1517 257 1653 C249 1737 322 1812 414 1855 C318 1841 212 1794 194 1684 C168 1530 341 1472 352 1390 C361 1320 246 1276 203 1165 C148 1018 232 909 303 822 C371 741 350 687 287 605 C197 488 224 329 352 275 Z"/></clipPath>
</defs>
<!-- Transparent outside the illustration: no rectangular card or labels. -->
<!-- A narrow, backward-facing crest deliberately keeps the head out of the upper-right taper. -->
<path d="M339 296 Q292 223 320 162 L354 215 L370 132 L397 232 Q444 219 461 247 L433 265 Q472 280 475 304 L429 306 Q445 330 423 351 L395 338 Q374 370 333 346 L284 350 L245 329 L272 310 L240 287 L285 282 L291 254 Z" fill="url(#metal)" stroke="#3a1b16" stroke-width="8" stroke-linejoin="round"/>
<path d="M283 289 L230 275 L253 298 L212 312 L269 320 L294 344 L337 332" fill="#d99b48" stroke="#51221c" stroke-width="7" stroke-linejoin="round"/>
<path d="M245 328 Q278 356 327 344 L312 366 L288 366 L273 348 Z" fill="#6e2b25" stroke="#eac16c" stroke-width="4"/>
<path d="M301 303 Q317 284 334 302 Q315 322 301 303" fill="#4c141c" stroke="#ffdf85" stroke-width="4"/>
<circle cx="315" cy="302" r="6" fill="#ff4e3e"/>
<!-- Whiskers, horns, mane, and flame arcs, all inside taper-safe central width. -->
<g fill="none" stroke="#eac071" stroke-linecap="round">
 <path d="M279 323 Q200 351 192 416 M291 337 Q214 387 226 453" stroke-width="7"/>
 <path d="M365 260 Q418 190 399 148 M392 258 Q455 221 445 182" stroke-width="9"/>
 <path d="M414 351 Q480 411 455 483 M315 372 Q252 423 281 478" stroke-width="6"/>
</g>
<!-- Distinct feathered wing membranes in the upper-midsection, not outside the panel. -->
<path d="M341 548 Q275 456 194 478 Q229 565 182 633 Q265 619 255 713 Q318 669 352 736 L380 601 Z" fill="url(#wing)" stroke="#f2c36a" stroke-width="10" stroke-linejoin="round"/>
<path d="M373 600 Q449 466 518 510 Q467 567 507 633 Q442 618 459 716 Q402 676 374 734 Z" fill="url(#wing)" stroke="#f2c36a" stroke-width="10" stroke-linejoin="round"/>
<g stroke="#ffd98c" stroke-width="5" fill="none" opacity=".8"><path d="M350 597 L194 478 M350 600 L182 633 M350 600 L255 713 M379 608 L518 510 M379 608 L507 633 M379 608 L459 716"/></g>
<!-- A thick sinuous coiled body occupies the lower two thirds, with an independent scale overlay. -->
<path d="M352 275 C275 336 267 475 348 573 C438 674 462 759 368 842 C278 926 231 1001 292 1113 C355 1226 487 1287 449 1406 C412 1525 269 1517 257 1653 C249 1737 322 1812 414 1855 C318 1841 212 1794 194 1684 C168 1530 341 1472 352 1390 C361 1320 246 1276 203 1165 C148 1018 232 909 303 822 C371 741 350 687 287 605 C197 488 224 329 352 275 Z" fill="url(#body)" stroke="#3b1a14" stroke-width="12"/>
<path d="M352 275 C275 336 267 475 348 573 C438 674 462 759 368 842 C278 926 231 1001 292 1113 C355 1226 487 1287 449 1406 C412 1525 269 1517 257 1653 C249 1737 322 1812 414 1855 C318 1841 212 1794 194 1684 C168 1530 341 1472 352 1390 C361 1320 246 1276 203 1165 C148 1018 232 909 303 822 C371 741 350 687 287 605 C197 488 224 329 352 275 Z" fill="url(#scales)" clip-path="url(#bodyclip)" opacity=".75"/>
<!-- Raised belly glint follows the body contour, adding depth without pipe geometry. -->
<path d="M333 393 Q295 493 365 578 Q448 700 370 826 Q245 982 272 1110 Q307 1200 417 1306 Q473 1390 397 1471 Q229 1590 241 1675" fill="none" stroke="#fff0b4" stroke-width="12" opacity=".52" stroke-linecap="round"/>
<!-- Four jointed legs with explicit talons, not blunt sticks. -->
<g fill="none" stroke="#e5b465" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
 <path d="M304 760 L233 799 L215 864 L174 883 M215 864 L226 902 M215 864 L192 911"/>
 <path d="M410 915 L475 944 L492 1011 L529 1028 M492 1011 L478 1055 M492 1011 L514 1054"/>
 <path d="M250 1212 L190 1247 L178 1321 L145 1343 M178 1321 L194 1361 M178 1321 L165 1372"/>
 <path d="M401 1494 L468 1515 L481 1579 L526 1604 M481 1579 L463 1626 M481 1579 L501 1633"/>
</g>
<g fill="#fff2b4" stroke="#8e522c" stroke-width="3">
 <path d="M174 883 l-23 17 13-30 Z M226 902 l-9 27 -6-31 Z M192 911 l-24 20 13-29 Z"/>
 <path d="M529 1028 l25 18 -10-30 Z M478 1055 l-8 30 -8-28 Z M514 1054 l20 26 -8-32 Z"/>
 <path d="M145 1343 l-22 21 10-30 Z M194 1361 l-6 30 -8-27 Z M165 1372 l-23 22 12-31 Z"/>
 <path d="M526 1604 l27 22 -11-33 Z M463 1626 l-7 30 -9-30 Z M501 1633 l22 26 -9-32 Z"/>
</g>
<!-- Decorative tapered tail tip and sparse fire flecks; no external lettering. -->
<path d="M414 1855 Q455 1918 427 1970 Q404 1925 375 1930 Q405 1890 414 1855" fill="url(#metal)" stroke="#673418" stroke-width="7"/>
<g fill="#ffd18a" opacity=".82"><path d="M140 690 l9-25 9 25 -9 25Z M555 838 l8-26 8 26 -8 26Z M125 1515 l7-19 7 19 -7 19Z M541 1778 l7-22 7 22 -7 22Z"/></g>
</svg>`;
}
export function dragonTallDataUrl(options) {
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(dragonTallSvg(options));
}
