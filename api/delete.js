import { del } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST or DELETE.' });
  }

  try {
    let urlToDelete = null;

    if (req.body && typeof req.body === 'object') {
      urlToDelete = req.body.url;
    } else if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        urlToDelete = parsed.url;
      } catch (e) {
        urlToDelete = req.body;
      }
    }

    // Fallback if req.body wasn't parsed (since bodyParser might be default or custom)
    if (!urlToDelete) {
      const host = req.headers.host || 'localhost';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const webReq = new Request(`${protocol}://${host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: req.method === 'POST' ? req : undefined,
        duplex: 'half'
      });
      try {
        const json = await webReq.json();
        urlToDelete = json.url;
      } catch (e) {
        const urlParams = new URL(`${protocol}://${host}${req.url}`).searchParams;
        urlToDelete = urlParams.get('url');
      }
    }

    if (!urlToDelete) {
      return res.status(400).json({ success: false, error: 'Missing image URL to delete.' });
    }

    // Remove from Vercel Blob Storage
    await del(urlToDelete);

    return res.status(200).json({
      success: true,
      url: urlToDelete
    });
  } catch (error) {
    console.error('Delete handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete image from Vercel Blob Storage.'
    });
  }
}
