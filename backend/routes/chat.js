const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/db');
const socketManager = require('../socketManager');
const router = express.Router();

router.use(authenticate);

// Get or create chat
router.post('/get-or-create', async (req, res) => {
  try {
    const { order_id, participant_id, chat_type } = req.body;

    let query = `SELECT * FROM chats WHERE `;
    const params = [];

    if (order_id) {
      params.push(order_id);
      query += `order_id = $1`;
    } else {
      params.push(req.user.id, participant_id, chat_type);
      query += `(participant_1_id = $1 AND participant_2_id = $2 OR participant_1_id = $2 AND participant_2_id = $1) AND chat_type = $3`;
    }

    let result = await db.query(query, params);

    if (result.rows.length === 0) {
      const p1 = req.user.id;
      const p2 = participant_id;

      const insertResult = await db.query(
        'INSERT INTO chats (order_id, participant_1_id, participant_2_id, chat_type) VALUES ($1, $2, $3, $4) RETURNING *',
        [order_id || null, p1, p2, chat_type]
      );
      result = insertResult;
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get chat messages
router.get('/:chatId/messages', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.chat_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.chatId]
    );

    // Mark as read
    await db.query(
      'UPDATE messages SET is_read = true WHERE chat_id = $1 AND sender_id != $2',
      [req.params.chatId, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Send message — also pushes to recipient via socket
router.post('/:chatId/messages', async (req, res) => {
  try {
    const { content } = req.body;
    const chatId = req.params.chatId;

    // Persist the message
    const result = await db.query(
      'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
      [chatId, req.user.id, content]
    );

    await db.query('UPDATE chats SET updated_at = NOW() WHERE id = $1', [chatId]);

    const message = result.rows[0];

    // Find the other participant so we can push the message to them via socket
    const chatResult = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    if (chatResult.rows.length > 0) {
      const chat = chatResult.rows[0];
      const recipientId = chat.participant_1_id === req.user.id
        ? chat.participant_2_id
        : chat.participant_1_id;

      // Emit to recipient's personal room
      socketManager.emitChatMessage(chatId, recipientId, message);
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's chats
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, 
        u1.name as participant_1_name, u2.name as participant_2_name,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND is_read = false AND sender_id != $1) as unread_count
       FROM chats c
       JOIN users u1 ON c.participant_1_id = u1.id
       JOIN users u2 ON c.participant_2_id = u2.id
       WHERE c.participant_1_id = $1 OR c.participant_2_id = $1
       ORDER BY c.updated_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;