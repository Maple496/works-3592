var canvas = null, g = null, raf = 0;

// standalone 双击运行时的条件自举（平台内条件恒假，不遮蔽容器注册通道）
if (typeof Work === 'undefined') {
  var Work = {
    register: function (mod) { this._mod = mod; if (mod && mod.mount) mod.mount({ bounds: { w: 960, h: 540 }, stage: document.body, onBounds: function () {} }); }
  };
}

function loop(ts) {
  Engine.advance(ts, function (dt) { Game.update(dt); }, function () {
    if (g && canvas) Game.render(g, canvas.width, canvas.height);
  });
  raf = requestAnimationFrame(loop);
}

function mount(ctx) {
  canvas = document.createElement('canvas');
  canvas.width = ctx.bounds.w; canvas.height = ctx.bounds.h;
  canvas.style.position = 'absolute';
  canvas.style.left = '0'; canvas.style.top = '0';
  canvas.style.width = ctx.bounds.w + 'px'; canvas.style.height = ctx.bounds.h + 'px';
  ctx.stage.appendChild(canvas);
  g = canvas.getContext('2d');
  ctx.onBounds(function (b) {
    canvas.width = b.w; canvas.height = b.h;
    canvas.style.width = b.w + 'px'; canvas.style.height = b.h + 'px';
  });
  Input.bind(canvas);
  Game.init();
  raf = requestAnimationFrame(loop);
}

function destroy() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  Input.unbind();
  if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null; g = null;
}

Work.register({ name: '弹壳地牢', mount: mount, destroy: destroy });
