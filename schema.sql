-- ═══════════════════════════════════════════════════════════════════
--  WholeCART v3.0 — PostgreSQL Schema (Neon DB)
--  You can run this manually in the Neon SQL Editor if you prefer
--  manual setup over the auto-init in server.js.
-- ═══════════════════════════════════════════════════════════════════

-- ── Drop existing tables (clean slate) ────────────────────────────
DROP TABLE IF EXISTS orders   CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users    CASCADE;

-- ── Users ──────────────────────────────────────────────────────────
CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(120)  NOT NULL,
  email      VARCHAR(200)  NOT NULL UNIQUE,
  password   VARCHAR(200)  NOT NULL,
  role       VARCHAR(20)   NOT NULL DEFAULT 'retailer'
             CHECK (role IN ('retailer', 'wholesaler')),
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ── Products ───────────────────────────────────────────────────────
CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200)   NOT NULL,
  category    VARCHAR(100)   NOT NULL DEFAULT 'Other',
  price       NUMERIC(10,2)  NOT NULL CHECK (price > 0),
  bulk_price  NUMERIC(10,2)  NOT NULL CHECK (bulk_price > 0),
  min_qty     INTEGER        NOT NULL DEFAULT 1 CHECK (min_qty >= 1),
  unit        VARCHAR(20)    NOT NULL DEFAULT 'kg',
  stock       INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image       VARCHAR(10)    NOT NULL DEFAULT '📦',
  description TEXT           NOT NULL DEFAULT '',
  rating      NUMERIC(3,1)   NOT NULL DEFAULT 4.0,
  reviews     INTEGER        NOT NULL DEFAULT 0,
  seller_id   INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT  chk_bulk_lt_mrp CHECK (bulk_price < price)
);

CREATE INDEX idx_products_seller    ON products(seller_id);
CREATE INDEX idx_products_category  ON products(category);

-- ── Orders ─────────────────────────────────────────────────────────
CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  buyer_id    INTEGER        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  seller_id   INTEGER        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  product_id  INTEGER        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER        NOT NULL CHECK (quantity > 0),
  total_price NUMERIC(12,2)  NOT NULL CHECK (total_price > 0),
  status      VARCHAR(20)    NOT NULL DEFAULT 'Pending'
              CHECK (status IN ('Pending','Accepted','InTransit','Delivered','Rejected')),
  order_date  DATE           NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer   ON orders(buyer_id);
CREATE INDEX idx_orders_seller  ON orders(seller_id);
CREATE INDEX idx_orders_product ON orders(product_id);
CREATE INDEX idx_orders_status  ON orders(status);

-- ═══════════════════════════════════════════════════════════════════
--  SEED DATA — Demo users + products + orders
--  Passwords are bcrypt hashes of 'demo123'
-- ═══════════════════════════════════════════════════════════════════

-- Demo users
-- NOTE: These are bcrypt hashes of 'demo123' (cost factor 10).
-- For a fresh seed run the server once — it auto-seeds on first boot.
-- Or replace $hash below with output of:
--   node -e "const b=require('bcryptjs');b.hash('demo123',10).then(console.log)"

INSERT INTO users (name, email, password, role) VALUES
  ('Sonu Meena',    'sonu@demo.com', '$2a$10$hashed_retailer_password_here',    'retailer'),
  ('Raj Wholesale', 'raj@demo.com',  '$2a$10$hashed_wholesaler_password_here',  'wholesaler');

-- ═══════════════════════════════════════════════════════════════════
--  TIP: The easiest way to seed is to just run `npm start` once —
--  server.js auto-creates tables and inserts demo data on first boot.
-- ═══════════════════════════════════════════════════════════════════