# EthioBiz OS — Backend API

EthioBiz OS is a backend system for managing small-business operations,
including products, inventory, sales, customer credit, payments and reports.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Environment Configuration](#environment-configuration)
- [Running the Server](#running-the-server)
- [Running Tests](#running-tests)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Request Examples](#request-examples)
- [Money and Inventory Units](#money-and-inventory-units)
- [Error Responses](#error-responses)
- [Security and Data Integrity](#security-and-data-integrity)
- [Implementation Notes](#implementation-notes)

## Features

- Business registration and authentication.
- Tenant-isolated product and customer management.
- Sales processing and automatic stock reduction.
- Customer credit and additional payment collection.
- Sale cancellation and stock restoration.
- Refund records for cancelled sales.
- Inventory movement history and stock adjustments.
- Sales reports, gross profit, collections and outstanding credit.
- Automated tests using Node.js's built-in test runner.

## Requirements

- Node.js
- npm
- MongoDB configured to support transactions.
- A valid MongoDB connection string and JWT secret.

## Installation

From the backend directory:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure the actual values required by your environment.
Do not commit `.env` or publish database credentials or JWT secrets.

## Environment Configuration

The example environment file defines:

| Variable | Purpose |
|---|---|
| `PORT` | HTTP server port; example value: `5000` |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used to sign authentication tokens |

## Running the Server

Development mode:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

The default example API base URL is:

```text
http://localhost:5000
```

## Running Tests

Run the project's test suite:

```bash
npm test
```

The package script runs Node.js tests using:

```bash
node --test
```

## Authentication

Register a business:

```http
POST /api/auth/register
Content-Type: application/json
```

Example request:

```json
{
  "businessName": "Example Mini Market",
  "ownerName": "Business Owner",
  "email": "owner@example.com",
  "phone": "+251900000000",
  "password": "ReplaceWithAStrongPassword123"
}
```

Registration requires `businessName`, `ownerName`, and a password.
At least one of `email` or `phone` is required. The password must contain
at least 12 characters and no more than 72 UTF-8 bytes.

Use a unique email or phone number. Registration creates the business and
its owner account.

Log in:

```http
POST /api/auth/login
Content-Type: application/json
```

Example request:

```json
{
  "identifier": "owner@example.com",
  "password": "ReplaceWithAStrongPassword123"
}
```

Use the returned access token on protected endpoints:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Get the authenticated user:

```http
GET /api/auth/me
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## API Endpoints

All endpoints below are mounted by the current application routes.
Except for health, registration and login, authentication is required.

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a business and owner |
| POST | `/api/auth/login` | Authenticate and receive an access token |
| GET | `/api/auth/me` | Get the authenticated user |

### Products

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/products` | Create a product |
| GET | `/api/products` | List active products |
| GET | `/api/products/:productId` | Get one product |
| PATCH | `/api/products/:productId` | Update allowed product fields |
| DELETE | `/api/products/:productId` | Deactivate a product |

Example product request:

```json
{
  "name": "Sugar",
  "category": "Groceries",
  "unit": "kg",
  "costPriceMinor": 8000,
  "sellingPriceMinor": 10000,
  "stockQuantity": 25
}
```

Product creation accepts `name`, `category`, `unit`, `costPriceMinor`,
`sellingPriceMinor` and `stockQuantity`. Stock quantity defaults to zero.
Prices are non-negative integer amounts in santim.

Product updates support `name`, `category`, `costPriceMinor` and
`sellingPriceMinor`. Stock must be changed through inventory movements or
sales, not through the product update endpoint.

### Customers

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/customers` | Create a customer |
| GET | `/api/customers` | List active customers |

Example customer request:

```json
{
  "name": "Example Customer",
  "phone": "+251911000000",
  "email": "customer@example.com",
  "address": "Adama",
  "notes": "Regular customer"
}
```

The customer's `name` is required. Phone, email, address and notes are
optional.

### Sales

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/sales` | Create a sale |
| GET | `/api/sales` | List sales with pagination and date filters |
| GET | `/api/sales/:saleId` | Get a sale |
| POST | `/api/sales/:saleId/payments` | Record an additional payment |
| POST | `/api/sales/:saleId/cancel` | Cancel a completed sale |
| POST | `/api/sales/:saleId/refunds` | Record a refund for a cancelled sale |

Create a sale:

```json
{
  "items": [
    {
      "productId": "REPLACE_WITH_PRODUCT_OBJECT_ID",
      "quantity": 2
    }
  ],
  "customerId": "REPLACE_WITH_CUSTOMER_OBJECT_ID",
  "paidAmountMinor": 10000,
  "paymentMethod": "cash",
  "paymentReference": "",
  "notes": "Example sale"
}
```

`items` must contain between 1 and 100 entries. Each item accepts only
`productId` and `quantity`. A product must not appear more than once in
the same sale; combine its quantities.

`paidAmountMinor` is required and must be a non-negative integer.
If the sale is not fully paid, a customer is required. If the initial
payment is positive, `paymentMethod` is required.

Supported payment methods:

- `cash`
- `mobile_money`
- `bank_transfer`
- `other`

Record an additional payment:

```json
{
  "amountMinor": 5000,
  "paymentMethod": "mobile_money",
  "reference": "PAYMENT-REFERENCE"
}
```

The payment amount must be positive and cannot exceed the outstanding
balance.

Cancel a sale:

```json
{
  "reason": "Sale entered incorrectly"
}
```

A cancellation reason is required. The system restores the sale's stock
and records inventory movements within a transaction. Original payment
history is preserved.

Record a refund:

```json
{
  "amountMinor": 5000,
  "method": "cash",
  "reference": "REFUND-REFERENCE",
  "reason": "Customer returned the purchase"
}
```

Refunds can only be recorded for cancelled sales. The refund cannot exceed
the collected amount minus previous refunds. The original sale and payment
history remain available for auditing.

List sales with pagination:

```http
GET /api/sales?page=1&limit=20
```

Optional date filters use the `YYYY-MM-DD` format:

```http
GET /api/sales?startDate=2026-10-01&endDate=2026-10-31
```

The default page is `1`; the default page size is `20`; the maximum page
size is `100`.

### Inventory

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/inventory/movements` | Record a manual stock movement |
| GET | `/api/inventory/movements` | List inventory movement history |

Example inventory movement:

```json
{
  "productId": "REPLACE_WITH_PRODUCT_OBJECT_ID",
  "movementType": "RECEIVED",
  "quantity": 10,
  "reason": "New stock received from supplier"
}
```

Supported manual movement types:

- `RECEIVED` — increase stock.
- `ADJUSTMENT_INCREASE` — increase stock through an adjustment.
- `DAMAGED` — decrease stock due to damage.
- `EXPIRED` — decrease stock due to expiration.
- `ADJUSTMENT_DECREASE` — decrease stock through an adjustment.

A positive quantity and a non-empty reason are required.

List movement history:

```http
GET /api/inventory/movements?page=1&limit=20
```

Filter by product:

```http
GET /api/inventory/movements?productId=REPLACE_WITH_PRODUCT_OBJECT_ID&page=1&limit=20
```

The default page is `1`; the default limit is `20`; the maximum limit is
`100`.

### Reports

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/reports/sales` | Get the sales report |

Example:

```http
GET /api/reports/sales?startDate=2026-10-01&endDate=2026-10-31
```

The sales report includes sales count, sales total, cost of goods sold,
gross profit, payments collected, refunds, net collections and outstanding
credit. Date filters use `YYYY-MM-DD` and the report period uses UTC.

The current service layer also defines dashboard, expenses, profit and
stock report functions. Those functions are not documented as HTTP
endpoints here because the current report routes expose only
`GET /api/reports/sales`.

## Money and Inventory Units

Money fields ending in `Minor` use integer santim:

- `100` santim = `1 ETB`
- `10000` santim = `100 ETB`

For example, `sellingPriceMinor: 10000` means 100 ETB.

Inventory quantities depend on the product unit. Units such as `piece`,
`box`, `pack`, `g` and `ml` require whole-number quantities in sales.
Units `kg` and `litre` support fractional quantities up to three decimal
places.

## Error Responses

Errors use a response structure similar to:

```json
{
  "success": false,
  "message": "Description of the error"
}
```

Common HTTP status codes include:

| Status | Meaning |
|---|---|
| 400 | Invalid input or unsupported fields |
| 401 | Missing or invalid authentication, or invalid user context |
| 403 | Forbidden or invalid business context |
| 404 | Resource not found in the current business |
| 409 | Conflict, such as insufficient stock or an already-paid sale |
| 500 | Unexpected server error |

The exact status and message depend on the endpoint and error handler.

## Security and Data Integrity

- Protected endpoints use bearer-token authentication.
- Business data is filtered by the authenticated business context.
- Client requests cannot choose another business's ownership identifier.
- Sale prices and totals are calculated on the server.
- Stock changes from sales, cancellations and manual movements are recorded
  with inventory history.
- Critical sale and inventory changes use MongoDB transactions.
- Passwords are hashed; password hashes must not be exposed in API responses.
- Keep `.env` out of source control and never publish access tokens or secrets.

## Implementation Notes

This README documents the endpoints currently mounted by the application.
If new route modules are added, update the API endpoint tables and examples
to match their actual request validation and response structure.
