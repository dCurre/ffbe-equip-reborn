/** Saves a file in the user's downloads (the old FileSaver). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

type Html2Canvas = (element: HTMLElement) => Promise<HTMLCanvasElement>;
let html2canvasLoading: Promise<Html2Canvas> | null = null;

/** html2canvas is loaded the first time a page exports an image (`lib/html2canvas.min.js` is copied as an asset). */
function loadHtml2canvas(): Promise<Html2Canvas> {
  html2canvasLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'lib/html2canvas.min.js';
    script.onload = () => resolve((window as unknown as { html2canvas: Html2Canvas }).html2canvas);
    script.onerror = () => {
      html2canvasLoading = null;
      reject(new Error('Cannot load html2canvas'));
    };
    document.head.appendChild(script);
  });
  return html2canvasLoading;
}

/** A PNG of what an element shows right now. */
export async function elementToPng(element: HTMLElement): Promise<Blob> {
  const canvas = await (await loadHtml2canvas())(element);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Cannot create the image'))), 'image/png'),
  );
}

/** Waits until every picture inside the element is loaded (the lazy ones are made eager by the caller). */
export function picturesLoaded(element: HTMLElement): Promise<unknown> {
  return Promise.all(
    [...element.querySelectorAll('img')].map((img) =>
      img.complete ? null : new Promise((done) => ((img.onload = img.onerror = done), undefined)),
    ),
  );
}
