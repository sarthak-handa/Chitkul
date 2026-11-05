import { put } from '@vercel/blob';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_FOLDERS = new Set(['uploads', 'gallery', 'projects', 'rooms', 'temp']);

function getExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function validateFile(file) {
  if (!file) return 'No file provided.';
  const name = file.name || 'unnamed';
  const ext = getExtension(name);

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `Invalid file type .${ext}. Allowed formats: jpg, jpeg, png, webp.`;
  }

  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return `Invalid file MIME type (${file.type}). Allowed formats: JPEG, PNG, WebP.`;
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    return `File "${name}" (${sizeInMB} MB) exceeds maximum allowed size of 20 MB.`;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use POST.' });
  }

  try {
    let filesToUpload = [];
    let targetFolder = 'gallery';

    if (typeof req.formData === 'function') {
      const formData = await req.formData();
      targetFolder = formData.get('folder') || 'gallery';
      filesToUpload = formData.getAll('files').concat(formData.getAll('file'));
    } else {
      const host = req.headers.host || 'localhost';
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const webReq = new Request(`${protocol}://${host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: req,
        duplex: 'half'
      });
      const formData = await webReq.formData();
      targetFolder = formData.get('folder') || 'gallery';
      const rawFiles = formData.getAll('files').concat(formData.getAll('file'));
      filesToUpload = rawFiles.filter(f => f && typeof f === 'object' && f.name);
    }

    // Sanitize target folder name
    targetFolder = String(targetFolder).replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase();
    if (!ALLOWED_FOLDERS.has(targetFolder)) {
      targetFolder = 'gallery';
    }

    if (!filesToUpload || filesToUpload.length === 0) {
      return res.status(400).json({ success: false, error: 'No files provided for upload.' });
    }

    const uploadedImages = [];

    for (const file of filesToUpload) {
      const validationError = validateFile(file);
      if (validationError) {
        return res.status(400).json({ success: false, error: validationError });
      }

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const pathname = `${targetFolder}/${cleanFileName}`;

      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: true,
      });

      uploadedImages.push({
        url: blob.url,
        pathname: blob.pathname,
        size: file.size
      });
    }

    return res.status(200).json({
      success: true,
      images: uploadedImages
    });
  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An unexpected error occurred during image upload.'
    });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
