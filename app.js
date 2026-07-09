/**
 * Constelação — motor visual e sonoro.
 * Uso: Constelacao.init(canvasEl, { audio: true })
 */
(function (global) {
  "use strict";

  function createAudioEngine() {
    let ctx = null;

    function ensureCtx() {
      if (!ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function pluck(freq, opts) {
      const audioCtx = ensureCtx();
      if (!audioCtx) return;
      const { gain = 0.05, duration = 0.6, type = "sine" } = opts || {};

      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

      g.gain.setValueAtTime(0, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(gain, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(g).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration + 0.05);
    }

    const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

    return {
      starBorn(index) {
        const freq = PENTATONIC[index % PENTATONIC.length];
        pluck(freq, { gain: 0.06, duration: 0.9, type: "sine" });
      },
      connection(distanceRatio) {
        const freq = 220 + (1 - distanceRatio) * 220;
        pluck(freq, { gain: 0.02, duration: 0.35, type: "triangle" });
      },
      resume() {
        ensureCtx();
      },
    };
  }

  function init(canvas, options) {
    if (!canvas || !canvas.getContext) {
      throw new Error("Constelacao.init requer um elemento <canvas> válido");
    }
    const opts = Object.assign({ audio: true, maxStars: 260, linkDistance: 130 }, options);
    const ctx2d = canvas.getContext("2d");
    const audio = opts.audio ? createAudioEngine() : null;

    let width = 0;
    let height = 0;
    let dpr = Math.max(1, global.devicePixelRatio || 1);
    let stars = [];
    let pointer = { x: -9999, y: -9999, active: false };
    let rafId = null;
    let reducedMotion = false;
    let starCounter = 0;

    const mql = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql) {
      reducedMotion = mql.matches;
      const onChange = (e) => (reducedMotion = e.matches);
      if (mql.addEventListener) mql.addEventListener("change", onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.max(1, global.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seedStars(count) {
      stars = [];
      for (let i = 0; i < count; i++) {
        addStar(Math.random() * width, Math.random() * height, false);
      }
    }

    function addStar(x, y, playSound) {
      if (stars.length >= opts.maxStars) stars.shift();
      const star = {
        id: starCounter++,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: 0.6 + Math.random() * 1.6,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.2,
        birth: performance.now(),
      };
      stars.push(star);
      if (playSound && audio) audio.starBorn(star.id);
      return star;
    }

    function step(now) {
      ctx2d.clearRect(0, 0, width, height);

      const linkDistSq = opts.linkDistance * opts.linkDistance;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!reducedMotion) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < 0 || s.x > width) s.vx *= -1;
          if (s.y < 0 || s.y > height) s.vy *= -1;
        }

        if (pointer.active) {
          const dx = pointer.x - s.x;
          const dy = pointer.y - s.y;
          const distSq = dx * dx + dy * dy;
          const pull = 6000;
          if (distSq < pull && distSq > 4) {
            const f = (pull - distSq) / pull * 0.02;
            s.vx += dx * f * 0.02;
            s.vy += dy * f * 0.02;
          }
        }

        const speed = Math.hypot(s.vx, s.vy);
        const maxSpeed = 0.6;
        if (speed > maxSpeed) {
          s.vx = (s.vx / speed) * maxSpeed;
          s.vy = (s.vy / speed) * maxSpeed;
        }
      }

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const a = stars[i];
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < linkDistSq) {
            const ratio = distSq / linkDistSq;
            const opacity = 1 - ratio;
            ctx2d.strokeStyle = `rgba(180, 200, 255, ${(opacity * 0.5).toFixed(3)})`;
            ctx2d.lineWidth = 1;
            ctx2d.beginPath();
            ctx2d.moveTo(a.x, a.y);
            ctx2d.lineTo(b.x, b.y);
            ctx2d.stroke();
          }
        }
      }

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const twinkle = 0.6 + 0.4 * Math.sin(now * 0.001 * s.twinkleSpeed + s.twinklePhase);
        ctx2d.beginPath();
        ctx2d.fillStyle = `rgba(255, 255, 255, ${(0.5 + 0.5 * twinkle).toFixed(3)})`;
        ctx2d.arc(s.x, s.y, s.radius * (0.8 + 0.4 * twinkle), 0, Math.PI * 2);
        ctx2d.fill();
      }

      rafId = global.requestAnimationFrame(step);
    }

    function pointerMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = clientX - rect.left;
      pointer.y = clientY - rect.top;
      pointer.active = true;
    }

    function pointerLeave() {
      pointer.active = false;
    }

    function spawnAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const star = addStar(x, y, true);

      if (audio) {
        let nearest = null;
        let nearestDistSq = Infinity;
        for (const other of stars) {
          if (other === star) continue;
          const dx = other.x - star.x;
          const dy = other.y - star.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = other;
          }
        }
        const linkDist = opts.linkDistance;
        if (nearest && nearestDistSq < linkDist * linkDist) {
          audio.connection(Math.sqrt(nearestDistSq) / linkDist);
        }
      }
    }

    function onPointerMove(e) {
      const point = e.touches ? e.touches[0] : e;
      if (point) pointerMove(point.clientX, point.clientY);
    }

    function onClick(e) {
      if (audio) audio.resume();
      spawnAt(e.clientX, e.clientY);
    }

    function onTouchStart(e) {
      if (audio) audio.resume();
      const t = e.touches[0];
      if (t) {
        pointerMove(t.clientX, t.clientY);
        spawnAt(t.clientX, t.clientY);
      }
    }

    canvas.addEventListener("mousemove", onPointerMove);
    canvas.addEventListener("mouseleave", pointerLeave);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onPointerMove, { passive: true });
    canvas.addEventListener("touchend", pointerLeave);

    global.addEventListener("resize", resize);

    resize();
    seedStars(reducedMotion ? 40 : 90);
    rafId = global.requestAnimationFrame(step);

    return {
      destroy() {
        global.cancelAnimationFrame(rafId);
        global.removeEventListener("resize", resize);
        canvas.removeEventListener("mousemove", onPointerMove);
        canvas.removeEventListener("mouseleave", pointerLeave);
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onPointerMove);
        canvas.removeEventListener("touchend", pointerLeave);
      },
      addStar,
      getStarCount() {
        return stars.length;
      },
    };
  }

  global.Constelacao = { init };
})(typeof window !== "undefined" ? window : this);
