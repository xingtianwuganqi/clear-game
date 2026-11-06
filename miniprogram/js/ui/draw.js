/* global module */
/**
 * Canvas 绘制小工具：圆角、箭头、文本、按钮、进度条。
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

  function roundRectPath(ctx, x, y, w, h, r) {
    var radius = Math.min(Math.max(0, r), Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function fillRoundRect(ctx, x, y, w, h, r, fill) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function strokeRoundRect(ctx, x, y, w, h, r, stroke, lineWidth, dash) {
    roundRectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  function drawText(ctx, text, x, y, options) {
    var opts = options || {};
    ctx.save();
    ctx.font = opts.font || '400 14px sans-serif';
    ctx.fillStyle = opts.color || '#F4F7FB';
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.shadowColor) {
      ctx.shadowColor = opts.shadowColor;
      ctx.shadowBlur = opts.shadowBlur || 12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function measureText(ctx, text, font) {
    ctx.save();
    ctx.font = font;
    var width = ctx.measureText(String(text)).width;
    ctx.restore();
    return width;
  }

  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    var current = '';
    var source = String(text);
    for (var i = 0; i < source.length; i += 1) {
      var ch = source[i];
      if (ch === '\n') {
        lines.push(current);
        current = '';
        continue;
      }
      var test = current + ch;
      if (current && ctx.measureText(test).width > maxWidth) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, options) {
    var opts = options || {};
    ctx.save();
    ctx.font = opts.font || '400 13px sans-serif';
    ctx.fillStyle = opts.color || '#D6E5F8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    var lines = wrapText(ctx, text, maxWidth);
    for (var i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], x, y + i * lineHeight);
    }
    ctx.restore();
    return lines.length;
  }

  /**
   * 绘制一个向右为基准的箭头，内部旋转。
   */
  function drawArrow(ctx, cx, cy, size, dir, color, alpha) {
    var rotations = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };
    var rotation = rotations[dir] || 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2.2, size * 0.105);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(-size * 0.34, 0);
    ctx.lineTo(size * 0.19, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.08, -size * 0.21);
    ctx.lineTo(size * 0.37, 0);
    ctx.lineTo(size * 0.08, size * 0.21);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPill(ctx, text, cx, y, height, font, color, border, background) {
    var width = measureText(ctx, text, font) + 26;
    var x = cx - width / 2;
    fillRoundRect(ctx, x, y, width, height, height / 2, background);
    strokeRoundRect(ctx, x, y, width, height, height / 2, border, 1);
    drawText(ctx, text, cx, y + height / 2 + 0.5, {
      font: font,
      color: color,
      align: 'center',
      baseline: 'middle'
    });
    return { x: x, y: y, w: width, h: height };
  }

  function drawButton(ctx, x, y, w, h, text, kind, options) {
    var opts = options || {};
    var radius = opts.radius === undefined ? 16 : opts.radius;
    var textColor;
    var textFont = opts.font || '900 16px sans-serif';

    if (kind === 'primary') {
      var gradient = ctx.createLinearGradient(x, y, x + w, y + h);
      gradient.addColorStop(0, '#C8FA7A');
      gradient.addColorStop(1, '#A9E85A');
      ctx.save();
      ctx.shadowColor = 'rgba(150,220,80,0.2)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      fillRoundRect(ctx, x, y, w, h, radius, gradient);
      ctx.restore();
      textColor = '#13213B';
    } else if (kind === 'ghost') {
      fillRoundRect(ctx, x, y, w, h, radius, '#22324D');
      strokeRoundRect(ctx, x, y, w, h, radius, 'rgba(177,199,229,0.14)', 1);
      textColor = '#D6E5F8';
    } else if (kind === 'limeGhost') {
      fillRoundRect(ctx, x, y, w, h, radius, 'rgba(186,244,108,0.08)');
      strokeRoundRect(ctx, x, y, w, h, radius, 'rgba(186,244,108,0.28)', 1);
      textColor = '#BAF46C';
    } else {
      textColor = '#A7B6CE';
      textFont = opts.font || '700 12px sans-serif';
    }

    if (opts.disabled) {
      ctx.save();
      ctx.globalAlpha = 0.42;
    }

    drawText(ctx, text, x + w / 2, y + h / 2 + 0.5, {
      font: textFont,
      color: textColor,
      align: 'center',
      baseline: 'middle'
    });
    if (opts.arrow) {
      drawText(ctx, opts.arrow, x + w - 28, y + h / 2 + 0.5, {
        font: '400 17px sans-serif',
        color: textColor,
        align: 'center',
        baseline: 'middle'
      });
    }
    if (opts.disabled) ctx.restore();
  }

  function drawPauseGlyph(ctx, cx, cy, color) {
    ctx.save();
    ctx.fillStyle = color;
    fillRoundRect(ctx, cx - 6, cy - 7, 4, 14, 2, color);
    fillRoundRect(ctx, cx + 2, cy - 7, 4, 14, 2, color);
    ctx.restore();
  }

  function drawSoundGlyph(ctx, cx, cy, on, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 3);
    ctx.lineTo(cx - 4, cy - 3);
    ctx.lineTo(cx + 2, cy - 8);
    ctx.lineTo(cx + 2, cy + 8);
    ctx.lineTo(cx - 4, cy + 3);
    ctx.lineTo(cx - 8, cy + 3);
    ctx.closePath();
    ctx.fill();
    if (on) {
      ctx.beginPath();
      ctx.arc(cx + 2, cy, 6, -0.7, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 2, cy, 10, -0.6, 0.6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#FF826E';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 5, cy - 6);
      ctx.lineTo(cx + 12, cy + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProgressBar(ctx, x, y, w, h, percent, low) {
    fillRoundRect(ctx, x, y, w, h, h / 2, '#243851');
    var fillW = Math.max(0, Math.min(1, percent)) * w;
    if (fillW <= 0.5) return;
    var gradient = ctx.createLinearGradient(x, y, x + w, y);
    if (low) {
      gradient.addColorStop(0, '#FF9B8C');
      gradient.addColorStop(1, '#FF826E');
    } else {
      gradient.addColorStop(0, '#78D9B8');
      gradient.addColorStop(1, '#BAF46C');
    }
    fillRoundRect(ctx, x, y, fillW, h, h / 2, gradient);
  }

  function drawSpark(ctx, cx, cy, size, color) {
    drawText(ctx, '✦', cx, cy + 1, {
      font: '900 ' + size + 'px sans-serif',
      color: color,
      align: 'center',
      baseline: 'middle'
    });
  }

  return {
    roundRectPath: roundRectPath,
    fillRoundRect: fillRoundRect,
    strokeRoundRect: strokeRoundRect,
    drawText: drawText,
    measureText: measureText,
    wrapText: wrapText,
    drawWrappedText: drawWrappedText,
    drawArrow: drawArrow,
    drawPill: drawPill,
    drawButton: drawButton,
    drawPauseGlyph: drawPauseGlyph,
    drawSoundGlyph: drawSoundGlyph,
    drawProgressBar: drawProgressBar,
    drawSpark: drawSpark
  };
});
