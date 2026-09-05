-- =====================================================
-- Delivery & Errand Service Platform - Database Schema
-- PostgreSQL
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);

-- =====================================================
-- 2. CUSTOMERS
-- =====================================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    default_address TEXT,
    addresses JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_user_id ON customers(user_id);

-- =====================================================
-- 3. VEHICLES
-- =====================================================

CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('motorcycle', 'tuk_tuk', 'car')),
    name_ar VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vehicles (type, name_ar, name_en, icon) VALUES
('motorcycle', 'دراجة نارية', 'Motorcycle', '🏍️'),
('tuk_tuk', 'توك توك', 'Tuk-tuk', '🛺'),
('car', 'سيارة', 'Car', '🚗');

-- =====================================================
-- 4. DRIVERS
-- =====================================================

CREATE TABLE drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    vehicle_plate VARCHAR(50),
    vehicle_color VARCHAR(50),
    national_id VARCHAR(50),
    national_id_image TEXT,
    license_image TEXT,
    current_location_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    availability_status VARCHAR(20) DEFAULT 'offline' CHECK (availability_status IN ('available', 'busy', 'offline')),
    is_approved BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    total_earnings DECIMAL(10, 2) DEFAULT 0,
    unpaid_earnings DECIMAL(10, 2) DEFAULT 0,
    rating_avg DECIMAL(2, 1) DEFAULT 5.0,
    total_ratings INTEGER DEFAULT 0,
    -- Prepaid balance system
    prepaid_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    balance_renewal_amount DECIMAL(10,2) NOT NULL DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_availability ON drivers(availability_status);
CREATE INDEX idx_drivers_approved ON drivers(is_approved);

-- =====================================================
-- 5. DRIVER SHIFTS
-- =====================================================

CREATE TABLE driver_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shifts_driver ON driver_shifts(driver_id);

-- =====================================================
-- 6. LOCATIONS
-- =====================================================

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    delivery_price DECIMAL(10, 2) NOT NULL DEFAULT 50,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO locations (name_ar, name_en, delivery_price, sort_order) VALUES
('السنطة', 'El Santa', 50, 1),
('طنطا', 'Tanta', 50, 2);

CREATE INDEX idx_locations_active ON locations(is_active);

-- =====================================================
-- 7. PROMOTIONAL BANNERS
-- =====================================================

CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(150),
    image_url TEXT NOT NULL,
    audience VARCHAR(20) NOT NULL DEFAULT 'both' CHECK (audience IN ('customer', 'driver', 'both')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_banners_audience_active ON banners(audience, is_active, sort_order);

-- =====================================================
-- 8. PRICING SETTINGS
-- =====================================================

CREATE TABLE pricing_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) UNIQUE NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO pricing_settings (key, value, description) VALUES
('motorcycle_base', 30, 'Base price for motorcycle delivery'),
('tuk_tuk_base', 40, 'Base price for tuk-tuk delivery'),
('car_base', 60, 'Base price for car delivery'),
('additional_location', 15, 'Fee per additional location after first'),
('ready_items_fee', 10, 'Service fee for ready items pickup'),
('driver_purchase_fee', 25, 'Service fee for driver purchasing items'),
('driver_percentage', 80, 'Driver revenue share percentage'),
('owner_percentage', 20, 'Owner revenue share percentage'),
('min_order_amount', 20, 'Minimum order amount'),
-- Number of Places pricing (added via migrate_places.js)
('places_1',      0,  'Fee for driver visiting 1 place'),
('places_2',     10,  'Fee for driver visiting 2 places'),
('places_3',     20,  'Fee for driver visiting 3 places'),
('places_4',     30,  'Fee for driver visiting 4 places'),
('places_5_plus',50,  'Fee for driver visiting 5+ places'),
-- Vehicle surcharges (added on top of location price; motorcycle = 0 extra)
('tuk_tuk_surcharge', 20, 'Extra fee for tuk-tuk orders on top of location price'),
('car_surcharge',     40, 'Extra fee for car orders on top of location price');

-- =====================================================
-- 9. ORDERS
-- =====================================================

CREATE TYPE order_status AS ENUM (
    'requested',
    'finding_driver',
    'driver_assigned',
    'driver_accepted',
    'going_to_location',
    'arrived_at_location',
    'items_collected',
    'delivering',
    'completed',
    'cancelled'
);

