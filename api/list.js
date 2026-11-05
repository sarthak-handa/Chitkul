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
    // ONE list call for the whole store (each list() is an "advanced operation" — the free plan has 2,000/month)
    const all = await listAll(undefined);
    const media = all.filter(b => b.pathname.startsWith('gallery/'));
    const thumbs = all.filter(b => b.pathname.startsWith('thumbs/gallery/'));
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

    // Vercel's CDN shares one result between all visitors for 60s (and serves it stale while refreshing),
    // so 50 people opening the site ≈ 1 list operation instead of 50.
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
    return res.status(200).json({
      success: true,
      items,
      totalBytes: items.reduce((s, i) => s + i.size, 0),
    });
  } catch (error) {
    console.error('List handler error:', error);
    res.setHeader('Cache-Control', 'no-store'); // never cache failures
    return res.status(200).json({ success: false, items: [], error: error.message || 'Could not list gallery.' });
  }
}
