const theme = require('./theme.js');
const draw = require('./draw.js');
const fmt = require('./format.js');
const { computeBoardLayout } = require('./ui-layout.js');
const { countArrows } = require('../core/arrow-collision.js');

const C = theme.COLORS;
const font = theme.font;
const GAME_DURATION = 60000;

class Renderer {
  constructor() {
    this.hitAreas = [];
    this.background = null;
    this.backgroundKey = '';
  }

  resetHits() {
    this.hitAreas = [];
  }

  addHit(id, x, y, w, h, extra) {
    const hit = { id: id, x: x, y: y, w: w, h: h };
    if (extra) Object.assign(hit, extra);
    this.hitAreas.push(hit);
  }

  hitTest(x, y) {
    for (let i = this.hitAreas.length - 1; i >= 0; i -= 1) {
      const r = this.hitAreas[i];
      if (x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h) return r;
    }
    return null;
  }

  ensureBackground(app) {
    const screen = app.screenInfo;
    const dpr = screen.dpr || 1;
    const key = screen.width + 'x' + screen.height + '@' + dpr;
    if (this.background && this.backgroundKey === key) return;
    const bg = wx.createCanvas();
    bg.width = Math.floor(screen.width * dpr);
    bg.height = Math.floor(screen.height * dpr);
    const c = bg.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = '#0A1123';
    c.fillRect(0, 0, screen.width, screen.height);

    const g1 = c.createRadialGradient(
      screen.width * 0.19, screen.height * 0.18, 0,
      screen.width * 0.19, screen.height * 0.18, screen.width * 0.75
    );
    g1.addColorStop(0, 'rgba(41,54,89,0.95)');
    g1.addColorStop(1, 'rgba(41,54,89,0)');
    c.fillStyle = g1;
    c.fillRect(0, 0, screen.width, screen.height);

    const g2 = c.createRadialGradient(
      screen.width * 0.88, screen.height * 0.86, 0,
      screen.width * 0.88, screen.height * 0.86, screen.width * 0.7
    );
    g2.addColorStop(0, 'rgba(25,60,67,0.8)');
    g2.addColorStop(1, 'rgba(25,60,67,0)');
    c.fillStyle = g2;
    c.fillRect(0, 0, screen.width, screen.height);

    const g3 = c.createRadialGradient(
      screen.width * 0.86, screen.height * 0.06, 0,
      screen.width * 0.86, screen.height * 0.06, screen.width * 0.6
    );
    g3.addColorStop(0, 'rgba(186,244,108,0.07)');
    g3.addColorStop(1, 'rgba(186,244,108,0)');
    c.fillStyle = g3;
    c.fillRect(0, 0, screen.width, screen.height);

    c.fillStyle = 'rgba(165,193,255,0.045)';
    for (let x = 12; x < screen.width; x += 30) {
      for (let y = 12; y < screen.height; y += 30) {
        c.beginPath();
        c.arc(x, y, 0.7, 0, Math.PI * 2);
        c.fill();
      }
    }

    this.background = bg;
    this.backgroundKey = key;
  }

  render(app, now) {
    const screen = app.screenInfo;
    this.ensureBackground(app);
    const ctx = app.ctx;
    ctx.setTransform(screen.dpr, 0, 0, screen.dpr, 0, 0);
    ctx.drawImage(this.background, 0, 0, screen.width, screen.height);
    this.resetHits();

    if (app.screen === 'game' && app.engine) {
      this.drawGame(app, now);
    } else if (app.screen === 'result' && app.result) {
      this.drawResult(app, now);
    } else {
      this.drawHome(app, now);
    }

    if (app.showGuide) {
      this.drawGuide(app, now);
    } else if (app.pauseOverlay) {
      this.drawPause(app, now);
    } else {
      this.drawToast(app, now);
    }
  }

  /* ---------------------------------- 首页 ---------------------------------- */

