const { pool } = require('./config/db');

async function test() {
  try {
    console.log('Testing /chats query...');
    const chats = await pool.query(`
      SELECT c.*, 
        u1.name as participant_1_name, u1.role as participant_1_role, u1.avatar_url as participant_1_avatar,
        u2.name as participant_2_name, u2.role as participant_2_role, u2.avatar_url as participant_2_avatar,
        o.order_number, o.status as order_status,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as total_messages
      FROM chats c
      LEFT JOIN users u1 ON c.participant_1_id = u1.id
      LEFT JOIN users u2 ON c.participant_2_id = u2.id
      LEFT JOIN orders o ON c.order_id = o.id
      ORDER BY last_message_at DESC NULLS LAST, c.updated_at DESC
      LIMIT 1
    `);
    console.log('Chats query OK. Found rows:', chats.rows.length);
    
    if (chats.rows.length > 0) {
      const chatId = chats.rows[0].id;
      console.log('Testing /chats/:id/messages query for chat:', chatId);
      const msgs = await pool.query(`
        SELECT m.*, u.name as sender_name, u.role as sender_role, u.avatar_url as sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = $1
        ORDER BY m.created_at ASC
        LIMIT 1
      `, [chatId]);
      console.log('Messages query OK. Found rows:', msgs.rows.length);
    }
    
    console.log('Testing /orders/:id query modification...');
    const orders = await pool.query(`
      SELECT o.id, (SELECT id FROM chats WHERE order_id = o.id LIMIT 1) as chat_id 
      FROM orders o 
      WHERE (SELECT id FROM chats WHERE order_id = o.id LIMIT 1) IS NOT NULL 
      LIMIT 1
    `);
    console.log('Orders query OK. Found orders with chat_id:', orders.rows.length);

    console.log('All DB queries successful.');
  } catch (err) {
    console.error('DB ERROR:', err.message);
  } finally {
    pool.end();
  }
}
test();
