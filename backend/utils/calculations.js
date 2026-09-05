const db = require('../config/db');

const getPricingSettings = async () => {
  const result = await db.query('SELECT key, value FROM pricing_settings');
  const settings = {};
  result.rows.forEach(row => {
    settings[row.key] = parseFloat(row.value);
  });
  return settings;
};

/**
 * NEW — Location-based pricing.
 *
 * Delivery fee = SUM of delivery_price for every selected location.
 * Vehicle surcharge = extra fee for tok-tok or car (admin-controlled).
 * Service fee   = from pricing_settings (ready_items_fee / driver_purchase_fee).
 * Places fee    = fee based on how many shopping places the driver visits.
 * Promo codes   = unchanged.
 *
 * @param {string[]} locationIds  - array of locations.id UUIDs
 * @param {string}   serviceType  - 'ready_items' | 'driver_purchase'
 * @param {number}   itemsSubtotal
 * @param {string|null} promoCode
 * @param {number}   placesFee    - extra fee from the "number of places" stage
 * @param {string}   vehicleType  - 'motorcycle' | 'tuk_tuk' | 'car'  (default: 'motorcycle')
 */
const calculateLocationBasedPricing = async (locationIds, serviceType, itemsSubtotal = 0, promoCode = null, placesFee = 0, vehicleType = 'motorcycle') => {
  const settings = await getPricingSettings();

  // ── Delivery fee: sum of each location's delivery_price ───────────────────
  let deliveryFee = 0;
  if (locationIds && locationIds.length > 0) {
    // Filter out null/empty ids (custom-address-only locations)
    const validIds = locationIds.filter(Boolean);
    if (validIds.length > 0) {
      const placeholders = validIds.map((_, i) => `$${i + 1}`).join(', ');
      const locResult = await db.query(
        `SELECT COALESCE(SUM(delivery_price), 0) as total FROM locations WHERE id IN (${placeholders})`,
        validIds
      );
      deliveryFee = parseFloat(locResult.rows[0].total) || 0;
    }
  }

  // Fall back to a minimum if no pricing location was selected
  if (deliveryFee === 0) {
    deliveryFee = settings['min_order_amount'] || 20;
  }

  // ── Vehicle surcharge (tok-tok or car costs more than motorcycle) ─────────
  let vehicleSurcharge = 0;
  if (vehicleType === 'tuk_tuk') {
    vehicleSurcharge = settings['tuk_tuk_surcharge'] || 0;
  } else if (vehicleType === 'car') {
    vehicleSurcharge = settings['car_surcharge'] || 0;
  }
  deliveryFee += vehicleSurcharge;

  // ── Service fee ───────────────────────────────────────────────────────────
  const serviceFee = serviceType === 'driver_purchase'
    ? (settings.driver_purchase_fee || 25)
    : (settings.ready_items_fee || 10);

  // ── Subtotal ──────────────────────────────────────────────────────────────
  let subtotal = deliveryFee + serviceFee + itemsSubtotal + placesFee;

  // ── Promo code ────────────────────────────────────────────────────────────
  let promoDiscount = 0;
  if (promoCode) {
    const promoResult = await db.query(
      'SELECT * FROM promo_codes WHERE code = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())',
      [promoCode.toUpperCase()]
    );

    if (promoResult.rows.length > 0) {
      const promo = promoResult.rows[0];
      if (subtotal >= (promo.min_order_amount || 0)) {
        if (!promo.max_uses || promo.used_count < promo.max_uses) {
          promoDiscount = promo.discount_type === 'percentage'
            ? subtotal * (promo.discount_value / 100)
            : promo.discount_value;
          if (promoDiscount > subtotal) promoDiscount = subtotal;
        }
      }
    }
  }

  const finalTotal = subtotal - promoDiscount;

  // ── Revenue split ─────────────────────────────────────────────────────────
  const driverPct = settings.driver_percentage || 80;
  const ownerPct  = settings.owner_percentage  || 20;
  const feeProfitBase = deliveryFee + serviceFee + placesFee;
  // Apply a discount to the fee pool proportionally when the order includes items.
  // Item prices are pass-through costs and are not driver/admin profit.
  const feeDiscount = subtotal > 0 ? promoDiscount * (feeProfitBase / subtotal) : 0;
  const discountedFeeProfit = Math.max(0, feeProfitBase - feeDiscount);
  const driverEarnings = discountedFeeProfit * (driverPct / 100);
  const ownerEarnings  = discountedFeeProfit * (ownerPct  / 100);

  return {
    deliveryFee,
    vehicleSurcharge,
    serviceFee,
    placesFee,
    itemsSubtotal,
    subtotal,
    promoDiscount,
    finalTotal,
    driverEarnings,
    ownerEarnings,
    driverPercentage: driverPct,
    ownerPercentage:  ownerPct
  };
};

/**
 * LEGACY — kept for backward compatibility with any internal code that still
 * calls it. New order creation uses calculateLocationBasedPricing instead.
 */
const calculateOrderPricing = async (vehicleType, numLocations, serviceType, itemsSubtotal = 0, promoCode = null) => {
  const settings = await getPricingSettings();

  let deliveryFee = settings[`${vehicleType}_base`] || 30;
  if (numLocations > 1) {
    deliveryFee += (numLocations - 1) * (settings.additional_location || 15);
  }

  const serviceFee = serviceType === 'driver_purchase'
    ? (settings.driver_purchase_fee || 25)
    : (settings.ready_items_fee || 10);

  let subtotal = deliveryFee + serviceFee + itemsSubtotal;
  let promoDiscount = 0;

  if (promoCode) {
    const promoResult = await db.query(
      'SELECT * FROM promo_codes WHERE code = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())',
      [promoCode.toUpperCase()]
    );
    if (promoResult.rows.length > 0) {
      const promo = promoResult.rows[0];
      if (subtotal >= (promo.min_order_amount || 0)) {
        if (!promo.max_uses || promo.used_count < promo.max_uses) {
          promoDiscount = promo.discount_type === 'percentage'
            ? subtotal * (promo.discount_value / 100)
            : promo.discount_value;
          if (promoDiscount > subtotal) promoDiscount = subtotal;
        }
      }
    }
  }

  const finalTotal = subtotal - promoDiscount;
  const driverPct = settings.driver_percentage || 80;
  const ownerPct  = settings.owner_percentage  || 20;
  const feeProfitBase = deliveryFee + serviceFee;
  const feeDiscount = subtotal > 0 ? promoDiscount * (feeProfitBase / subtotal) : 0;
  const discountedFeeProfit = Math.max(0, feeProfitBase - feeDiscount);

  return {
    deliveryFee,
    serviceFee,
    itemsSubtotal,
    subtotal,
    promoDiscount,
    finalTotal,
    driverEarnings: discountedFeeProfit * (driverPct / 100),
    ownerEarnings:  discountedFeeProfit * (ownerPct  / 100),
    driverPercentage: driverPct,
    ownerPercentage:  ownerPct
  };
};

module.exports = {
  getPricingSettings,
  calculateLocationBasedPricing,
  calculateOrderPricing   // legacy
};