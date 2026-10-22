-- =============================================================================
-- CLEARBILL AI - SEED DEMO DATA
-- Provides initial accounts, business profiles, and test products with known barcodes
-- =============================================================================

USE `clearbill_ai`;

-- Demo Company 1: Annapurna Fresh Mart & Tea Bar (Multi-category retail)
INSERT INTO `companies` (`id`, `business_name`, `category`, `owner_name`, `email`, `phone`, `address`, `currency`, `timezone`, `tax_identification_number`)
VALUES 
('cmp-demo-01', 'Annapurna Retail & Tea Lounge', 'grocery_store', 'Rajesh Sharma', 'manager@clearbill.ai', '+91 98765 43210', 'Shop 14, Commercial Complex, MG Road, Bengaluru', 'INR', 'Asia/Kolkata', '29AAAAA0000A1Z5')
ON DUPLICATE KEY UPDATE `business_name` = VALUES(`business_name`);

-- Demo Outlets
INSERT INTO `outlets` (`id`, `company_id`, `outlet_name`, `outlet_code`, `address`, `phone`)
VALUES
('out-demo-01', 'cmp-demo-01', 'MG Road Flagship Store', 'BLR-01', 'Shop 14, Commercial Complex, MG Road, Bengaluru', '+91 98765 43210'),
('out-demo-02', 'cmp-demo-01', 'Indiranagar Express Outlet', 'BLR-02', '4th Block, 100ft Road, Indiranagar, Bengaluru', '+91 98765 43211')
ON DUPLICATE KEY UPDATE `outlet_name` = VALUES(`outlet_name`);