CREATE TYPE service_type AS ENUM ('ready_items', 'driver_purchase');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id),
    driver_id UUID REFERENCES drivers(id),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id),
    service_type service_type NOT NULL,
    status order_status DEFAULT 'requested',
    total_locations INTEGER NOT NULL DEFAULT 1,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    service_fee DECIMAL(10, 2) NOT NULL,
    items_subtotal DECIMAL(10, 2) DEFAULT 0,
    promo_discount DECIMAL(10, 2) DEFAULT 0,
    promo_code_id UUID,
    final_total DECIMAL(10, 2) NOT NULL,
    driver_earnings DECIMAL(10, 2) DEFAULT 0,
    owner_earnings DECIMAL(10, 2) DEFAULT 0,
    customer_phone VARCHAR(20) NOT NULL,
    customer_address TEXT NOT NULL,
    notes TEXT,
    -- Number of Places stage (added via migrate_places.js)
    num_places INTEGER DEFAULT 1,
    places_fee DECIMAL(10, 2) DEFAULT 0,
    place_details JSONB DEFAULT '[]',
    -- Driver cost estimate / receipt (added via migrate_estimate.js)
    estimate_status VARCHAR(20) DEFAULT NULL,
    estimate_items JSONB DEFAULT '[]',
    estimate_total DECIMAL(10, 2) DEFAULT 0,
    estimate_sent_at TIMESTAMP,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    complaint TEXT,
    complaint_status VARCHAR(20) DEFAULT 'open' CHECK (complaint_status IN ('open', 'resolved', 'dismissed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_driver ON orders(driver_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);

-- =====================================================
-- 10. ORDER LOCATIONS
-- =====================================================

CREATE TABLE order_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id),
    custom_address TEXT,
    location_name TEXT,
    sort_order INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_locations_order ON order_locations(order_id);

-- =====================================================
-- 11. ORDER ITEMS
-- =====================================================

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_location_id UUID REFERENCES order_locations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) DEFAULT 1,
    unit VARCHAR(50) DEFAULT 'piece',
    price DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    is_purchased BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_location ON order_items(order_location_id);

-- =====================================================
-- 11. RECEIPTS
-- =====================================================

CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    receipt_number VARCHAR(30) UNIQUE NOT NULL,
    items_subtotal DECIMAL(10, 2) NOT NULL,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    service_fee DECIMAL(10, 2) NOT NULL,
    promo_discount DECIMAL(10, 2) DEFAULT 0,
    final_total DECIMAL(10, 2) NOT NULL,
    driver_earnings DECIMAL(10, 2) NOT NULL,
    owner_earnings DECIMAL(10, 2) NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_receipts_order ON receipts(order_id);

-- =====================================================
-- 12. EARNINGS
-- =====================================================

CREATE TABLE earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    is_paid BOOLEAN DEFAULT false,
    payout_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_earnings_driver ON earnings(driver_id);
CREATE INDEX idx_earnings_paid ON earnings(is_paid);

-- =====================================================
-- 13. DRIVER PAYOUTS
-- =====================================================

CREATE TABLE driver_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    amount DECIMAL(10, 2) NOT NULL,
    processed_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payouts_driver ON driver_payouts(driver_id);

-- =====================================================
-- 13b. DRIVER BALANCE TRANSACTIONS
-- =====================================================

CREATE TABLE driver_balance_transactions (
    id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id      UUID          NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    type           VARCHAR(20)   NOT NULL CHECK (type IN ('deposit', 'deduction', 'adjustment')),
    amount         DECIMAL(10,2) NOT NULL,
    balance_after  DECIMAL(10,2) NOT NULL,
    description    TEXT,
    order_id       UUID          REFERENCES orders(id) ON DELETE SET NULL,
    created_by     UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_bal_tx_driver ON driver_balance_transactions(driver_id);
CREATE INDEX idx_bal_tx_order  ON driver_balance_transactions(order_id);

-- =====================================================
-- 14. PROMO CODES
-- =====================================================

CREATE TABLE promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
    discount_value DECIMAL(10, 2) NOT NULL,
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);

-- =====================================================
-- 15. CHATS & MESSAGES
-- =====================================================

CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    participant_1_id UUID NOT NULL REFERENCES users(id),
    participant_2_id UUID NOT NULL REFERENCES users(id),
    chat_type VARCHAR(20) NOT NULL CHECK (chat_type IN ('customer_driver', 'admin_driver')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chats_order ON chats(order_id);
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_unread ON messages(chat_id, is_read);

-- =====================================================
-- 16. SYSTEM SETTINGS
-- =====================================================

CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_settings (key, value, description) VALUES
('accepting_orders', 'true', 'Global switch to accept new orders'),
('platform_name_ar', 'خدمة التوصيل', 'Platform name in Arabic'),
('platform_name_en', 'Delivery Service', 'Platform name in English'),
('contact_phone', '01000000000', 'Customer support phone'),
('default_language', 'ar', 'Default language: ar or en');

-- =====================================================
-- 17. ADMIN ACTIVITY LOG
-- =====================================================

CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at);

-- =====================================================
-- 18. DRIVER LOCATION HISTORY
-- =====================================================

CREATE TABLE driver_location_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_loc_history_driver ON driver_location_history(driver_id);
CREATE INDEX idx_loc_history_time ON driver_location_history(recorded_at);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate order number function
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number = 'ORD-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Generate receipt number function
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.receipt_number = 'RCP-' || TO_CHAR(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_receipt_number BEFORE INSERT ON receipts
    FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- =====================================================
-- 19. PLACE COUNT OPTIONS (dynamic admin-managed list)
-- =====================================================

CREATE TABLE place_count_options (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label_ar      VARCHAR(100) NOT NULL,
    min_places    INTEGER NOT NULL,
    is_open_ended BOOLEAN NOT NULL DEFAULT false,
    price         DECIMAL(10,2) NOT NULL DEFAULT 0,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO place_count_options (label_ar, min_places, is_open_ended, price, sort_order) VALUES
('مكان واحد',        1, false,  0, 1),
('مكانان',           2, false, 10, 2),
('ثلاثة أماكن',      3, false, 20, 3),
('أربعة أماكن',      4, false, 30, 4),
('خمسة أماكن فأكثر', 5, true,  50, 5);
