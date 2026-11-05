import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  try {
    const { blobs } = await list();
    return res.status(200).json({
      success: true,
      blobs: blobs.map(b => ({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: b.uploadedAt
      }))
    });
  } catch (error) {
    console.error('List handler error:', error);
    // Return empty list if no token or error so page still functions gracefully
    return res.status(200).json({
      success: false,
      blobs: [],
      error: error.message || 'Could not list Vercel Blob items.'
    });
  }
}
