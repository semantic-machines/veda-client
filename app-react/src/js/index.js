import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import ModelViewer from './ModelViewer.js';
import ModelTest from './ModelTest.js';
import Backend from '../../../src/Backend.js';
import Subscription from '../../../src/Subscription.js';

Backend.init();
Subscription.init();

function App() {
  const [currentUri, setCurrentUri] = useState(() => {
    // Получаем URI из URL при инициализации
    const params = new URLSearchParams(window.location.search);
    return params.get('uri') || 'd:TestApplication';
  });

  const [showTest, setShowTest] = useState(false);

  // Обработчик изменения URL
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const uri = params.get('uri') || 'd:TestApplication';
      setCurrentUri(uri);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (newUri) => {
    setCurrentUri(newUri);

    // Обновляем URL без перезагрузки страницы
    const url = new URL(window.location);
    url.searchParams.set('uri', newUri);
    window.history.pushState({}, '', url);
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1>Тестовое приложение</h1>
        <button
          onClick={() => setShowTest(!showTest)}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          {showTest ? 'Показать просмотр модели' : 'Показать тест FinalizationRegistry'}
        </button>
      </div>
      {showTest ? (
        <ModelTest />
      ) : (
        <ModelViewer uri={currentUri} onNavigate={handleNavigate} />
      )}
    </div>
  );
}

/*function App() {
  return (
    <div style={{ padding: '20px' }}>
      <ModelTest />
    </div>
  );
}*/

// Аутентификация
Backend.authenticate('veda', 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3')
  .then(() => {
    const root = createRoot(document.getElementById('root'));
    root.render(<App />);
  })
  .catch(error => {
    console.error('Ошибка аутентификации:', error);
    document.getElementById('root').innerHTML = `
      <div style="color: red; padding: 20px;">
        Ошибка аутентификации: ${error.message}
      </div>
    `;
  });
