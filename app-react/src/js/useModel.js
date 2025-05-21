import { useState, useEffect } from 'react';
import Model from '../../../src/Model.js';

export const useModel = (id, subscribe = true) => {
  const [, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const model = new Model(id);

  useEffect(() => {
    let mounted = true;

    const handleModified = () => {
      if (mounted) {
        setVersion(v => v + 1);
      }
    };

    model.on('modified', handleModified);

    const setupModel = async () => {
      try {
        await model.load();
        if (mounted) {
          if (subscribe) {
            model.subscribe();
          }
        }
      } catch (err) {
        console.error('Error setting up model:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    setupModel();

    return () => {
      mounted = false;
      model.off('modified', handleModified);
    };
  }, [id, subscribe, model]);

  return { model, loading };
};