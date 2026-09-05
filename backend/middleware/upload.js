const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const avatarDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
const bannerDir = path.join(__dirname, '../uploads/banners');
if (!fs.existsSync(bannerDir)) fs.mkdirSync(bannerDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // e.g. avatar-<userId>-<timestamp>.jpg
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('الصور المقبولة: JPG، PNG، WEBP فقط'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

const bannerUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, bannerDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `banner-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
  }),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }
});

module.exports = upload;
module.exports.bannerUpload = bannerUpload;
