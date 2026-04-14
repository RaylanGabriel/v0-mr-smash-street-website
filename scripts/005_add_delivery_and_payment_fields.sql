-- Adicionar campos de entrega e pagamento na tabela orders

-- Campos de entrega
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'pickup';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_neighborhood VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cep VARCHAR(9);

-- Campos de pagamento
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'counter';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qrcode TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pix_qrcode_base64 TEXT;

-- Comentários
COMMENT ON COLUMN orders.delivery_type IS 'pickup = retirada no local, delivery = entrega';
COMMENT ON COLUMN orders.payment_method IS 'counter = pagar no balcão, pix = PIX, credit = cartão crédito, debit = cartão débito';
COMMENT ON COLUMN orders.payment_status IS 'pending = aguardando, approved = aprovado, rejected = rejeitado';
