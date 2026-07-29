# AttireLab

**AttireLab** is a full-stack clothing e-commerce application built with modern web technologies. It features two distinct surfaces: a Customer Storefront for browsing products and placing orders, and an Admin Dashboard for managing inventory and tracking orders.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js v5 (Auth.js)
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand (Cart persistence)
- **Forms & Validation:** react-hook-form + Zod

## Features

- **Customer Storefront:**
  - Browse products by category
  - Product details and image galleries
  - Shopping cart with local storage persistence
  - Mock checkout process
  - User authentication and order history
- **Admin Dashboard:**
  - Secure admin login (`/admin/login`)
  - Product management (Create, Read, Update, Delete)
  - Bulk product import via CSV
  - Order management and status updates
  - Category management

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- PostgreSQL database

### Installation

1. Clone the repository and navigate into the project directory:
   ```bash
   git clone <repository-url>
   cd attirelab
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory based on your local setup:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/attirelab"
   AUTH_SECRET="your-nextauth-secret-key"
   ```
   *(You can generate an `AUTH_SECRET` using `openssl rand -base64 32`)*

4. Set up the database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Optional: you can run `npx prisma studio` to view and manage your data)*

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) with your browser to view the customer storefront.
7. Access the admin dashboard via [http://localhost:3000/admin/login](http://localhost:3000/admin/login).

## Project Structure

- `/app`: Next.js App Router pages and layouts
- `/app/admin`: Admin dashboard routes
- `/app/auth`: Customer authentication routes
- `/public/uploads`: Local storage for product images
- `implementation.md`: Detailed technical design and implementation plan
