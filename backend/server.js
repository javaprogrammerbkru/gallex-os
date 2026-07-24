const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes, Op } = require('sequelize');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Инициализация базы данных SQLite в файле gallex.sqlite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './gallex.sqlite',
  logging: false
});

// 2. Описание моделей (Таблиц)
const Marketplace = sequelize.define('Marketplace', {
  prefix: { type: DataTypes.STRING, allowNull: false },
  fullName: { type: DataTypes.STRING, allowNull: false }
});

const Product = sequelize.define('Product', {
  carModel: { type: DataTypes.STRING, allowNull: false },
  matColor: { type: DataTypes.STRING, allowNull: false },
  carYear: { type: DataTypes.STRING, allowNull: false }
});

const StockItem = sequelize.define('StockItem', {
  edgingColor: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'available' }, // 'available', 'reserved'
  orderId: { type: DataTypes.INTEGER, allowNull: true }
}, {
  sequelize,
  modelName: 'StockItem',
  
  indexes: [
    {
      name: 'stock_items_product_status_idx',
      fields: ['productId', 'status'] // Составной индекс (сразу по двум полям)
    }
  ]
});

const Order = sequelize.define('Order', {
  marketplaceId:  { type: DataTypes.INTEGER, allowNull: false },
  marketplaceOrderId: { type: DataTypes.STRING, allowNull: false },
  targetEdgingColor: { type: DataTypes.STRING, allowNull: false },
  
  // 'pending', 'in_production', 'completed'
  status: { type: DataTypes.STRING, defaultValue: 'pending' },

  // 'routing', 'cuttingNew', 'cuttingRebuild', 'sewing', 'molding', 'packing', 'shipping', 'done'
  currentStage: { type: DataTypes.STRING, defaultValue: 'routing' },

  shipmentDeadline: { 
    type: DataTypes.DATE, 
    allowNull: false
  },
  shippedAt: { 
    type: DataTypes.DATE, 
    allowNull: true
  }
}, {
  // Настройки модели
  sequelize,
  modelName: 'Order',
  
  // Объявление индексов:
  indexes: [
    {
      name: 'orders_current_stage_idx', // Имя индекса в БД (опционально)
      fields: ['currentStage']         // Поле, по которому строится индекс
    },
    // Индекс для быстрой сортировки по дедлайну
    {
      name: 'orders_shipment_deadline_idx',
      fields: ['shipmentDeadline']
    }
  ]
});

// Настройка связей
Product.hasMany(StockItem, { foreignKey: 'productId' });
StockItem.belongsTo(Product, { foreignKey: 'productId' });

Product.hasMany(Order, { foreignKey: 'productId' });
Order.belongsTo(Product, { foreignKey: 'productId' });

Marketplace.hasMany(Order, { foreignKey: 'marketplaceId' });
Order.belongsTo(Marketplace, { foreignKey: 'marketplaceId' });

Order.hasOne(StockItem, {foreignKey: 'orderId'});
StockItem.belongsTo(Order, { foreignKey: 'orderId' });

// 3. Функция генерации тестовых данных (Запустится один раз при старте)
async function seedDatabase() {
  await sequelize.sync({ force: true }); // Очищает БД при каждом перезапуске для тестов

  // Создаем модели авто
  const p1 = await Product.create({ carModel: 'Toyota Camry V70', matColor: 'Черный', carYear: '2019' });
  const p2 = await Product.create({ carModel: 'Kia Rio 4', matColor: 'Серый', carYear: '1998' });
  const p3 = await Product.create({ carModel: 'Hyundai Creta', matColor: 'Коричневый', carYear: '2014' });

  // Создаем маркетплейсы  
  const mpWb = await Marketplace.create({ prefix: 'WB', fullName: 'Wildberries' });
  const mpOzon = await Marketplace.create({ prefix: 'OZON', fullName: 'Ozon' });
  const mpYandex = await Marketplace.create({ prefix: 'YANDEX', fullName: 'Яндекс Маркет' });

  // Заполняем склад готовой продукции (Stock)
  await StockItem.create({ productId: p1.id, edgingColor: 'Красный', status: 'available' }); // Для Сценария 1 (Совпадение)
  await StockItem.create({ productId: p2.id, edgingColor: 'Синий', status: 'available' });   // Для Сценария 2 (Другой цвет)
  // Для p3 (Creta) склад оставляем пустым — пойдет по Сценарию 3 (С нуля)

  // Генерируем 15 тестовых заказов
  const edgingColors = ['Красный', 'Черный', 'Синий', 'Серый'];
  const products = [p1, p2, p3];

  for (let i = 1; i <= 15; i++) {
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomColor = edgingColors[Math.floor(Math.random() * edgingColors.length)];
    const currMarketplace = (i % 5 === 0) ? mpOzon : (i % 3 === 0) ? mpWb : mpYandex;
    const deadlineHours = Math.floor(Math.random() * (72 - (-12) + 1));
    
    const deadlineDate = new Date();
    deadlineDate.setHours(deadlineDate.getHours() + deadlineHours);

    await Order.create({
      marketplaceId: `${currMarketplace.id}`,
      marketplaceOrderId: `${currMarketplace.prefix}-${100000 + i}`,
      productId: randomProduct.id,
      targetEdgingColor: randomColor,
      status: 'pending',
      currentStage: 'routing',
      shipmentDeadline: deadlineDate
    });
  }

  console.log('>>> Обработка запросов в статусе routing');
  await routeOrders();
  console.log('>>> База данных успешно заполнена тестовыми данными!');
}


