/**
 * Memo PDF — render, and (on issue) file the blob to Storage and record where
 * it landed through the callable. Imported lazily by the pages so the
 * renderer is not in the main bundle.
 */
import { pdf } from '@react-pdf/renderer';
import { uploadFile } from '@/shared/services/firebase/storage';
import type { Memo } from '../types/memo';
import { fileMemoPdf } from '../services/memoActions';
import { issuedMemoPdfPath } from '../services/memoService';
import { buildMemoDocData, buildMemoFilename } from './memoDocData';
import { MemoDocument } from './MemoDocument';

export { buildMemoDocData, buildMemoFilename } from './memoDocData';

export async function generateMemoPdfBlob(memo: Memo): Promise<Blob> {
  return pdf(<MemoDocument data={buildMemoDocData(memo)} />).toBlob();
}

/**
 * Render + file the issued PDF and record it on the memo. Best effort: the
 * memo IS issued either way; "Render & file PDF" on the page retries.
 */
export async function renderAndFileIssuedMemoPdf(memo: Memo): Promise<{ storagePath: string; url: string }> {
  const blob = await generateMemoPdfBlob({ ...memo, status: 'issued' });
  const storagePath = issuedMemoPdfPath(memo);
  const { url } = await uploadFile(storagePath, blob);
  await fileMemoPdf(memo.id, storagePath, url);
  return { storagePath, url };
}

/** Open a rendering of the memo (draft watermarked) in a new tab. */
export async function openMemoPdfPreview(memo: Memo): Promise<void> {
  const blob = await generateMemoPdfBlob(memo);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    const a = document.createElement('a');
    a.href = url;
    a.download = buildMemoFilename(memo);
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
