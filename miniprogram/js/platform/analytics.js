/* global module, globalThis */
/**
 * 本地调试埋点：MVP 不上报服务器。未来接入真实统计时替换这里。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ArrowClear = root.ArrowClear || {};
    Object.assign(root.ArrowClear, factory());
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var events = [];
  var MAX_EVENTS = 100;

  function track(name, payload) {
    var event = {
      name: name,
      payload: payload || null,
      at: Date.now()
    };
    events.push(event);
    if (events.length > MAX_EVENTS) events.shift();
    try {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[arrow-clear]', name, event.payload || '');
      }
    } catch (error) {
      /* ignore */
    }
    return event;
  }

  function getEvents() {
    return events.slice();
  }

  function clear() {
    events = [];
  }

  return {
    track: track,
    getEvents: getEvents,
    clear: clear
  };
});
