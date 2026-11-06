/* global module, globalThis */
/**
 * 一箭清空 · 核心类型与常量
 * 纯 JavaScript，无任何 wx / DOM 依赖，可在小程序与 Node/浏览器测试中复用。
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

  var DIRECTIONS = Object.freeze({
    up: Object.freeze({ name: 'up', dr: -1, dc: 0, rotation: -90 }),
    right: Object.freeze({ name: 'right', dr: 0, dc: 1, rotation: 0 }),
    down: Object.freeze({ name: 'down', dr: 1, dc: 0, rotation: 90 }),
    left: Object.freeze({ name: 'left', dr: 0, dc: -1, rotation: 180 })
  });

  var DIRECTION_NAMES = Object.freeze(['up', 'right', 'down', 'left']);

  var PHASES = Object.freeze({
    HOME: 'home',
    PLAYING: 'playing',
    PAUSED: 'paused',
    TRANSITION: 'transition',
    RESULT: 'result'
  });

  var RUN_MODES = Object.freeze({
    STANDARD: 'standard',
    ASSISTED: 'assisted'
  });

  var SCORE_RULES = Object.freeze({
    version: 1,
    durationMs: 60000,
    scorePerArrow: 10,
    comboEvery: 5,
    comboBonus: 10,
    clearBonus: 50,
    blockPenaltyMs: 2000
  });

  var ANIMATION = Object.freeze({
    flyOutMs: 200,
    blockedMs: 290,
    hintMs: 1200,
    clearMs: 600,
    toastMs: 1300
  });

  var LEVEL_SIZES = Object.freeze({ 1: 4, 2: 5, default: 6 });

  function sizeForStage(stage) {
    return LEVEL_SIZES[stage] || LEVEL_SIZES.default;
  }

  function isDirection(value) {
    return DIRECTION_NAMES.indexOf(value) !== -1;
  }

  return {
    DIRECTIONS: DIRECTIONS,
    DIRECTION_NAMES: DIRECTION_NAMES,
    PHASES: PHASES,
    RUN_MODES: RUN_MODES,
    SCORE_RULES: SCORE_RULES,
    ANIMATION: ANIMATION,
    sizeForStage: sizeForStage,
    isDirection: isDirection
  };
});
