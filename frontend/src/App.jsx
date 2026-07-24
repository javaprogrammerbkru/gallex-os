import React, { useState, useEffect } from 'react';

// Перевод этапов на русский язык для интерфейса
const stageLabels = {
  routing: 'Ожидает распределения',
  cuttingNew: 'Резка (новый комплект)',
  cuttingRebuild: 'Резка (снять окантовку)',
  sewing: 'Шитье',
  molding: 'Формовка',
  packing: 'Упаковка',
  shipping: 'Отгрузка',
  done: 'Завершен'
};

function App() {
  const [orders, setOrders] = useState([]);
  const [marketplaces, setMarketplaces] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState(''); // Фильтр по ролям/цехам
  const [selectedOrder, setSelectedOrder] = useState(null); // Для карточки заказа
  const [selectedMarketplace, setSelectedMarketplace] = useState(''); // Фильтр по маркетплейсам

  // Загрузка маркетплейсов
  const fetchMarketplaces = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/marketplaces`
      );
      const data = await response.json();
      setMarketplaces(data);
    } catch (error) {
      console.error("Ошибка при получении данных:", error);
    }
  };

  // Загрузка заказов с сервера с учетом поиска и фильтра
  const fetchOrders = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/orders?search=${search}&stage=${selectedStage}&marketplace=${selectedMarketplace}`
      );
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Ошибка при получении данных:", error);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchMarketplaces();
  }, [search, selectedStage, selectedMarketplace]);


  // Сценарий автоматического распределения (Кнопка "Запустить систему роутинга")
  const handleAutoRoute = async (id) => {
    await fetch(`http://localhost:5000/api/orders/${id}/route`, { method: 'POST' });
    fetchOrders();
    setSelectedOrder(null);
  };

  // Кнопка сотрудника "Завершить этап и перевести далее"
  const handleNextStage = async (id) => {
    await fetch(`http://localhost:5000/api/orders/${id}/next`, { method: 'POST' });
    fetchOrders();
    setSelectedOrder(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <header className="mb-8 bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Gallex OS — Модуль «Заказы»</h1>
        <div className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">Режим: Разработка MVP</div>
      </header>

      {/* Панель фильтров и поиска */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Поиск по модели авто или № заказа..."
          className="border border-gray-300 rounded p-2 flex-1 min-w-[200px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border border-gray-300 rounded p-2 bg-white"
          value={selectedMarketplace}
          onChange={(e) => setSelectedMarketplace(e.target.value)}>
            <option value="">Все маркетплейсы</option>
            {/* Динамически генерируем опции из базы данных */}
            {marketplaces.map((mp) => (
            <option key={mp.id} value={mp.id}>
              {mp.fullName}
            </option>
          ))}
        </select>

        <select
          className="border border-gray-300 rounded p-2 bg-white"
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value)}
        >
          <option value="">Все этапы (Администратор)</option>
          <option value="routing">Цех: Распределение (Менеджер)</option>
          <option value="cutting">Цех: Резка (Резчик)</option>
          <option value="sewing">Цех: Шитье (Швейник)</option>
          <option value="molding">Цех: Формовка (Формовщик)</option>
          <option value="packing">Цех: Упаковка (Упаковщик)</option>
          <option value="shipping">Цех: Отгрузка (Логист)</option>
        </select>
      </div>

      {/* Основной контент (Таблица + Карточка) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Список заказов */}
        <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Очередь заказов ({orders.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="pb-2">ID Заказа</th>
                  <th className="pb-2">Маркетплейс</th>
                  <th className="pb-2">Модель авто / Год / Цвет</th>
                  <th className="pb-2">Результат проверки склада</th>
                  <th className="pb-2"># комплекта</th>
                  <th className="pb-2">Окантовка</th>
                  <th className="pb-2">Текущий этап</th>
                  <th className="pb-2">Срок отгрузки</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr 
                    key={order.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="py-3 font-medium text-blue-600">{order.marketplaceOrderId}</td>
                    <td className="py-3 font-medium text-blue-600">{order.Marketplace?.fullName}</td>
                    <td className="py-3">
                      <span className="font-semibold">{order.Product?.carModel}</span> 
                      <span className="text-gray-400 text-xs block">Год: {order.Product?.carYear}</span>
                      <span className="text-gray-400 text-xs block">Основа: {order.Product?.matColor}</span>
                    </td>
                    <td className="py-3">{order.StockItem?.id ? "Зарезервирован" : "Нет на складе"}</td>
                    <td className="py-3">{order.StockItem?.id}</td>
                    <td className="py-3">{order.targetEdgingColor}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        order.currentStage === 'routing' ? 'bg-amber-100 text-amber-800' :
                        order.currentStage === 'done' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {stageLabels[order.currentStage]}
                      </span>
                    </td>
                    <td className="py-3">
                      {new Date(order.shipmentDeadline).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Боковая Карточка заказа */}
        <div className="bg-white p-6 rounded-lg shadow-sm h-fit border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Детализация задачи</h2>
          {selectedOrder ? (
            <div>

              <div className="mb-4">
                <p><strong>Маркетплейс:</strong> {selectedOrder.Marketplace?.fullName}</p>
              </div>
              <div className="mb-4">
                <p><strong>Номер на Маркетплейсе:</strong> {selectedOrder.marketplaceOrderId}</p>
              </div>


              <div className="space-y-3 border-t border-b border-gray-100 py-4 mb-4">
                <p><strong>Автомобиль:</strong> {selectedOrder.Product?.carModel}</p>
                <p><strong>Год:</strong> {selectedOrder.Product?.carYear}</p>
                <p><strong>Цвет коврика:</strong> {selectedOrder.Product?.matColor}</p>
                <p><strong>Нужная окантовка:</strong> <span className="underline font-semibold">{selectedOrder.targetEdgingColor}</span></p>
                <p><strong>Результат проверки склада: </strong>{selectedOrder.StockItem?.id ? "Зарезервирован" : "Нет на складе"}</p>
                <p><strong># комплекта: </strong>{selectedOrder.StockItem?.id}</p>
                <p><strong>Срок отгрузки: </strong>
                      {new Date(selectedOrder.shipmentDeadline).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                </p>
                <p><strong>Текущий статус в системе:</strong> {stageLabels[selectedOrder.currentStage]}</p>
              </div>


              {/* Управление заказом в зависимости от этапа */}
              {selectedOrder.currentStage === 'routing' ? (
                <div>
                  <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded mb-3">
                    Заказ только поступил. Система должна проверить склад и автоматически определить маршрут.
                  </p>
                  <button
                    onClick={() => handleAutoRoute(selectedOrder.id)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-4 rounded transition"
                  >
                    ⚡ Запустить авто-роутинг
                  </button>
                </div>
              ) : selectedOrder.currentStage === 'done' ? (
                <p className="text-center text-green-600 font-bold py-4">✅ Продукт отгружен клиенту</p>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-3">
                    Сотрудник видит только кнопку выполнения. Решения «куда направить дальше» принимаются алгоритмом бэкенда.
                  </p>
                  <button
                    onClick={() => handleNextStage(selectedOrder.id)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition"
                  >
                    Выполнить этап «{stageLabels[selectedOrder.currentStage]}» →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">Выберите заказ из таблицы для просмотра карточки и выполнения действий.</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
