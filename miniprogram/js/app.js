const { GameEngine } = require('./core/game-engine.js');
const { generateLevel, randomSeed } = require('./core/level-generator.js');
const { findEscapableArrows } = require('./core/arrow-collision.js');
const { getLayoutMetrics } = require('./platform/layout.js');
const { now } = require('./platform/clock.js');
const { LocalStorage } = require('./platform/local-storage.js');
const audio = require('./platform/audio.js');
const share = require('./platform/share.js');
const analytics = require('./platform/analytics.js');
const { Renderer } = require('./ui/renderer.js');

const TONES = ['#7DC8FF', '#D6E8FF', '#9BBCF7'];
const FALLBACK_DIRS = [
  'up', 'right', 'right', 'down',
  'left', 'down', 'up', 'right',
  'up', 'left', 'down', 'right',
  'up', 'right', 'left', 'down'
];

class GameApp {
  constructor() {
    this.storage = new LocalStorage();
    this.save = this.storage.load();
    this.soundEnabled = this.save.soundEnabled;
    audio.setEnabled(this.soundEnabled);

    this.screenInfo = this.readScreen();
    this.canvas = wx.createCanvas();
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.renderer = new Renderer();
    this.screen = 'home';
    this.engine = null;
    this.result = null;
    this.showGuide = false;
    this.guideFirstRun = true;
    this.pauseOverlay = false;
    this.pauseAuto = false;
    this.toast = null;
    this.hint = null;
    this.fly = null;
    this.blocked = null;
    this.clearAt = 0;
    this.sample = this.buildSample();
    this.rafId = 0;
    this.started = false;

    this.bindEvents();
  }

  readScreen() {
    const metrics = getLayoutMetrics();
    return {
      width: metrics.windowWidth,
      height: metrics.windowHeight,
      dpr: metrics.pixelRatio || 1,
      safeTop: metrics.safeTop,
      safeBottom: metrics.safeBottom,
      capsuleInset: metrics.capsuleInset
    };
  }

  resizeCanvas() {
    const screen = this.screenInfo;
    const dpr = screen.dpr || 1;
    this.canvas.width = Math.floor(screen.width * dpr);
    this.canvas.height = Math.floor(screen.height * dpr);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  bindEvents() {
    wx.onTouchStart((event) => this.onTouchStart(event));
    wx.onShow(() => this.onShow());
    wx.onHide(() => this.onHide());

    if (typeof wx.onWindowResize === 'function') {
      wx.onWindowResize(() => {
        this.screenInfo = this.readScreen();
        this.resizeCanvas();
      });
    }

    try {
      if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: false });
      if (wx.onShareAppMessage) {
        wx.onShareAppMessage(() => this.getSharePayload());
      }
    } catch (error) {
      /* 分享能力不可用不影响游戏 */
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    analytics.track('app_launch', { persisted: this.storage.persisted });
    this.loop();
  }

