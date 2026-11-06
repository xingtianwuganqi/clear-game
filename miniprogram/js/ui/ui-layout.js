/* global module */
/**
 * 纯几何布局：棋盘尺寸、游戏页纵向结构、点击命中。
 * 不依赖 wx 或 Canvas，便于单元测试。
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

  function pointInRect(x, y, rect) {
    return !!rect && x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
  }

  function hitTest(hitAreas, x, y) {
    for (var i = hitAreas.length - 1; i >= 0; i -= 1) {
      if (pointInRect(x, y, hitAreas[i])) return hitAreas[i];
    }
    return null;
  }

  /**
   * @param {object} options
   * @param {number} options.size 4/5/6
   * @param {number} options.width 逻辑屏宽
   * @param {number} options.height 逻辑屏高
   * @param {number} options.safeTop
   * @param {number} options.safeBottom
   */
  function computeBoardLayout(options) {
    var size = Number(options.size) || 6;
    var width = Number(options.width) || 375;
    var height = Number(options.height) || 812;
    var safeTop = Number(options.safeTop) || 0;
    var safeBottom = Number(options.safeBottom) || 0;
    var compact = height < 720;

    var side = width < 350 ? 10 : 14;
    var topbarY = safeTop + (compact ? 4 : 8);
    var topbarH = compact ? 38 : 42;

    var labelY = topbarY + topbarH + (compact ? 2 : 8);
    var timeSize = compact ? 46 : 54;
    var timeY = labelY + 14;
    var barY = timeY + timeSize + (compact ? 5 : 8);

    var promptY = barY + 8 + (compact ? 8 : 14);
    var promptH = compact ? 22 : 40;

    var hintH = compact ? 44 : 46;
    var hintY = height - safeBottom - (compact ? 12 : 16) - hintH;
    var scoreH = compact ? 54 : 58;
    var scoreY = hintY - 10 - scoreH;

    var boardTop = promptY + promptH + (compact ? 6 : 10);
    var boardBottom = scoreY - 10;
    var areaH = Math.max(140, boardBottom - boardTop);

    var gap = size >= 6 ? 4 : 5;
    var maxWrapW = Math.min(width - side * 2, 440);
    var maxBoardByWidth = Math.max(120, maxWrapW - 16);
    var maxBoardByHeight = Math.max(120, areaH - 44);
    var maxBoard = Math.min(maxBoardByWidth, maxBoardByHeight);
    var cell = Math.floor((maxBoard - gap * (size - 1)) / size);
    cell = Math.max(26, cell);
    var boardPx = cell * size + gap * (size - 1);
    var wrapPx = boardPx + 16;
    var wrapH = boardPx + 44;
    var wrapX = (width - wrapPx) / 2;
    var wrapY = boardTop + Math.max(0, (areaH - wrapH) / 2);

    return {
      compact: compact,
      side: side,
      topbarY: topbarY,
      topbarH: topbarH,
      labelY: labelY,
      timeY: timeY,
      timeSize: timeSize,
      barY: barY,
      barH: 8,
      promptY: promptY,
      promptH: promptH,
      boardTop: boardTop,
      boardBottom: boardBottom,
      gap: gap,
      cellPx: cell,
      boardPx: boardPx,
      wrapPx: wrapPx,
      wrapH: wrapH,
      wrapX: wrapX,
      wrapY: wrapY,
      scoreY: scoreY,
      scoreH: scoreH,
      hintY: hintY,
      hintH: hintH,
      toastY: height - safeBottom - (compact ? 84 : 94)
    };
  }

  return {
    clamp: clamp,
    pointInRect: pointInRect,
    hitTest: hitTest,
    computeBoardLayout: computeBoardLayout
  };
});
