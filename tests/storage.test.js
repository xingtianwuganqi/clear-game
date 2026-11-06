const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LocalStorage,
  STORAGE_KEY,
  defaultSave,
  normalizeSave,
  createWxAdapter
} = require('../miniprogram/js/platform/local-storage.js');

function memoryAdapter(initial) {
  const memory = Object.assign({}, initial || {});
  return {
    memory: memory,
    read: function read(key) {
      return memory[key] === undefined ? '' : memory[key];
    },
    write: function write(key, value) {
      memory[key] = JSON.parse(JSON.stringify(value));
    }
  };
}

function thrownAdapter() {
  return {
    read: function read() {
      throw new Error('read blocked');
    },
    write: function write() {
      throw new Error('write blocked');
    }
  };
}

test('本地存档：默认值与异常数据归一化', () => {
  assert.deepEqual(normalizeSave(null), defaultSave());
  assert.deepEqual(
    normalizeSave({
      bestStandardScore: -10,
      bestStandardStreak: '7.9',
      bestStandardBoards: null,
      totalRuns: '3',
      soundEnabled: false
    }),
    {
      schemaVersion: 1,
      scoreRuleVersion: 1,
      bestStandardScore: 0,
      bestStandardStreak: 7,
      bestStandardBoards: 0,
      totalRuns: 3,
      soundEnabled: false
    }
  );
  assert.deepEqual(normalizeSave('{broken json'), defaultSave());
  assert.equal(normalizeSave('{"bestStandardScore":88}').bestStandardScore, 88);
});

test('本地存档：纪录只在更高时刷新，连击与清屏分别更新', () => {
  const adapter = memoryAdapter();
  const store = new LocalStorage({ adapter: adapter });
  assert.equal(store.load().bestStandardScore, 0);

  const first = store.recordStandardRun({
    mode: 'standard',
    score: 300,
    bestStreak: 12,
    clearedBoards: 1
  });
  assert.equal(first.isNewBest, true);
  assert.equal(first.previousBest, 0);
  assert.equal(first.bestScore, 300);
  assert.equal(first.historicBestStreak, 12);
  assert.equal(first.historicBestBoards, 1);
  assert.equal(first.totalRuns, 1);
  assert.equal(first.distanceToBest, 0);
  assert.equal(first.persisted, true);

  const second = store.recordStandardRun({
    mode: 'standard',
    score: 180,
    bestStreak: 20,
    clearedBoards: 3
  });
  assert.equal(second.isNewBest, false);
  assert.equal(second.bestScore, 300);
  assert.equal(second.historicBestStreak, 20);
  assert.equal(second.historicBestBoards, 3);
  assert.equal(second.totalRuns, 2);
  assert.equal(second.distanceToBest, 120);

  const third = store.recordStandardRun({
    mode: 'standard',
    score: 300,
    bestStreak: 4,
    clearedBoards: 0
  });
  assert.equal(third.isNewBest, false);
  assert.equal(third.distanceToBest, 0);
  assert.equal(third.bestScore, 300);
});

test('本地存档：换实例后纪录保持；assisted 不混入标准纪录', () => {
  const adapter = memoryAdapter();
  const first = new LocalStorage({ adapter: adapter });
  first.recordStandardRun({ mode: 'standard', score: 420, bestStreak: 9, clearedBoards: 2 });

  const second = new LocalStorage({ adapter: adapter });
  const save = second.load();
  assert.equal(save.bestStandardScore, 420);
  assert.equal(save.bestStandardStreak, 9);
  assert.equal(save.bestStandardBoards, 2);
  assert.equal(save.totalRuns, 1);

  const assisted = second.recordStandardRun({
    mode: 'assisted',
    score: 999,
    bestStreak: 99,
    clearedBoards: 99
  });
  assert.equal(assisted.isNewBest, false);
  assert.equal(second.load().bestStandardScore, 420);
  assert.equal(second.load().totalRuns, 1);
});

test('本地存档：写入/读取异常降级到内存，不抛异常', () => {
  const store = new LocalStorage({ adapter: thrownAdapter() });
  assert.doesNotThrow(() => store.load());
  assert.equal(store.load().bestStandardScore, 0);

  const result = store.recordStandardRun({
    mode: 'standard',
    score: 150,
    bestStreak: 4,
    clearedBoards: 1
  });
  assert.equal(result.persisted, false);
  assert.equal(store.load().bestStandardScore, 150);
  assert.equal(store.load().totalRuns, 1);
  assert.ok(store.lastError);
});

test('本地存档：音效设置持久化，reset 恢复默认', () => {
  const adapter = memoryAdapter();
  const store = new LocalStorage({ adapter: adapter });
  assert.equal(store.getSoundEnabled(), true);
  assert.equal(store.setSoundEnabled(false), false);
  assert.equal(store.getSoundEnabled(), false);
  assert.equal(adapter.memory[STORAGE_KEY].soundEnabled, false);

  store.reset();
  assert.equal(store.getSoundEnabled(), true);
  assert.equal(store.load().bestStandardScore, 0);
});

test('本地存档：wx 适配器读写', () => {
  const memory = {};
  global.wx = {
    getStorageSync: function getStorageSync(key) {
      return memory[key] === undefined ? '' : memory[key];
    },
    setStorageSync: function setStorageSync(key, value) {
      memory[key] = JSON.parse(JSON.stringify(value));
    }
  };

  const store = new LocalStorage();
  store.recordStandardRun({ mode: 'standard', score: 240, bestStreak: 5, clearedBoards: 1 });
  assert.equal(memory[STORAGE_KEY].bestStandardScore, 240);
  assert.equal(store.load().bestStandardScore, 240);

  const adapter = createWxAdapter();
  assert.equal(adapter.read(STORAGE_KEY).bestStandardBoards, 1);
  delete global.wx;
});

