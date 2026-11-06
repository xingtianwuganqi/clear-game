/* global module, globalThis, wx */
/**
 * 响应式布局计算：状态栏、胶囊按钮避让、棋盘格尺寸。
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

  function getWindowInfo() {
    try {
      if (typeof wx !== 'undefined' && wx) {
        if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo();
        if (typeof wx.getSystemInfoSync === 'function') return wx.getSystemInfoSync();
      }
    } catch (error) {
      /* use fallback */
    }
    return { windowWidth: 375, windowHeight: 667, statusBarHeight: 20, safeArea: null };
  }

  function getMenuRect() {
    try {
      if (typeof wx !== 'undefined' && wx && typeof wx.getMenuButtonBoundingClientRect === 'function') {
        var rect = wx.getMenuButtonBoundingClientRect();
        if (rect && rect.left) return rect;
      }
    } catch (error) {
      /* ignore */
    }
    return null;
  }

  function getLayoutMetrics() {
    var info = getWindowInfo();
    var menu = getMenuRect();
    var width = Number(info.windowWidth) || 375;
    var height = Number(info.windowHeight) || 667;
    var statusBarHeight = Number(info.statusBarHeight) || 20;
    var capsuleInset = menu ? Math.max(12, Math.round(width - menu.left + 8)) : 12;
    var safeTop = info.safeArea && typeof info.safeArea.top === 'number'
      ? Math.max(statusBarHeight, info.safeArea.top)
      : statusBarHeight;
    var safeBottom = 0;
    if (info.safeArea && typeof info.safeArea.bottom === 'number') {
      safeBottom = Math.max(0, height - info.safeArea.bottom);
    }
    return {
      windowWidth: width,
      windowHeight: height,
      pixelRatio: Number(info.pixelRatio) || 1,
      statusBarHeight: statusBarHeight,
      safeTop: safeTop,
      navTop: statusBarHeight + 6,
      capsuleInset: capsuleInset,
      safeBottom: safeBottom
    };
  }

  function getBoardMetrics(size, layout) {
    var metrics = layout || getLayoutMetrics();
    var width = Number(metrics.windowWidth) || 375;
    var n = Math.max(4, Math.min(6, Number(size) || 6));
    var gap = n >= 6 ? 4 : 5;
    var pagePadding = 24;
    var panelPadding = 16;
    var maxBoard = Math.min(width - pagePadding - panelPadding, 420);
    var cell = Math.floor((maxBoard - gap * (n - 1)) / n);
    cell = Math.max(28, cell);
    var boardPx = cell * n + gap * (n - 1);
    return {
      size: n,
      gap: gap,
      cellPx: cell,
      boardPx: boardPx,
      wrapPx: boardPx + panelPadding
    };
  }

  return {
    getWindowInfo: getWindowInfo,
    getLayoutMetrics: getLayoutMetrics,
    getBoardMetrics: getBoardMetrics
  };
});
