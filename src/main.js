var canvas = null, g = null, raf = 0;

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
