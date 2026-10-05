/** Returns the text with surrounding whitespace removed and inner runs of spaces collapsed. */
export function squish(text) {
  return text.trim().replace(/\s+/g, ' ');
}
