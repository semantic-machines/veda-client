import React, { useState } from 'react';
import Model from '../../../src/Model.js';
import Subscription from '../../../src/Subscription.js';

export default function ModelTest() {
  const [logs, setLogs] = useState([]);
  const [testRunning, setTestRunning] = useState(false);

  const addLog = (message) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]}: ${message}`]);
  };

  const runModelTest = async () => {
    setTestRunning(true);
    setLogs([]);
    addLog('Начало теста моделей');

    // Очищаем кэш перед тестом
    Model.cache.clear();
    addLog('Кэш моделей очищен');

    // Создаем изолированную область видимости
    {
      const weakRefs = new Map();
      const modelCount = 10;

      addLog(`Начинаем создание ${modelCount} моделей...`);

      // Создаем модели в отдельных блоках
      for (let i = 0; i < modelCount; i++) {
        {
          const model = new Model(`test:Model${i}`);
          model.subscribe();
          weakRefs.set(model.id, new WeakRef(model));
        }

        if (i % 10 === 0) {
          addLog(`Создано ${i} моделей...`);
        }
      }

      addLog(`Создано ${modelCount} моделей и подписок`);
      addLog('Текущее количество подписок: ' + Subscription._getSubscriptionCount());
      addLog('Размер кэша моделей: ' + Model.cache._getSize());

      setTimeout(() => {
        addLog('Очищаем ссылки на модели');
        addLog('Ссылки очищены, ждем автоматической сборки мусора...');
        addLog('Размер кэша моделей: ' + Model.cache._getSize());

        // Проверяем доступность моделей через WeakRef
        let availableCount = 0;
        for (const [id, weakRef] of weakRefs) {
          if (weakRef.deref() !== undefined) {
            availableCount++;
          }
        }
        addLog(`Доступно моделей через WeakRef: ${availableCount}`);

        // Запускаем сборку мусора
        setTimeout(() => {
          addLog('Запускаем сборку мусора');
          if (globalThis.gc) {
            globalThis.gc();
            addLog('Сборка мусора запущена');
          } else {
            addLog('Сборка мусора недоступна (запустите Chrome с флагом --js-flags="--expose-gc")');
          }

          // Даем время на сборку мусора
          setTimeout(() => {
            addLog('Размер кэша моделей после GC: ' + Model.cache._getSize());

            // Проверяем доступность моделей после GC
            availableCount = 0;
            for (const [id, weakRef] of weakRefs) {
              if (weakRef.deref() !== undefined) {
                availableCount++;
              }
            }
            addLog(`Доступно моделей после GC: ${availableCount}`);

            // Проверяем, что модели удалены из кэша
            let cachedCount = 0;
            for (let i = 0; i < modelCount; i++) {
              const id = `test:Model${i}`;
              if (Model.cache.get(id)) {
                cachedCount++;
              }
            }
            addLog(`Моделей в кэше после GC: ${cachedCount}`);
          }, 1000);
        }, 1000);
      }, 1000);
    }

    setTestRunning(false);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Тест моделей</h2>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={runModelTest}
          disabled={testRunning}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: testRunning ? 'not-allowed' : 'pointer',
            opacity: testRunning ? 0.7 : 1
          }}
        >
          {testRunning ? 'Тест выполняется...' : 'Запустить тест'}
        </button>
      </div>
      <div style={{
        backgroundColor: '#f5f5f5',
        padding: '10px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
      <div style={{ marginTop: '20px', color: '#666' }}>
        <h3>Инструкция:</h3>
        <ol>
          <li>Запустите Chrome с флагом <code>--js-flags="--expose-gc"</code></li>
          <li>Нажмите кнопку "Запустить тест"</li>
          <li>Следите за логами в консоли и на странице</li>
        </ol>
      </div>
    </div>
  );
}