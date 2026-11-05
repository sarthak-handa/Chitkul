import { del } from '@vercel/blob';

/*
 * Deletes gallery items (and their thumbnails).
 * Body: { "urls": ["https://<store>.public.blob.vercel-storage.com/gallery/..."] }
 * Only blobs under /gallery/ in a Vercel Blob store can be deleted — nothing else on the site.
 */
function isGalleryBlob(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'https:'
      && url.hostname.endsWith('.public.blob.vercel-storage.com')
      && url.pathname.startsWith('/gallery/');
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const urls = [].concat(body?.urls || body?.url || []).filter(Boolean);

  if (!urls.length) return res.status(400).json({ success: false, error: 'No URLs provided.' });
  if (urls.length > 500) return res.status(400).json({ success: false, error: 'Too many items in one request.' });
  const bad = urls.filter(u => !isGalleryBlob(u));
  if (bad.length) return res.status(400).json({ success: false, error: 'Only gallery items can be deleted.' });

  // thumbnails live at /thumbs/gallery/<name>.jpg in the same store
  const thumbs = urls.map(u => {
    const url = new URL(u);
    return `${url.origin}/thumbs${decodeURIComponent(url.pathname)}.jpg`;
  });

  try {
    await del([...urls, ...thumbs]);
    return res.status(200).json({ success: true, deleted: urls.length });
  } catch (error) {
    console.error('Delete handler error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Delete failed.' });
  }
}