  drawHome(app, now) {
    const screen = app.screenInfo;
    const W = screen.width;
    const H = screen.height;
    const ctx = app.ctx;
    const compact = H < 730;
    const side = W < 360 ? 17 : 22;
    const cx = W / 2;
    const top = screen.safeTop + 6;
    const topbarH = compact ? 42 : 46;

    this.drawBrand(app, side, top, topbarH);

    const soundSize = compact ? 36 : 38;
    const soundX = Math.max(side + 108, W - screen.capsuleInset - 6 - soundSize);
    const soundY = top + (topbarH - soundSize) / 2;
    draw.fillRoundRect(ctx, soundX, soundY, soundSize, soundSize, 12, '#22324D');
    draw.strokeRoundRect(ctx, soundX, soundY, soundSize, soundSize, 12, C.border, 1);
    draw.drawSoundGlyph(ctx, soundX + soundSize / 2, soundY + soundSize / 2, app.soundEnabled, '#C6D6ED');
    this.addHit('sound', soundX, soundY, soundSize, soundSize);

    let y = top + topbarH + (compact ? 8 : 14);
    const pillH = compact ? 24 : 26;
    draw.drawPill(
      ctx,
      'ARROW CLEAR · 60S',
      cx,
      y,
      pillH,
      font(compact ? 9 : 10, 900),
      C.lime,
      'rgba(186,244,108,0.25)',
      'rgba(186,244,108,0.1)'
    );
    y += pillH + (compact ? 10 : 16);

    const titleSize = compact ? 46 : 52;
    const titleY = y + titleSize * 0.58;
    this.drawTitle(ctx, cx, titleY, titleSize);
    y += titleSize * 1.14 + (compact ? 4 : 8);

    const subFont = font(compact ? 12 : 13, 500);
    const subLine = compact ? 21 : 23;
    draw.drawText(ctx, '找出能一路飞出去的箭头。', cx, y + subLine / 2, {
      font: subFont, color: C.muted, align: 'center'
    });
    draw.drawText(ctx, '清空棋盘，挑战你的最快反应！', cx, y + subLine * 1.5, {
      font: subFont, color: C.muted, align: 'center'
    });
    y += subLine * 2 + (compact ? 12 : 18);

    const footerY = H - screen.safeBottom - 16;
    const afterCard =
      (compact ? 8 : 12) + 50 +
      (compact ? 8 : 12) + (compact ? 52 : 58) +
      (compact ? 4 : 8) + (compact ? 34 : 40) + 12;
    const maxCardH = footerY - y - afterCard;
    const cardW = Math.min(W - side * 2, 360);
    const minCardH = H < 640 ? 150 : compact ? 174 : 190;
    const desiredCardH = H < 640 ? 184 : compact ? 210 : 250;
    const cardH = Math.max(minCardH, Math.min(desiredCardH, maxCardH));

    this.drawSampleCard(app, (W - cardW) / 2, y, cardW, cardH, compact);
    y += cardH + (compact ? 10 : 16);

    const startH = 50;
    draw.drawButton(ctx, side, y, W - side * 2, startH, '开始 60 秒挑战', 'primary', {
      font: font(16, 900), arrow: '↗', radius: 16
    });
    this.addHit('start', side, y, W - side * 2, startH);
    y += startH + (compact ? 8 : 12);

    const bestH = compact ? 52 : 58;
    this.drawBestRow(app, side, y, W - side * 2, bestH);
    y += bestH + (compact ? 4 : 8);

    draw.drawText(ctx, '?　先看玩法说明', cx, y + 18, {
      font: font(12, 700), color: C.muted, align: 'center'
    });
    this.addHit('instructions', side, y, W - side * 2, 34);

    draw.drawText(ctx, '纯单机体验 · 无需登录 · 广告暂未接入', cx, footerY, {
      font: font(10, 500), color: C.faint, align: 'center'
    });
  }

  drawBrand(app, x, top, height) {
    const ctx = app.ctx;
    const size = 38;
    const y = top + (height - size) / 2;
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(-8 * Math.PI / 180);
    ctx.shadowColor = 'rgba(186,244,108,0.22)';
    ctx.shadowBlur = 16;
    draw.fillRoundRect(ctx, -size / 2, -size / 2, size, size, 13, C.lime);
    ctx.shadowBlur = 0;
    ctx.rotate(8 * Math.PI / 180);
    draw.drawArrow(ctx, 0, 0, 22, 'right', C.darkInk, 1);
    ctx.restore();

    draw.drawText(ctx, '一箭清空', x + size + 10, top + height / 2, {
      font: font(15, 900), color: C.text, align: 'left'
    });
  }

  drawTitle(ctx, cx, y, size) {
    const fontStr = font(size, 900);
    const part1 = '一箭';
    const part2 = '清空';
    const w1 = draw.measureText(ctx, part1, fontStr);
    const w2 = draw.measureText(ctx, part2, fontStr);
    const left = cx - (w1 + w2) / 2;
    draw.drawText(ctx, part1, left, y, {
      font: fontStr, color: C.text, align: 'left'
    });
    draw.drawText(ctx, part2, left + w1, y, {
      font: fontStr, color: C.lime, align: 'left', shadowColor: 'rgba(186,244,108,0.18)', shadowBlur: 22
    });
  }