-- Users (Manager, Retailer Cashier, Customer)
-- Pre-hashed passwords for development (Password: "clearbill123")
INSERT INTO `users` (`id`, `email`, `phone`, `password_hash`, `full_name`, `role`)
VALUES
('usr-mgr-01', 'manager@clearbill.ai', '+91 98765 43210', '$2b$10$EpRnTzVlqHNP0.fHPxTc3.gLKnUeUj3B7p7s3a8eG0FqH1m7v.3/S', 'Rajesh Sharma', 'manager'),
('usr-ret-01', 'cashier@clearbill.ai', '+91 98765 43212', '$2b$10$EpRnTzVlqHNP0.fHPxTc3.gLKnUeUj3B7p7s3a8eG0FqH1m7v.3/S', 'Priya Patel', 'retailer'),
('usr-cus-01', 'customer@clearbill.ai', '+91 98765 43213', '$2b$10$EpRnTzVlqHNP0.fHPxTc3.gLKnUeUj3B7p7s3a8eG0FqH1m7v.3/S', 'Amit Kumar', 'customer')
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`);

-- Employee Membership
INSERT INTO `employee_memberships` (`id`, `company_id`, `outlet_id`, `user_id`, `employee_code`, `permissions_json`, `is_active`)
VALUES
('emp-01', 'cmp-demo-01', 'out-demo-01', 'usr-mgr-01', 'EMP-001', '{"can_manage_products": true, "can_manage_employees": true, "can_configure_billing": true, "can_issue_refunds": true}', 1),
('emp-02', 'cmp-demo-01', 'out-demo-01', 'usr-ret-01', 'EMP-002', '{"can_manage_products": false, "can_manage_employees": false, "can_configure_billing": false, "can_issue_refunds": false}', 1)
ON DUPLICATE KEY UPDATE `employee_code` = VALUES(`employee_code`);

-- Default Configurable Billing Fields for Company
INSERT INTO `billing_field_configs` (`id`, `company_id`, `field_key`, `field_label`, `field_type`, `is_visible`, `is_required`, `display_order`)
VALUES
('bf-01', 'cmp-demo-01', 'product_name', 'Product Name', 'text', 1, 1, 1),
('bf-02', 'cmp-demo-01', 'barcode', 'Barcode / Scan', 'text', 1, 0, 2),
('bf-03', 'cmp-demo-01', 'sku', 'SKU Code', 'text', 0, 0, 3),
('bf-04', 'cmp-demo-01', 'category', 'Category', 'text', 1, 0, 4),
('bf-05', 'cmp-demo-01', 'quantity', 'Quantity', 'number', 1, 1, 5),
('bf-06', 'cmp-demo-01', 'unit_price', 'Price (₹)', 'number', 1, 1, 6),
('bf-07', 'cmp-demo-01', 'discount', 'Discount (₹)', 'number', 1, 0, 7),
('bf-08', 'cmp-demo-01', 'tax_rate', 'GST (%)', 'number', 1, 0, 8),
('bf-09', 'cmp-demo-01', 'customer_phone', 'Customer Phone', 'text', 1, 0, 9),
('bf-10', 'cmp-demo-01', 'notes', 'Special Instructions', 'text', 0, 0, 10)
ON DUPLICATE KEY UPDATE `field_label` = VALUES(`field_label`);

-- Products with KNOWN physical retail barcodes (EAN-13, EAN-8, UPC, Code 128)
-- and Quick Bill tea/bakery items
INSERT INTO `products` (`id`, `company_id`, `outlet_id`, `product_name`, `barcode`, `sku`, `category`, `unit`, `unit_price`, `cost_price`, `tax_rate`, `description`, `is_quick_bill_item`, `quick_bill_order`, `is_active`)
VALUES
-- Quick Bill items (1-tap for Tea Shop & Bakery)
('prod-qb-01', 'cmp-demo-01', 'out-demo-01', 'Special Masala Tea', 'TEA-001', 'TEA-MAS', 'Beverages', 'cup', 15.00, 5.00, 5.00, 'Freshly brewed cardamom and ginger chai', 1, 1, 1),
('prod-qb-02', 'cmp-demo-01', 'out-demo-01', 'Filter Coffee', 'COF-001', 'COF-FIL', 'Beverages', 'cup', 20.00, 7.00, 5.00, 'Authentic South Indian chicory-blend filter coffee', 1, 2, 1),
('prod-qb-03', 'cmp-demo-01', 'out-demo-01', 'Fresh Milk Glass', 'MLK-001', 'MLK-GLS', 'Dairy', 'cup', 25.00, 12.00, 0.00, 'Farm-fresh pasteurized warm milk', 1, 3, 1),
('prod-qb-04', 'cmp-demo-01', 'out-demo-01', 'Hot Samosa (2 pcs)', 'SAM-001', 'SNK-SAM', 'Snacks', 'plate', 30.00, 12.00, 5.00, 'Crispy spiced potato samosas with green chutney', 1, 4, 1),
('prod-qb-05', 'cmp-demo-01', 'out-demo-01', 'Bun Maska', 'BUN-001', 'BAK-BUN', 'Bakery', 'pcs', 35.00, 14.00, 5.00, 'Irani bakery style toasted bun with salted butter', 1, 5, 1),
('prod-qb-06', 'cmp-demo-01', 'out-demo-01', 'Sweet Lassi', 'LAS-001', 'BEV-LAS', 'Beverages', 'glass', 40.00, 18.00, 5.00, 'Chilled thick sweet curd lassi', 1, 6, 1),

-- Standard retail items with PHYSICAL STANDARD BARCODES
-- 1. EAN-13: Tata Tea Gold (8901030383786)
('prod-ean-01', 'cmp-demo-01', 'out-demo-01', 'Tata Tea Gold 250g', '8901030383786', 'GRO-TTG-250', 'Groceries', 'pack', 165.00, 140.00, 5.00, 'Premium tea with gently rolled long leaves', 0, 0, 1),
-- 2. EAN-13: Amul Pure Ghee 500ml (8901233024823)
('prod-ean-02', 'cmp-demo-01', 'out-demo-01', 'Amul Pure Ghee Carton 500ml', '8901233024823', 'GRO-AMG-500', 'Dairy', 'carton', 315.00, 280.00, 12.00, 'Pure clarified butter ghee with rich aroma', 0, 0, 1),
-- 3. EAN-13: Parle-G Gold Biscuits (8901499026418)
('prod-ean-03', 'cmp-demo-01', 'out-demo-01', 'Parle-G Gold Glucose Biscuits 1kg', '8901499026418', 'SNK-PAR-1KG', 'Snacks', 'pack', 120.00, 102.00, 5.00, 'Classic glucose biscuits pack', 0, 0, 1),
-- 4. EAN-13: Britannia Good Day Butter (8901063013216)
('prod-ean-04', 'cmp-demo-01', 'out-demo-01', 'Britannia Good Day Butter 200g', '8901063013216', 'SNK-GDB-200', 'Snacks', 'pack', 45.00, 36.00, 5.00, 'Crunchy butter cookies with cashew sprinkles', 0, 0, 1),
-- 5. EAN-8: Standard EAN-8 Barcode (50123456)
('prod-ean8-01', 'cmp-demo-01', 'out-demo-01', 'ClearBill Mint Tin 50g (EAN-8 Test)', '50123456', 'MNT-EAN8', 'Confectionery', 'tin', 50.00, 35.00, 12.00, 'Pocket peppermint candies in metal tin', 0, 0, 1),
-- 6. UPC-A: Standard 12-digit UPC Barcode with leading zero (012345678905)
('prod-upc-01', 'cmp-demo-01', 'out-demo-01', 'Organic Honey 250ml (UPC-A Test)', '012345678905', 'HON-UPC12', 'Organic', 'bottle', 240.00, 195.00, 5.00, 'Wildflower organic mountain honey', 0, 0, 1),
-- 7. Code 128: Alphanumeric Inventory Barcode (CB-RETAIL-1001)
('prod-c128-01', 'cmp-demo-01', 'out-demo-01', 'Stainless Steel Insulated Flask 750ml (Code 128 Test)', 'CB-RETAIL-1001', 'HW-FLK-750', 'Merchandise', 'pcs', 699.00, 480.00, 18.00, 'Double-wall vacuum thermal water flask', 0, 0, 1),
-- 8. Code 128: Apparel Tag Barcode (APP-DENIM-32)
('prod-c128-02', 'cmp-demo-01', 'out-demo-01', 'Classic Slim Denim Jeans Size 32', 'APP-DENIM-32', 'APP-JNS-32', 'Apparel', 'pcs', 1499.00, 950.00, 12.00, 'Dark wash stretch cotton denim', 0, 0, 1)
ON DUPLICATE KEY UPDATE `unit_price` = VALUES(`unit_price`);

-- Sample Completed Transactions
INSERT INTO `transactions` (`id`, `company_id`, `outlet_id`, `user_id`, `transaction_number`, `status`, `subtotal`, `discount_amount`, `tax_amount`, `grand_total`, `payment_method`, `payment_status`, `customer_name`, `customer_phone`, `finalized_at`)
VALUES
('tx-001', 'cmp-demo-01', 'out-demo-01', 'usr-ret-01', 'CB-2026-1001', 'completed', 80.00, 0.00, 4.00, 84.00, 'cash', 'verified', 'Arun Kumar', '+91 99887 76655', NOW() - INTERVAL 2 HOUR),
('tx-002', 'cmp-demo-01', 'out-demo-01', 'usr-ret-01', 'CB-2026-1002', 'completed', 480.00, 20.00, 24.00, 484.00, 'upi', 'verified', 'Sneha Rao', '+91 98877 66554', NOW() - INTERVAL 1 HOUR),
('tx-003', 'cmp-demo-01', 'out-demo-01', 'usr-ret-01', 'CB-2026-1003', 'completed', 699.00, 0.00, 125.82, 824.82, 'card', 'verified', 'Venkatesh Iyer', '+91 97766 55443', NOW() - INTERVAL 30 MINUTE)
ON DUPLICATE KEY UPDATE `grand_total` = VALUES(`grand_total`);

-- Transaction Items
INSERT INTO `transaction_items` (`id`, `transaction_id`, `product_id`, `product_name`, `barcode`, `quantity`, `unit_price`, `tax_rate`, `tax_amount`, `discount_amount`, `line_total`)
VALUES
('txi-01', 'tx-001', 'prod-qb-01', 'Special Masala Tea', 'TEA-001', 2.000, 15.00, 5.00, 1.50, 0.00, 30.00),
('txi-02', 'tx-001', 'prod-qb-04', 'Hot Samosa (2 pcs)', 'SAM-001', 1.000, 30.00, 5.00, 1.50, 0.00, 30.00),
('txi-03', 'tx-001', 'prod-qb-02', 'Filter Coffee', 'COF-001', 1.000, 20.00, 5.00, 1.00, 0.00, 20.00),

('txi-04', 'tx-002', 'prod-ean-01', 'Tata Tea Gold 250g', '8901030383786', 1.000, 165.00, 5.00, 8.25, 0.00, 165.00),
('txi-05', 'tx-002', 'prod-ean-02', 'Amul Pure Ghee Carton 500ml', '8901233024823', 1.000, 315.00, 12.00, 37.80, 20.00, 295.00),

('txi-06', 'tx-003', 'prod-c128-01', 'Stainless Steel Insulated Flask 750ml (Code 128 Test)', 'CB-RETAIL-1001', 1.000, 699.00, 18.00, 125.82, 0.00, 699.00)
ON DUPLICATE KEY UPDATE `line_total` = VALUES(`line_total`);

-- Receipts & Tokens
INSERT INTO `receipts` (`id`, `transaction_id`, `receipt_number`, `qr_code_data`, `receipt_url`, `paper_print_avoided`)
VALUES
('rcpt-001', 'tx-001', 'RCP-1001', 'https://clearbill.ai/r/t-guest-001', '/receipt/t-guest-001', 1),
('rcpt-002', 'tx-002', 'RCP-1002', 'https://clearbill.ai/r/t-guest-002', '/receipt/t-guest-002', 1),
('rcpt-003', 'tx-003', 'RCP-1003', 'https://clearbill.ai/r/t-guest-003', '/receipt/t-guest-003', 1)
ON DUPLICATE KEY UPDATE `receipt_number` = VALUES(`receipt_number`);

INSERT INTO `receipt_tokens` (`id`, `receipt_id`, `token`, `viewing_session_seconds`, `expires_at`, `is_claimed`)
VALUES
('tok-001', 'rcpt-001', 't-guest-001', 30, NOW() + INTERVAL 1 DAY, 0),
('tok-002', 'rcpt-002', 't-guest-002', 30, NOW() + INTERVAL 1 DAY, 1),
('tok-003', 'rcpt-003', 't-guest-003', 30, NOW() + INTERVAL 1 DAY, 0)
ON DUPLICATE KEY UPDATE `token` = VALUES(`token`);

-- Customer Claim
INSERT INTO `customer_receipt_claims` (`id`, `customer_user_id`, `receipt_id`)
VALUES
('clm-01', 'usr-cus-01', 'rcpt-002')
ON DUPLICATE KEY UPDATE `claimed_at` = CURRENT_TIMESTAMP;
