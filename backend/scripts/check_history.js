const db = require('../config/db');

// Simulate exactly what GET /drivers/history does for Mohamed Driver
(async () => {
  try {
    // Step 1: get driver id by user_id (same as the route does with req.user.id)
    const userResult = await db.query(
      `SELECT u.id as user_id, u.name FROM users u
       JOIN drivers d ON d.user_id = u.id
       WHERE u.name = 'Mohamed Driver'`
    );
    if (!userResult.rows.length) { console.log('Driver user not found'); process.exit(1); }
    const { user_id, name } = userResult.rows[0];
    console.log(`Testing history for: ${name} (user_id=${user_id})`);

    // Step 2: get driver.id
    const driverResult = await db.query('SELECT id FROM drivers WHERE user_id = $1', [user_id]);
    const driverId = driverResult.rows[0].id;
    console.log(`driver_id = ${driverId}`);

    // Step 3: run the history query exactly
    const orders = await db.query(
      `SELECT o.id, o.order_number, o.status, o.service_type,
         o.delivery_fee, o.service_fee, o.places_fee, o.items_subtotal,
         o.promo_discount, o.final_total,
         COALESCE(o.driver_earnings, 0) AS driver_earnings,
         o.customer_address, o.customer_phone, o.num_places,
         o.notes, o.created_at, o.completed_at,
         cu.name as customer_name
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       JOIN users cu ON c.user_id = cu.id
       WHERE o.driver_id = $1
         AND o.status IN ('completed', 'cancelled')
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [driverId]
    );
    console.log(`\nOrders returned by history query: ${orders.rows.length}`);
    orders.rows.slice(0, 5).forEach(o =>
      console.log(`  ${o.order_number} | ${o.status} | customer=${o.customer_name}`)
    );

    // Step 4: check the customers join — are any customers deleted?
    const allOrders = await db.query(
      `SELECT o.order_number, o.status, o.customer_id,
              c.id as cust_row, cu.id as cust_user_id, cu.name as cust_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users cu ON c.user_id = cu.id
       WHERE o.driver_id = $1 AND o.status IN ('completed','cancelled')
       ORDER BY o.created_at DESC`,
      [driverId]
    );
    console.log('\n=== Checking customer rows (NULL = customer was deleted) ===');
    allOrders.rows.forEach(o =>
      console.log(`  ${o.order_number} | cust_row=${o.cust_row} | cust_user=${o.cust_user_id} | name=${o.cust_name}`)
    );

    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();
