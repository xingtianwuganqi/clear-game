/* global module */
/**
 * 深夜电光 / 清爽街机主题。
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

  var COLORS = {
    bg: '#10172C',
    bgDeep: '#0A1123',
    panel: '#1B2943',
    panel2: '#182743',
    tile: '#243856',
    tileHover: '#2C4569',
    lime: '#BAF46C',
    limeBright: '#C8FA7A',
    limeDeep: '#A9E85A',
    sky: '#7DC8FF',
    coral: '#FF826E',
    text: '#F4F7FB',
    muted: '#A7B6CE',
    dim: '#8298B6',
    faint: '#788BA8',
    blueLight: '#D6E8FF',
    blueSoft: '#9BBCF7',
    darkInk: '#13213B',
    border: 'rgba(177,199,229,0.14)',
    borderStrong: 'rgba(193,223,255,0.17)',
    tileBorder: 'rgba(205,228,255,0.07)',
    overlay: 'rgba(8,13,27,0.82)',
    limeSoft: 'rgba(186,244,108,0.12)',
    coralSoft: 'rgba(255,130,110,0.2)',
    emptyTile: 'rgba(18,29,49,0.25)'
  };

  var FONT = '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';

  var TONES = ['#7DC8FF', '#D6E8FF', '#9BBCF7'];

  function font(size, weight) {
    return (weight || 400) + ' ' + size + 'px ' + FONT;
  }

  function toneFor(row, col) {
    return TONES[(row * 3 + col) % TONES.length];
  }

  return {
    COLORS: COLORS,
    FONT: FONT,
    TONES: TONES,
    font: font,
    toneFor: toneFor
  };
});
