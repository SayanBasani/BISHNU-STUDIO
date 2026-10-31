-- Migration 0012: Universal Fulfillment and Exchange Lifecycle
ALTER TABLE order_returns ADD COLUMN replacement_order_id text;
ALTER TABLE order_returns ADD COLUMN exchange_status text DEFAULT 'requested';
ALTER TABLE order_returns ADD COLUMN exchange_price_difference real DEFAULT 0;
ALTER TABLE order_returns ADD COLUMN exchange_notes text;
