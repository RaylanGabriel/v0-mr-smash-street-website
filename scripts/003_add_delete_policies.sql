-- Adicionar políticas de DELETE para permitir exclusão de pedidos

-- Política para excluir pedidos
CREATE POLICY "Allow public delete orders" ON orders FOR DELETE USING (true);

-- Política para excluir itens do pedido
CREATE POLICY "Allow public delete order_items" ON order_items FOR DELETE USING (true);

-- Política para excluir ingredientes extras dos itens
CREATE POLICY "Allow public delete order_item_ingredients" ON order_item_ingredients FOR DELETE USING (true);
