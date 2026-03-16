// ═══════════════════════════════════════════════════════════════════
//  WholeCART v3.0 — Backend API  (Node.js + Express + Neon PostgreSQL)
// ═══════════════════════════════════════════════════════════════════
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "wholecart_secret_dev";

// ─── Middleware ────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Neon PostgreSQL Pool ──────────────────────────────────────────
// Neon provides a connection string in this format:
//   postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Neon
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error:", err.message);
  x;
});

// Helper — run a query and return rows
const query = (text, params) => pool.query(text, params);

// ─── DB Initialisation ─────────────────────────────────────────────
// Creates all tables and seeds demo data on first run.
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── users ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(120)  NOT NULL,
        email      VARCHAR(200)  NOT NULL UNIQUE,
        password   VARCHAR(200)  NOT NULL,
        role       VARCHAR(20)   NOT NULL DEFAULT 'retailer'
                   CHECK (role IN ('retailer','wholesaler')),
        created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);

    // ── products ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(200)  NOT NULL,
        category    VARCHAR(100)  NOT NULL DEFAULT 'Other',
        price       NUMERIC(10,2) NOT NULL,
        bulk_price  NUMERIC(10,2) NOT NULL,
        min_qty     INTEGER       NOT NULL DEFAULT 1,
        unit        VARCHAR(20)   NOT NULL DEFAULT 'kg',
        stock       INTEGER       NOT NULL DEFAULT 0,
        image       VARCHAR(10)   NOT NULL DEFAULT '📦',
        description TEXT          NOT NULL DEFAULT '',
        rating      NUMERIC(3,1)  NOT NULL DEFAULT 4.0,
        reviews     INTEGER       NOT NULL DEFAULT 0,
        seller_id   INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);

    // ── orders ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id           SERIAL PRIMARY KEY,
        buyer_id     INTEGER       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        seller_id    INTEGER       NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        product_id   INTEGER       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity     INTEGER       NOT NULL,
        total_price  NUMERIC(12,2) NOT NULL,
        status       VARCHAR(20)   NOT NULL DEFAULT 'Pending'
                     CHECK (status IN ('Pending','Accepted','InTransit','Delivered','Rejected')),
        order_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
        created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
    `);

    // ── Seed demo users (only if table is empty) ───────────────────
    const { rows: existingUsers } = await client.query(
      "SELECT id FROM users LIMIT 1",
    );
    if (existingUsers.length === 0) {
      const retailerHash = await bcrypt.hash("demo123", 10);
      const wholesalerHash = await bcrypt.hash("demo123", 10);

      await client.query(
        `
        INSERT INTO users (name, email, password, role) VALUES
          ('Sonu Meena',    'sonu@demo.com', $1, 'retailer'),
          ('Raj Wholesale', 'raj@demo.com',  $2, 'wholesaler')
      `,
        [retailerHash, wholesalerHash],
      );

      // Fetch the wholesaler id to use in product seeds
      const {
        rows: [ws],
      } = await client.query(
        `SELECT id FROM users WHERE email = 'raj@demo.com'`,
      );

      await client.query(
        `
        INSERT INTO products (name, category, price, bulk_price, min_qty, unit, stock, image, description, rating, reviews, seller_id) VALUES
          ('Basmati Rice',  'Grains',  45,  38,  50,  'kg', 1200, '🌾', 'Premium long-grain basmati',  4.5, 128, $1),
          ('Sunflower Oil', 'Oils',   120,  98,  20,  'L',  500,  '🫒', 'Cold-pressed sunflower oil',  4.2,  85, $1),
          ('Sugar',         'Grains',  40,  34, 100, 'kg', 3000, '🍬', 'Refined white sugar',          4.7, 210, $1),
          ('Wheat Flour',   'Grains',  35,  29, 100, 'kg', 2000, '🌾', 'Fine wheat chakki atta',       4.3, 156, $1),
          ('Toor Dal',      'Pulses',  90,  78,  25, 'kg',  800, '🫘', 'Split pigeon peas',            4.6,  97, $1),
          ('Mustard Oil',   'Oils',   135, 115,  20,  'L',  350, '🫙', 'Kachi ghani mustard oil',      4.4,  72, $1),
          ('Moong Dal',     'Pulses',  95,  82,  25, 'kg',  600, '🫘', 'Split green lentils',          4.5,  63, $1),
          ('Rock Salt',     'Spices',  25,  18,  50, 'kg', 1500, '🧂', 'Natural sendha namak',         4.8, 340, $1)
      `,
        [ws.id],
      );

      // Seed demo orders
      const {
        rows: [retailer],
      } = await client.query(
        `SELECT id FROM users WHERE email = 'sonu@demo.com'`,
      );
      const { rows: seedProducts } = await client.query(
        `SELECT id FROM products WHERE seller_id = $1 ORDER BY id LIMIT 3`,
        [ws.id],
      );

      if (seedProducts.length >= 2) {
        await client.query(
          `
          INSERT INTO orders (buyer_id, seller_id, product_id, quantity, total_price, status, order_date) VALUES
            ($1, $2, $3, 100, 3800, 'Delivered', '2025-01-10'),
            ($1, $2, $4, 200, 6800, 'InTransit', '2025-03-05')
        `,
          [retailer.id, ws.id, seedProducts[0].id, seedProducts[2].id],
        );
      }

      console.log("🌱 Database seeded with demo data");
    }

    await client.query("COMMIT");
    console.log("✅ Database initialised");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ DB init failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

// ─── Auth Middleware ───────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

function wholesalerOnly(req, res, next) {
  if (req.user.role !== "wholesaler")
    return res.status(403).json({ message: "Wholesaler access only" });
  next();
}

function retailerOnly(req, res, next) {
  if (req.user.role !== "retailer")
    return res.status(403).json({ message: "Retailer access only" });
  next();
}

// ─── Utility: shape a product row for the API response ────────────
function formatProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: parseFloat(row.price),
    bulkPrice: parseFloat(row.bulk_price),
    minQty: row.min_qty,
    unit: row.unit,
    stock: row.stock,
    image: row.image,
    desc: row.description,
    rating: parseFloat(row.rating),
    reviews: row.reviews,
    sellerId: row.seller_id,
    seller: row.seller_name || "",
    createdAt: row.created_at,
  };
}

function formatOrder(row) {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    sellerId: row.seller_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    totalPrice: parseFloat(row.total_price),
    status: row.status,
    date: row.order_date,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════════

// ── Health ─────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.sendFile(require("path").join(__dirname, "index.html"));
});

app.get("/api/health", async (req, res) => {
  try {
    const { rows } = await query("SELECT NOW() AS db_time");
    res.json({
      status: "✅ WholeCART API v3.0",
      dbTime: rows[0].db_time,
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(500).json({ status: "❌ DB unreachable", error: err.message });
  }
});

// ── Auth: Register ─────────────────────────────────────────────────
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });

  const validRoles = ["retailer", "wholesaler"];
  const userRole = validRoles.includes(role) ? role : "retailer";

  try {
    const { rows: existing } = await query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()],
    );
    if (existing.length > 0)
      return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name.trim(), email.toLowerCase().trim(), hashed, userRole],
    );
    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// ── Auth: Login ────────────────────────────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const { rows } = await query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    if (rows.length === 0)
      return res
        .status(404)
        .json({ message: "No account found with that email" });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error during login" });
  }
});

// ── Auth: Get current user ─────────────────────────────────────────
app.get("/api/auth/me", auth, async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [req.user.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "User not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Products: Get all (with optional filters) ──────────────────────
app.get("/api/products", async (req, res) => {
  const { category, search } = req.query;
  try {
    let sql = `
      SELECT p.*, u.name AS seller_name
      FROM   products p
      JOIN   users    u ON u.id = p.seller_id
      WHERE  1=1
    `;
    const params = [];

    if (category && category !== "All") {
      params.push(category);
      sql += ` AND p.category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      sql += ` AND LOWER(p.name) LIKE $${params.length}`;
    }

    sql += " ORDER BY p.id ASC";
    const { rows } = await query(sql, params);
    res.json(rows.map(formatProduct));
  } catch (err) {
    console.error("Get products error:", err.message);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ── Products: Get categories ───────────────────────────────────────
app.get("/api/categories", async (req, res) => {
  try {
    const { rows } = await query(
      "SELECT DISTINCT category FROM products ORDER BY category ASC",
    );
    res.json(["All", ...rows.map((r) => r.category)]);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// ── Products: Get single ───────────────────────────────────────────
app.get("/api/products/:id", async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name AS seller_name
       FROM   products p
       JOIN   users    u ON u.id = p.seller_id
       WHERE  p.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Product not found" });
    res.json(formatProduct(rows[0]));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// ── Products: Add (wholesaler only) ───────────────────────────────
app.post("/api/products", auth, wholesalerOnly, async (req, res) => {
  const { name, category, price, bulkPrice, minQty, unit, stock, image, desc } =
    req.body;
  if (!name || !price || !bulkPrice || !minQty || stock === undefined)
    return res
      .status(400)
      .json({ message: "name, price, bulkPrice, minQty, stock are required" });
  if (parseFloat(bulkPrice) >= parseFloat(price))
    return res
      .status(400)
      .json({ message: "Bulk price must be less than MRP" });
  if (parseInt(stock) < 0 || parseInt(minQty) < 1)
    return res.status(400).json({ message: "Stock ≥ 0 and Min Qty ≥ 1" });

  try {
    const { rows } = await query(
      `INSERT INTO products
         (name, category, price, bulk_price, min_qty, unit, stock, image, description, seller_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *, (SELECT name FROM users WHERE id = $10) AS seller_name`,
      [
        name.trim(),
        category || "Other",
        parseFloat(price),
        parseFloat(bulkPrice),
        parseInt(minQty),
        unit || "kg",
        parseInt(stock),
        image || "📦",
        desc || "",
        req.user.id,
      ],
    );
    res.status(201).json(formatProduct(rows[0]));
  } catch (err) {
    console.error("Add product error:", err.message);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// ── Products: Edit (wholesaler, own products) ──────────────────────
app.put("/api/products/:id", auth, wholesalerOnly, async (req, res) => {
  const { name, category, price, bulkPrice, minQty, unit, stock, image, desc } =
    req.body;
  try {
    // Verify ownership
    const { rows: existing } = await query(
      "SELECT seller_id FROM products WHERE id = $1",
      [req.params.id],
    );
    if (existing.length === 0)
      return res.status(404).json({ message: "Product not found" });
    if (existing[0].seller_id !== req.user.id)
      return res
        .status(403)
        .json({ message: "You can only edit your own products" });

    const { rows } = await query(
      `UPDATE products SET
         name        = COALESCE($1, name),
         category    = COALESCE($2, category),
         price       = COALESCE($3, price),
         bulk_price  = COALESCE($4, bulk_price),
         min_qty     = COALESCE($5, min_qty),
         unit        = COALESCE($6, unit),
         stock       = COALESCE($7, stock),
         image       = COALESCE($8, image),
         description = COALESCE($9, description)
       WHERE id = $10
       RETURNING *, (SELECT name FROM users WHERE id = seller_id) AS seller_name`,
      [
        name || null,
        category || null,
        price ? parseFloat(price) : null,
        bulkPrice ? parseFloat(bulkPrice) : null,
        minQty ? parseInt(minQty) : null,
        unit || null,
        stock !== undefined ? parseInt(stock) : null,
        image || null,
        desc !== undefined ? desc : null,
        req.params.id,
      ],
    );
    res.json(formatProduct(rows[0]));
  } catch (err) {
    console.error("Edit product error:", err.message);
    res.status(500).json({ message: "Failed to update product" });
  }
});

// ── Products: Delete (wholesaler, own products) ────────────────────
app.delete("/api/products/:id", auth, wholesalerOnly, async (req, res) => {
  try {
    const { rows: existing } = await query(
      "SELECT seller_id FROM products WHERE id = $1",
      [req.params.id],
    );
    if (existing.length === 0)
      return res.status(404).json({ message: "Product not found" });
    if (existing[0].seller_id !== req.user.id)
      return res
        .status(403)
        .json({ message: "You can only delete your own products" });

    await query("DELETE FROM products WHERE id = $1", [req.params.id]);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete product error:", err.message);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

// ── Products: Update stock/price only ─────────────────────────────
app.patch("/api/products/:id/stock", auth, wholesalerOnly, async (req, res) => {
  const { stock, bulkPrice, price } = req.body;
  try {
    const { rows: existing } = await query(
      "SELECT seller_id FROM products WHERE id = $1",
      [req.params.id],
    );
    if (existing.length === 0)
      return res.status(404).json({ message: "Product not found" });
    if (existing[0].seller_id !== req.user.id)
      return res.status(403).json({ message: "Not your product" });

    const { rows } = await query(
      `UPDATE products SET
         stock      = COALESCE($1, stock),
         bulk_price = COALESCE($2, bulk_price),
         price      = COALESCE($3, price)
       WHERE id = $4
       RETURNING *, (SELECT name FROM users WHERE id = seller_id) AS seller_name`,
      [
        stock !== undefined ? parseInt(stock) : null,
        bulkPrice !== undefined ? parseFloat(bulkPrice) : null,
        price !== undefined ? parseFloat(price) : null,
        req.params.id,
      ],
    );
    res.json(formatProduct(rows[0]));
  } catch (err) {
    console.error("Stock update error:", err.message);
    res.status(500).json({ message: "Failed to update stock" });
  }
});

// ── Products: My products (wholesaler) ────────────────────────────
app.get("/api/my/products", auth, wholesalerOnly, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.name AS seller_name
       FROM   products p
       JOIN   users    u ON u.id = p.seller_id
       WHERE  p.seller_id = $1
       ORDER BY p.id ASC`,
      [req.user.id],
    );
    res.json(rows.map(formatProduct));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your products" });
  }
});

// ── Orders: Place order (retailer only) ───────────────────────────
app.post("/api/orders", auth, retailerOnly, async (req, res) => {
  const { productId, quantity } = req.body;
  if (!productId || !quantity)
    return res
      .status(400)
      .json({ message: "productId and quantity are required" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the product row to prevent race conditions
    const {
      rows: [product],
    } = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [
      productId,
    ]);
    if (!product) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Product not found" });
    }
    if (quantity < product.min_qty) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({
          message: `Minimum order quantity is ${product.min_qty} ${product.unit}`,
        });
    }
    if (quantity > product.stock) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: `Only ${product.stock} ${product.unit} in stock` });
    }

    const totalPrice = parseFloat(product.bulk_price) * quantity;

    // Insert order
    const {
      rows: [order],
    } = await client.query(
      `INSERT INTO orders (buyer_id, seller_id, product_id, quantity, total_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, product.seller_id, product.id, quantity, totalPrice],
    );

    // Deduct stock
    await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [
      quantity,
      product.id,
    ]);

    await client.query("COMMIT");

    // Fetch full order with names for response
    const {
      rows: [fullOrder],
    } = await query(
      `SELECT o.*,
              b.name AS buyer_name,
              p.name AS product_name
       FROM   orders   o
       JOIN   users    b ON b.id = o.buyer_id
       JOIN   products p ON p.id = o.product_id
       WHERE  o.id = $1`,
      [order.id],
    );
    res.status(201).json(formatOrder(fullOrder));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Place order error:", err.message);
    res.status(500).json({ message: "Failed to place order" });
  } finally {
    client.release();
  }
});

// ── Orders: Get my orders (role-aware) ────────────────────────────
app.get("/api/orders", auth, async (req, res) => {
  try {
    let sql, params;
    if (req.user.role === "retailer") {
      sql = `
        SELECT o.*, b.name AS buyer_name, p.name AS product_name
        FROM   orders   o
        JOIN   users    b ON b.id = o.buyer_id
        JOIN   products p ON p.id = o.product_id
        WHERE  o.buyer_id = $1
        ORDER  BY o.created_at DESC`;
      params = [req.user.id];
    } else {
      sql = `
        SELECT o.*, b.name AS buyer_name, p.name AS product_name
        FROM   orders   o
        JOIN   users    b ON b.id = o.buyer_id
        JOIN   products p ON p.id = o.product_id
        WHERE  o.seller_id = $1
        ORDER  BY o.created_at DESC`;
      params = [req.user.id];
    }
    const { rows } = await query(sql, params);
    res.json(rows.map(formatOrder));
  } catch (err) {
    console.error("Get orders error:", err.message);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
});

// ── Orders: Get single ─────────────────────────────────────────────
app.get("/api/orders/:id", auth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT o.*, b.name AS buyer_name, p.name AS product_name
       FROM   orders   o
       JOIN   users    b ON b.id = o.buyer_id
       JOIN   products p ON p.id = o.product_id
       WHERE  o.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Order not found" });
    const order = rows[0];
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id)
      return res.status(403).json({ message: "Access denied" });
    res.json(formatOrder(order));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch order" });
  }
});

// ── Orders: Update status (wholesaler only) ────────────────────────
app.patch("/api/orders/:id/status", auth, wholesalerOnly, async (req, res) => {
  const { status } = req.body;
  const validStatuses = [
    "Pending",
    "Accepted",
    "InTransit",
    "Delivered",
    "Rejected",
  ];
  if (!validStatuses.includes(status))
    return res
      .status(400)
      .json({ message: `Status must be one of: ${validStatuses.join(", ")}` });

  try {
    const {
      rows: [existing],
    } = await query("SELECT seller_id FROM orders WHERE id = $1", [
      req.params.id,
    ]);
    if (!existing) return res.status(404).json({ message: "Order not found" });
    if (existing.seller_id !== req.user.id)
      return res
        .status(403)
        .json({ message: "You can only update your own orders" });

    const { rows } = await query(
      `UPDATE orders SET status = $1 WHERE id = $2
       RETURNING *`,
      [status, req.params.id],
    );
    // Fetch full order
    const {
      rows: [fullOrder],
    } = await query(
      `SELECT o.*, b.name AS buyer_name, p.name AS product_name
       FROM   orders   o
       JOIN   users    b ON b.id = o.buyer_id
       JOIN   products p ON p.id = o.product_id
       WHERE  o.id = $1`,
      [rows[0].id],
    );
    res.json(formatOrder(fullOrder));
  } catch (err) {
    console.error("Status update error:", err.message);
    res.status(500).json({ message: "Failed to update order status" });
  }
});

// ── Dashboard: Stats (role-aware) ─────────────────────────────────
app.get("/api/dashboard/stats", auth, async (req, res) => {
  try {
    if (req.user.role === "wholesaler") {
      const [products, orders, lowStock, revenue, pending] = await Promise.all([
        query("SELECT COUNT(*) FROM products WHERE seller_id = $1", [
          req.user.id,
        ]),
        query("SELECT COUNT(*) FROM orders   WHERE seller_id = $1", [
          req.user.id,
        ]),
        query(
          "SELECT COUNT(*) FROM products WHERE seller_id = $1 AND stock < 100",
          [req.user.id],
        ),
        query(
          `SELECT COALESCE(SUM(total_price),0) AS rev FROM orders
               WHERE seller_id = $1 AND status = 'Delivered'`,
          [req.user.id],
        ),
        query(
          `SELECT COUNT(*) FROM orders WHERE seller_id=$1 AND status='Pending'`,
          [req.user.id],
        ),
      ]);
      return res.json({
        totalProducts: parseInt(products.rows[0].count),
        totalOrders: parseInt(orders.rows[0].count),
        revenue: parseFloat(revenue.rows[0].rev),
        lowStock: parseInt(lowStock.rows[0].count),
        pending: parseInt(pending.rows[0].count),
      });
    } else {
      const [total, spent, delivered, inTransit, pending] = await Promise.all([
        query("SELECT COUNT(*) FROM orders WHERE buyer_id = $1", [req.user.id]),
        query(
          "SELECT COALESCE(SUM(total_price),0) AS s FROM orders WHERE buyer_id = $1",
          [req.user.id],
        ),
        query(
          `SELECT COUNT(*) FROM orders WHERE buyer_id=$1 AND status='Delivered'`,
          [req.user.id],
        ),
        query(
          `SELECT COUNT(*) FROM orders WHERE buyer_id=$1 AND status='InTransit'`,
          [req.user.id],
        ),
        query(
          `SELECT COUNT(*) FROM orders WHERE buyer_id=$1 AND status='Pending'`,
          [req.user.id],
        ),
      ]);
      return res.json({
        totalOrders: parseInt(total.rows[0].count),
        totalSpent: parseFloat(spent.rows[0].s),
        delivered: parseInt(delivered.rows[0].count),
        inTransit: parseInt(inTransit.rows[0].count),
        pending: parseInt(pending.rows[0].count),
      });
    }
  } catch (err) {
    console.error("Dashboard stats error:", err.message);
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  Start
// ═══════════════════════════════════════════════════════════════════
async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`\n🛒  WholeCART v3.0 API — http://localhost:${PORT}`);
      console.log(`    Demo Retailer:   sonu@demo.com  / demo123`);
      console.log(`    Demo Wholesaler: raj@demo.com   / demo123\n`);
    });
  } catch (err) {
    console.error("❌  Startup failed:", err.message);
    process.exit(1);
  }
}

start();
