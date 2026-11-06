/* global module, globalThis */
/**
 * 游戏状态机：输入锁、射线判定、计分、清屏过场、暂停、时间结束。
 * 纯逻辑层，不依赖 wx 或任何 UI API；所有时间均通过参数显式传入，便于测试。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./game-types.js'),
      require('./arrow-collision.js'),
      require('./score-policy.js'),
      require('./level-generator.js'),
      require('./game-timer.js')
    );
  } else {
    root.ArrowClear = root.ArrowClear || {};
    Object.assign(root.ArrowClear, factory(
      root.ArrowClear,
      root.ArrowClear,
      root.ArrowClear,
      root.ArrowClear,
      root.ArrowClear
    ));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (types, collision, scorePolicy, levelGenerator, timerModule) {
  'use strict';

  var PHASES = types.PHASES;
  var RUN_MODES = types.RUN_MODES;
  var RULES = types.SCORE_RULES;
  var ANIMATION = types.ANIMATION;
  var canEscape = collision.canEscape;
  var countArrows = collision.countArrows;
  var findEscapableArrows = collision.findEscapableArrows;

  var RunTimer = timerModule.RunTimer;
  var generateLevel = levelGenerator.generateLevel;
  var deriveSeed = levelGenerator.deriveSeed;
  var normalizeSeed = levelGenerator.normalizeSeed;
  var randomSeed = levelGenerator.randomSeed;

  function toNow(now) {
    if (now === undefined || now === null || isNaN(Number(now))) return Date.now();
    return Number(now);
  }

  function GameEngine(options) {
    var opts = options || {};
    this.durationMs = Math.max(1000, Number(opts.durationMs) || RULES.durationMs);
    this.generator = opts.generator || generateLevel;
    this.randomSeed = opts.randomSeed || randomSeed;
    this.state = null;
    this.timer = null;
    this._runSeed = 0;
  }

  GameEngine.prototype.start = function start(now, seed) {
    var time = toNow(now);
    var useSeed = normalizeSeed(seed === undefined ? this.randomSeed() : seed);
    var level = this.generator(1, deriveSeed(useSeed, 1));
    var timer = new RunTimer(this.durationMs);
    timer.start(time);

    this._runSeed = useSeed;
    this.timer = timer;
    this.state = {
      phase: PHASES.PLAYING,
      mode: RUN_MODES.STANDARD,
      stage: 1,
      board: level.board,
      stageSeed: level.seed,
      seed: useSeed,
      score: 0,
      removedCount: 0,
      clearedBoards: 0,
      streak: 0,
      bestStreak: 0,
      blockedTaps: 0,
      hintRemaining: 1,
      inputLocked: false,
      lockUntil: 0,
      transitionUntil: 0,
      resumePhase: null,
      pauseStartedAt: 0,
      remainingMs: timer.remainingMs,
      startedAt: time,
      finishedAt: 0
    };

    return { type: 'started', state: this.state };
  };

  GameEngine.prototype._makeLevel = function _makeLevel(stage) {
    var level = this.generator(stage, deriveSeed(this._runSeed, stage));
    return level;
  };

  GameEngine.prototype._syncRemaining = function _syncRemaining() {
    if (this.state && this.timer) this.state.remainingMs = this.timer.remainingMs;
  };

  GameEngine.prototype._finish = function _finish(now) {
    var state = this.state;
    if (!state || state.phase === PHASES.RESULT) return { type: 'idle' };
    this.timer.stop(now);
    this._syncRemaining();
    state.phase = PHASES.RESULT;
    state.finishedAt = toNow(now);
    state.inputLocked = true;
    return { type: 'finished', result: this.getResult(), state: state };
  };

  GameEngine.prototype.tick = function tick(now) {
    var time = toNow(now);
    var state = this.state;
    if (!state || state.phase === PHASES.RESULT || state.phase === PHASES.HOME || state.phase === PHASES.PAUSED) {
      return { type: 'idle' };
    }
    if (state.phase !== PHASES.PLAYING && state.phase !== PHASES.TRANSITION) {
      return { type: 'idle' };
    }

    this.timer.update(time);
    this._syncRemaining();

    if (this.timer.isExpired()) {
      return this._finish(time);
    }

    if (state.inputLocked && time >= state.lockUntil) {
      state.inputLocked = false;
      state.lockUntil = 0;
    }

    if (state.phase === PHASES.TRANSITION && time >= state.transitionUntil) {
      var level = this._makeLevel(state.stage);
      state.board = level.board;
      state.stageSeed = level.seed;
      state.phase = PHASES.PLAYING;
      state.inputLocked = false;
      state.lockUntil = 0;
      state.transitionUntil = 0;
      return {
        type: 'stage',
        stage: state.stage,
        board: state.board,
        remainingMs: state.remainingMs,
        state: state
      };
    }

    return {
      type: 'tick',
      remainingMs: state.remainingMs,
      inputLocked: state.inputLocked,
      state: state
    };
  };

  GameEngine.prototype.tap = function tap(row, col, now) {
    var time = toNow(now);
    var state = this.state;
    if (!state || state.phase !== PHASES.PLAYING) {
      return { type: 'ignored', reason: 'phase' };
    }

    var tickResult = this.tick(time);
    if (tickResult.type === 'finished') return tickResult;
    if (state.inputLocked) return { type: 'ignored', reason: 'locked' };

    var arrow = state.board[row] && state.board[row][col];
    if (!arrow) return { type: 'ignored', reason: 'empty' };

    if (!canEscape(state.board, row, col)) {
      state.blockedTaps += 1;
      state.streak = 0;
      this.timer.subtract(RULES.blockPenaltyMs);
      this._syncRemaining();
      state.inputLocked = true;
      state.lockUntil = time + ANIMATION.blockedMs;

      if (this.timer.isExpired()) {
        var blockedFinish = this._finish(time);
        blockedFinish.blocked = true;
        blockedFinish.row = row;
        blockedFinish.col = col;
        blockedFinish.arrow = arrow;
        blockedFinish.penaltyMs = RULES.blockPenaltyMs;
        return blockedFinish;
      }

      return {
        type: 'blocked',
        row: row,
        col: col,
        arrow: arrow,
        penaltyMs: RULES.blockPenaltyMs,
        remainingMs: state.remainingMs,
        state: state
      };
    }

    var streak = state.streak + 1;
    var scored = scorePolicy.applyArrowScore(state.score, streak);
    state.streak = streak;
    state.bestStreak = Math.max(state.bestStreak, streak);
    state.score = scored.score;
    state.removedCount += 1;
    state.board[row][col] = null;

    var cleared = false;
    var clearBonus = 0;

    if (countArrows(state.board) === 0) {
      var clearedScore = scorePolicy.applyClearBonus(state.score);
      state.score = clearedScore.score;
      clearBonus = clearedScore.gained;
      state.clearedBoards += 1;
      state.stage += 1;
      state.phase = PHASES.TRANSITION;
      state.transitionUntil = time + ANIMATION.clearMs;
      state.inputLocked = false;
      state.lockUntil = 0;
      cleared = true;
    } else {
      state.inputLocked = true;
      state.lockUntil = time + ANIMATION.flyOutMs;
    }

    this._syncRemaining();

    return {
      type: cleared ? 'cleared' : 'escaped',
      row: row,
      col: col,
      arrow: arrow,
      gained: scored.gained,
      comboBonus: scored.comboBonus,
      clearBonus: clearBonus,
      score: state.score,
      cleared: cleared,
      stage: state.stage,
      remainingMs: state.remainingMs,
      state: state
    };
  };

  GameEngine.prototype.useHint = function useHint(now) {
    var time = toNow(now);
    var state = this.state;
    if (!state || state.phase !== PHASES.PLAYING) {
      return { type: 'ignored', reason: 'phase' };
    }
    var tickResult = this.tick(time);
    if (tickResult.type === 'finished') return tickResult;
    if (state.inputLocked) return { type: 'ignored', reason: 'locked' };
    if (state.hintRemaining <= 0) return { type: 'ignored', reason: 'no-hints' };

    var options = findEscapableArrows(state.board);
    if (!options.length) return { type: 'ignored', reason: 'no-moves' };

    state.hintRemaining -= 1;
    return {
      type: 'hint',
      arrow: options[0],
      hintRemaining: state.hintRemaining,
      state: state
    };
  };

  GameEngine.prototype.pause = function pause(now) {
    var time = toNow(now);
    var state = this.state;
    if (!state || (state.phase !== PHASES.PLAYING && state.phase !== PHASES.TRANSITION)) {
      return { type: 'ignored', reason: 'phase' };
    }

    this.timer.update(time);
    this._syncRemaining();
    if (this.timer.isExpired()) return this._finish(time);

    var resumePhase = state.phase;
    this.timer.pause(time);
    state.phase = PHASES.PAUSED;
    state.resumePhase = resumePhase;
    state.pauseStartedAt = time;
    return { type: 'paused', state: state };
  };

  GameEngine.prototype.resume = function resume(now) {
    var time = toNow(now);
    var state = this.state;
    if (!state || state.phase !== PHASES.PAUSED) {
      return { type: 'ignored', reason: 'phase' };
    }

    var pausedFor = Math.max(0, time - (state.pauseStartedAt || time));
    if (state.lockUntil > 0) state.lockUntil += pausedFor;
    if (state.transitionUntil > 0) state.transitionUntil += pausedFor;

    state.phase = state.resumePhase || PHASES.PLAYING;
    state.resumePhase = null;
    state.pauseStartedAt = 0;
    this.timer.resume(time);
    this._syncRemaining();
    return { type: 'resumed', state: state };
  };

  GameEngine.prototype.abandon = function abandon() {
    if (this.timer) this.timer.running = false;
    if (this.state) this.state.phase = PHASES.HOME;
    this.state = null;
    this.timer = null;
    return { type: 'abandoned' };
  };

  GameEngine.prototype.getResult = function getResult() {
    var state = this.state;
    if (!state) return null;
    return {
      mode: state.mode,
      score: state.score,
      removedCount: state.removedCount,
      clearedBoards: state.clearedBoards,
      bestStreak: state.bestStreak,
      blockedTaps: state.blockedTaps,
      stage: state.stage,
      remainingMs: state.remainingMs,
      durationMs: this.durationMs,
      scoreRuleVersion: RULES.version,
      generationVersion: 1,
      seed: state.seed
    };
  };

  GameEngine.prototype.getRemainingArrows = function getRemainingArrows() {
    return this.state ? countArrows(this.state.board) : 0;
  };

  return { GameEngine: GameEngine };
});
