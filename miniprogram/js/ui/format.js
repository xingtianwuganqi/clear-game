/* global module */
/**
 * 展示层纯函数：时间格式、结算文案、数值缓动。
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pad2(value) {
    var number = Number(value) || 0;
    return number < 10 ? '0' + number : String(number);
  }

  function formatTime(remainingMs) {
    var tenths = Math.ceil(Math.max(0, remainingMs) / 100) / 10;
    return tenths.toFixed(1);
  }

  function easeOutCubic(progress) {
    var p = clamp(progress, 0, 1);
    return 1 - Math.pow(1 - p, 3);
  }

  function easeInOutCubic(progress) {
    var p = clamp(progress, 0, 1);
    return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  }

  function resultTitle(result) {
    if (!result) return '再来一次！';
    if (result.clearedBoards >= 2) return '清屏高手！';
    if (result.clearedBoards === 1) return '清得漂亮！';
    if (result.score >= 300) return '再快一点！';
    return '再来一次！';
  }

  function bestLine(result) {
    if (!result) return '';
    if (result.isNewBest) {
      return '✦ NEW BEST · 历史新纪录 ' + result.score + ' 分';
    }
    if (result.bestScore === 0) {
      return '再来一局，刷新纪录！';
    }
    if (result.distanceToBest === 0) {
      return '追平历史最高 ' + result.bestScore + ' 分';
    }
    return '距离纪录还差 ' + result.distanceToBest + ' 分';
  }

  return {
    clamp: clamp,
    pad2: pad2,
    formatTime: formatTime,
    easeOutCubic: easeOutCubic,
    easeInOutCubic: easeInOutCubic,
    resultTitle: resultTitle,
    bestLine: bestLine
  };
});
