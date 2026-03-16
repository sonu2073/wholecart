const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
const PORT = 5000;
const path = require("path");

const JWT_SECRET = "wholecart_secret_2025";
app.use(cors());
app.use(express.json());
let users = [
  {
    id: 1,
    name: "Sonu Meena",
    email: "sonu@demo.com",
    password: bcrypt.hashSync("demo123", 10),
    role: "retailer",
  },
  {
    id: 2,
    name: "Raj Wholesale",
    email: "raj@demo.com",
    password: bcrypt.hashSync("demo123", 10),
    role: "wholesaler",
  },
];
let products = [
  {
    id: 1,
    name: "Basmati Rice",
    category: "Grains",
    price: 45,
    bulkPrice: 38,
    minQty: 50,
    stock: 1200,
    unit: "kg",
    sellerId: 2,
    seller: "Raj Wholesale",
    image: "🌾",
    rating: 4.5,
    reviews: 128,
    desc: "Premium basmati",
  },
  {
    id: 2,
    name: "Sunflower Oil",
    category: "Oils",
    price: 120,
    bulkPrice: 98,
    minQty: 20,
    stock: 500,
    unit: "L",
    sellerId: 2,
    seller: "Raj Wholesale",
    image: "🫒",
    rating: 4.2,
    reviews: 85,
    desc: "Cold-pressed",
  },
  {
    id: 3,
    name: "Sugar",
    category: "Grains",
    price: 40,
    bulkPrice: 34,
    minQty: 100,
    stock: 3000,
    unit: "kg",
    sellerId: 2,
    seller: "Raj Wholesale",
    image: "🍬",
    rating: 4.7,
    reviews: 210,
    desc: "Refined white sugar",
  },
  {
    id: 4,
    name: "Wheat Flour",
    category: "Grains",
    price: 35,
    bulkPrice: 29,
    minQty: 100,
    stock: 2000,
    unit: "kg",
    sellerId: 2,
    seller: "Raj Wholesale",
    image: "🌾",
    rating: 4.3,
    reviews: 156,
    desc: "Chakki atta",
  },
  {
    id: 5,
    name: "Toor Dal",
    category: "Pulses",
    price: 90,
    bulkPrice: 78,
    minQty: 25,
    stock: 800,
    unit: "kg",
    sellerId: 2,
    seller: "Raj Wholesale",
    image: "🫘",
    rating: 4.6,
    reviews: 97,
    desc: "Split pigeon peas",
  },
  {
    id: 8,
    name: "Rock Salt",
    category: "Spices",
    price: 25,
    bulkPrice: 18,
    minQty: 50,
    stock: 1500,
    unit: "kg",
    sellerId: 2,
    seller: "Raj Wholesale",
    image: "🧂",
    rating: 4.8,
    reviews: 340,
    desc: "Sendha namak",
  },
];
let orders = [
  {
    id: 1,
    buyerId: 1,
    buyerName: "Sonu Meena",
    sellerId: 2,
    productId: 1,
    productName: "Basmati Rice",
    quantity: 100,
    totalPrice: 3800,
    status: "Delivered",
    date: "2025-01-10",
  },
  {
    id: 2,
    buyerId: 1,
    buyerName: "Sonu Meena",
    sellerId: 2,
    productId: 3,
    productName: "Sugar",
    quantity: 200,
    totalPrice: 6800,
    status: "InTransit",
    date: "2025-03-05",
  },
];
let nU = 3,
  nO = 3,
  nP = 9;
function auth(req, res, next) {
  const t = req.headers.authorization?.split(" ")[1];
  if (!t) return res.status(401).json({ message: "No token" });
  try {
    req.user = jwt.verify(t, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}
function ws(req, res, next) {
  if (req.user.role !== "wholesaler")
    return res.status(403).json({ message: "Wholesaler only" });
  next();
}
function rt(req, res, next) {
  if (req.user.role !== "retailer")
    return res.status(403).json({ message: "Retailer only" });
  next();
}


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); // Use path.join to create the absolute path
});


