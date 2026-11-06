/* global module, globalThis, wx */
/**
 * 本地存档：wx.setStorageSync / getStorageSync 包装，异常时自动降级到内存。
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

  var STORAGE_KEY = 'arrow-clear-save-v1';
  var SCHEMA_VERSION = 1;
  var SCORE_RULE_VERSION = 1;

  function defaultSave() {
    return {
      schemaVersion: SCHEMA_VERSION,
      scoreRuleVersion: SCORE_RULE_VERSION,
      bestStandardScore: 0,
      bestStandardStreak: 0,
      bestStandardBoards: 0,
      totalRuns: 0,
      soundEnabled: true
    };
  }

  function nonNegativeInt(value) {
    var number = Number(value);
    if (!isFinite(number) || number < 0) return 0;
    return Math.floor(number);
  }

  function normalizeSave(raw) {
    var value = raw;
    if (typeof value === 'string' && value) {
      try {
        value = JSON.parse(value);
      } catch (error) {
        value = null;
      }
    }
    if (!value || typeof value !== 'object') return defaultSave();

    return {
      schemaVersion: SCHEMA_VERSION,
      scoreRuleVersion: SCORE_RULE_VERSION,
      bestStandardScore: nonNegativeInt(value.bestStandardScore),
      bestStandardStreak: nonNegativeInt(value.bestStandardStreak),
      bestStandardBoards: nonNegativeInt(value.bestStandardBoards),
      totalRuns: nonNegativeInt(value.totalRuns),
      soundEnabled: value.soundEnabled !== false
    };
  }

  function createWxAdapter() {
    return {
      read: function read(key) {
        if (typeof wx === 'undefined' || !wx || typeof wx.getStorageSync !== 'function') {
          throw new Error('wx.getStorageSync 不可用');
        }
        return wx.getStorageSync(key);
      },
      write: function write(key, value) {
        if (typeof wx === 'undefined' || !wx || typeof wx.setStorageSync !== 'function') {
          throw new Error('wx.setStorageSync 不可用');
        }
        wx.setStorageSync(key, value);
      }
    };
  }

  function LocalStorage(options) {
    var opts = options || {};
    this.key = opts.key || STORAGE_KEY;
    this.adapter = opts.adapter || (typeof wx !== 'undefined' ? createWxAdapter() : null);
    this.data = null;
    this.loaded = false;
    this.persisted = false;
    this.lastError = null;
  }

  LocalStorage.prototype.load = function load() {
    if (this.loaded && this.data) return this.data;
    this.loaded = true;
    var raw = null;
    if (this.adapter) {
      try {
        raw = this.adapter.read(this.key);
        this.lastError = null;
      } catch (error) {
        this.lastError = error;
      }
    }
    this.data = normalizeSave(raw);
    return this.data;
  };

  LocalStorage.prototype.save = function save() {
    this.load();
    try {
      if (!this.adapter) throw new Error('没有可用的存储适配器');
      this.adapter.write(this.key, this.data);
      this.persisted = true;
      this.lastError = null;
    } catch (error) {
      this.persisted = false;
      this.lastError = error;
    }
    return this.persisted;
  };

  LocalStorage.prototype.recordStandardRun = function recordStandardRun(result) {
    var data = this.load();
    var previousBest = data.bestStandardScore;
    var score = nonNegativeInt(result && result.score);
    var combo = nonNegativeInt(result && result.bestStreak);
    var boards = nonNegativeInt(result && result.clearedBoards);
    var isStandard = !!result && result.mode === 'standard';
    var isNewBest = isStandard && score > previousBest;

    if (isStandard) {
      data.totalRuns += 1;
      if (isNewBest) data.bestStandardScore = score;
      if (combo > data.bestStandardStreak) data.bestStandardStreak = combo;
      if (boards > data.bestStandardBoards) data.bestStandardBoards = boards;
    }

    var persisted = this.save();
    return {
      isNewBest: isNewBest,
      previousBest: previousBest,
      bestScore: data.bestStandardScore,
      historicBestStreak: data.bestStandardStreak,
      historicBestBoards: data.bestStandardBoards,
      totalRuns: data.totalRuns,
      distanceToBest: Math.max(0, data.bestStandardScore - score),
      persisted: persisted
    };
  };

  LocalStorage.prototype.setSoundEnabled = function setSoundEnabled(enabled) {
    var data = this.load();
    data.soundEnabled = enabled !== false;
    this.save();
    return data.soundEnabled;
  };

  LocalStorage.prototype.getSoundEnabled = function getSoundEnabled() {
    return this.load().soundEnabled;
  };

  LocalStorage.prototype.getSaveData = function getSaveData() {
    return this.load();
  };

  LocalStorage.prototype.reset = function reset() {
    this.data = defaultSave();
    this.loaded = true;
    return this.save();
  };

  return {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    SCORE_RULE_VERSION: SCORE_RULE_VERSION,
    defaultSave: defaultSave,
    normalizeSave: normalizeSave,
    createWxAdapter: createWxAdapter,
    LocalStorage: LocalStorage
  };
});
