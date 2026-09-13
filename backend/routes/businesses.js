const express = require("express");
const { authenticate } = require("../middleware/auth");
const db = require("../config/db");
const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.business_name, c.business_description, c.business_phone,
              c.business_location_id, l.name_ar as location_name,
              u.name as owner_name, u.avatar_url
       FROM customers c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN locations l ON c.business_location_id = l.id
       WHERE c.account_type = 'commercial'
         AND c.is_approved_commercial = true
         AND c.show_in_directory = true
         AND u.is_active = true
       ORDER BY c.business_name ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.business_name, c.business_description, c.business_phone,
              c.business_location_id, l.name_ar as location_name,
              u.name as owner_name, u.avatar_url
       FROM customers c
       JOIN users u ON c.user_id = u.id
       LEFT JOIN locations l ON c.business_location_id = l.id
       WHERE c.id = $1 AND c.account_type = 'commercial'
         AND c.is_approved_commercial = true AND c.show_in_directory = true`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Business not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
