import { handleUpload } from '@vercel/blob/client';

/*
 * Client-upload token endpoint.
 * The browser uploads files DIRECTLY to Vercel Blob (no 4.5 MB serverless body limit),
 * so large photos and videos work. This handler only authorises each upload.
 *
 *   gallery/<name>          → the original photo / video (random suffix added)
 *   thumbs/gallery/<name>.jpg → small preview generated in the browser
 */
const MAX_MEDIA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB per file
const MAX_THUMB_BYTES = 2 * 1024 * 1024;        // 2 MB per thumbnail

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || !body.type) {
    return res.status(400).json({ error: 'Invalid upload request body.' });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname.startsWith('gallery/')) {
          return {
            allowedContentTypes: ['image/*', 'video/*'],
            maximumSizeInBytes: MAX_MEDIA_BYTES,
            addRandomSuffix: true,
          };
        }
        if (pathname.startsWith('thumbs/gallery/') && pathname.endsWith('.jpg')) {
          return {
            allowedContentTypes: ['image/jpeg'],
            maximumSizeInBytes: MAX_THUMB_BYTES,
            addRandomSuffix: false, // must sit at a predictable path next to its original
          };
        }
        throw new Error('Uploads are only allowed into the gallery.');
      },
      // Called by Vercel Blob after the upload finishes (production only). Nothing to do:
      // the gallery lists the store directly.
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Upload token error:', error);
    return res.status(400).json({ error: error.message || 'Could not authorise upload.' });
  }
}
