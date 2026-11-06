const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MINI = path.join(ROOT, 'miniprogram');

const format = require('../miniprogram/js/ui/format.js');
const layout = require('../miniprogram/js/ui/ui-layout.js');
const { findEscapableArrows } = require('../miniprogram/js/core/arrow-collision.js');
const { LocalStorage, STORAGE_KEY } = require('../miniprogram/js/platform/local-storage.js');
const { Renderer } = require('../miniprogram/js/ui/renderer.js');

/* ------------------------------- 纯函数测试 ------------------------------- */

test('展示格式：时间、标题与最佳成绩文案', () => {
  assert.equal(format.formatTime(60000), '60.0');
  assert.equal(format.formatTime(38123), '38.2');
  assert.equal(format.formatTime(0), '0.0');
  assert.equal(format.formatTime(-10), '0.0');
  assert.equal(format.pad2(3), '03');
  assert.equal(format.pad2(12), '12');
  assert.equal(format.resultTitle({ clearedBoards: 0, score: 10 }), '再来一次！');
  assert.equal(format.resultTitle({ clearedBoards: 1, score: 100 }), '清得漂亮！');
  assert.equal(format.resultTitle({ clearedBoards: 2, score: 100 }), '清屏高手！');
  assert.equal(
    format.bestLine({ isNewBest: true, score: 300, bestScore: 300, distanceToBest: 0 }),
    '✦ NEW BEST · 历史新纪录 300 分'
  );
  assert.equal(
    format.bestLine({ isNewBest: false, score: 0, bestScore: 0, distanceToBest: 0 }),
    '再来一局，刷新纪录！'
  );
  assert.equal(
    format.bestLine({ isNewBest: false, score: 300, bestScore: 300, distanceToBest: 0 }),
    '追平历史最高 300 分'
  );
  assert.equal(
    format.bestLine({ isNewBest: false, score: 220, bestScore: 300, distanceToBest: 80 }),
    '距离纪录还差 80 分'
  );
});

test('棋盘布局：4/5/6 在常见屏幕上均能放进游戏区域', () => {
  const screens = [
    { width: 320, height: 568, safeTop: 20, safeBottom: 0 },
    { width: 375, height: 667, safeTop: 20, safeBottom: 0 },
    { width: 375, height: 812, safeTop: 44, safeBottom: 34 },
    { width: 390, height: 844, safeTop: 47, safeBottom: 34 },
    { width: 430, height: 932, safeTop: 47, safeBottom: 34 }
  ];

  for (const screen of screens) {
    for (const size of [4, 5, 6]) {
      const result = layout.computeBoardLayout({
        size: size,
        width: screen.width,
        height: screen.height,
        safeTop: screen.safeTop,
        safeBottom: screen.safeBottom
      });
      assert.ok(result.cellPx >= 26, size + 'x' + size + ' 格子不能过小');
      assert.ok(result.wrapPx <= screen.width, '棋盘不能超出屏幕宽度');
      assert.ok(result.wrapY >= result.boardTop - 1, '棋盘不能顶到上方元素');
      assert.ok(result.wrapY + result.wrapH <= result.scoreY + 1, '棋盘不能压住得分区');
      assert.ok(result.scoreY + result.scoreH <= result.hintY, '得分区不能压住提示按钮');
      assert.ok(result.hintY + result.hintH <= screen.height - screen.safeBottom, '提示按钮不能超出安全区');
    }
  }
});

test('点击命中：从后往前匹配，圆角区域按矩形处理', () => {
  const hits = [
    { id: 'a', x: 0, y: 0, w: 100, h: 50 },
    { id: 'b', x: 20, y: 10, w: 40, h: 20 }
  ];
  assert.equal(layout.hitTest(hits, 10, 10).id, 'a');
  assert.equal(layout.hitTest(hits, 30, 15).id, 'b');
  assert.equal(layout.hitTest(hits, 200, 200), null);
  assert.equal(layout.pointInRect(100, 50, hits[0]), true);
});

/* ------------------------------- 项目静态检查 ------------------------------- */

