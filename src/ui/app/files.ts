// Browser file plumbing for export and import (DESIGN §13.16): a Blob download and a byte read of a picked file.

export interface DownloadableFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export function downloadFile(file: DownloadableFile): void {
  const url = URL.createObjectURL(new Blob([file.bytes.slice()], { type: file.mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled; revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readFileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}
