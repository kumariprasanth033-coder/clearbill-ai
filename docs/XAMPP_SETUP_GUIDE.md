# ClearBill AI - XAMPP MySQL Local Setup & Architecture Guide

This document provides step-by-step instructions for configuring MySQL on Windows using XAMPP for **ClearBill AI**.

---

## 1. Prerequisites
- **XAMPP for Windows** (with Apache and MySQL installed)
- **Node.js** (v18 or higher)
- **Git** / Terminal

---

## 2. Start MySQL via XAMPP Control Panel
1. Open the **XAMPP Control Panel**.
2. Click **Start** next to **MySQL** (Default port: `3306`).
3. Click **Start** next to **Apache** (to enable phpMyAdmin).
4. Verify that MySQL is running green with Port `3306`.

---

## 3. Create Database & Dedicated Application User
Open **phpMyAdmin** in your browser (`http://localhost/phpmyadmin`) or open the MySQL Shell via the XAMPP Control Panel **Shell** button:

```bash
mysql -u root -p
```
*(Press Enter if no root password is set)*

### Step 3.1: Create Database
```sql
CREATE DATABASE IF NOT EXISTS `clearbill_ai` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;
```

### Step 3.2: Create Dedicated MySQL User
Do not use the `root` user for the application in production or shared development:
```sql
CREATE USER IF NOT EXISTS 'clearbill_app'@'127.0.0.1' IDENTIFIED BY 'ClearBill@Dev2026';
CREATE USER IF NOT EXISTS 'clearbill_app'@'localhost' IDENTIFIED BY 'ClearBill@Dev2026';

GRANT ALL PRIVILEGES ON `clearbill_ai`.* TO 'clearbill_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `clearbill_ai`.* TO 'clearbill_app'@'localhost';

FLUSH PRIVILEGES;
```

---

## 4. Import Schema & Demo Data

### Method A: Via phpMyAdmin
1. Select the `clearbill_ai` database from the left sidebar.
2. Click the **Import** tab.
3. Browse and select `database/schema.sql`, then click **Go**.
4. Repeat and select `database/seeds/demo_data.sql` to import test items and barcodes.

### Method B: Via Terminal / Command Line
```bash
mysql -u clearbill_app -p clearbill_ai < database/schema.sql
mysql -u clearbill_app -p clearbill_ai < database/seeds/demo_data.sql
```

---

## 5. Configure Backend `.env`
In the root directory or `backend/`, copy `.env.example` to `.env`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=clearbill_ai
DB_USER=clearbill_app
DB_PASSWORD=ClearBill@Dev2026
DB_SSL=false
```

---

## 6. Known Test Barcodes in Seed Data
Use these to test camera scanning or manual entry:

| Product Name | Format | Barcode Value | Price |
| :--- | :--- | :--- | :--- |
| **Tata Tea Gold 250g** | EAN-13 | `8901030383786` | ₹165.00 |
| **Amul Pure Ghee 500ml** | EAN-13 | `8901233024823` | ₹315.00 |
| **Parle-G Gold Biscuits** | EAN-13 | `8901499026418` | ₹120.00 |
| **Britannia Good Day** | EAN-13 | `8901063013216` | ₹45.00 |
| **ClearBill Mint Tin** | EAN-8 | `50123456` | ₹50.00 |
| **Organic Honey 250ml** | UPC-A | `012345678905` | ₹240.00 |
| **Stainless Flask 750ml** | Code 128 | `CB-RETAIL-1001` | ₹699.00 |
| **Classic Denim Jeans 32**| Code 128 | `APP-DENIM-32` | ₹1499.00 |

---

## 7. Verifying Connection
Visit the **Settings > Database & XAMPP Status** tab inside ClearBill AI or trigger:
```bash
GET /api/db/status
```
If MySQL is online, it will show:
`Connected successfully to MySQL Community Edition (127.0.0.1:3306) with 28 tables.`
