/**
 * Fits a dealer's reply into the speech bubble without chopping a word: a long
 * (or token-limited) reply ends at its last full sentence, and one with no
 * sentence end that fits ends at a whole word with an ellipsis.
 */
function tidyReply(text, limit = 240, cutOff = false) {
  if (text.length <= limit && !cutOff) return text;
  // one character past the limit shows whether the text breaks right there
  const head = text.slice(0, limit + 1);
  const sentence = head.match(/^.*[.!?]["'”’)]*(?=\s|$)/);
  if (sentence && sentence[0].length <= limit) return sentence[0];
  const room = text.slice(0, limit); // leaves one character for the ellipsis
  const space = room.lastIndexOf(' ');
  return room.slice(0, space > 0 ? space : limit - 1).replace(/[\s,;:-]+$/, '') + '…';
}

module.exports = { tidyReply };