test('小游戏项目结构、配置和音频资源完整', () => {
  const gameJson = JSON.parse(fs.readFileSync(path.join(MINI, 'game.json'), 'utf8'));
  assert.equal(gameJson.deviceOrientation, 'portrait');
  assert.equal(gameJson.showStatusBar, false);

  const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
  assert.equal(project.compileType, 'game');
  assert.equal(project.miniprogramRoot, 'miniprogram/');
  assert.match(project.appid, /^wx[0-9a-f]{16}$/);
  assert.ok(fs.existsSync(path.join(ROOT, project.miniprogramRoot, 'game.js')));
  assert.ok(fs.existsSync(path.join(ROOT, project.miniprogramRoot, 'js', 'app.js')));

  const audioFiles = ['good.wav', 'bad.wav', 'clear.wav', 'hint.wav', 'stage.wav'];
  for (const file of audioFiles) {
    const full = path.join(MINI, 'audio', file);
    assert.ok(fs.existsSync(full), file + ' 应存在');
    const buffer = fs.readFileSync(full);
    assert.equal(buffer.slice(0, 4).toString(), 'RIFF');
    assert.ok(buffer.length > 1000);
  }

  assert.equal(fs.existsSync(path.join(MINI, 'app.json')), false, '小游戏不应包含小程序 app.json');
  assert.equal(fs.existsSync(path.join(MINI, 'pages')), false, '小游戏不应包含 WXML 页面');
});

/* ------------------------------- 应用集成测试 ------------------------------- */

function createCanvasMock() {
  const gradient = { addColorStop: function addColorStop() {} };
  const context = new Proxy(
    {
      measureText: function measureText(text) {
        return { width: String(text).length * 6.2 };
      },
      createLinearGradient: function createLinearGradient() {
        return gradient;
      },
      createRadialGradient: function createRadialGradient() {
        return gradient;
      }
    },
    {
      get: function get(target, property) {
        if (property in target) return target[property];
        return function noop() {};
      },
      set: function set(target, property, value) {
        target[property] = value;
        return true;
      }
    }
  );
  return {
    width: 0,
    height: 0,
    getContext: function getContext() {
      return context;
    }
  };
}

function installWxMock() {
  const memory = {};
  const events = {};
  global.wx = {
    getWindowInfo: function getWindowInfo() {
      return {
        windowWidth: 390,
        windowHeight: 844,
        pixelRatio: 2,
        statusBarHeight: 47,
        safeArea: { top: 47, bottom: 810 }
      };
    },
    getMenuButtonBoundingClientRect: function getMenuButtonBoundingClientRect() {
      return { left: 290, top: 52, right: 377, bottom: 84, width: 87, height: 32 };
    },
    getStorageSync: function getStorageSync(key) {
      return memory[key] === undefined ? '' : memory[key];
    },
    setStorageSync: function setStorageSync(key, value) {
      memory[key] = JSON.parse(JSON.stringify(value));
    },
    createCanvas: function createCanvas() {
      return createCanvasMock();
    },
    onTouchStart: function onTouchStart(handler) {
      events.touch = handler;
    },
    onShow: function onShow(handler) {
      events.show = handler;
    },
    onHide: function onHide(handler) {
      events.hide = handler;
    },
    onWindowResize: function onWindowResize(handler) {
      events.resize = handler;
    },
    showShareMenu: function showShareMenu() {},
    onShareAppMessage: function onShareAppMessage(handler) {
      events.share = handler;
    },
    shareAppMessage: function shareAppMessage() {},
    setKeepScreenOn: function setKeepScreenOn() {},
    vibrateShort: function vibrateShort() {},
    getPerformance: function getPerformance() {
      return { now: function now() { return Date.now(); } };
    }
  };
  return { memory: memory, events: events };
}

installWxMock();
const { GameApp } = require('../miniprogram/js/app.js');

function click(app, hit) {
  app.onTouchStart({
    touches: [
      {
        clientX: hit.x + hit.w / 2,
        clientY: hit.y + hit.h / 2
      }
    ]
  });
}

function render(app) {
  app.renderer.render(app, Date.now());
}

