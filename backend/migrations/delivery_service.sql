-- =====================================================
-- Migration: Add delivery_service type
-- Run this against your PostgreSQL database
-- =====================================================

-- 1. Add 'delivery_service' to the service_type enum
ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'delivery_service';

-- 2. Add delivery-specific columns to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_sub_type   VARCHAR(10)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pickup_location_id  UUID         REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS pickup_address      TEXT         DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dropoff_location_id UUID         REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS dropoff_address     TEXT         DEFAULT NULL;

-- 3. Create the delivery route prices table
CREATE TABLE IF NOT EXISTS delivery_route_prices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  to_location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  price            DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (from_location_id, to_location_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_prices_from ON delivery_route_prices(from_location_id);
CREATE INDEX IF NOT EXISTS idx_delivery_prices_to   ON delivery_route_prices(to_location_id);

-- 4. Allow new delivery statuses in order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'going_to_pickup';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'arrived_at_pickup';