  drawSampleCard(app, x, y, w, h, compact) {
    const ctx = app.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(3,9,20,0.28)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, 'rgba(37,60,90,0.95)');
    gradient.addColorStop(1, 'rgba(23,36,61,0.95)');
    draw.fillRoundRect(ctx, x, y, w, h, 24, gradient);
    ctx.restore();
    draw.strokeRoundRect(ctx, x, y, w, h, 24, 'rgba(168,211,255,0.14)', 1);

    const boardSize = Math.max(118, Math.min(w - 36, h - 50));
    const gap = compact ? 5 : 6;
    const cell = (boardSize - gap * 3) / 4;
    const boardX = x + (w - boardSize) / 2;
    const boardY = y + 14;

    if (app.sample) {
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 4; c += 1) {
          const item = app.sample.cells[r][c];
          if (!item) continue;
          const cellX = boardX + c * (cell + gap);
          const cellY = boardY + r * (cell + gap);
          if (item.highlight) {
            ctx.save();
            ctx.shadowColor = 'rgba(186,244,108,0.25)';
            ctx.shadowBlur = 14;
            draw.fillRoundRect(ctx, cellX, cellY, cell, cell, 10, 'rgba(186,244,108,0.14)');
            ctx.restore();
            draw.strokeRoundRect(ctx, cellX, cellY, cell, cell, 10, C.lime, 2);
          } else {
            draw.fillRoundRect(ctx, cellX, cellY, cell, cell, 10, C.tile);
            draw.strokeRoundRect(ctx, cellX, cellY, cell, cell, 10, C.tileBorder, 1);
          }
          draw.drawArrow(
            ctx,
            cellX + cell / 2,
            cellY + cell / 2,
            cell * 0.62,
            item.dir,
            item.highlight ? C.lime : theme.toneFor(r, c),
            1
          );
        }
      }
    }

    draw.drawText(ctx, '看方向 · 找出口 · 一箭接一箭', x + w / 2, y + h - 14, {
      font: font(10, 700), color: '#8FA6C3', align: 'center'
    });
  }

  drawBestRow(app, x, y, w, h) {
    const ctx = app.ctx;
    const gap = 10;
    const boxW = (w - gap) / 2;
    const best = app.save || { bestStandardScore: 0, bestStandardBoards: 0 };
    this.drawKpi(ctx, x, y, boxW, h, '历史最高分', best.bestStandardScore);
    this.drawKpi(ctx, x + boxW + gap, y, boxW, h, '最多清屏', best.bestStandardBoards);
  }

  drawKpi(ctx, x, y, w, h, label, value) {
    draw.fillRoundRect(ctx, x, y, w, h, 16, 'rgba(27,41,67,0.72)');
    draw.strokeRoundRect(ctx, x, y, w, h, 16, C.border, 1);
    draw.drawText(ctx, label, x + 15, y + 16, {
      font: font(10, 700), color: C.muted, align: 'left'
    });
    draw.drawText(ctx, String(value), x + 15, y + h - 17, {
      font: font(22, 900), color: C.lime, align: 'left'
    });
  }

  /* ---------------------------------- 游戏 ---------------------------------- */

  drawGame(app, now) {
    const screen = app.screenInfo;
    const ctx = app.ctx;
    const state = app.engine.state;
    const W = screen.width;
    const H = screen.height;
    const cx = W / 2;
    const layout = computeBoardLayout({
      size: state.board.length,
      width: W,
      height: H,
      safeTop: screen.safeTop,
      safeBottom: screen.safeBottom
    });
    this.gameLayout = layout;

    const btnSize = layout.compact ? 34 : 38;
    draw.fillRoundRect(ctx, layout.side, layout.topbarY, btnSize, btnSize, 11, '#22324D');
    draw.strokeRoundRect(ctx, layout.side, layout.topbarY, btnSize, btnSize, 11, C.border, 1);
    draw.drawPauseGlyph(ctx, layout.side + btnSize / 2, layout.topbarY + btnSize / 2, '#C6D6ED');
    this.addHit('pause', layout.side, layout.topbarY, btnSize, btnSize);

    draw.drawText(ctx, '第 ' + fmt.pad2(state.stage) + ' 关', cx, layout.topbarY + btnSize / 2, {
      font: font(13, 800), color: C.sky, align: 'center'
    });

    const tagRight = W - screen.capsuleInset - 6;
    if (W >= 350 && tagRight - 70 > cx + 50) {
      draw.drawText(ctx, '60 SEC RUSH', tagRight, layout.topbarY + btnSize / 2, {
        font: font(9, 800), color: C.muted, align: 'right'
      });
    }

    const remainingMs = state.remainingMs;
    const low = remainingMs <= 10000;
    draw.drawText(ctx, '剩余时间', cx, layout.labelY, {
      font: font(10, 800), color: C.muted, align: 'center'
    });

    const numFont = font(layout.timeSize, 900);
    const unitFont = font(18, 700);
    const timeText = fmt.formatTime(remainingMs);
    const numW = draw.measureText(ctx, timeText, numFont);
    const unitW = draw.measureText(ctx, 's', unitFont);
    const timeLeft = cx - (numW + unitW + 2) / 2;
    const timeColor = low ? C.coral : C.text;
    draw.drawText(ctx, timeText, timeLeft, layout.timeY + layout.timeSize * 0.56, {
      font: numFont, color: timeColor, align: 'left'
    });
    draw.drawText(ctx, 's', timeLeft + numW + 2, layout.timeY + layout.timeSize * 0.62, {
      font: unitFont, color: '#8298B8', align: 'left'
    });
    draw.drawProgressBar(
      ctx,
      layout.side,
      layout.barY,
      W - layout.side * 2,
      layout.barH,
      remainingMs / GAME_DURATION,
      low
    );

    draw.drawText(ctx, '点击能直接飞出的箭头', cx, layout.promptY + (layout.compact ? 11 : 10), {
      font: font(16, 900), color: C.text, align: 'center'
    });
    if (!layout.compact) {
      draw.drawText(ctx, '前面有箭头阻挡，就要换一支试试', cx, layout.promptY + 30, {
        font: font(10, 500), color: '#8298B6', align: 'center'
      });
    }

    this.drawBoard(app, layout, now);
    this.drawScores(app, layout);
    this.drawHintButton(app, layout);
  }

  drawBoard(app, layout, now) {
    const ctx = app.ctx;
    const state = app.engine.state;
    const size = state.board.length;
    const W = app.screenInfo.width;
    const tx = layout.wrapX;
    const ty = layout.wrapY;
    const wrapW = layout.wrapPx;
    const wrapH = layout.wrapH;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.24)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
    const wrapGradient = ctx.createLinearGradient(tx, ty, tx, ty + wrapH);
    wrapGradient.addColorStop(0, '#2D4061');
    wrapGradient.addColorStop(1, '#182943');
    draw.fillRoundRect(ctx, tx, ty, wrapW, wrapH, 24, wrapGradient);
    ctx.restore();
    draw.strokeRoundRect(ctx, tx, ty, wrapW, wrapH, 24, C.borderStrong, 1);

    const boardX = tx + 8;
    const boardY = ty + 8;
    const gap = layout.gap;
    const cell = layout.cellPx;

    const hint = app.hint && now <= app.hint.until ? app.hint : null;
    const blocked = app.blocked && now <= app.blocked.start + app.blocked.duration ? app.blocked : null;

    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        const x = boardX + c * (cell + gap);
        const y = boardY + r * (cell + gap);
        const arrow = state.board[r][c];

        if (!arrow) {
          draw.fillRoundRect(ctx, x, y, cell, cell, 11, C.emptyTile);
          draw.strokeRoundRect(ctx, x, y, cell, cell, 11, 'rgba(185,205,229,0.07)', 1, [2, 4]);
          ctx.save();
          ctx.fillStyle = 'rgba(156,181,209,0.17)';
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          this.addHit('cell', x, y, cell, cell, { row: r, col: c });
          continue;
        }

        const isHint = !!hint && hint.row === r && hint.col === c;
        const isBlocked = !!blocked && blocked.row === r && blocked.col === c;
        ctx.save();
        if (isHint) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 120);
          ctx.shadowColor = 'rgba(186,244,108,0.35)';
          ctx.shadowBlur = 14;
          draw.fillRoundRect(ctx, x, y, cell, cell, 11, 'rgba(186,244,108,' + (0.12 + pulse * 0.05) + ')');
          ctx.restore();
          draw.strokeRoundRect(ctx, x, y, cell, cell, 11, C.lime, 2);
        } else {
          ctx.restore();
          if (isBlocked) {
            draw.fillRoundRect(ctx, x, y, cell, cell, 11, C.coralSoft);
            draw.strokeRoundRect(ctx, x, y, cell, cell, 11, 'rgba(255,130,110,0.9)', 1.5);
          } else {
            draw.fillRoundRect(ctx, x, y, cell, cell, 11, C.tile);
            draw.strokeRoundRect(ctx, x, y, cell, cell, 11, C.tileBorder, 1);
          }
        }

        let offsetX = 0;
        if (isBlocked) {
          const p = (now - blocked.start) / blocked.duration;
          offsetX = Math.sin(p * Math.PI * 3) * 4 * (1 - p);
        }
        draw.drawArrow(
          ctx,
          x + cell / 2 + offsetX,
          y + cell / 2,
          cell * 0.62,
          arrow.dir,
          isBlocked ? '#FFA49A' : theme.toneFor(r, c),
          1
        );
        this.addHit('cell', x, y, cell, cell, { row: r, col: c });
      }
    }

    if (app.fly) {
      const p = fmt.clamp((now - app.fly.start) / app.fly.duration, 0, 1);
      if (p < 1) {
        const ease = fmt.easeOutCubic(p);
        const index = app.fly.row * size + app.fly.col;
        const r = Math.floor(index / size);
        const c = index % size;
        const originX = boardX + c * (cell + gap) + cell / 2;
        const originY = boardY + r * (cell + gap) + cell / 2;
        const dx = { left: -1, right: 1 }[app.fly.dir] || 0;
        const dy = { up: -1, down: 1 }[app.fly.dir] || 0;
        const distance = Math.max(W, cell * 4);
        draw.drawArrow(
          ctx,
          originX + dx * distance * ease,
          originY + dy * distance * ease,
          cell * 0.62,
          app.fly.dir,
          theme.toneFor(r, c),
          1 - p
        );
      }
    }

    draw.drawText(ctx, '剩余 ' + countArrows(state.board) + ' / ' + size * size, tx + 12, ty + layout.boardPx + 26, {
      font: font(10, 500), color: '#9BB0CB', align: 'left'
    });
    const clearNumFont = font(12, 900);
    const suffix = ' 次';
    const prefix = '清屏 ';
    const numStr = String(state.clearedBoards);
    const suffixW = draw.measureText(ctx, suffix, font(10, 500));
    const numW = draw.measureText(ctx, numStr, clearNumFont);
    const prefixW = draw.measureText(ctx, prefix, font(10, 500));
    const rightEdge = tx + wrapW - 12;
    const startX = rightEdge - (prefixW + numW + suffixW);
    draw.drawText(ctx, prefix, startX, ty + layout.boardPx + 26, {
      font: font(10, 500), color: '#9BB0CB', align: 'left'
    });
    draw.drawText(ctx, numStr, startX + prefixW, ty + layout.boardPx + 26, {
      font: clearNumFont, color: C.lime, align: 'left'
    });
    draw.drawText(ctx, suffix, startX + prefixW + numW, ty + layout.boardPx + 26, {
      font: font(10, 500), color: '#9BB0CB', align: 'left'
    });

    if (state.phase === 'transition' && app.clearAt) {
      const bannerStart = app.clearAt + 170;
      if (now >= bannerStart) {
        const total = Math.max(1, state.transitionUntil - bannerStart);
        const p = fmt.clamp((now - bannerStart) / total, 0, 1);
        ctx.save();
        draw.roundRectPath(ctx, tx, ty, wrapW, wrapH, 24);
        ctx.clip();
        ctx.fillStyle = 'rgba(9,19,36,0.8)';
        ctx.fillRect(tx, ty, wrapW, wrapH);
        ctx.restore();
        const scale = 0.86 + 0.14 * fmt.easeOutCubic(Math.min(1, p * 4));
        ctx.save();
        ctx.translate(W / 2, ty + wrapH / 2 - 8);
        ctx.scale(scale, scale);
        draw.drawText(ctx, 'CLEAR!', 0, 0, {
          font: font(layout.compact ? 38 : 42, 900),
          color: C.lime,
          align: 'center',
          shadowColor: 'rgba(186,244,108,0.3)',
          shadowBlur: 28
        });
        draw.drawText(ctx, '整盘清空 +50', 0, 36, {
          font: font(12, 700), color: '#D6E5F8', align: 'center'
        });
        ctx.restore();
      }
    }
  }

  drawScores(app, layout) {
    const ctx = app.ctx;
    const W = app.screenInfo.width;
    const state = app.engine.state;
    const gap = 10;
    const w = (W - layout.side * 2 - gap) / 2;
    const h = layout.scoreH;
    const y = layout.scoreY;
    this.drawStatBox(ctx, layout.side, y, w, h, '本局得分', String(state.score), C.text);
    this.drawStatBox(ctx, layout.side + w + gap, y, w, h, '连续成功', '×' + state.streak, C.lime);
  }

  drawStatBox(ctx, x, y, w, h, label, value, color) {
    draw.fillRoundRect(ctx, x, y, w, h, 16, 'rgba(27,41,67,0.72)');
    draw.strokeRoundRect(ctx, x, y, w, h, 16, C.border, 1);
    draw.drawText(ctx, label, x + 16, y + 16, {
      font: font(10, 700), color: C.muted, align: 'left'
    });
    draw.drawText(ctx, value, x + 16, y + h - 17, {
      font: font(23, 900), color: color, align: 'left'
    });
  }

  drawHintButton(app, layout) {
    const ctx = app.ctx;
    const W = app.screenInfo.width;
    const remaining = app.engine.state.hintRemaining;
    const x = layout.side;
    const w = W - layout.side * 2;
    const h = layout.hintH;
    const y = layout.hintY;
    if (remaining > 0) {
      draw.fillRoundRect(ctx, x, y, w, h, 14, 'rgba(186,244,108,0.08)');
      draw.strokeRoundRect(ctx, x, y, w, h, 14, 'rgba(186,244,108,0.28)', 1);
      draw.drawText(ctx, '✦　免费提示（' + remaining + '/1）', W / 2, y + h / 2 + 0.5, {
        font: font(12, 800), color: C.lime, align: 'center'
      });
      this.addHit('hint', x, y, w, h);
    } else {
      draw.fillRoundRect(ctx, x, y, w, h, 14, 'rgba(27,41,67,0.6)');
      draw.strokeRoundRect(ctx, x, y, w, h, 14, C.border, 1);
      draw.drawText(ctx, '✦　本局提示已用完', W / 2, y + h / 2 + 0.5, {
        font: font(12, 700), color: '#8BA0BB', align: 'center'
      });
    }
  }

  /* ---------------------------------- 结算 ---------------------------------- */

  drawResult(app, now) {
    const screen = app.screenInfo;
    const ctx = app.ctx;
    const W = screen.width;
    const H = screen.height;
    const cx = W / 2;
    const side = W < 360 ? 17 : 22;
    const tiny = H < 640;
    const compact = !tiny && H - screen.safeTop - screen.safeBottom < 760;
    const result = app.result;

    let y = screen.safeTop + (tiny ? 8 : compact ? 16 : 30);

    const medal = tiny ? 66 : compact ? 82 : 96;
    this.drawMedal(ctx, cx - medal / 2, y, medal);
    y += medal + (tiny ? 8 : compact ? 11 : 16);

    const titleSize = tiny ? 22 : compact ? 26 : 30;
    draw.drawText(ctx, fmt.resultTitle(result), cx, y + titleSize * 0.55, {
      font: font(titleSize, 900), color: C.text, align: 'center'
    });
    y += titleSize + (tiny ? 6 : compact ? 8 : 10);

    draw.drawText(ctx, 'YOUR FINAL SCORE', cx, y + 6, {
      font: font(tiny ? 9 : 10, 700), color: C.muted, align: 'center'
    });
    y += tiny ? 12 : compact ? 16 : 18;

    const scoreSize = tiny ? 52 : compact ? 60 : 72;
    draw.drawText(ctx, String(result.score), cx, y + scoreSize * 0.54, {
      font: font(scoreSize, 900),
      color: C.lime,
      align: 'center',
      shadowColor: 'rgba(186,244,108,0.16)',
      shadowBlur: 28
    });
    y += scoreSize * (tiny ? 1.06 : 1.08) + (tiny ? 2 : 6);

    const bestText = fmt.bestLine(result);
    const bestFont = font(tiny ? 10 : 11, 800);
    const bestW = draw.measureText(ctx, bestText, bestFont) + 28;
    const bestH = tiny ? 27 : compact ? 30 : 32;
    draw.fillRoundRect(ctx, cx - bestW / 2, y, bestW, bestH, bestH / 2, result.isNewBest ? 'rgba(186,244,108,0.15)' : 'rgba(186,244,108,0.1)');
    draw.strokeRoundRect(ctx, cx - bestW / 2, y, bestW, bestH, bestH / 2, 'rgba(186,244,108,0.28)', 1);
    draw.drawText(ctx, bestText, cx, y + bestH / 2 + 0.5, {
      font: bestFont, color: C.lime, align: 'center'
    });
    y += bestH + (tiny ? 10 : compact ? 16 : 22);

    const gap = tiny ? 8 : 10;
    const boxW = (W - side * 2 - gap) / 2;
    const boxH = tiny ? 50 : compact ? 52 : 56;
    this.drawKpi(ctx, side, y, boxW, boxH, '成功消除', result.removedCount);
    this.drawKpi(ctx, side + boxW + gap, y, boxW, boxH, '清空棋盘', result.clearedBoards);
    y += boxH + gap;
    this.drawKpi(ctx, side, y, boxW, boxH, '最长连击', result.bestStreak);
    this.drawKpi(ctx, side + boxW + gap, y, boxW, boxH, '受阻次数', result.blockedTaps);
    y += boxH + (tiny ? 10 : compact ? 16 : 20);

    const buttonH = tiny ? 44 : compact ? 48 : 50;
    draw.drawButton(ctx, side, y, W - side * 2, buttonH, '再来一局', 'primary', {
      font: font(tiny ? 15 : 16, 900), arrow: '↗', radius: 16
    });
    this.addHit('again', side, y, W - side * 2, buttonH);
    y += buttonH + 8;

    draw.drawButton(ctx, side, y, W - side * 2, buttonH, '分享成绩', 'ghost', {
      font: font(tiny ? 14 : 15, 800), radius: 16
    });
    this.addHit('share', side, y, W - side * 2, buttonH);
    y += buttonH + 2;

    const homeY = tiny ? y + 16 : y + 20;
    draw.drawText(ctx, '返回首页', cx, homeY, {
      font: font(12, 700), color: C.muted, align: 'center'
    });
    this.addHit('home', side, y, W - side * 2, tiny ? 32 : 40);

    const noteY = H - screen.safeBottom - (tiny ? 14 : compact ? 22 : 26);
    draw.drawText(ctx, '60 秒标准模式 · 本局成绩保存在本机', cx, noteY - (tiny ? 7 : 9), {
      font: font(tiny ? 9 : 10, 500), color: '#8498B3', align: 'center'
    });
    draw.drawText(ctx, '激励广告暂未接入，免费游玩永远可用', cx, noteY + (tiny ? 7 : 9), {
      font: font(tiny ? 9 : 10, 500), color: '#8498B3', align: 'center'
    });
  }

  drawMedal(ctx, x, y, size) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(186,244,108,0.14)';
    ctx.shadowBlur = 44;
    const gradient = ctx.createRadialGradient(cx - size * 0.18, cy - size * 0.2, 4, cx, cy, size * 0.72);
    gradient.addColorStop(0, '#344C5E');
    gradient.addColorStop(1, '#21345B');
    draw.fillRoundRect(ctx, x, y, size, size, 29, gradient);
    ctx.restore();
    draw.strokeRoundRect(ctx, x, y, size, size, 29, 'rgba(186,244,108,0.26)', 1);
    draw.drawSpark(ctx, cx, cy, size * 0.5, C.lime);
  }

  /* ---------------------------------- 弹层 ---------------------------------- */

  drawPanel(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, '#263959');
    gradient.addColorStop(1, '#182743');
    draw.fillRoundRect(ctx, x, y, w, h, 26, gradient);
    ctx.restore();
    draw.strokeRoundRect(ctx, x, y, w, h, 26, 'rgba(202,221,250,0.2)', 1);
  }

  drawGuide(app, now) {
    const screen = app.screenInfo;
    const ctx = app.ctx;
    const W = screen.width;
    const H = screen.height;
    this.resetHits();
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, W, H);

    const panelW = Math.min(W - 44, 350);
    const panelH = Math.min(430, H - 40);
    const x = (W - panelW) / 2;
    const y = (H - panelH) / 2;
    this.drawPanel(ctx, x, y, panelW, panelH);

    const cx = W / 2;
    const iconSize = 66;
    const iconY = y + 24;
    ctx.save();
    ctx.shadowColor = 'rgba(186,244,108,0.2)';
    ctx.shadowBlur = 20;
    draw.fillRoundRect(ctx, cx - iconSize / 2, iconY, iconSize, iconSize, 20, 'rgba(186,244,108,0.12)');
    ctx.restore();
    draw.strokeRoundRect(ctx, cx - iconSize / 2, iconY, iconSize, iconSize, 20, 'rgba(186,244,108,0.3)', 1);
    draw.drawArrow(ctx, cx + 2, iconY + iconSize / 2, 32, 'right', C.lime, 1);

    let cursorY = iconY + iconSize + 12;
    draw.drawText(ctx, '3 步学会清屏', cx, cursorY + 14, {
      font: font(23, 900), color: C.text, align: 'center'
    });
    cursorY += 44;

    const steps = [
      ['①', '看方向：点一下箭头，它会沿自己的方向直线飞出。'],
      ['②', '避开阻挡：前方还有箭头就换一支，点错扣 2 秒。'],
      ['③', '冲高分：每支 +10，连续消除和整盘清空还有加分。']
    ];
    const textX = x + 32;
    const textMax = panelW - 64;
    const stepFont = font(13, 500);
    for (let i = 0; i < steps.length; i += 1) {
      draw.drawText(ctx, steps[i][0], textX, cursorY + 6, {
        font: font(14, 900), color: C.lime, align: 'left'
      });
      ctx.save();
      ctx.font = stepFont;
      ctx.fillStyle = '#D6E5F8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const lines = draw.wrapText(ctx, steps[i][1], textMax - 26);
      for (let j = 0; j < lines.length; j += 1) {
        ctx.fillText(lines[j], textX + 26, cursorY + 6 + j * 20);
      }
      ctx.restore();
      cursorY += Math.max(28, lines.length * 20 + 8);
    }

    cursorY = Math.max(cursorY + 10, y + panelH - 118);
    const buttonX = x + 22;
    const buttonW = panelW - 44;
    draw.drawButton(ctx, buttonX, cursorY, buttonW, 48, app.guideFirstRun ? '我学会了，开始！' : '开始挑战', 'primary', {
      font: font(15, 900), radius: 15
    });
    this.addHit('guideStart', buttonX, cursorY, buttonW, 48);
    cursorY += 52;
    draw.drawText(ctx, '先不玩', cx, cursorY + 18, {
      font: font(12, 700), color: C.muted, align: 'center'
    });
    this.addHit('guideClose', buttonX, cursorY, buttonW, 36);
  }

  drawPause(app, now) {
    const screen = app.screenInfo;
    const ctx = app.ctx;
    const W = screen.width;
    const H = screen.height;
    this.resetHits();
    ctx.fillStyle = C.overlay;
    ctx.fillRect(0, 0, W, H);

    const panelW = Math.min(W - 48, 340);
    const panelH = 314;
    const x = (W - panelW) / 2;
    const y = (H - panelH) / 2;
    this.drawPanel(ctx, x, y, panelW, panelH);

    const cx = W / 2;
    draw.fillRoundRect(ctx, cx - 33, y + 22, 66, 66, 20, 'rgba(186,244,108,0.12)');
    draw.strokeRoundRect(ctx, cx - 33, y + 22, 66, 66, 20, 'rgba(186,244,108,0.3)', 1);
    draw.drawPauseGlyph(ctx, cx, y + 55, C.lime);

    draw.drawText(ctx, app.pauseAuto ? '已为你自动暂停' : '游戏暂停', cx, y + 116, {
      font: font(22, 900), color: C.text, align: 'center'
    });
    const state = app.engine.state;
    draw.drawText(ctx, '本局 ' + state.score + ' 分，剩余 ' + fmt.formatTime(state.remainingMs) + ' 秒。', cx, y + 150, {
      font: font(13, 500), color: '#B9C9DF', align: 'center'
    });
    draw.drawText(ctx, '继续挑战，或返回首页放弃本局。', cx, y + 174, {
      font: font(12, 500), color: C.muted, align: 'center'
    });

    const buttonX = x + 22;
    const buttonW = panelW - 44;
    const buttonY = y + panelH - 118;
    draw.drawButton(ctx, buttonX, buttonY, buttonW, 48, '继续挑战', 'primary', {
      font: font(15, 900), radius: 15
    });
    this.addHit('resume', buttonX, buttonY, buttonW, 48);
    draw.drawButton(ctx, buttonX, buttonY + 56, buttonW, 46, '放弃本局 · 返回首页', 'ghost', {
      font: font(13, 700), radius: 15
    });
    this.addHit('quit', buttonX, buttonY + 56, buttonW, 46);
  }

  drawToast(app, now) {
    if (!app.toast || now > app.toast.until) return;
    const ctx = app.ctx;
    const screen = app.screenInfo;
    const W = screen.width;
    const H = screen.height;
    const text = app.toast.text;
    const textFont = font(12, 800);
    const width = Math.min(W - 40, draw.measureText(ctx, text, textFont) + 32);
    const height = 34;
    const x = (W - width) / 2;
    const y = app.screen === 'game' && this.gameLayout
      ? this.gameLayout.promptY + 4
      : H - screen.safeBottom - 70 - height / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.24)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    draw.fillRoundRect(
      ctx,
      x,
      y,
      width,
      height,
      height / 2,
      app.toast.error ? 'rgba(55,24,29,0.95)' : 'rgba(21,43,39,0.94)'
    );
    ctx.restore();
    draw.strokeRoundRect(
      ctx,
      x,
      y,
      width,
      height,
      height / 2,
      app.toast.error ? 'rgba(255,130,110,0.45)' : 'rgba(186,244,108,0.35)',
      1
    );
    draw.drawText(ctx, text, W / 2, y + height / 2 + 0.5, {
      font: textFont,
      color: app.toast.error ? '#FFB0A4' : C.lime,
      align: 'center'
    });
  }
}

module.exports = { Renderer };
