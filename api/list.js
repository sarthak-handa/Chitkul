import { list } from '@vercel/blob';

// Lists every gallery item (all pages), paired with its browser-made thumbnail.
async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  try {
    const [media, thumbs] = await Promise.all([listAll('gallery/'), listAll('thumbs/gallery/')]);
    const thumbByPath = new Map(thumbs.map(t => [t.pathname.slice('thumbs/'.length, -'.jpg'.length), t.url]));

    const items = media
      .map(b => ({
        url: b.url,
        downloadUrl: b.downloadUrl,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt,
        thumb: thumbByPath.get(b.pathname) || null,
      }))
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      items,
      totalBytes: items.reduce((s, i) => s + i.size, 0),
    });
  } catch (error) {
    console.error('List handler error:', error);
    return res.status(200).json({ success: false, items: [], error: error.message || 'Could not list gallery.' });
  }
}
