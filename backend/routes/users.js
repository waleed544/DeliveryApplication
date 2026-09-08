const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');
const db = require('../config/db');
const router = express.Router();

router.use(authenticate);

// ── GET /api/users/me ─────────────────────────────────────────────────────────
// Returns the current user's basic info (name, phone, avatar_url)
router.get('/me', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, phone, email, avatar_url, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/profile ────────────────────────────────────────────────────
// Drivers and customers can update name and phone number
router.put('/profile', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'الاسم مطلوب' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'رقم الهاتف مطلوب' });
    }

    // Check if new phone is already taken by ANOTHER user
    if (phone !== req.user.phone) {
      const existing = await db.query(
        'SELECT id FROM users WHERE phone = $1 AND id != $2',
        [phone.trim(), req.user.id]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ message: 'رقم الهاتف مستخدم بالفعل من قبل حساب آخر' });
      }
    }

    await db.query(
      'UPDATE users SET name = $1, phone = $2, updated_at = NOW() WHERE id = $3',
      [name.trim(), phone.trim(), req.user.id]
    );

    const updated = await db.query(
      'SELECT id, name, phone, email, avatar_url, role FROM users WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'تم تحديث الملف الشخصي', user: updated.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'رقم الهاتف مستخدم بالفعل' });
    }
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/users/avatar ────────────────────────────────────────────────────
// Upload or replace profile photo (multipart/form-data, field: "avatar")
router.post('/avatar', upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'لم يتم رفع أي صورة' });
  }

  try {
    // Delete old avatar file if it exists and is local
    const old = await db.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    const oldUrl = old.rows[0]?.avatar_url;
    if (oldUrl && oldUrl.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', oldUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await db.query(
      'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2',
      [avatarUrl, req.user.id]
    );

    res.json({ message: 'تم رفع الصورة بنجاح', avatar_url: avatarUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/users/avatar ──────────────────────────────────────────────────
// Remove profile photo
router.delete('/avatar', async (req, res) => {
  try {
    const result = await db.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
    const oldUrl = result.rows[0]?.avatar_url;
    if (oldUrl && oldUrl.startsWith('/uploads/')) {
      const oldPath = path.join(__dirname, '..', oldUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await db.query('UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1', [req.user.id]);
    res.json({ message: 'تم حذف الصورة' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/users/change-password ───────────────────────────────────────────
// Any authenticated user can change their own password
router.put('/change-password', async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ message: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
  }
  try {
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'المستخدم غير موجود' });
    const bcrypt = require('bcryptjs');
    const match = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!match) return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
    const hashed = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
