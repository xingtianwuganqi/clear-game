/* global module, globalThis */
/**
 * 关卡生成器：从中心向外反向构造，保证每个新放置的箭头在放入时都能飞出。
 * 使用显式 seed + mulberry32，保证同一 seed 可复现。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./game-types.js'),
      require('./arrow-collision.js')
    );
  } else {
    root.ArrowClear = root.ArrowClear || {};
    Object.assign(root.ArrowClear, factory(root.ArrowClear, root.ArrowClear));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (types, collision) {
  'use strict';

  var DIRECTIONS = types.DIRECTIONS;
  var DIRECTION_NAMES = types.DIRECTION_NAMES;
  var sizeForStage = types.sizeForStage;
  var canDirectionEscape = collision.canDirectionEscape;

  function normalizeSeed(seed) {
    if (typeof seed === 'string' && seed.length) {
      var hash = 2166136261;
      for (var i = 0; i < seed.length; i += 1) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    }
    var numeric = Number(seed);
    if (!isFinite(numeric)) return 1;
    return (numeric >>> 0) || 1;
  }

  function deriveSeed(seed, salt) {
    var value = normalizeSeed(seed);
    var mixed = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
    mixed ^= Math.imul((salt || 0) + 0x165667b1, 0xc2b2ae35);
    mixed ^= mixed >>> 13;
    return (mixed >>> 0) || 1;
  }

  /** mulberry32：小、快、可复现。 */
  function createRandom(seed) {
    var state = normalizeSeed(seed);
    return function random() {
      state = (state + 0x6d2b79f5) >>> 0;
      var t = Math.imul(state ^ (state >>> 15), 1 | state);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomSeed() {
    return ((Math.random() * 4294967296) >>> 0) || 1;
  }

  function createEmptyBoard(size) {
    var board = [];
    for (var r = 0; r < size; r += 1) {
      var row = [];
      for (var c = 0; c < size; c += 1) row.push(null);
      board.push(row);
    }
    return board;
  }

  function solveBoard(board) {
    var working = [];
    var size = board.length;
    for (var r = 0; r < size; r += 1) {
      var row = [];
      for (var c = 0; c < size; c += 1) {
        var arrow = board[r][c];
        row.push(arrow ? { id: arrow.id, row: arrow.row, col: arrow.col, dir: arrow.dir } : null);
      }
      working.push(row);
    }

    var order = [];
    var total = size * size;
    while (order.length < total) {
      var found = null;
      for (var rr = 0; rr < size && !found; rr += 1) {
        for (var cc = 0; cc < size; cc += 1) {
          var current = working[rr][cc];
          if (current && canDirectionEscape(working, rr, cc, current.dir)) {
            found = current;
            break;
          }
        }
      }
      if (!found) return null;
      working[found.row][found.col] = null;
      order.push(found);
    }
    return order;
  }

  function verifySolvable(board) {
    return solveBoard(board) !== null;
  }

  function buildWithSeed(size, seed) {
    var random = createRandom(seed);
    var coords = [];
    for (var r = 0; r < size; r += 1) {
      for (var c = 0; c < size; c += 1) {
        coords.push({
          row: r,
          col: c,
          ring: Math.min(r, c, size - 1 - r, size - 1 - c),
          tie: random(),
          order: r * size + c
        });
      }
    }

    coords.sort(function (a, b) {
      if (a.ring !== b.ring) return b.ring - a.ring;
      if (a.tie !== b.tie) return a.tie - b.tie;
      return a.order - b.order;
    });

    var board = createEmptyBoard(size);
    var arrows = [];

    for (var i = 0; i < coords.length; i += 1) {
      var cell = coords[i];
      var candidates = [];
      for (var d = 0; d < DIRECTION_NAMES.length; d += 1) {
        var name = DIRECTION_NAMES[d];
        if (canDirectionEscape(board, cell.row, cell.col, name)) candidates.push(name);
      }
      if (!candidates.length) {
        throw new Error('关卡生成失败：位置 (' + cell.row + ',' + cell.col + ') 没有合法方向');
      }
      var direction = candidates[Math.floor(random() * candidates.length)];
      var arrow = {
        id: cell.row + '-' + cell.col,
        row: cell.row,
        col: cell.col,
        dir: DIRECTIONS[direction].name
      };
      board[cell.row][cell.col] = arrow;
      arrows.push(arrow);
    }

    return { board: board, arrows: arrows, seed: seed };
  }

  /**
   * @param {number} stage 关卡序号，从 1 开始
   * @param {number|string} seed 显式种子
   */
  function generateLevel(stage, seed) {
    var stageNumber = Math.max(1, Math.floor(Number(stage) || 1));
    var size = sizeForStage(stageNumber);
    var initialSeed = normalizeSeed(seed === undefined ? randomSeed() : seed);
    var lastError = null;

    for (var attempt = 0; attempt < 4; attempt += 1) {
      var attemptSeed = attempt === 0 ? initialSeed : deriveSeed(initialSeed, attempt * 7919 + 17);
      try {
        var built = buildWithSeed(size, attemptSeed);
        if (!verifySolvable(built.board)) {
          throw new Error('关卡生成失败：可解性校验未通过');
        }
        return {
          id: 'stage-' + stageNumber + '-' + attemptSeed,
          stage: stageNumber,
          seed: attemptSeed,
          size: size,
          board: built.board,
          arrows: built.arrows,
          generationVersion: 1
        };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('关卡生成失败');
  }

  return {
    normalizeSeed: normalizeSeed,
    deriveSeed: deriveSeed,
    createRandom: createRandom,
    randomSeed: randomSeed,
    createEmptyBoard: createEmptyBoard,
    solveBoard: solveBoard,
    verifySolvable: verifySolvable,
    generateLevel: generateLevel
  };
});
