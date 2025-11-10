-- Supabase Schema Template for Next.js 16 Projects
--
-- This template provides a starting point for database schemas with:
-- - Row Level Security (RLS) policies
-- - Performance indexes
-- - Automatic timestamp updates
-- - Atomic operations
--
-- Customize this template for your specific needs

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Profiles Table (User Management)
-- ============================================================================

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'guest')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================================================
-- Example: Products Table
-- ============================================================================

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

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all products"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and managers can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );

-- Indexes
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- Full-text search
CREATE INDEX idx_products_search ON products
  USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- ============================================================================
-- Triggers and Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Example: Atomic stock update function
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

-- ============================================================================
-- Materialized Views (for Analytics)
-- ============================================================================

CREATE MATERIALIZED VIEW product_statistics AS
SELECT
  COUNT(*) as total_products,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_products,
  AVG(price) as average_price,
  SUM(stock_quantity) as total_stock
FROM products;

CREATE INDEX idx_product_statistics ON product_statistics(total_products);

-- Function to refresh statistics
CREATE OR REPLACE FUNCTION refresh_product_statistics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_statistics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Seed Data (Optional)
-- ============================================================================

-- Insert initial admin user (update the UUID with actual user ID)
-- INSERT INTO profiles (id, email, full_name, role)
-- VALUES (
--   'your-admin-user-id-here',
--   'admin@example.com',
--   'Admin User',
--   'admin'
-- );

-- ============================================================================
-- Notes
-- ============================================================================

-- Remember to:
-- 1. Update RLS policies based on your security requirements
-- 2. Add indexes for frequently queried columns
-- 3. Test policies thoroughly before deploying
-- 4. Use migrations for schema changes in production
-- 5. Generate TypeScript types after schema changes:
--    npx supabase gen types typescript --project-id your-project-id
