/* global module, globalThis */
/**
 * 分享文案与页面路径。分享是自愿行为，不与奖励绑定。
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

  function buildShareText(result) {
    var score = result && result.score ? result.score : 0;
    var boards = result && result.clearedBoards ? result.clearedBoards : 0;
    return '我在《一箭清空》60 秒挑战拿下 ' + score + ' 分，清空 ' + boards + ' 盘！来挑战我的纪录！';
  }

  function buildSharePayload(result) {
    return {
      title: buildShareText(result),
      path: '/pages/home/home'
    };
  }

  return {
    buildShareText: buildShareText,
    buildSharePayload: buildSharePayload
  };
});