  loop() {
    const time = now();
    this.tick(time);
    this.renderer.render(this, time);
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  tick(time) {
    if (this.toast && time > this.toast.until) this.toast = null;
    if (this.hint && time > this.hint.until) this.hint = null;
    if (this.blocked && time > this.blocked.start + this.blocked.duration + 40) this.blocked = null;
    if (this.fly && time > this.fly.start + this.fly.duration + 40) this.fly = null;

    if (this.screen !== 'game' || !this.engine || this.pauseOverlay) return;

    const event = this.engine.tick(time);
    if (event.type === 'finished') {
      this.finishRun(event.result);
      return;
    }
    if (event.type === 'stage') {
      this.clearAt = 0;
      this.fly = null;
      this.hint = null;
      audio.playSound('stage');
    }
  }

  onTouchStart(event) {
    const touches = event.touches || event.changedTouches || [];
    if (!touches.length) return;
    const touch = touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    const hit = this.renderer.hitTest(x, y);
    if (!hit) return;

    if (hit.id === 'sound') {
      this.toggleSound();
      return;
    }

    if (this.showGuide) {
      if (hit.id === 'guideStart') {
        this.showGuide = false;
        this.startGame();
      } else if (hit.id === 'guideClose') {
        this.showGuide = false;
      }
      return;
    }

    if (this.pauseOverlay) {
      if (hit.id === 'resume') this.resumeGame();
      else if (hit.id === 'quit') this.quitRun();
      return;
    }

    if (this.screen === 'home') {
      if (hit.id === 'start') {
        if (this.save.totalRuns === 0) {
          this.showGuide = true;
          this.guideFirstRun = true;
          analytics.track('guide_auto_open');
        } else {
          this.startGame();
        }
      } else if (hit.id === 'instructions') {
        this.showGuide = true;
        this.guideFirstRun = false;
        analytics.track('guide_open');
      }
      return;
    }

    if (this.screen === 'game') {
      if (hit.id === 'pause') {
        this.pauseGame(false);
      } else if (hit.id === 'hint') {
        this.useHint();
      } else if (hit.id === 'cell') {
        this.tapCell(hit.row, hit.col);
      }
      return;
    }

    if (this.screen === 'result') {
      if (hit.id === 'again') {
        this.startGame();
      } else if (hit.id === 'share') {
        this.shareResult();
      } else if (hit.id === 'home') {
        this.goHome();
      }
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this.storage.setSoundEnabled(this.soundEnabled);
    this.save = this.storage.getSaveData();
    audio.setEnabled(this.soundEnabled);
    if (this.soundEnabled) audio.playSound('good');
    this.showToast(this.soundEnabled ? '音效已开启' : '音效已关闭', false);
    analytics.track('sound_toggle', { enabled: this.soundEnabled });
  }

  startGame() {
    if (this.engine) this.engine.abandon();
    this.engine = new GameEngine({ durationMs: 60000 });
    this.engine.start(now(), randomSeed());
    this.screen = 'game';
    this.result = null;
    this.showGuide = false;
    this.pauseOverlay = false;
    this.pauseAuto = false;
    this.toast = null;
    this.hint = null;
    this.fly = null;
    this.blocked = null;
    this.clearAt = 0;
    try {
      if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: true });
    } catch (error) {
      /* ignore */
    }
    analytics.track('game_begin');
  }

  tapCell(row, col) {
    if (!this.engine || this.screen !== 'game') return;
    const time = now();
    const event = this.engine.tap(row, col, time);

    if (event.type === 'ignored') return;

    if (event.type === 'finished') {
      if (event.blocked) {
        this.blocked = { row: row, col: col, start: time, duration: 290 };
        audio.playSound('bad');
        audio.vibrateBlocked();
      }
      this.finishRun(event.result);
      return;
    }

    if (event.type === 'blocked') {
      this.blocked = { row: row, col: col, start: time, duration: 290 };
      audio.playSound('bad');
      audio.vibrateBlocked();
      this.showToast('被挡住了！−2 秒', true);
      return;
    }

    this.fly = {
      row: row,
      col: col,
      dir: event.arrow.dir,
      start: time,
      duration: 200
    };

    if (event.type === 'cleared') {
      this.clearAt = time;
      audio.playSound('clear');
      this.showToast('CLEAR! 整盘清空 +50', false);
    } else {
      audio.playSound('good');
      if (event.comboBonus > 0) {
        this.showToast('COMBO ×' + this.engine.state.streak + ' · 额外 +10', false);
      } else {
        this.showToast('成功飞出　+10', false);
      }
    }
  }

  useHint() {
    if (!this.engine || this.screen !== 'game') return;
    const event = this.engine.useHint(now());
    if (event.type === 'finished') {
      this.finishRun(event.result);
      return;
    }
    if (event.type === 'hint') {
      this.hint = {
        row: event.arrow.row,
        col: event.arrow.col,
        until: now() + 1200
      };
      audio.playSound('hint');
      this.showToast('绿色高亮的箭头可以飞出去', false);
    } else if (event.reason === 'no-hints') {
      this.showToast('本局免费提示已用完', true);
    } else if (event.reason === 'locked') {
      this.showToast('等箭头飞出去再试', true);
    }
  }

  pauseGame(auto) {
    if (!this.engine || this.screen !== 'game') return;
    const event = this.engine.pause(now());
    if (event.type === 'finished') {
      this.finishRun(event.result);
      return;
    }
    if (event.type === 'paused') {
      this.pauseOverlay = true;
      this.pauseAuto = !!auto;
      analytics.track(auto ? 'game_auto_pause' : 'game_pause');
    }
  }

