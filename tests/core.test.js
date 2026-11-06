const test = require('node:test');
const assert = require('node:assert/strict');

const types = require('../miniprogram/js/core/game-types.js');
const collision = require('../miniprogram/js/core/arrow-collision.js');
const generator = require('../miniprogram/js/core/level-generator.js');
const scorePolicy = require('../miniprogram/js/core/score-policy.js');
const { RunTimer } = require('../miniprogram/js/core/game-timer.js');
const { GameEngine } = require('../miniprogram/js/core/game-engine.js');

function arrow(row, col, dir) {
  return { id: row + '-' + col, row: row, col: col, dir: dir };
}

function firstFree(engine) {
  const options = collision.findEscapableArrows(engine.state.board);
  assert.ok(options.length > 0, '当前棋盘应至少有一个可飞出箭头');
  return options[0];
}

function firstBlocked(engine) {
  const board = engine.state.board;
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board.length; c += 1) {
      if (board[r][c] && !collision.canEscape(board, r, c)) return board[r][c];
    }
  }
  return null;
}

test('方向定义覆盖上下左右且旋转角度正确', () => {
  assert.deepEqual(types.DIRECTION_NAMES, ['up', 'right', 'down', 'left']);
  assert.equal(types.DIRECTIONS.up.rotation, -90);
  assert.equal(types.DIRECTIONS.right.rotation, 0);
  assert.equal(types.DIRECTIONS.down.rotation, 90);
  assert.equal(types.DIRECTIONS.left.rotation, 180);
  assert.equal(types.sizeForStage(1), 4);
  assert.equal(types.sizeForStage(2), 5);
  assert.equal(types.sizeForStage(3), 6);
  assert.equal(types.sizeForStage(99), 6);
});

test('碰撞规则：同一行左侧 → 被右侧 → 阻挡，右侧先飞出', () => {
  const board = [
    [arrow(0, 0, 'right'), null, arrow(0, 2, 'right'), null],
    [null, null, null, null],
    [null, null, null, null],
    [null, null, null, null]
  ];
  assert.equal(collision.canEscape(board, 0, 0), false);
  assert.equal(collision.canEscape(board, 0, 2), true);
  board[0][2] = null;
  assert.equal(collision.canEscape(board, 0, 0), true);
});

test('碰撞规则：四个方向都按直线逐格检测，且只检测未清除箭头', () => {
  const board = Array.from({ length: 4 }, () => Array(4).fill(null));
  board[1][1] = arrow(1, 1, 'up');
  assert.equal(collision.canEscape(board, 1, 1), true);
  board[0][1] = arrow(0, 1, 'left');
  assert.equal(collision.canEscape(board, 1, 1), false);

  board[0][1] = null;
  board[1][1] = arrow(1, 1, 'right');
  board[1][3] = arrow(1, 3, 'down');
  assert.equal(collision.canEscape(board, 1, 1), false);
  board[1][3] = null;
  assert.equal(collision.canEscape(board, 1, 1), true);

  board[1][1] = arrow(1, 1, 'left');
  assert.equal(collision.canEscape(board, 1, 1), true);
  board[1][0] = arrow(1, 0, 'down');
  assert.equal(collision.canEscape(board, 1, 1), false);

  board[1][0] = null;
  board[1][1] = arrow(1, 1, 'down');
  board[3][1] = arrow(3, 1, 'left');
  assert.equal(collision.canEscape(board, 1, 1), false);
});

test('空格不可点击、计数与 cloneBoard 独立', () => {
  const board = Array.from({ length: 4 }, () => Array(4).fill(null));
  board[0][0] = arrow(0, 0, 'right');
  assert.equal(collision.canEscape(board, 2, 2), false);
  assert.equal(collision.countArrows(board), 1);
  const copy = collision.cloneBoard(board);
  copy[0][0].dir = 'down';
  assert.equal(board[0][0].dir, 'right');
});

test('关卡生成：4/5/6 各 1000 个种子，坐标唯一、方向合法、满盘且可解', () => {
  const stages = [1, 2, 3];
  for (const stage of stages) {
    const size = types.sizeForStage(stage);
    assert.equal(size, [4, 5, 6][stage - 1]);
    assert.equal(types.sizeForStage(stage), size);
  }

  for (const [stage, size] of [[1, 4], [2, 5], [3, 6]]) {
    for (let i = 1; i <= 1000; i += 1) {
      const seed = (i * 2654435761) >>> 0;
      const level = generator.generateLevel(stage, seed);
      assert.equal(level.size, size, 'stage ' + stage + ' size');
      assert.equal(level.arrows.length, size * size);
      assert.equal(collision.countArrows(level.board), size * size);
      assert.equal(level.generationVersion, 1);

      const seen = new Set();
      for (const item of level.arrows) {
        assert.ok(item.row >= 0 && item.row < size);
        assert.ok(item.col >= 0 && item.col < size);
        assert.ok(types.DIRECTION_NAMES.includes(item.dir));
        const key = item.row + ',' + item.col;
        assert.equal(seen.has(key), false, '坐标必须唯一');
        seen.add(key);
      }

      assert.equal(generator.verifySolvable(level.board), true, 'seed ' + seed + ' 应可解');
    }
  }
});

