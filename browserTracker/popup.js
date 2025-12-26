// Use browser API for Firefox (or chrome for compatibility)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Форматирование времени
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) {
    return 'только что';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} мин назад`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} ч назад`;
  } else {
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Отображение текущей вкладки
function displayCurrentTab(tab) {
  const container = document.getElementById('current-tab-content');
  
  if (!tab) {
    container.innerHTML = '<div class="empty-state">Нет данных</div>';
    return;
  }
  
  container.innerHTML = `
    <div class="tab-title">${tab.title || 'Без названия'}</div>
    <div class="tab-info">${tab.url || 'Нет URL'}</div>
    <div class="tab-info history-time">${formatTime(tab.timestamp)}</div>
  `;
}

// Отображение истории
function displayHistory(history) {
  const container = document.getElementById('history-content');
  
  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state">История пуста</div>';
    return;
  }
  
  // Берем последние 10 записей в обратном порядке
  const recentHistory = history.slice(-10).reverse();
  
  container.innerHTML = recentHistory.map(item => `
    <div class="history-item">
      <div class="tab-title">${item.title || 'Без названия'}</div>
      <div class="tab-info">${item.url || 'Нет URL'}</div>
      <div class="history-time">${formatTime(item.timestamp)}</div>
    </div>
  `).join('');
}

// Загрузка данных
async function loadData() {
  const result = await browserAPI.storage.local.get(['tabHistory', 'currentTab']);
  displayCurrentTab(result.currentTab);
  displayHistory(result.tabHistory);
}

// Очистка истории
document.getElementById('clear-history').addEventListener('click', async () => {
  await browserAPI.storage.local.set({
    tabHistory: [],
    currentTab: null
  });
  loadData();
  console.log('История очищена');
});

// Инициализация
loadData();

// Обновление данных каждую секунду для актуального отображения времени
setInterval(loadData, 1000);
