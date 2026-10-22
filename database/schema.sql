-- =============================================================================
-- CLEARBILL AI - PRODUCTION MYSQL SCHEMA
-- Target Engine: MySQL Community Edition / MariaDB (XAMPP Compatible)
-- Storage Engine: InnoDB
-- Character Set: utf8mb4 / utf8mb4_unicode_ci
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `clearbill_ai` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `clearbill_ai`;

-- 1. COMPANIES
CREATE TABLE IF NOT EXISTS `companies` (
  `id` VARCHAR(36) PRIMARY KEY,
  `business_name` VARCHAR(150) NOT NULL,
  `category` ENUM('tea_shop', 'grocery_store', 'bakery', 'juice_shop', 'clothing_store', 'general_retail', 'supermarket', 'medical_store', 'other') NOT NULL DEFAULT 'general_retail',
  `owner_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) UNIQUE,
  `phone` VARCHAR(30),
  `address` TEXT,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'INR',
  `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  `tax_identification_number` VARCHAR(50),
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. OUTLETS
CREATE TABLE IF NOT EXISTS `outlets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `outlet_name` VARCHAR(100) NOT NULL,
  `outlet_code` VARCHAR(20) NOT NULL,
  `address` TEXT,
  `phone` VARCHAR(30),
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_company_outlet_code` (`company_id`, `outlet_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. USERS
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) PRIMARY KEY,
  `email` VARCHAR(150) UNIQUE,
  `phone` VARCHAR(30),
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` ENUM('manager', 'retailer', 'customer', 'admin') NOT NULL DEFAULT 'retailer',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. EMPLOYEE MEMBERSHIPS
CREATE TABLE IF NOT EXISTS `employee_memberships` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `outlet_id` VARCHAR(36),
  `user_id` VARCHAR(36) NOT NULL,
  `employee_code` VARCHAR(30) NOT NULL,
  `permissions_json` JSON,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_company_employee_code` (`company_id`, `employee_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. INVITATIONS
CREATE TABLE IF NOT EXISTS `invitations` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `outlet_id` VARCHAR(36),
  `email` VARCHAR(150) NOT NULL,
  `role` ENUM('manager', 'retailer') NOT NULL DEFAULT 'retailer',
  `token` VARCHAR(100) UNIQUE NOT NULL,
  `status` ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  `expires_at` TIMESTAMP NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. PRODUCTS
CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `outlet_id` VARCHAR(36),
  `product_name` VARCHAR(150) NOT NULL,
  `barcode` VARCHAR(64),
  `sku` VARCHAR(64),
  `category` VARCHAR(60) NOT NULL DEFAULT 'General',
  `unit` VARCHAR(20) NOT NULL DEFAULT 'pcs',
  `unit_price` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cost_price` DECIMAL(12,2) DEFAULT 0.00,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `description` TEXT,
  `custom_fields_json` JSON,
  `is_quick_bill_item` TINYINT(1) NOT NULL DEFAULT 0,
  `quick_bill_order` INT DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE SET NULL,
  INDEX `idx_prod_company_barcode` (`company_id`, `barcode`),
  INDEX `idx_prod_company_name` (`company_id`, `product_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. TRANSACTIONS
CREATE TABLE IF NOT EXISTS `transactions` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `outlet_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `transaction_number` VARCHAR(50) NOT NULL,
  `status` ENUM('draft', 'completed', 'cancelled', 'refunded') NOT NULL DEFAULT 'draft',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_method` ENUM('cash', 'upi', 'card', 'split', 'unpaid') NOT NULL DEFAULT 'unpaid',
  `payment_status` ENUM('pending', 'verified', 'failed') NOT NULL DEFAULT 'pending',
  `customer_name` VARCHAR(100),
  `customer_phone` VARCHAR(30),
  `notes` TEXT,
  `finalized_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  UNIQUE KEY `uk_company_transaction_no` (`company_id`, `transaction_number`),
  INDEX `idx_tx_company_created` (`company_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. TRANSACTION ITEMS
CREATE TABLE IF NOT EXISTS `transaction_items` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transaction_id` VARCHAR(36) NOT NULL,
  `product_id` VARCHAR(36),
  `product_name` VARCHAR(150) NOT NULL,
  `barcode` VARCHAR(64),
  `quantity` DECIMAL(10,3) NOT NULL DEFAULT 1.000,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `tax_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `line_total` DECIMAL(12,2) NOT NULL,
  `custom_values_json` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. PAYMENT ATTEMPTS
CREATE TABLE IF NOT EXISTS `payment_attempts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transaction_id` VARCHAR(36) NOT NULL,
  `payment_method` ENUM('cash', 'upi', 'card') NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `provider_reference` VARCHAR(100),
  `cash_tendered` DECIMAL(12,2),
  `change_due` DECIMAL(12,2),
  `status` ENUM('initiated', 'successful', 'failed') NOT NULL DEFAULT 'initiated',
  `idempotency_key` VARCHAR(100) UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. PAYMENT EVENTS
CREATE TABLE IF NOT EXISTS `payment_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `payment_attempt_id` VARCHAR(36) NOT NULL,
  `event_type` VARCHAR(50) NOT NULL,
  `payload_json` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`payment_attempt_id`) REFERENCES `payment_attempts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. REFUNDS
CREATE TABLE IF NOT EXISTS `refunds` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transaction_id` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `approved_by_user_id` VARCHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. RECEIPTS
CREATE TABLE IF NOT EXISTS `receipts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transaction_id` VARCHAR(36) UNIQUE NOT NULL,
  `receipt_number` VARCHAR(50) NOT NULL,
  `qr_code_data` TEXT NOT NULL,
  `receipt_url` VARCHAR(255) NOT NULL,
  `pdf_rendered_at` TIMESTAMP NULL,
  `paper_print_avoided` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. RECEIPT TOKENS (For guest 30-sec view and tokenized secure access)
CREATE TABLE IF NOT EXISTS `receipt_tokens` (
  `id` VARCHAR(36) PRIMARY KEY,
  `receipt_id` VARCHAR(36) NOT NULL,
  `token` VARCHAR(100) UNIQUE NOT NULL,
  `viewing_session_seconds` INT NOT NULL DEFAULT 30,
  `expires_at` TIMESTAMP NOT NULL,
  `is_claimed` TINYINT(1) NOT NULL DEFAULT 0,
  `access_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. CUSTOMER RECEIPT CLAIMS
CREATE TABLE IF NOT EXISTS `customer_receipt_claims` (
  `id` VARCHAR(36) PRIMARY KEY,
  `customer_user_id` VARCHAR(36) NOT NULL,
  `receipt_id` VARCHAR(36) NOT NULL,
  `claimed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`customer_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_customer_receipt` (`customer_user_id`, `receipt_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. CUSTOMER PREFERENCES
CREATE TABLE IF NOT EXISTS `customer_preferences` (
  `user_id` VARCHAR(36) PRIMARY KEY,
  `sms_receipts` TINYINT(1) NOT NULL DEFAULT 1,
  `email_receipts` TINYINT(1) NOT NULL DEFAULT 1,
  `warranty_alerts` TINYINT(1) NOT NULL DEFAULT 1,
  `budget_alerts` TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. HOUSEHOLD MEMBERSHIPS (Family sharing opt-in)
CREATE TABLE IF NOT EXISTS `household_memberships` (
  `id` VARCHAR(36) PRIMARY KEY,
  `primary_user_id` VARCHAR(36) NOT NULL,
  `member_user_id` VARCHAR(36) NOT NULL,
  `relationship` VARCHAR(50) NOT NULL,
  `status` ENUM('active', 'pending', 'declined') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`primary_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`member_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. SPENDING BUDGETS
CREATE TABLE IF NOT EXISTS `spending_budgets` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `month_year` VARCHAR(7) NOT NULL,
  `monthly_limit` DECIMAL(12,2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. REMINDERS (Warranty, returns, expiry)
CREATE TABLE IF NOT EXISTS `reminders` (
  `id` VARCHAR(36) PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `receipt_id` VARCHAR(36) NOT NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `reminder_type` ENUM('warranty', 'return_window', 'service') NOT NULL,
  `due_date` DATE NOT NULL,
  `notes` TEXT,
  `is_resolved` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`receipt_id`) REFERENCES `receipts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. PRINT EVENTS (For paper savings tracking)
CREATE TABLE IF NOT EXISTS `print_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transaction_id` VARCHAR(36) NOT NULL,
  `outlet_id` VARCHAR(36) NOT NULL,
  `was_printed` TINYINT(1) NOT NULL DEFAULT 0,
  `reason` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. RECONCILIATION CASES
CREATE TABLE IF NOT EXISTS `reconciliation_cases` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `outlet_id` VARCHAR(36) NOT NULL,
  `case_type` ENUM('cash_shortage', 'upi_unsettled', 'card_variance', 'duplicate_scan') NOT NULL,
  `discrepancy_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('open', 'investigating', 'resolved') NOT NULL DEFAULT 'open',
  `notes` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. ANOMALY ALERTS
CREATE TABLE IF NOT EXISTS `anomaly_alerts` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `alert_type` VARCHAR(60) NOT NULL,
  `severity` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `details` TEXT NOT NULL,
  `is_acknowledged` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. ANOMALY REVIEWS
CREATE TABLE IF NOT EXISTS `anomaly_reviews` (
  `id` VARCHAR(36) PRIMARY KEY,
  `anomaly_alert_id` VARCHAR(36) NOT NULL,
  `reviewed_by_user_id` VARCHAR(36) NOT NULL,
  `action_taken` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`anomaly_alert_id`) REFERENCES `anomaly_alerts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 23. AUDIT LOGS
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36),
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(36),
  `details_json` JSON,
  `ip_address` VARCHAR(50),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 24. REPORT EXPORTS
CREATE TABLE IF NOT EXISTS `report_exports` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `report_name` VARCHAR(100) NOT NULL,
  `format` ENUM('csv', 'pdf', 'xlsx') NOT NULL DEFAULT 'csv',
  `date_range_start` DATE,
  `date_range_end` DATE,
  `download_url` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 25. AI CONVERSATIONS
CREATE TABLE IF NOT EXISTS `ai_conversations` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36),
  `user_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `role_context` ENUM('manager', 'retailer', 'customer') NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 26. AI TOOL AUDIT EVENTS
CREATE TABLE IF NOT EXISTS `ai_tool_audit_events` (
  `id` VARCHAR(36) PRIMARY KEY,
  `conversation_id` VARCHAR(36) NOT NULL,
  `tool_name` VARCHAR(100) NOT NULL,
  `query_params_json` JSON,
  `result_summary` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 27. BILLING FIELD CONFIGS (Configurable fields per company)
CREATE TABLE IF NOT EXISTS `billing_field_configs` (
  `id` VARCHAR(36) PRIMARY KEY,
  `company_id` VARCHAR(36) NOT NULL,
  `field_key` VARCHAR(50) NOT NULL,
  `field_label` VARCHAR(100) NOT NULL,
  `field_type` ENUM('text', 'number', 'date', 'dropdown', 'checkbox') NOT NULL DEFAULT 'text',
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `display_order` INT NOT NULL DEFAULT 0,
  `options_json` JSON,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_company_field` (`company_id`, `field_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 28. BILLING CUSTOM FIELD VALUES
CREATE TABLE IF NOT EXISTS `billing_custom_field_values` (
  `id` VARCHAR(36) PRIMARY KEY,
  `transaction_id` VARCHAR(36) NOT NULL,
  `field_config_id` VARCHAR(36) NOT NULL,
  `value_text` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`field_config_id`) REFERENCES `billing_field_configs`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
