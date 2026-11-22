/** Runs the last action asked, `ms` after the last call: the pages search while typing without redrawing at every key. */
export function debouncer(ms = 300): (action: () => void) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (action) => {
    clearTimeout(timer);
    timer = setTimeout(action, ms);
  };
}
