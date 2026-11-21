/** Marks the words in the text of an element with the CSS Custom Highlight API (`::highlight(search)`), without touching the DOM. */
export function highlightText(root: HTMLElement, words: readonly string[]): void {
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  if (!highlights || typeof Highlight === 'undefined') return; // an older browser: no highlight
  const ranges: Range[] = [];
  const needles = words.map((word) => word.toLowerCase()).filter(Boolean);
  if (needles.length) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').toLowerCase();
      for (const needle of needles) {
        for (let at = text.indexOf(needle); at >= 0; at = text.indexOf(needle, at + needle.length)) {
          const range = new Range();
          range.setStart(node, at);
          range.setEnd(node, at + needle.length);
          ranges.push(range);
        }
      }
    }
  }
  highlights.set('search', new Highlight(...ranges));
}
