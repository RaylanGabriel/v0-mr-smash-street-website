-- Adiciona coluna is_paid na tabela orders para controle de pagamento
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- Atualiza pedidos existentes como não pagos
UPDATE orders SET is_paid = false WHERE is_paid IS NULL;