// Автоматический Роутинг заказов по сценариям ТЗ
async function routeOrders() {

  try {
    // Находим все заказы в статусе routing
    const routingOrders = await Order.findAll({
      where: {
        currentStage: 'routing'
      },
      order: [['createdAt', 'ASC']] // Сначала старые заказы
    });

    // Очередь пуста
    if (routingOrders.length === 0) {
      console.log(`>>> Нет заказов для распределения`)
      return { processed: 0, errors: 0 };
    }
    console.log(`>>> ${routingOrders.length} заказов в статусе routing`)

    // Перебираем заказы
    const stats = { processed: 0, errors: 0 };
    for (const order of routingOrders) {
      try {
        await routeOrder(order.id); 
        stats.processed++;
      } catch (orderError) {
        console.error(`Ошибка обработки заказа ${order.id}:`, orderError);
        stats.errors++;
      }
    }    
    console.log(`>>> Обработка завершена. Успешно: ${stats.processed}, Ошибок: ${stats.errors}`);
    return stats;

  } catch (error) {
    console.error("Критическая ошибка в главном процессе роутинга:", error);
    throw error;
  }
}


async function routeOrder(orderId) {
  
  // Открываем отдельную транзакцию для одного заказа
  const t = await sequelize.transaction();
  
  try {
    // Перечитываем заказ внутри транзакции. 
    // Это защищает от ситуации, когда пока шел цикл, статус заказа изменился в другом запросе.
    const order = await Order.findByPk(orderId, { transaction: t });
    
    // Если заказ уже кто-то обработал или удалил — отменяем операцию
    if (!order || order.currentStage !== 'routing') {
      await t.rollback();
      return;
    }

    // Ищем подходящий коврик на складе. 
    const availableStock = await StockItem.findOne({
      where: { productId: order.productId, status: 'available' },
      transaction: t
    });

    if (availableStock) {
      // Резервируем комплект, привязывая к ID заказа
      await availableStock.update({ status: 'reserved', orderId: order.id }, { transaction: t });

      if (availableStock.edgingColor === order.targetEdgingColor) {
        // Сценарий 1: Цвет совпал -> сразу на Формовку
        await order.update({ currentStage: 'molding', status: 'in_production' }, { transaction: t });
      } else {
        // Сценарий 2: Цвет другой -> Резка (Снять старую окантовку)
        await order.update({ currentStage: 'cuttingRebuild', status: 'in_production' }, { transaction: t });
      }
    } else {
      // Сценарий 3: На складе ничего нет -> Полный цикл с Резки
      await order.update({ currentStage: 'cuttingNew', status: 'in_production' }, { transaction: t });
    }

    await t.commit(); // Сохраняем изменения в БД
    
  } catch (error) {
    await t.rollback(); // Если произошла ошибка, откатываем изменение назад
    throw error;
  }
};


// 4. API Эндпоинты

// Список маркетплейсов
app.get('/api/marketplaces', async (req, res) => {
  try {
    const marketplaces = await Marketplace.findAll({
      order: [['fullName', 'ASC']]
    });
    res.json(marketplaces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Получить все заказы с фильтрацией и поиском
app.get('/api/orders', async (req, res) => {
  const { search, stage, marketplace } = req.query;
  const whereCondition = {};

  if (stage) {
    whereCondition.currentStage = stage;
  }

  // Фильтр по маркетплейсу
  if (marketplace) {
    whereCondition.marketplaceId = {
      // Ищет совпадение по id маркетплейса
      [Op.eq]: `${marketplace}` 
    };
  }

  // Если передан поисковый запрос, ищем по модели ИЛИ по номеру заказа
  if (search) {
    whereCondition[Op.or] = [
      // 1. Поиск по номеру заказа из маркетплейса (в таблице Orders)
      {
        marketplaceOrderId: {
          [Op.like]: `%${search}%` // Для PostgreSQL используйте Op.iLike (регистронезависимый)
        }
      },
      // 2. Поиск по модели автомобиля (в связанной таблице Products)
      // Для этого мы проверяем вложенное поле через '$Product.car_model$'
      {
        '$Product.carModel$': {
          [Op.like]: `%${search}%`
        }
      }
    ];
  }

  try {
    const orders = await Order.findAll({
      where: whereCondition,
      include: [
        { model: Product },
        { model: Marketplace },
        { model: StockItem }
      ],
      order: [['id', 'ASC']]
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Перевод заказа на следующий этап сотрудником
app.post('/api/orders/:id/next', async (req, res) => {
  const orderId = req.params.id;
  const stages = ['cuttingNew', 'cuttingRebuild', 'sewing', 'molding', 'packing', 'shipping', 'done'];

  try {
    const order = await Order.findByPk(orderId, { include: Product });
    if (!order) return res.status(404).json({ error: 'Заказ не найден' });

    const currentIndex = stages.indexOf(order.currentStage);
    if (currentIndex === -1 || order.currentStage === 'done') {
      return res.status(400).json({ error: 'Невозможно перевести заказ дальше' });
    }

    const step = (order.currentStage === 'cuttingNew') ? 2 : 1;
    const nextIndex = currentIndex + step;

    const nextStage = stages[nextIndex];
    const updates = { currentStage: nextStage };
    
    if (nextStage === 'done') {
      updates.status = 'completed';
    }

    await order.update(updates);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Запуск сервера
const PORT = 5000;
sequelize.authenticate().then(async () => {
  await seedDatabase();
  app.listen(PORT, () => console.log(`>>> Сервер Gallex OS запущен на http://localhost:${PORT}`));
});

