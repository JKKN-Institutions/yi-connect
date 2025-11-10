# Database Patterns with Supabase

Comprehensive guide for designing database schemas with Row Level Security, indexes, and functions for Next.js 16 applications.

## Database Schema Design

### Complete Table with RLS

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table example
CREATE TABLE products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

## Row Level Security (RLS) Policies

### Read Policies

```sql
-- Public can view active products
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = true);

-- Authenticated users can view all products
CREATE POLICY "Authenticated users can view all products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');
```

### Write Policies

```sql
-- Admins and managers can insert products
CREATE POLICY "Admins and managers can insert products"
  ON products FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Admins and managers can update products
CREATE POLICY "Admins and managers can update products"
  ON products FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Only admins can delete products
CREATE POLICY "Only admins can delete products"
  ON products FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
```

### User-Specific Policies

```sql
-- Users can only view their own orders
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

## Indexes for Performance

### Basic Indexes

```sql
-- Index on foreign keys
CREATE INDEX idx_products_category ON products(category_id);

-- Index on commonly filtered columns
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_name ON products(name);
```

### Full-Text Search Index

```sql
-- GIN index for full-text search
CREATE INDEX idx_products_search ON products
  USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Query with full-text search
SELECT * FROM products
WHERE to_tsvector('english', name || ' ' || COALESCE(description, ''))
  @@ to_tsquery('english', 'laptop');
```

### Composite Indexes

```sql
-- Composite index for common query patterns
CREATE INDEX idx_products_active_category
  ON products(is_active, category_id);

-- Useful for queries like:
-- SELECT * FROM products WHERE is_active = true AND category_id = '...';
```

### Partial Indexes

```sql
-- Index only active products for faster queries
CREATE INDEX idx_active_products
  ON products(created_at DESC)
  WHERE is_active = true;
```

## Database Functions

### Auto-Update Timestamp

```sql
-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Atomic Stock Update

```sql
-- Function for atomic stock updates
CREATE OR REPLACE FUNCTION update_product_stock(
  product_id UUID,
  quantity_change INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + quantity_change
  WHERE id = product_id
  AND stock_quantity + quantity_change >= 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock or product not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Usage from Next.js:
-- await supabase.rpc('update_product_stock', {
--   product_id: '...',
--   quantity_change: -1
-- })
```

### User-Specific Data Function

```sql
-- Get user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_orders', COUNT(*),
    'total_spent', COALESCE(SUM(total), 0),
    'avg_order_value', COALESCE(AVG(total), 0),
    'last_order_date', MAX(created_at)
  )
  INTO result
  FROM orders
  WHERE user_id = p_user_id;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Materialized Views

For expensive aggregations, use materialized views:

```sql
-- Create materialized view
CREATE MATERIALIZED VIEW product_analytics AS
SELECT
  p.category_id,
  c.name as category_name,
  COUNT(p.id) as product_count,
  AVG(p.price) as avg_price,
  SUM(p.stock_quantity) as total_stock,
  COUNT(CASE WHEN p.is_active THEN 1 END) as active_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
GROUP BY p.category_id, c.name;

-- Index on materialized view
CREATE INDEX idx_product_analytics_category
  ON product_analytics(category_id);

-- Function to refresh the view
CREATE OR REPLACE FUNCTION refresh_product_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_analytics;
END;
$$ LANGUAGE plpgsql;

-- Auto-refresh trigger
CREATE OR REPLACE FUNCTION trigger_refresh_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('refresh_analytics', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_changed
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_analytics();
```

## Complete Module Schema Example

### Orders Module

```sql
-- Orders table
CREATE TABLE orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  total DECIMAL(10,2) NOT NULL CHECK (total >= 0),
  items JSONB NOT NULL,
  shipping_address JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items table (normalized)
CREATE TABLE order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_time DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view items of their orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE id = order_items.order_id
      AND user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- Triggers
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Schema Best Practices

### 1. Always Use UUIDs

```sql
-- Good: UUID primary key
id UUID DEFAULT uuid_generate_v4() PRIMARY KEY

-- Avoid: Auto-increment IDs (unless specific reason)
id SERIAL PRIMARY KEY
```

### 2. Add Timestamps

```sql
-- Always include created_at and updated_at
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
```

### 3. Use Constraints

```sql
-- Check constraints for data validation
price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
status TEXT CHECK (status IN ('pending', 'active', 'completed'))
```

### 4. Soft Deletes

```sql
-- Add is_deleted flag instead of hard deletes
is_deleted BOOLEAN DEFAULT false,
deleted_at TIMESTAMPTZ,

-- Policy to filter deleted records
CREATE POLICY "Hide deleted records"
  ON products FOR SELECT
  USING (is_deleted = false);
```

### 5. Audit Trails

```sql
-- Track who created/modified records
created_by UUID REFERENCES auth.users(id),
updated_by UUID REFERENCES auth.users(id)

-- Function to auto-set updated_by
CREATE OR REPLACE FUNCTION set_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Common Query Patterns

### Filtered List with Pagination

```sql
SELECT *
FROM products
WHERE is_active = true
  AND category_id = $1
  AND name ILIKE '%' || $2 || '%'
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

### Aggregations with Grouping

```sql
SELECT
  category_id,
  COUNT(*) as product_count,
  AVG(price) as avg_price,
  MIN(price) as min_price,
  MAX(price) as max_price
FROM products
WHERE is_active = true
GROUP BY category_id
ORDER BY product_count DESC;
```

### Join with Aggregation

```sql
SELECT
  c.id,
  c.name as category_name,
  COUNT(p.id) as product_count,
  COALESCE(SUM(p.stock_quantity), 0) as total_stock
FROM categories c
LEFT JOIN products p ON c.id = p.category_id AND p.is_active = true
GROUP BY c.id, c.name
ORDER BY c.name;
```

## TypeScript Type Generation

Generate TypeScript types from your Supabase schema:

```bash
# Install Supabase CLI
npm install -g supabase

# Generate types
npx supabase gen types typescript --project-id your-project-id > types/database.types.ts
```

Usage in Next.js:

```typescript
import { Database } from '@/types/database.types'

type Product = Database['public']['Tables']['products']['Row']
type ProductInsert = Database['public']['Tables']['products']['Insert']
type ProductUpdate = Database['public']['Tables']['products']['Update']
```

---

These patterns provide a solid foundation for designing scalable, secure, and performant databases for Next.js 16 applications.
