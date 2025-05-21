import React from 'react';
import { useModel } from './useModel.js';
import Model from '../../../src/Model.js';
function LinkedIndividual({ uri, onNavigate }) {
  const { model, loading } = useModel(uri);

  return (
    <a
      href="#"
      onClick={e => { e.preventDefault(); onNavigate(uri); }}
      style={{ color: '#2196F3', textDecoration: 'none', marginRight: 8 }}
    >
      {loading ? uri : (model?.toLabel() || uri)}
    </a>
  );
}

function PropertyValue({ value, onNavigate }) {
  if (!value) return null;

  // Если значение - это массив, обрабатываем каждый элемент
  if (Array.isArray(value)) {
    return (
      <div>
        {value.map((item, index) => (
          <PropertyValue key={index} value={item} onNavigate={onNavigate} />
        ))}
      </div>
    );
  }

  // Если значение - это объект с data и type
  if (value.data && value.type) {
    // Если это URI, показываем метку индивида
    if (value.type === 'Uri') {
      return <LinkedIndividual uri={value.data} onNavigate={onNavigate} />;
    }
    // Для других типов просто показываем значение
    return <span>{value.data}</span>;
  }

  // Для простых значений
  return <span>{value}</span>;
}

function PropertyLabel({ uri }) {
  const { model, loading } = useModel(uri);

  if (loading) {
    return <span style={{ color: '#999' }}>{uri}</span>;
  }

  return <span>{model?.toLabel() || uri}</span>;
}

export default function ModelViewer({ uri, onNavigate }) {
  const { model, loading } = useModel(uri);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!model) {
    return <div>Модель не найдена</div>;
  }

  const handleSave = async () => {
    const _model = new Model(uri);
    _model.isSync(false);
    await _model.save();
  };

  const handleRemove = async () => {
    const _model = new Model(uri);
    await _model.remove();
  };

  const handleNavigate = (newUri) => {
    if (onNavigate) {
      onNavigate(newUri);
    }
  };

  return (
    <div>
      <h2>Просмотр модели: {model.toLabel() || model.id}</h2>
      <div>
        <h3>Свойства:</h3>
        <div style={{ marginTop: '16px' }}>
          {Object.entries(model.toJSON()).map(([key, value]) => (
            key !== '@' && (
              <div key={key} style={{ marginBottom: '12px' }}>
                <div style={{
                  fontWeight: 'bold',
                  color: '#666',
                  marginBottom: '4px'
                }}>
                  <PropertyLabel uri={key} />:
                </div>
                <PropertyValue value={value} onNavigate={handleNavigate} />
              </div>
            )
          ))}
        </div>
      </div>
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={handleSave}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Сохранить
        </button>
        <button
          onClick={handleRemove}
          style={{
            backgroundColor: '#f44336',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            marginLeft: '8px',
            cursor: 'pointer'
          }}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}