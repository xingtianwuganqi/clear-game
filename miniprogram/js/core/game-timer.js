/* global module, globalThis */
/**
 * 基于单调时间差的计时器。
 * 不使用“每秒减一”的定时器，低帧率或后台冻结都不会造成时间误差。
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

  function RunTimer(durationMs) {
    this.durationMs = Math.max(1, Number(durationMs) || 0);
    this.remainingMs = this.durationMs;
    this.elapsedMs = 0;
    this.running = false;
    this.lastAt = 0;
  }

  RunTimer.prototype.start = function start(now) {
    this.remainingMs = this.durationMs;
    this.elapsedMs = 0;
    this.running = true;
    this.lastAt = Number(now) || 0;
    return this.remainingMs;
  };

  RunTimer.prototype.update = function update(now) {
    if (!this.running) return this.remainingMs;
    var time = Number(now) || 0;
    var delta = time - this.lastAt;
    if (delta < 0) {
      // 单调时钟不应回拨；若平台异常回拨，不把 lastAt 一起回拨，避免下一次多扣时间。
      delta = 0;
    } else {
      this.lastAt = time;
    }
    var applied = Math.min(delta, this.remainingMs);
    this.remainingMs = Math.max(0, this.remainingMs - delta);
    this.elapsedMs += applied;
    if (this.remainingMs <= 0) this.running = false;
    return this.remainingMs;
  };

  RunTimer.prototype.pause = function pause(now) {
    this.update(now);
    this.running = false;
    return this.remainingMs;
  };

  RunTimer.prototype.resume = function resume(now) {
    if (this.remainingMs > 0) {
      this.running = true;
      this.lastAt = Number(now) || 0;
    }
    return this.remainingMs;
  };

  RunTimer.prototype.stop = function stop(now) {
    this.update(now);
    this.running = false;
    return this.remainingMs;
  };

  RunTimer.prototype.subtract = function subtract(ms) {
    var amount = Math.max(0, Number(ms) || 0);
    this.remainingMs = Math.max(0, this.remainingMs - amount);
    if (this.remainingMs <= 0) this.running = false;
    return this.remainingMs;
  };

  RunTimer.prototype.isExpired = function isExpired() {
    return this.remainingMs <= 0;
  };

  return { RunTimer: RunTimer };
});
