# 🛒 WholeCART — Setup & Run Guide

## 📁 Project Structure
```
wholecart/
├── frontend/
│   └── index.html        ← Open directly in browser (works offline too!)
├── backend/
│   ├── server.js         ← Node.js + Express REST API
│   └── package.json
└── README.md
```

---

## 🚀 Quick Start

### Option 1 — Frontend Only (No Setup Needed)
Just open `frontend/index.html` in your browser.
The app uses **built-in mock data** so everything works without a backend.
✅ Products, Auth (demo login), Orders, Dashboard — all functional!

---

### Option 2 — Full Stack (Frontend + Backend)

#### Step 1: Start the Backend
```bash
cd backend
npm install
npm start
```
Backend runs at: `http://localhost:5000`

#### Step 2: Open the Frontend
Open `frontend/index.html` in your browser.
It will auto-connect to `http://localhost:5000/api`.

---

## 🔑 Demo Credentials
| Email           | Password  | Role     |
|-----------------|-----------|----------|
| sonu@demo.com   | demo123   | Retailer |
| raj@demo.com    | demo123   | Wholesaler |

---

## 📡 Backend API Endpoints

| Method | Endpoint              | Auth | Description           |
|--------|-----------------------|------|-----------------------|
| GET    | /api/health           | ❌   | Server status         |
| POST   | /api/auth/register    | ❌   | Register new user     |
| POST   | /api/auth/login       | ❌   | Login + get JWT token |
| GET    | /api/auth/me          | ✅   | Get current user      |
| GET    | /api/products         | ❌   | All products          |
| GET    | /api/products?category=Grains | ❌ | Filter by category |
| GET    | /api/categories       | ❌   | All categories        |
| POST   | /api/orders           | ✅   | Place bulk order      |
| GET    | /api/orders           | ✅   | My orders             |
| GET    | /api/orders/:id       | ✅   | Single order          |
| GET    | /api/dashboard/stats  | ✅   | Dashboard statistics  |

---

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JS (zero dependencies)
- **Backend**: Node.js, Express, JWT, bcryptjs
- **Design**: Custom dark theme, Google Fonts (Syne + DM Sans)

---

Built by **Sonu Meena** | [Portfolio](https://sonu-portfolio-1ue7.vercel.app/) | MIT License