test('关卡生成：同一种子可复现，任意合法消除不会产生死局', () => {
  const levelA = generator.generateLevel(3, 987654321);
  const levelB = generator.generateLevel(3, 987654321);
  const dirsA = levelA.board.map((row) => row.map((cell) => (cell ? cell.dir : '-')));
  const dirsB = levelB.board.map((row) => row.map((cell) => (cell ? cell.dir : '-')));
  assert.deepEqual(dirsA, dirsB);

  for (const [stage, size] of [[1, 4], [2, 5], [3, 6]]) {
    for (let i = 1; i <= 50; i += 1) {
      const level = generator.generateLevel(stage, i * 7919);
      const board = collision.cloneBoard(level.board);
      const random = generator.createRandom(i * 104729 + stage);
      let removed = 0;
      while (collision.countArrows(board) > 0) {
        const free = collision.findEscapableArrows(board);
        assert.ok(free.length > 0, '还剩箭头时必须存在合法消除');
        const pick = free[Math.floor(random() * free.length)];
        board[pick.row][pick.col] = null;
        removed += 1;
        if (removed > size * size) throw new Error('消除数量异常');
      }
      assert.equal(removed, size * size);
    }
  }
});

test('关卡生成：solveBoard 返回完整消除序列', () => {
  const level = generator.generateLevel(2, 123456);
  const order = generator.solveBoard(level.board);
  assert.equal(order.length, 25);
  assert.equal(new Set(order.map((item) => item.id)).size, 25);
});

test('计分规则：连续 5 支 = 60 分，清屏再 +50 = 110 分', () => {
  let score = 0;
  for (let streak = 1; streak <= 5; streak += 1) {
    const result = scorePolicy.applyArrowScore(score, streak);
    score = result.score;
    if (streak < 5) assert.equal(result.comboBonus, 0);
    if (streak === 5) assert.equal(result.comboBonus, 10);
  }
  assert.equal(score, 60);
  score = scorePolicy.applyClearBonus(score).score;
  assert.equal(score, 110);

  const tenth = scorePolicy.arrowScore(10);
  assert.equal(tenth.total, 20);
  assert.equal(scorePolicy.arrowScore(9).total, 10);
  assert.equal(scorePolicy.applyBlockPenalty(1500), 0);
  assert.equal(scorePolicy.applyBlockPenalty(5000), 3000);
});

test('计时器：真实时间差、暂停恢复、扣时与时钟回拨', () => {
  const timer = new RunTimer(60000);
  timer.start(1000);
  assert.equal(timer.update(1500), 59500);
  assert.equal(timer.update(1500), 59500);
  timer.pause(2500);
  assert.equal(timer.remainingMs, 58500);
  assert.equal(timer.update(9000), 58500);
  timer.resume(9000);
  assert.equal(timer.update(10000), 57500);
  assert.equal(timer.subtract(2000), 55500);
  assert.equal(timer.subtract(999999), 0);
  assert.equal(timer.isExpired(), true);
  assert.equal(timer.update(20000), 0);

  const second = new RunTimer(1000);
  second.start(100);
  assert.equal(second.update(50), 1000, '时钟回拨不应增加时间');
  assert.equal(second.update(600), 500);
  second.stop(700);
  assert.equal(second.running, false);
});

test('引擎：合法箭头只计一次分，动画锁期间忽略输入', () => {
  const engine = new GameEngine();
  engine.start(1000, 42);
  assert.equal(engine.state.phase, types.PHASES.PLAYING);
  assert.equal(engine.state.board.length, 4);
  assert.equal(engine.getRemainingArrows(), 16);

  const free = firstFree(engine);
  const first = engine.tap(free.row, free.col, 1000);
  assert.equal(first.type, 'escaped');
  assert.equal(engine.state.score, 10);
  assert.equal(engine.state.streak, 1);
  assert.equal(engine.state.removedCount, 1);
  assert.equal(engine.getRemainingArrows(), 15);
  assert.equal(engine.state.inputLocked, true);

  const secondFree = firstFree(engine);
  const blockedByLock = engine.tap(secondFree.row, secondFree.col, 1100);
  assert.equal(blockedByLock.type, 'ignored');
  assert.equal(blockedByLock.reason, 'locked');
  assert.equal(engine.state.score, 10);

  const tick = engine.tick(1200);
  assert.equal(tick.type, 'tick');
  assert.equal(engine.state.inputLocked, false);
  const second = engine.tap(secondFree.row, secondFree.col, 1200);
  assert.equal(second.type, 'escaped');
  assert.equal(engine.state.score, 20);
});