test('应用集成：开始游戏、提示、合法/受阻点击、暂停、结算和返回首页', () => {
  const wxState = installWxMock();
  // 预置一局玩过的存档，跳过首次引导。
  wxState.memory[STORAGE_KEY] = {
    schemaVersion: 1,
    scoreRuleVersion: 1,
    bestStandardScore: 0,
    bestStandardStreak: 0,
    bestStandardBoards: 0,
    totalRuns: 1,
    soundEnabled: true
  };

  const app = new GameApp();
  render(app);
  assert.equal(app.screen, 'home');

  const startHit = app.renderer.hitAreas.find((item) => item.id === 'start');
  assert.ok(startHit);
  click(app, startHit);
  assert.equal(app.screen, 'game');
  assert.ok(app.engine);

  render(app);
  const hintHit = app.renderer.hitAreas.find((item) => item.id === 'hint');
  assert.ok(hintHit);
  click(app, hintHit);
  assert.equal(app.engine.state.hintRemaining, 0);
  assert.ok(app.hint);
  assert.ok(app.engine.state.score === 0);

  render(app);
  const free = findEscapableArrows(app.engine.state.board)[0];
  const freeHit = app.renderer.hitAreas.find(
    (item) => item.id === 'cell' && item.row === free.row && item.col === free.col
  );
  click(app, freeHit);
  assert.equal(app.engine.state.score, 10);
  assert.equal(app.engine.state.streak, 1);
  assert.ok(app.fly);

  const blocked = (() => {
    const board = app.engine.state.board;
    for (let r = 0; r < board.length; r += 1) {
      for (let c = 0; c < board.length; c += 1) {
        if (board[r][c] && !findEscapableArrows(board).some((a) => a.row === r && a.col === c)) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  })();
  assert.ok(blocked, '应存在受阻箭头');
  // 等待引擎解锁，再点击受阻箭头
  app.engine.state.inputLocked = false;
  app.engine.state.lockUntil = 0;
  render(app);
  const blockedHit = app.renderer.hitAreas.find(
    (item) => item.id === 'cell' && item.row === blocked.row && item.col === blocked.col
  );
  const scoreBefore = app.engine.state.score;
  const arrowsBefore = app.engine.getRemainingArrows();
  click(app, blockedHit);
  assert.equal(app.engine.state.score, scoreBefore);
  assert.equal(app.engine.state.streak, 0);
  assert.equal(app.engine.state.blockedTaps, 1);
  assert.equal(app.engine.getRemainingArrows(), arrowsBefore);
  assert.ok(app.toast && app.toast.error);

  app.engine.state.inputLocked = false;
  app.engine.state.lockUntil = 0;
  render(app);
  const pauseHit = app.renderer.hitAreas.find((item) => item.id === 'pause');
  click(app, pauseHit);
  assert.equal(app.pauseOverlay, true);
  assert.equal(app.engine.state.phase, 'paused');

  render(app);
  const resumeHit = app.renderer.hitAreas.find((item) => item.id === 'resume');
  assert.ok(resumeHit);
  click(app, resumeHit);
  assert.equal(app.pauseOverlay, false);

  const summary = app.engine.getResult();
  app.finishRun(summary);
  assert.equal(app.screen, 'result');
  assert.ok(app.result);
  assert.equal(app.result.bestStreak, summary.bestStreak, '结算显示本局最长连击，不被历史纪录覆盖');
  assert.equal(wxState.memory[STORAGE_KEY].totalRuns, 2);

  render(app);
  const againHit = app.renderer.hitAreas.find((item) => item.id === 'again');
  const shareHit = app.renderer.hitAreas.find((item) => item.id === 'share');
  const homeHit = app.renderer.hitAreas.find((item) => item.id === 'home');
  assert.ok(againHit && shareHit && homeHit);
  click(app, homeHit);
  assert.equal(app.screen, 'home');
});

test('结算页在 320×568 小屏上按钮不与底部说明重叠', () => {
  const canvas = createCanvasMock();
  const renderer = new Renderer();
  const app = {
    screen: 'result',
    screenInfo: { width: 320, height: 568, dpr: 2, safeTop: 20, safeBottom: 0 },
    ctx: canvas.getContext('2d'),
    result: {
      score: 280,
      removedCount: 23,
      clearedBoards: 2,
      bestStreak: 11,
      blockedTaps: 3,
      isNewBest: true,
      bestScore: 280,
      distanceToBest: 0
    }
  };
  renderer.render(app, Date.now());
  const again = renderer.hitAreas.find((item) => item.id === 'again');
  const share = renderer.hitAreas.find((item) => item.id === 'share');
  const home = renderer.hitAreas.find((item) => item.id === 'home');
  assert.ok(again && share && home);
  assert.ok(again.y + again.h < share.y, '按钮不能重叠');
  assert.ok(share.y + share.h < home.y + home.h, '分享按钮应在返回首页上方');
  assert.ok(home.y + home.h <= 568 - 30, '返回首页不应压到底部说明');
  assert.ok(again.x >= 0 && again.x + again.w <= 320);
});

test('应用集成：首次启动显示引导，引导开始进入游戏', () => {
  const wxState = installWxMock();
  wxState.memory[STORAGE_KEY] = {
    schemaVersion: 1,
    scoreRuleVersion: 1,
    bestStandardScore: 0,
    bestStandardStreak: 0,
    bestStandardBoards: 0,
    totalRuns: 0,
    soundEnabled: true
  };

  const app = new GameApp();
  render(app);
  const startHit = app.renderer.hitAreas.find((item) => item.id === 'start');
  click(app, startHit);
  assert.equal(app.showGuide, true);
  assert.equal(app.screen, 'home');

  render(app);
  const guideHit = app.renderer.hitAreas.find((item) => item.id === 'guideStart');
  assert.ok(guideHit);
  click(app, guideHit);
  assert.equal(app.showGuide, false);
  assert.equal(app.screen, 'game');
});
