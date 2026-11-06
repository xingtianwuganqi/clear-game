const { GameApp } = require('./js/app.js');

const app = new GameApp();
app.start();

// 本地调试入口；不影响正式玩法。
if (typeof GameGlobal !== 'undefined') {
  GameGlobal.__arrowClear = app;
}
