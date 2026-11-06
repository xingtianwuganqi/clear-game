/* global module, globalThis, wx */
/**
 * 轻量本地音效：优先使用 wx.createInnerAudioContext 播放包内 WAV，
 * 不可用时静默失败，不影响游戏。
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

  var enabled = true;
  var initialized = false;
  var contexts = {};

  var KINDS = ['good', 'bad', 'clear', 'hint', 'stage'];

  function setEnabled(value) {
    enabled = value !== false;
  }

  function getEnabled() {
    return enabled;
  }

  function initAudio() {
    if (initialized) return;
    initialized = true;
    try {
      if (typeof wx === 'undefined' || !wx || typeof wx.createInnerAudioContext !== 'function') return;
      KINDS.forEach(function (kind) {
        var audio = wx.createInnerAudioContext();
        audio.src = 'audio/' + kind + '.wav';
        audio.volume = 0.42;
        if ('obeyMuteSwitch' in audio) audio.obeyMuteSwitch = false;
        if (typeof audio.onError === 'function') {
          audio.onError(function () {
            /* 某些基础库/模拟器不支持相对路径音频，静默跳过 */
          });
        }
        contexts[kind] = audio;
      });
    } catch (error) {
      contexts = {};
    }
  }

  function playSound(kind) {
    if (!enabled) return;
    initAudio();
    var audio = contexts[kind];
    if (!audio) return;
    try {
      if (typeof audio.stop === 'function') audio.stop();
      if (typeof audio.seek === 'function') audio.seek(0);
      audio.play();
    } catch (error) {
      /* 静默失败，游戏继续 */
    }
  }

  function vibrateBlocked() {
    try {
      if (typeof wx !== 'undefined' && wx && typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: 'light' });
      }
    } catch (error) {
      /* ignore */
    }
  }

  return {
    setEnabled: setEnabled,
    getEnabled: getEnabled,
    playSound: playSound,
    vibrateBlocked: vibrateBlocked
  };
});
