/** Dragon Fire: original standalone ornamental side-art texture.
 * Generates a self-contained SVG for a painted UV insert, with no remote assets.
 * Convert to PNG for Blender, or use as a browser Image/CanvasTexture.
 * This is illustrative game art, not a photographed or sculpted relief.
 */
export function dragonReliefSvg({width=1024,height=2048}={}) {
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<64||height<64)throw new RangeError('Invalid texture dimensions');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1024 2048">
 <defs>
 <linearGradient id="enamel" x2="1" y2="1"><stop stop-color="#21030e"/><stop offset=".48" stop-color="#750f24"/><stop offset="1" stop-color="#160711"/></linearGradient>
 <linearGradient id="metal" x2=".7" y2="1"><stop stop-color="#fff2b1"/><stop offset=".35" stop-color="#b87625"/><stop offset=".7" stop-color="#f4d581"/><stop offset="1" stop-color="#734018"/></linearGradient>
 <pattern id="scales" width="42" height="40" patternUnits="userSpaceOnUse"><path d="M0 8Q21 38 42 8 M-21 -12Q0 18 21 -12 M21 -12Q42 18 63 -12" fill="none" stroke="#ffd88a" stroke-opacity=".3" stroke-width="3"/></pattern>
 </defs>
 <rect width="1024" height="2048" rx="90" fill="url(#enamel)"/>
 <path d="M85 85Q512 45 939 85L939 1963Q512 2000 85 1963Z" fill="none" stroke="url(#metal)" stroke-width="22"/>
 <g stroke="#f3cc72" stroke-linejoin="round" stroke-linecap="round">
 <path id="dragon-body" d="M530 1815C300 1920 205 1770 300 1660C385 1560 505 1690 410 1730C350 1750 350 1695 397 1695C290 1615 215 1460 330 1310C450 1150 640 1130 620 955C607 815 495 750 510 620C528 495 650 435 705 325L780 370C730 545 625 570 635 695C660 850 760 975 720 1130C690 1290 490 1350 430 1470C390 1550 440 1650 530 1815Z" fill="url(#metal)" stroke-width="16"/>
 <use href="#dragon-body" fill="url(#scales)" stroke="none"/>
 <path d="M575 1050Q360 770 130 800Q225 890 135 1030Q245 995 255 1160Q340 1080 400 1220Q495 1125 575 1050Z" fill="#aa2631" stroke-width="19"/>
 <path d="M575 1050L130 800M575 1050L135 1030M575 1050L255 1160M575 1050L400 1220" fill="none" stroke="url(#metal)" stroke-width="19"/>
 <path d="M615 1000Q760 735 895 725Q850 870 930 980Q820 925 795 1090Q715 1010 615 1000Z" fill="#8c172b" stroke-width="16"/>
 <path d="M615 1000L895 725M615 1000L930 980M615 1000L795 1090" fill="none" stroke-width="15"/>
 <path d="M682 395Q620 320 650 215L690 280Q715 175 790 120L773 255Q825 220 870 260L835 325Q910 335 915 410L835 440L900 485L820 502L750 468L695 515L665 455Z" fill="url(#metal)" stroke-width="17"/>
 <path d="M818 440L950 462L900 520L810 520L775 480" fill="#bc7729" stroke-width="15"/>
 <path d="M837 497L851 522L865 493L881 519L893 490" fill="#fff0b8" stroke-width="5"/>
 <path d="M792 350L835 335L812 374Z" fill="#f1223d" stroke="#ffefbd" stroke-width="9"/>
 <circle cx="822" cy="356" r="9" fill="#fff7cc" stroke="none"/>
 <path d="M883 407L894 414" stroke="#3b0811" stroke-width="13"/>
 <path d="M530 1180L385 1285L335 1400L300 1375L305 1315L270 1380L250 1350L310 1250L455 1080M650 1260L760 1350L790 1490L750 1450L730 1390L725 1490L685 1455L690 1340" fill="none" stroke="url(#metal)" stroke-width="40"/>
 <path d="M300 1375L260 1430M250 1350L215 1390M750 1450L775 1500M685 1455L685 1510" stroke="#ffe3a1" stroke-width="13"/>
 </g>
 <g fill="#eebf65" font-family="Georgia,serif" text-anchor="middle"><text x="512" y="190" font-size="63" letter-spacing="9">DRAGON FIRE</text><text x="512" y="1925" font-size="40" letter-spacing="8">VELVET ACE</text></g>
 </svg>`;
}
export function dragonReliefDataUrl(opts) {
 // Encode UTF-8 safely for a browser image without remote image dependencies.
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(dragonReliefSvg(opts));
}
