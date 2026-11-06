/* global module, globalThis */
/**
 * 计分规则（scoreRuleVersion = 1）。
 * 修改任何分值或连击节奏时必须提升版本号，避免不同规则的成绩混排。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./game-types.js'));
  } else {
    root.ArrowClear = root.ArrowClear || {};
    Object.assign(root.ArrowClear, factory(root.ArrowClear));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (types) {
  'use strict';

  var RULES = types.SCORE_RULES;

  function arrowScore(streakAfter) {
    var comboBonus = streakAfter > 0 && streakAfter % RULES.comboEvery === 0 ? RULES.comboBonus : 0;
    return {
      base: RULES.scorePerArrow,
      comboBonus: comboBonus,
      total: RULES.scorePerArrow + comboBonus
    };
  }

  function applyArrowScore(score, streakAfter) {
    var result = arrowScore(streakAfter);
    return {
      score: score + result.total,
      gained: result.total,
      comboBonus: result.comboBonus
    };
  }

  function applyClearBonus(score) {
    return {
      score: score + RULES.clearBonus,
      gained: RULES.clearBonus
    };
  }

  function applyBlockPenalty(remainingMs) {
    return Math.max(0, remainingMs - RULES.blockPenaltyMs);
  }

  return {
    version: RULES.version,
    arrowScore: arrowScore,
    applyArrowScore: applyArrowScore,
    applyClearBonus: applyClearBonus,
    applyBlockPenalty: applyBlockPenalty
  };
});