app.get("/api/health", (req, res) =>
  res.json({ status: "OK v2.0", time: new Date() }),
);
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Fields required" });
  if (users.find((u) => u.email === email))
    return res.status(409).json({ message: "Email exists" });
  const h = await bcrypt.hash(password, 10);
  const u = { id: nU++, name, email, password: h, role: role || "retailer" };
  users.push(u);
  const t = jwt.sign(
    { id: u.id, email: u.email, role: u.role, name: u.name },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  res
    .status(201)
    .json({
      token: t,
      user: { id: u.id, name: u.name, email: u.email, role: u.role },
    });
});
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const u = users.find((u) => u.email === email);
  if (!u) return res.status(404).json({ message: "User not found" });
  const v = await bcrypt.compare(password, u.password);
  if (!v) return res.status(401).json({ message: "Wrong password" });
  const t = jwt.sign(
    { id: u.id, email: u.email, role: u.role, name: u.name },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  res.json({
    token: t,
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
  });
});
app.get("/api/auth/me", auth, (req, res) => {
  const u = users.find((u) => u.id === req.user.id);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role });
});
app.get("/api/products", (req, res) => {
  let r = [...products];
  if (req.query.category && req.query.category !== "All")
    r = r.filter((p) => p.category === req.query.category);
  if (req.query.search)
    r = r.filter((p) =>
      p.name.toLowerCase().includes(req.query.search.toLowerCase()),
    );
  res.json(r);
});
app.get("/api/categories", (req, res) =>
  res.json(["All", ...new Set(products.map((p) => p.category))]),
);
app.get("/api/products/:id", (req, res) => {
  const p = products.find((p) => p.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(p);
});
app.post("/api/products", auth, ws, (req, res) => {
  const { name, category, price, bulkPrice, minQty, unit, stock, image, desc } =
    req.body;
  if (!name || !price || !bulkPrice || !minQty || !stock)
    return res.status(400).json({ message: "Missing fields" });
  if (parseFloat(bulkPrice) >= parseFloat(price))
    return res.status(400).json({ message: "Bulk price must be < MRP" });
  const seller = users.find((u) => u.id === req.user.id);
  const p = {
    id: nP++,
    name,
    category: category || "Other",
    price: parseFloat(price),
    bulkPrice: parseFloat(bulkPrice),
    minQty: parseInt(minQty),
    unit: unit || "kg",
    stock: parseInt(stock),
    image: image || "📦",
    desc: desc || "",
    sellerId: req.user.id,
    seller: seller?.name || req.user.name,
    rating: 4.0,
    reviews: 0,
  };
  products.push(p);
  res.status(201).json(p);
});
app.put("/api/products/:id", auth, ws, (req, res) => {
  const idx = products.findIndex((p) => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Not found" });
  if (products[idx].sellerId !== req.user.id)
    return res.status(403).json({ message: "Not your product" });
  const { name, category, price, bulkPrice, minQty, unit, stock, image, desc } =
    req.body;
  products[idx] = {
    ...products[idx],
    ...(name && { name }),
    ...(category && { category }),
    ...(price && { price: parseFloat(price) }),
    ...(bulkPrice && { bulkPrice: parseFloat(bulkPrice) }),
    ...(minQty && { minQty: parseInt(minQty) }),
    ...(unit && { unit }),
    ...(stock !== undefined && { stock: parseInt(stock) }),
    ...(image && { image }),
    ...(desc !== undefined && { desc }),
  };
  res.json(products[idx]);
});
app.delete("/api/products/:id", auth, ws, (req, res) => {
  const idx = products.findIndex((p) => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Not found" });
  if (products[idx].sellerId !== req.user.id)
    return res.status(403).json({ message: "Not your product" });
  products.splice(idx, 1);
  res.json({ message: "Deleted" });
});
app.patch("/api/products/:id/stock", auth, ws, (req, res) => {
  const idx = products.findIndex((p) => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ message: "Not found" });
  if (products[idx].sellerId !== req.user.id)
    return res.status(403).json({ message: "Not your product" });
  const { stock, bulkPrice, price } = req.body;
  if (stock !== undefined) products[idx].stock = parseInt(stock);
  if (bulkPrice) products[idx].bulkPrice = parseFloat(bulkPrice);
  if (price) products[idx].price = parseFloat(price);
  res.json(products[idx]);
});
app.get("/api/my/products", auth, ws, (req, res) =>
  res.json(products.filter((p) => p.sellerId === req.user.id)),
);
app.post("/api/orders", auth, rt, (req, res) => {
  const { productId, quantity } = req.body;
  const p = products.find((p) => p.id === productId);
  if (!p) return res.status(404).json({ message: "Product not found" });
  if (quantity < p.minQty)
    return res
      .status(400)
      .json({ message: `Min order: ${p.minQty} ${p.unit}` });
  if (quantity > p.stock)
    return res.status(400).json({ message: "Insufficient stock" });
  const o = {
    id: nO++,
    buyerId: req.user.id,
    buyerName: req.user.name,
    sellerId: p.sellerId,
    productId,
    productName: p.name,
    quantity,
    totalPrice: p.bulkPrice * quantity,
    status: "Pending",
    date: new Date().toISOString().split("T")[0],
  };
  orders.push(o);
  p.stock -= quantity;
  res.status(201).json(o);
});
app.get("/api/orders", auth, (req, res) => {
  if (req.user.role === "retailer")
    return res.json(orders.filter((o) => o.buyerId === req.user.id));
  res.json(orders.filter((o) => o.sellerId === req.user.id));
});
app.get("/api/orders/:id", auth, (req, res) => {
  const o = orders.find((o) => o.id === parseInt(req.params.id));
  if (!o) return res.status(404).json({ message: "Not found" });
  if (o.buyerId !== req.user.id && o.sellerId !== req.user.id)
    return res.status(403).json({ message: "Access denied" });
  res.json(o);
});
app.patch("/api/orders/:id/status", auth, ws, (req, res) => {
  const o = orders.find((o) => o.id === parseInt(req.params.id));
  if (!o) return res.status(404).json({ message: "Not found" });
  if (o.sellerId !== req.user.id)
    return res.status(403).json({ message: "Not your order" });
  const { status } = req.body;
  const valid = ["Pending", "Accepted", "InTransit", "Delivered", "Rejected"];
  if (!valid.includes(status))
    return res.status(400).json({ message: "Invalid status" });
  o.status = status;
  res.json(o);
});
app.get("/api/dashboard/stats", auth, (req, res) => {
  if (req.user.role === "wholesaler") {
    const mo = orders.filter((o) => o.sellerId === req.user.id);
    const mp = products.filter((p) => p.sellerId === req.user.id);
    return res.json({
      totalProducts: mp.length,
      totalOrders: mo.length,
      revenue: mo
        .filter((o) => o.status === "Delivered")
        .reduce((s, o) => s + o.totalPrice, 0),
      pending: mo.filter((o) => o.status === "Pending").length,
      delivered: mo.filter((o) => o.status === "Delivered").length,
      lowStock: mp.filter((p) => p.stock < 100).length,
    });
  }
  const mo = orders.filter((o) => o.buyerId === req.user.id);
  res.json({
    totalOrders: mo.length,
    totalSpent: mo.reduce((s, o) => s + o.totalPrice, 0),
    delivered: mo.filter((o) => o.status === "Delivered").length,
    inTransit: mo.filter((o) => o.status === "InTransit").length,
    pending: mo.filter((o) => o.status === "Pending").length,
  });
});
app.listen(PORT, () => {
  console.log(`✅ WholeCART v2 Backend → http://localhost:${PORT}`);
  console.log("   Retailer: sonu@demo.com / demo123");
  console.log("   Wholesaler: raj@demo.com / demo123");
});
