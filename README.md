# MoneyLog - Family Expense Tracker

A production-ready web application for couples/families to track expenses together. Import bank statements from KBank (K PLUS), auto-categorize transactions, and gain insights into spending patterns.

## Features

### ✅ Authentication & Family Space
- Email + password authentication
- Create or join a Family Space (household)
- Invite partner via shareable link
- Exactly 2 members per family

### ✅ Import Wizard
- Upload KBank monthly statement PDFs
- Support for password-protected PDFs
- Preview transactions before import
- Auto-detect statement month
- Duplicate detection and handling

### ✅ Auto-Categorization
- Built-in keyword matching for common categories
- User-defined categorization rules
- Bulk category assignment
- "Contains keyword" pattern matching

### ✅ Expense Management
- Filter by owner, category, date range
- Search by description
- Inline category editing
- Bulk operations
- CSV export

### ✅ Dashboard & Reports
- Family-wide and per-person views
- Period filters (day/week/month/year)
- Category breakdown with percentages
- Recent transactions

### ✅ Thai-Friendly
- Thai default categories
- Thai language UI
- Buddhist Era date handling

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Backend**: Next.js Route Handlers
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: JWT-based session with HTTP-only cookies
- **Styling**: Tailwind CSS with custom glassmorphism design

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone and install dependencies**
   ```bash
   cd MoneyLog
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database URL:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/moneylog?schema=public"
   AUTH_SECRET="your-super-secret-key-change-in-production-min-32-chars"
   BASE_URL="http://localhost:3000"
   ```

3. **Set up database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev
   
   # Seed demo data (optional)
   npx prisma db seed
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Demo Accounts (after seeding)

- **Email**: demo1@moneylog.app / demo2@moneylog.app
- **Password**: password123

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── family/        # Family & invite management
│   │   ├── categories/    # Category CRUD
│   │   ├── expenses/      # Expense listing & updates
│   │   ├── import/        # PDF import workflow
│   │   ├── reports/       # Dashboard summaries
│   │   ├── rules/         # Categorization rules
│   │   └── export/        # CSV export
│   ├── dashboard/         # Main dashboard
│   ├── expenses/          # Expense list page
│   ├── import/            # Import wizard
│   ├── categories/        # Category management
│   ├── settings/          # Settings page
│   ├── family/            # Family create/join
│   ├── login/             # Login page
│   └── signup/            # Signup page
├── components/
│   ├── layout/            # Navbar, ProtectedLayout
│   └── ui/                # Reusable UI components
├── contexts/
│   └── AuthContext.tsx    # Authentication state
└── lib/
    ├── prisma.ts          # Prisma client
    ├── auth.ts            # Auth utilities
    ├── constants.ts       # App constants
    ├── utils.ts           # Helper functions
    ├── categorization.ts  # Auto-categorization logic
    └── parser/
        └── kbank-parser.ts # KBank PDF parser
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Family
- `GET /api/family` - Get user's family
- `POST /api/family` - Create family
- `GET /api/family/invite` - Get invite link
- `POST /api/family/invite` - Create invite
- `POST /api/family/invite/accept` - Accept invite

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories` - Update category
- `DELETE /api/categories` - Delete category

### Import
- `POST /api/import/batch` - Upload & parse PDF
- `POST /api/import/confirm` - Confirm import

### Expenses
- `GET /api/expenses` - List with filters
- `PUT /api/expenses` - Update single expense
- `POST /api/expenses/bulk-category` - Bulk update

### Reports
- `GET /api/reports/summary` - Dashboard summary
- `GET /api/reports/top-categories` - Top categories
- `GET /api/export/csv` - Export CSV

### Rules
- `GET /api/rules` - List rules
- `POST /api/rules` - Create rule
- `PUT /api/rules` - Update rule
- `DELETE /api/rules` - Delete rule

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `AUTH_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `BASE_URL` | Application URL | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## Security Features

- ✅ PDF files are deleted immediately after parsing
- ✅ PDF passwords are never stored
- ✅ Raw transaction data is not logged
- ✅ JWT tokens in HTTP-only cookies
- ✅ Password hashing with bcrypt

## KBank Statement Parsing

The parser handles KBank monthly statements exported from K PLUS app:

- Text-based PDF extraction (no OCR)
- Password-protected PDF support
- Thai date format handling (DD/MM/YYYY, Buddhist Era)
- Expense filtering (inflows removed)
- Transaction fingerprinting for deduplication

### Supported Transaction Types
- โอนเงิน (Transfer)
- ชำระเงิน (Payment)
- หักบัญชี (Debit)
- ถอนเงิน (Withdrawal)
- ซื้อสินค้า (Purchase)
- จ่ายบิล (Bill payment)

## Default Categories

| Emoji | Category |
|-------|----------|
| 🍜 | อาหาร/เครื่องดื่ม |
| 🚗 | เดินทาง/น้ำมัน/รถ |
| 🏠 | บิลบ้าน(ไฟ/น้ำ/เน็ต/โทร) |
| 💳 | ผ่อน/บัตรเครดิต/หนี้ |
| 🐕 | สัตว์เลี้ยง |
| 👶 | เลี้ยงดูบุตร |
| 🛍️ | ช้อปปิ้ง |
| 🏥 | สุขภาพ |
| 💝 | โอนให้คน/ครอบครัว |
| 🔄 | สมัครสมาชิก/ตัดอัตโนมัติ |
| 📦 | อื่นๆ/ยังไม่รู้หมวด |

## Future Improvements (V2+)

- [ ] Client-side PDF parsing for privacy
- [ ] Support for other banks (SCB, BBL, etc.)
- [ ] OCR for scanned statements
- [ ] Budget goals and alerts
- [ ] Recurring expense detection
- [ ] Mobile app (React Native)

## License

MIT
