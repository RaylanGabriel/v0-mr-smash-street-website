-- Tabela de itens do menu (lanches base)
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de ingredientes/adicionais
CREATE TABLE IF NOT EXISTS ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  category TEXT NOT NULL, -- 'protein', 'cheese', 'vegetable', 'sauce'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'delivered'
  total_price DECIMAL(10, 2) NOT NULL,
  estimated_wait_time INTEGER NOT NULL, -- em minutos
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tabela de itens do pedido
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de ingredientes extras por item do pedido
CREATE TABLE IF NOT EXISTS order_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir itens do menu padrão
INSERT INTO menu_items (name, description, base_price) VALUES
('Smash Clássico', 'Blend de carne 120g, queijo cheddar, alface, tomate e molho especial', 18.90),
('Smash Bacon', 'Blend de carne 120g, bacon crocante, queijo cheddar e molho barbecue', 21.90),
('Smash Duplo', 'Dois blends de carne 120g, queijo cheddar duplo e cebola caramelizada', 27.90),
('Smash Salada', 'Blend de carne 120g, alface, tomate, picles, cebola roxa e molho ranch', 19.90);

-- Inserir ingredientes/adicionais
INSERT INTO ingredients (name, price, category) VALUES
('Hambúrguer (120g)', 8.00, 'protein'),
('Bacon', 5.00, 'protein'),
('Cheddar', 3.50, 'cheese'),
('Queijo Mussarela', 3.00, 'cheese'),
('Alface', 1.00, 'vegetable'),
('Tomate', 1.00, 'vegetable'),
('Cebola Roxa', 1.00, 'vegetable'),
('Picles', 1.50, 'vegetable'),
('Cebola Caramelizada', 2.50, 'vegetable'),
('Molho Especial', 0.50, 'sauce'),
('Molho Barbecue', 0.50, 'sauce'),
('Molho Ranch', 0.50, 'sauce');

-- Habilitar RLS (Row Level Security) para todas as tabelas
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_item_ingredients ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - Permitir leitura para todos (sem autenticação necessária)
CREATE POLICY "Allow public read menu_items" ON menu_items FOR SELECT USING (true);
CREATE POLICY "Allow public read ingredients" ON ingredients FOR SELECT USING (true);
CREATE POLICY "Allow public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Allow public read order_items" ON order_items FOR SELECT USING (true);
CREATE POLICY "Allow public read order_item_ingredients" ON order_item_ingredients FOR SELECT USING (true);

-- Políticas RLS - Permitir inserção e atualização para todos
CREATE POLICY "Allow public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update orders" ON orders FOR UPDATE USING (true);
CREATE POLICY "Allow public insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert order_item_ingredients" ON order_item_ingredients FOR INSERT WITH CHECK (true);