test('引擎：受阻扣 2 秒、连击归零、棋盘不变，并经过反馈锁', () => {
  const engine = new GameEngine();
  engine.start(1000, 7);
  const blocked = firstBlocked(engine);
  assert.ok(blocked, '满盘应存在被阻挡的箭头');
  const before = engine.state.board.map((row) => row.map((cell) => (cell ? cell.dir : '-')));
  const beforeArrows = engine.getRemainingArrows();

  const result = engine.tap(blocked.row, blocked.col, 1000);
  assert.equal(result.type, 'blocked');
  assert.equal(result.penaltyMs, 2000);
  assert.equal(engine.state.remainingMs, 58000);
  assert.equal(engine.state.score, 0);
  assert.equal(engine.state.streak, 0);
  assert.equal(engine.state.blockedTaps, 1);
  assert.equal(engine.getRemainingArrows(), beforeArrows);
  const after = engine.state.board.map((row) => row.map((cell) => (cell ? cell.dir : '-')));
  assert.deepEqual(after, before);

  const free = firstFree(engine);
  assert.equal(engine.tap(free.row, free.col, 1100).reason, 'locked');
  assert.equal(engine.tick(1290).type, 'tick');
  assert.equal(engine.state.inputLocked, false);
  const success = engine.tap(free.row, free.col, 1290);
  assert.equal(success.type, 'escaped');
  assert.equal(engine.state.streak, 1);
});

test('引擎：点击空格忽略且不扣时间', () => {
  const engine = new GameEngine();
  engine.start(0, 99);
  const free = firstFree(engine);
  engine.tap(free.row, free.col, 0);
  engine.tick(200);
  const before = engine.state.remainingMs;
  const scoreBefore = engine.state.score;
  const ignored = engine.tap(free.row, free.col, 200);
  assert.equal(ignored.type, 'ignored');
  assert.equal(ignored.reason, 'empty');
  assert.equal(engine.state.score, scoreBefore);
  assert.equal(engine.state.remainingMs, before);

  const outOfBounds = engine.tap(99, 99, 300);
  assert.equal(outOfBounds.type, 'ignored');
  assert.equal(engine.state.remainingMs, before - 100);
});

test('引擎：15 次连击奖励与清屏加分、自动进入下一关', () => {
  const engine = new GameEngine();
  engine.start(0, 2026);
  let time = 0;

  for (let i = 0; i < 5; i += 1) {
    const free = firstFree(engine);
    const result = engine.tap(free.row, free.col, time);
    assert.equal(result.type, 'escaped');
    time += 210;
  }
  assert.equal(engine.state.score, 60);
  assert.equal(engine.state.streak, 5);
  assert.equal(engine.state.bestStreak, 5);

  for (let i = 5; i < 15; i += 1) {
    const free = firstFree(engine);
    const result = engine.tap(free.row, free.col, time);
    assert.equal(result.type, 'escaped');
    time += 210;
  }
  assert.equal(engine.state.score, 180);
  assert.equal(engine.state.streak, 15);

  const lastFree = firstFree(engine);
  const cleared = engine.tap(lastFree.row, lastFree.col, time);
  time += 210;
  assert.equal(cleared.type, 'cleared');
  assert.equal(cleared.clearBonus, 50);
  assert.equal(engine.state.score, 240);
  assert.equal(engine.state.clearedBoards, 1);
  assert.equal(engine.state.stage, 2);
  assert.equal(engine.state.phase, types.PHASES.TRANSITION);
  assert.equal(engine.getRemainingArrows(), 0);

  const beforeStage = engine.tick(time);
  assert.equal(beforeStage.type, 'tick');
  const stage = engine.tick(time + 600);
  assert.equal(stage.type, 'stage');
  assert.equal(stage.stage, 2);
  assert.equal(engine.state.board.length, 5);
  assert.equal(engine.state.phase, types.PHASES.PLAYING);
  assert.equal(engine.getRemainingArrows(), 25);
  assert.equal(engine.state.score, 240);
  assert.equal(engine.state.hintRemaining, 1, '免费提示整局只有一次');
});

