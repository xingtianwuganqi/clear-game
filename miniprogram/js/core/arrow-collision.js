/* global module, globalThis */
/**
 * 箭头射线碰撞检测。
 * 规则：只检查当前棋盘网格中、沿箭头方向到边缘的直线上是否有其他箭头。
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

  var DIRECTIONS = types.DIRECTIONS;

  function isInside(size, row, col) {
    return row >= 0 && col >= 0 && row < size && col < size;
  }

  function canDirectionEscape(board, row, col, directionName) {
    var direction = DIRECTIONS[directionName];
    if (!board || !board.length || !direction || !isInside(board.length, row, col)) {
      return false;
    }
    var r = row + direction.dr;
    var c = col + direction.dc;
    while (isInside(board.length, r, c)) {
      if (board[r][c]) return false;
      r += direction.dr;
      c += direction.dc;
    }
    return true;
  }

  function canEscape(board, row, col) {
    if (!board || !board.length) return false;
    var arrow = board[row] && board[row][col];
    if (!arrow) return false;
    return canDirectionEscape(board, row, col, arrow.dir);
  }

  function countArrows(board) {
    if (!board || !board.length) return 0;
    var total = 0;
    for (var r = 0; r < board.length; r += 1) {
      for (var c = 0; c < board.length; c += 1) {
        if (board[r][c]) total += 1;
      }
    }
    return total;
  }

  function findEscapableArrows(board) {
    var result = [];
    if (!board || !board.length) return result;
    for (var r = 0; r < board.length; r += 1) {
      for (var c = 0; c < board.length; c += 1) {
        var arrow = board[r][c];
        if (arrow && canDirectionEscape(board, r, c, arrow.dir)) {
          result.push(arrow);
        }
      }
    }
    return result;
  }

  function isBoardClear(board) {
    return countArrows(board) === 0;
  }

  function cloneBoard(board) {
    var copy = [];
    for (var r = 0; r < board.length; r += 1) {
      var row = [];
      for (var c = 0; c < board.length; c += 1) {
        var arrow = board[r][c];
        row.push(arrow ? { id: arrow.id, row: arrow.row, col: arrow.col, dir: arrow.dir } : null);
      }
      copy.push(row);
    }
    return copy;
  }

  return {
    isInside: isInside,
    canDirectionEscape: canDirectionEscape,
    canEscape: canEscape,
    countArrows: countArrows,
    findEscapableArrows: findEscapableArrows,
    isBoardClear: isBoardClear,
    cloneBoard: cloneBoard
  };
});
