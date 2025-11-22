import Emitter from '../src/Emitter.js';

export default ({test, assert}) => {
  // ==================== BASIC EMITTER FUNCTIONALITY ====================

  test('Emitter - basic on/emit', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let called = false;
    let receivedValue = null;

    emitter.on('test', (value) => {
      called = true;
      receivedValue = value;
    });

    emitter.emit('test', 42);

    assert.ok(called, 'Event handler should be called');
    assert.equal(receivedValue, 42, 'Event handler should receive the value');
  });

  test('Emitter - multiple handlers for same event', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let call1 = false;
    let call2 = false;

    emitter.on('test', () => { call1 = true; });
    emitter.on('test', () => { call2 = true; });

    emitter.emit('test');

    assert.ok(call1, 'First handler should be called');
    assert.ok(call2, 'Second handler should be called');
  });

  test('Emitter - multiple events on single on() call', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let event1Called = false;
    let event2Called = false;
    let event1Value = null;
    let event2Value = null;

    // handler receives event name as first arg, value as second
    emitter.on('event1 event2', function(eventName, value) {
      if (eventName === 'event1') {
        event1Called = true;
        event1Value = value;
      }
      if (eventName === 'event2') {
        event2Called = true;
        event2Value = value;
      }
    });

    emitter.emit('event1', 'value1');
    emitter.emit('event2', 'value2');

    assert.ok(event1Called, 'Event1 handler should be called');
    assert.ok(event2Called, 'Event2 handler should be called');
    assert.equal(event1Value, 'value1', 'Event1 should receive its value');
    assert.equal(event2Value, 'value2', 'Event2 should receive its value');
  });

  test('Emitter - off() with specific function', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let call1 = false;
    let call2 = false;

    const fn1 = () => { call1 = true; };
    const fn2 = () => { call2 = true; };

    emitter.on('test', fn1);
    emitter.on('test', fn2);

    emitter.off('test', fn1);
    emitter.emit('test');

    assert.ok(!call1, 'Removed handler should not be called');
    assert.ok(call2, 'Other handler should still be called');
  });

  test('Emitter - off() without function removes all handlers', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let called = false;

    emitter.on('test', () => { called = true; });
    emitter.off('test');
    emitter.emit('test');

    assert.ok(!called, 'All handlers should be removed');
  });

  test('Emitter - off("*") removes all events', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let call1 = false;
    let call2 = false;

    emitter.on('event1', () => { call1 = true; });
    emitter.on('event2', () => { call2 = true; });

    emitter.off('*');

    emitter.emit('event1');
    emitter.emit('event2');

    assert.ok(!call1, 'Event1 handler should be removed');
    assert.ok(!call2, 'Event2 handler should be removed');
  });

  test('Emitter - one() handler is called once', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let callCount = 0;

    emitter.one('test', () => { callCount++; });

    emitter.emit('test');
    emitter.emit('test');
    emitter.emit('test');

    assert.equal(callCount, 1, 'Handler should be called only once');
  });

  test('Emitter - once() is alias for one()', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let callCount = 0;

    emitter.once('test', () => { callCount++; });

    emitter.emit('test');
    emitter.emit('test');

    assert.equal(callCount, 1, 'once() should work like one()');
  });

  test('Emitter - trigger() is alias for emit()', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let called = false;

    emitter.on('test', () => { called = true; });
    emitter.trigger('test');

    assert.ok(called, 'trigger() should work like emit()');
  });

  test('Emitter - on() returns this for chaining', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let call1 = false;
    let call2 = false;

    emitter
      .on('event1', () => { call1 = true; })
      .on('event2', () => { call2 = true; });

    emitter.emit('event1');
    emitter.emit('event2');

    assert.ok(call1, 'First chained handler should work');
    assert.ok(call2, 'Second chained handler should work');
  });

  test('Emitter - off() returns this for chaining', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let called = false;

    const fn = () => { called = true; };

    emitter
      .on('test', fn)
      .off('test', fn);

    emitter.emit('test');

    assert.ok(!called, 'Handler should be removed via chaining');
  });

  test('Emitter - extends custom class', () => {
    class MyClass {
      constructor(value) {
        this.value = value;
      }
      getValue() {
        return this.value;
      }
    }

    const EmitterClass = Emitter(MyClass);
    const emitter = new EmitterClass(42);

    assert.equal(emitter.getValue(), 42, 'Should preserve base class functionality');

    let eventCalled = false;
    emitter.on('test', () => { eventCalled = true; });
    emitter.emit('test');

    assert.ok(eventCalled, 'Should have emitter functionality');
  });

  test('Emitter - typed event (event name passed to handler)', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let receivedName = null;
    let receivedValue = null;

    // Multiple events in one on() call - second handler is "typed"
    emitter.on('event1 event2', function(nameOrValue, value) {
      if (value !== undefined) {
        // Typed handler (event name is first arg)
        receivedName = nameOrValue;
        receivedValue = value;
      }
    });

    emitter.emit('event2', 'testValue');

    assert.equal(receivedName, 'event2', 'Typed handler should receive event name');
    assert.equal(receivedValue, 'testValue', 'Typed handler should receive value');
  });

  test('Emitter - emit with multiple arguments', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let arg1, arg2, arg3;

    emitter.on('test', (a, b, c) => {
      arg1 = a;
      arg2 = b;
      arg3 = c;
    });

    emitter.emit('test', 'first', 'second', 'third');

    assert.equal(arg1, 'first', 'Should receive first argument');
    assert.equal(arg2, 'second', 'Should receive second argument');
    assert.equal(arg3, 'third', 'Should receive third argument');
  });

  test('Emitter - handler context is emitter instance', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();
    emitter.testValue = 'test';

    let receivedContext = null;

    emitter.on('test', function() {
      receivedContext = this;
    });

    emitter.emit('test');

    assert.equal(receivedContext, emitter, 'Handler context should be emitter instance');
    assert.equal(receivedContext.testValue, 'test', 'Should access emitter properties via this');
  });

  test('Emitter - emit non-existent event does not throw', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let errorThrown = false;
    try {
      emitter.emit('nonExistent');
    } catch (e) {
      errorThrown = true;
    }

    assert.ok(!errorThrown, 'Emitting non-existent event should not throw');
  });

  test('Emitter - off on non-existent event does not throw', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let errorThrown = false;
    try {
      emitter.off('nonExistent');
    } catch (e) {
      errorThrown = true;
    }

    assert.ok(!errorThrown, 'Removing handlers for non-existent event should not throw');
  });

  test('Emitter - one() with multiple events', () => {
    const EmitterClass = Emitter();
    const emitter = new EmitterClass();

    let event1Count = 0;
    let event2Count = 0;

    // Multiple events handler receives (eventName, value)
    emitter.one('event1 event2', (eventName, value) => {
      if (eventName === 'event1') event1Count++;
      if (eventName === 'event2') event2Count++;
    });

    // Emit each event twice
    emitter.emit('event1', 1);
    emitter.emit('event1', 1);
    emitter.emit('event2', 2);
    emitter.emit('event2', 2);

    // Should be called once per event
    assert.equal(event1Count, 1, 'Event1 handler should be called once');
    assert.equal(event2Count, 1, 'Event2 handler should be called once');
  });
};

