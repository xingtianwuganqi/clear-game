/* global module, globalThis, wx */
/**
 * 单调时钟：优先使用 wx.getPerformance().now()，避免系统时间调整影响倒计时。
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

  var performanceApi = null;
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.getPerformance === 'function') {
      performanceApi = wx.getPerformance();
    }
  } catch (error) {
    performanceApi = null;
  }

  function now() {
    try {
      if (performanceApi && typeof performanceApi.now === 'function') {
        return performanceApi.now();
      }
    } catch (error) {
      /* fall through */
    }
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  return { now: now };
});