test('引擎：免费提示只高亮合法箭头，不改变棋盘和分数', () => {
  const engine = new GameEngine();
  engine.start(0, 123);
  const boardBefore = engine.state.board.map((row) => row.map((cell) => (cell ? cell.dir : '-')));
  const hint = engine.useHint(100);
  assert.equal(hint.type, 'hint');
  assert.equal(engine.state.hintRemaining, 0);
  assert.equal(engine.state.score, 0);
  assert.equal(collision.canEscape(engine.state.board, hint.arrow.row, hint.arrow.col), true);
  const boardAfter = engine.state.board.map((row) => row.map((cell) => (cell ? cell.dir : '-')));
  assert.deepEqual(boardAfter, boardBefore);

  const again = engine.useHint(200);
  assert.equal(again.type, 'ignored');
  assert.equal(again.reason, 'no-hints');
});

test('引擎：暂停期间不计时，暂停/恢复会顺延动画与过场', () => {
  const engine = new GameEngine();
  engine.start(0, 55);
  assert.equal(engine.tick(1000).type, 'tick');
  assert.equal(engine.state.remainingMs, 59000);

  assert.equal(engine.pause(1000).type, 'paused');
  assert.equal(engine.tick(61000).type, 'idle');
  assert.equal(engine.state.remainingMs, 59000);
  assert.equal(engine.state.phase, types.PHASES.PAUSED);

  assert.equal(engine.resume(61000).type, 'resumed');
  assert.equal(engine.tick(62000).type, 'tick');
  assert.equal(engine.state.remainingMs, 58000);
  assert.equal(engine.state.phase, types.PHASES.PLAYING);
});

test('引擎：暂停清屏过场后恢复，过场按暂停时长顺延', () => {
  const engine = new GameEngine();
  engine.start(0, 31337);
  let time = 0;
  for (let i = 0; i < 16; i += 1) {
    const free = firstFree(engine);
    engine.tap(free.row, free.col, time);
    time += 210;
  }
  assert.equal(engine.state.phase, types.PHASES.TRANSITION);
  const clearAt = time - 210;
  assert.equal(engine.state.transitionUntil, clearAt + 600);

  engine.pause(clearAt + 100);
  assert.equal(engine.tick(clearAt + 5000).type, 'idle');
  engine.resume(clearAt + 5100);
  assert.equal(engine.tick(clearAt + 5500).type, 'tick');
  assert.equal(engine.state.phase, types.PHASES.TRANSITION);
  const stage = engine.tick(clearAt + 5700);
  assert.equal(stage.type, 'stage');
  assert.equal(engine.state.stage, 2);
});

test('引擎：时间结束立即结算，过场中到期不会生成新盘', () => {
  const engine = new GameEngine({ durationMs: 5000 });
  engine.start(0, 888);
  let time = 0;
  for (let i = 0; i < 16; i += 1) {
    const free = firstFree(engine);
    const result = engine.tap(free.row, free.col, time);
    assert.notEqual(result.type, 'finished');
    time += 210;
  }
  assert.equal(engine.state.phase, types.PHASES.TRANSITION);
  const finished = engine.tick(5000);
  assert.equal(finished.type, 'finished');
  assert.equal(engine.state.phase, types.PHASES.RESULT);
  assert.equal(finished.result.remainingMs, 0);
  assert.equal(engine.state.stage, 2);
  assert.equal(engine.state.board.length, 4);

  const after = engine.tick(6000);
  assert.equal(after.type, 'idle');
});

test('引擎：受阻扣时触发 0 秒时结算，且不产生清屏奖励', () => {
  const engine = new GameEngine();
  engine.start(0, 2027);
  const blocked = firstBlocked(engine);
  assert.ok(blocked);
  engine.tick(59000);
  assert.equal(engine.state.remainingMs, 1000);
  const result = engine.tap(blocked.row, blocked.col, 59000);
  assert.equal(result.type, 'finished');
  assert.equal(result.blocked, true);
  assert.equal(engine.state.phase, types.PHASES.RESULT);
  assert.equal(engine.state.score, 0);
  assert.equal(engine.state.remainingMs, 0);
  assert.equal(result.result.clearedBoards, 0);
});

test('引擎：结算摘要包含规则版本与关键统计，abandon 不产生成绩', () => {
  const engine = new GameEngine();
  engine.start(0, 4321);
  const free = firstFree(engine);
  engine.tap(free.row, free.col, 1000);
  engine.tick(1200);
  const blocked = firstBlocked(engine);
  if (blocked) engine.tap(blocked.row, blocked.col, 1200);
  engine.tick(60000);
  const result = engine.getResult();
  assert.equal(result.mode, 'standard');
  assert.equal(result.scoreRuleVersion, 1);
  assert.equal(result.durationMs, 60000);
  assert.equal(result.seed, 4321);
  assert.equal(result.remainingMs, 0);
  assert.equal(typeof result.bestStreak, 'number');

  const other = new GameEngine();
  other.start(0, 10);
  other.abandon();
  assert.equal(other.state, null);
  assert.equal(other.getResult(), null);
});

