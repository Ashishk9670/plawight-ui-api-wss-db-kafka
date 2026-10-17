CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'general',
  price       NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  status     TEXT NOT NULL DEFAULT 'CREATED',
  total      NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL
);

INSERT INTO products (name, description, category, price, stock) VALUES
  ('Laptop Pro 14',      '14-inch laptop, 16GB RAM',     'electronics', 1299.00, 50),
  ('Wireless Mouse',     'Ergonomic wireless mouse',     'accessories',   25.50, 200),
  ('Mechanical Keyboard','Hot-swappable keyboard',       'accessories',   89.99, 120),
  ('USB-C Hub',          '7-in-1 USB-C hub',             'accessories',   45.00, 80),
  ('27" Monitor',        '4K IPS monitor',               'electronics',  349.00, 30),
  ('Noise Cancelling Headphones', 'Over-ear Bluetooth',  'audio',        199.00, 60);
