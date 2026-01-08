# Personal Financial Management

A comprehensive full-stack financial management platform with AI-powered chatbot assistance, real-time market data tracking, and personal expense/income management.

##  Overview

This project is a complete financial management solution that combines:
- **Personal Finance Tracking**: Track income, expenses, and generate financial reports
- **Market Data Integration**: Real-time cryptocurrency and stock market data from Binance
- **AI Financial Assistant**:  Intelligent chatbot powered by Gemini AI for financial queries
- **Watchlist Management**: Monitor favorite stocks and cryptocurrencies
- **News Aggregation**: Financial news and market updates

##  Features

### Personal Finance Management
-  Track income and expenses by category
-  Visual dashboard with charts and analytics
-  Time-based filtering (day, week, month, year)
-  Export data to Excel
-  MongoDB database for user data persistence

### Market Data & Trading
-  Real-time price updates via WebSocket (Binance)
-  Historical OHLCV (Open, High, Low, Close, Volume) data
-  Market statistics and performance metrics
-  Asset search and discovery
-  Watchlist with starred favorites
-  Price alert system

### AI-Powered Finance Chatbot
-  Natural language queries for stocks and companies
-  Automatic news search and fundamental analysis
-  Financial ratio calculations (EPS, P/E, ROE)
-  Multiple tools:  `get_stock_price`, `get_fundamentals`, `search_news`, etc.
-  Vector search with FAISS for intelligent tool selection
-  Conversation history and session management

### User Features
-  JWT-based authentication
-  User profiles with avatar upload
-  Password reset functionality
-  Email notifications via Nodemailer

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js with Express 5.x
- **Databases**: 
  - MongoDB (Mongoose) - User data, income/expenses
  - PostgreSQL - Market data, OHLCV, assets
  - Redis/IORedis - Caching and real-time data
- **WebSocket**: ws library for real-time price updates
- **APIs**:  
  - Binance API for crypto data
  - yfinance for stock data
  - RSS Parser for news feeds
- **Authentication**: JWT (jsonwebtoken), bcryptjs
- **File Processing**:  Multer for uploads, XLSX for Excel export
- **Web Scraping**: Cheerio, Axios

### Frontend
- **Framework**: React 19.x with Vite
- **Routing**: React Router DOM v7
- **Styling**:  Tailwind CSS 4.x
- **UI Libraries**:
  - Recharts for data visualization
  - Lucide React & React Icons for icons
  - React Markdown for rendering markdown
- **State Management**: React hooks
- **HTTP Client**: Axios

### AI Chatbot
- **Language**: Python 3.10+
- **Framework**: FastAPI with Uvicorn
- **LLM**: Gemini 2.0 (via OpenAI SDK compatibility layer)
- **Vector Store**:  FAISS with sentence-transformers
- **Data Sources**: 
  - yfinance for stock data
  - SerpAPI for web search (optional)
- **Embeddings**: HuggingFace `all-MiniLM-L6-v2`

##  Project Structure

```
our-final-project/
├── backend/                    # Node.js Express API
│   ├── config/                 # Database configurations
│   ├── controllers/            # Route controllers
│   ├── middleware/             # Auth & upload middleware
│   ├── models/                 # Mongoose schemas
│   ├── routes/                 # API route definitions
│   ├── services/               # Business logic (alerts, etc.)
│   ├── streams/                # WebSocket handlers
│   ├── jobs/                   # Cron jobs for data sync
│   ├── db/                     # PostgreSQL migrations
│   ├── server.js               # Main entry point
│   ├── package.json
│   └── docker-compose.yml      # PostgreSQL setup
│
├── frontend/                   # React application
│   └── financial-management/
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── pages/          # Page components
│       │   ├── contexts/       # React contexts
│       │   └── utils/          # Utilities
│       ├── public/             # Static assets
│       ├── index.html
│       ├── vite.config.js
│       └── package.json
│
└── finance_chatbot/            # Python AI Agent
    ├── finance_agent/          # Agent implementation
    ├── main.py                 # FastAPI server
    ├── run_example.py          # CLI demo
    ├── requirements.txt
    ├── README.md
    ├── IMPLEMENTATION_SUMMARY.md
    └── TOOL_DESCRIPTION.md
```

##  Getting Started

### Prerequisites
- Node.js 16+ and npm
- Python 3.10+
- MongoDB (local or cloud)
- PostgreSQL (Docker recommended)
- Redis (optional, for caching)

### Backend Setup

1. **Navigate to backend directory**: 
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables** - Create `.env` file:
   ```env
   PORT=8000
   MONGO_URI=mongodb://localhost:27017/financial-management
   JWT_SECRET=your_jwt_secret_key
   CLIENT_URL=http://localhost:5173
   
   # PostgreSQL
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=finance_data
   
   # Email (optional)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

4. **Start PostgreSQL with Docker**:
   ```bash
   docker-compose up -d
   ```

5. **Run database migrations**:
   ```bash
   npm run migrate
   ```

6. **Start the server**:
   ```bash
   npm run dev
   ```

The backend will run on `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend/financial-management
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:5173`

### AI Chatbot Setup

1. **Navigate to chatbot directory**:
   ```bash
   cd finance_chatbot
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv . venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```

3. **Install dependencies**: 
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables** - Create `.env` file:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   SERPAPI_KEY=your_serpapi_key  # Optional
   ```

5. **Start the chatbot API**:
   ```bash
   python main.py
   ```

The chatbot API will run on `http://localhost:8008`

##  Architecture

### Key Components

1. **Authentication Flow**:  JWT tokens for secure API access
2. **Real-time Data**:  WebSocket connections for live market prices
3. **Data Synchronization**:  Cron jobs for periodic data updates
4. **AI Agent**: RAG-based system with tool calling for financial queries

##  API Documentation

### Authentication Endpoints
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/getUser` - Get user info (protected)
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password/: resetToken` - Reset password

### Finance Endpoints
- `POST /api/v1/income/add` - Add income
- `GET /api/v1/income/get` - Get all income
- `POST /api/v1/expense/add` - Add expense
- `GET /api/v1/expense/get` - Get all expenses
- `GET /api/v1/dashboard` - Get dashboard summary

### Market Data Endpoints
- `GET /api/v1/market/ticker` - Get single ticker
- `GET /api/v1/market/tickers` - Get bulk tickers
- `GET /api/v1/market/movers` - Get market movers
- `GET /api/v1/market/stats` - Get market statistics
- `GET /api/v1/assets` - Search assets
- `GET /api/v1/price/: symbol/ohlcv` - Get OHLCV data

### Chatbot Endpoints
- `POST /api/init` - Initialize chat session
- `POST /api/chat` - Send message (non-streaming)
- `POST /api/chat/stream` - Send message (streaming)
- `GET /api/session/: id` - Get session info
- `GET /api/session/: id/history` - Get conversation history

##  Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

##  License

This project is open source and available for educational purposes.

##  Authors

Created by the team at **Nolannnolan**

##  Links

- Repository: [https://github.com/Nolannnolan/our-final-project](https://github.com/Nolannnolan/our-final-project)
- Issues: [https://github.com/Nolannnolan/our-final-project/issues](https://github.com/Nolannnolan/our-final-project/issues)

---

**Note**: This is a final project demonstrating full-stack development with modern technologies including React, Node.js, Python, and AI integration. 
