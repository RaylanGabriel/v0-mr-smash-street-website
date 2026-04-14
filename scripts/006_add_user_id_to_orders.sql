-- Adiciona coluna user_id para vincular pedidos a usuários autenticados
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Cria índice para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Habilita RLS na tabela orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Política: Clientes podem ver apenas seus próprios pedidos
DROP POLICY IF EXISTS "customers_select_own_orders" ON orders;
CREATE POLICY "customers_select_own_orders" ON orders 
  FOR SELECT 
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Política: Clientes podem criar pedidos vinculados a si mesmos
DROP POLICY IF EXISTS "customers_insert_own_orders" ON orders;
CREATE POLICY "customers_insert_own_orders" ON orders 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Política: Admins podem ver todos os pedidos (usando service_role)
DROP POLICY IF EXISTS "service_role_all_orders" ON orders;
CREATE POLICY "service_role_all_orders" ON orders 
  FOR ALL 
  USING (true)
  WITH CHECK (true);
