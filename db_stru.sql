-- Базовая модель как пример реализации.
-- Реальный вариант требует дальнейшей нрмализации. Например, current_stage в отдельной таблице.

-- Справочник товаров (шаблоны ковриков)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    car_model VARCHAR(255) NOT NULL, -- Модель авто (например, "Toyota Camry V70")
    mat_color VARCHAR(50) NOT NULL,    -- Цвет основы (например, "Черный")
    car_year  CHAR(4) NOT NULL    -- Год автомобиля
);

-- Склад готовой продукции (Stock)
CREATE TABLE stock_items (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id),
    edging_color VARCHAR(50) NOT NULL, -- Цвет окантовки текущего комплекта
    status VARCHAR(50) DEFAULT 'available', -- 'available', 'reserved'
    order_id INT NULL -- Ссылка на заказ, если зарезервирован
);

-- Заказы (Orders)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    marketplace_id  INT REFERENCES marketplace(id),
    marketplace_order_id VARCHAR(100), -- ID из маркетплейса для теста
    product_id INT REFERENCES products(id),
    target_edging_color VARCHAR(50) NOT NULL, -- Желаемый цвет окантовки
    status VARCHAR(50) NOT NULL, -- 'pending', 'in_production', 'completed'
    current_stage VARCHAR(50) NOT NULL, -- 'routing', 'cutting', 'sewing', 'molding', 'packing', 'shipping', 'done'
    shipment_deadline TIMESTAMP NOT NULL, -- К какому времени нужно отгрузить (SLA маркетплейса)
    shipped_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marketplace (
    id SERIAL PRIMARY KEY,
    prefix VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Лог прохождения этапов (для истории и аналитики)
CREATE TABLE order_history (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    stage VARCHAR(50) NOT NULL,
    worker_id INT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
