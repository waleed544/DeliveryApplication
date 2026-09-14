const { Pool } = require('pg');
require('dotenv').config();
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function reindexLocations(newItemId = null, newOrder = null) {
  const res = await p.query('SELECT id FROM locations ORDER BY sort_order ASC, created_at ASC');
  let items = res.rows.map(r => r.id);

  if (newItemId && newOrder !== null) {
    items = items.filter(id => id !== newItemId);
    const targetIndex = Math.max(0, Math.min(items.length, newOrder - 1));
    items.splice(targetIndex, 0, newItemId);
  }

  for (let i = 0; i < items.length; i++) {
    await p.query('UPDATE locations SET sort_order = $1 WHERE id = $2', [i + 1, items[i]]);
  }
}

async function test() {
  try {
    const ids = [];
    for(let i = 1; i <= 5; i++) {
      const res = await p.query(`INSERT INTO locations (name_ar, name_en, delivery_price, sort_order) VALUES ('TestLoc${i}', 'TestEn${i}', 10, 999999) RETURNING id`);
      ids.push(res.rows[0].id);
    }
    
    await reindexLocations();
    
    let res = await p.query(`SELECT name_ar, sort_order FROM locations WHERE name_ar LIKE 'TestLoc%' ORDER BY sort_order ASC`);
    console.log('Initial:', res.rows.map(r => r.name_ar)); 
    // Expected: TestLoc1, TestLoc2, TestLoc3, TestLoc4, TestLoc5
    
    await reindexLocations(ids[1], 4); // TestLoc2 -> 4
    res = await p.query(`SELECT name_ar, sort_order FROM locations WHERE name_ar LIKE 'TestLoc%' ORDER BY sort_order ASC`);
    console.log('Move 2 to 4:', res.rows.map(r => r.name_ar)); 
    // Expected: TestLoc1, TestLoc3, TestLoc4, TestLoc2, TestLoc5
    
    await reindexLocations(ids[4], 2); // TestLoc5 -> 2
    res = await p.query(`SELECT name_ar, sort_order FROM locations WHERE name_ar LIKE 'TestLoc%' ORDER BY sort_order ASC`);
    console.log('Move 5 to 2:', res.rows.map(r => r.name_ar));
    // Expected: TestLoc1, TestLoc5, TestLoc3, TestLoc4, TestLoc2

    await p.query(`DELETE FROM locations WHERE name_ar LIKE 'TestLoc%'`);
    await reindexLocations();
  } catch (err) {
    console.error(err);
  } finally {
    p.end();
  }
}

test();