  resumeGame() {
    if (!this.engine) return;
    const event = this.engine.resume(now());
    if (event.type === 'resumed') {
      this.pauseOverlay = false;
      this.pauseAuto = false;
      analytics.track('game_resume');
    }
  }

  quitRun() {
    if (this.engine) this.engine.abandon();
    this.engine = null;
    this.pauseOverlay = false;
    this.pauseAuto = false;
    this.toast = null;
    this.screen = 'home';
    this.refreshSave();
    try {
      if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: false });
    } catch (error) {
      /* ignore */
    }
    analytics.track('run_abandon');
  }

  finishRun(result) {
    if (this.screen === 'result') return;
    const outcome = this.storage.recordStandardRun(result);
    this.result = Object.assign({}, result, outcome);
    this.engine = null;
    this.screen = 'result';
    this.pauseOverlay = false;
    this.pauseAuto = false;
    this.toast = null;
    this.hint = null;
    this.fly = null;
    this.blocked = null;
    this.clearAt = 0;
    this.refreshSave();
    try {
      if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: false });
    } catch (error) {
      /* ignore */
    }
    analytics.track('run_finish', {
      score: result.score,
      removed: result.removedCount,
      boards: result.clearedBoards,
      bestStreak: result.bestStreak,
      blocked: result.blockedTaps,
      isNewBest: outcome.isNewBest
    });
  }

  goHome() {
    this.screen = 'home';
    this.result = null;
    this.pauseOverlay = false;
    this.refreshSave();
    analytics.track('result_home');
  }

  refreshSave() {
    this.save = this.storage.load();
    this.soundEnabled = this.save.soundEnabled;
    audio.setEnabled(this.soundEnabled);
  }

  showToast(text, error) {
    this.toast = {
      text: text,
      error: !!error,
      until: now() + 1300
    };
  }

  getSharePayload() {
    if (this.screen === 'result' && this.result) {
      return share.buildSharePayload(this.result);
    }
    if (this.screen === 'game' && this.engine) {
      return share.buildSharePayload({
        score: this.engine.state.score,
        clearedBoards: this.engine.state.clearedBoards
      });
    }
    return share.buildSharePayload({
      score: this.save.bestStandardScore,
      clearedBoards: this.save.bestStandardBoards
    });
  }

  shareResult() {
    if (!this.result) return;
    const payload = share.buildSharePayload(this.result);
    try {
      if (wx.shareAppMessage) {
        wx.shareAppMessage({ title: payload.title });
        this.showToast('已调起分享', false);
      } else if (wx.showToast) {
        wx.showToast({ title: '当前环境不支持分享', icon: 'none' });
      }
    } catch (error) {
      this.showToast('分享暂不可用', true);
    }
    analytics.track('share_click', { score: this.result.score });
  }

  onHide() {
    if (this.screen !== 'game' || !this.engine) return;
    const event = this.engine.pause(now());
    if (event.type === 'finished') {
      this.finishRun(event.result);
      return;
    }
    if (event.type === 'paused') {
      this.pauseOverlay = true;
      this.pauseAuto = true;
    }
  }

  onShow() {
    this.refreshSave();
    if (this.screen === 'game' && this.engine) {
      const state = this.engine.state;
      if (state && state.phase === 'paused') {
        this.pauseOverlay = true;
        this.pauseAuto = true;
      }
    }
  }

  buildSample() {
    const cells = [];
    try {
      const level = generateLevel(1, 20261106);
      const free = findEscapableArrows(level.board);
      const highlighted = free.length ? free[0] : null;
      for (let r = 0; r < level.size; r += 1) {
        const row = [];
        for (let c = 0; c < level.size; c += 1) {
          row.push({
            dir: level.board[r][c].dir,
            highlight: !!(highlighted && highlighted.row === r && highlighted.col === c)
          });
        }
        cells.push(row);
      }
    } catch (error) {
      for (let r = 0; r < 4; r += 1) {
        const row = [];
        for (let c = 0; c < 4; c += 1) {
          const index = r * 4 + c;
          row.push({
            dir: FALLBACK_DIRS[index],
            highlight: index === 3
          });
        }
        cells.push(row);
      }
    }
    return { cells: cells, tones: TONES };
  }
}

module.exports = { GameApp };
