-- Loyalty & Product Customization schema migration
-- Creates core tables for ingredients, option groups, and loyalty campaigns.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    nutrition JSONB,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_ingredients (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    is_mandatory BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    UNIQUE (product_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS option_groups (
    id SERIAL PRIMARY KEY,
    product_id INTEGER,
    category_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(32) NOT NULL CHECK (type IN ('single', 'multiple', 'select', 'custom')),
    is_active BOOLEAN DEFAULT TRUE,
    min_required INTEGER DEFAULT 0,
    max_allowed INTEGER DEFAULT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS option_choices (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price_cents INTEGER DEFAULT 0,
    price_is_percent BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    is_required BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item_options (
    id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL,
    option_choice_id INTEGER NOT NULL REFERENCES option_choices(id),
    price_cents INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS removed_ingredient_ids INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS selected_option_ids INTEGER[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS base_price_cents INTEGER,
    ADD COLUMN IF NOT EXISTS final_price_cents INTEGER;

CREATE TABLE IF NOT EXISTS loyalty_campaigns (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(128) UNIQUE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(32) DEFAULT 'draft',
    priority INTEGER DEFAULT 0,
    schedule JSONB,
    conditions JSONB,
    actions JSONB,
    caps JSONB,
    stacking JSONB,
    display JSONB,
    channels TEXT[],
    zones TEXT[],
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_rules (
    id SERIAL PRIMARY KEY,
    scope VARCHAR(32) NOT NULL CHECK (scope IN ('global', 'category', 'sku')),
    reference_id VARCHAR(128),
    percent INTEGER NOT NULL,
    coins_rate NUMERIC(10,4) DEFAULT 0,
    exclude_promo BOOLEAN DEFAULT FALSE,
    valid_from TIMESTAMP WITHOUT TIME ZONE,
    valid_to TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(16) NOT NULL CHECK (type IN ('static', 'dynamic')),
    query JSONB,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_group_items (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES campaign_groups(id) ON DELETE CASCADE,
    sku VARCHAR(128),
    category_id INTEGER,
    UNIQUE (group_id, sku)
);

CREATE TABLE IF NOT EXISTS loyalty_anchors (
    id SERIAL PRIMARY KEY,
    anchor_key VARCHAR(128) UNIQUE NOT NULL,
    mapping JSONB NOT NULL,
    utm_support BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

COMMIT;


