import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  samplePPG,
  sampleBeat,
  sampleAccelerometer,
  type Physiology,
  type SiteId,
} from './simulation';

type WaveformProps = {
  physiology: Physiology;
  site: SiteId;
  clock: RefObject<{ time: number; running: boolean }>;
  compare?: { physiology: Physiology; site: SiteId } | null;
  mode?: 'stream' | 'beat' | 'accelerometer';
  annotate?: boolean;
};

type Landmark = { index: number; label: string; short: string; color: string };

const COLORS = {
  trace: '#efaa70',
  comparison: '#b7a4d1',
  cyan: '#82d9dc',
  grid: '#39322b',
  text: '#a1978d',
  bright: '#f3ede7',
};

// Landmarks are measured from the generated cycle, never placed at fixed phases.
// With a merged reflected wave there may be no discrete notch to annotate.
function findLandmarks(samples: Float32Array): Landmark[] {
  const n = samples.length;
  const smooth = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) {
      sum += samples[j];
      count++;
    }
    smooth[i] = sum / count;
  }
  let peak = 1;
  for (let i = 2; i < Math.floor(n * 0.56); i++) {
    if (smooth[i] > smooth[peak]) peak = i;
  }
  const landmarks: Landmark[] = [
    { index: peak, label: 'Systolic peak', short: 'Systolic', color: COLORS.trace },
  ];
  const threshold = Math.max(0.006, smooth[peak] * 0.012);
  for (let i = peak + 5; i < Math.floor(n * 0.76); i++) {
    if (smooth[i] > smooth[i - 1] || smooth[i] >= smooth[i + 1]) continue;
    for (let j = i + 3; j < Math.floor(n * 0.9); j++) {
      if (smooth[j] < smooth[j - 1] || smooth[j] <= smooth[j + 1]) continue;
      if (smooth[j] - smooth[i] > threshold && smooth[peak] - smooth[i] > threshold) {
        landmarks.push(
          { index: i, label: 'Dicrotic notch', short: 'Notch', color: COLORS.cyan },
          { index: j, label: 'Diastolic peak', short: 'Diastolic', color: COLORS.comparison },
        );
        return landmarks;
      }
    }
  }
  return landmarks;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function Waveform(props: WaveformProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef(props);
  const revisionRef = useRef(0);

  useLayoutEffect(() => {
    latestRef.current = props;
    revisionRef.current++;
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 640;
    let height = 240;
    let dpr = 1;
    let frame = 0;
    let lastFrame = -Infinity;
    let lastTime = NaN;
    let lastRevision = -1;
    let dirty = true;
    let visible = true;
    let displayTime = latestRef.current.clock.current?.time ?? 0;
    let hover: { x: number; y: number } | null = null;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(150, bounds.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      dirty = true;
    };

    const draw = () => {
      const { physiology, site, compare, mode = 'stream', annotate = false } = latestRef.current;
      const time = displayTime;
      const beat = mode === 'beat';
      const accelerometer = mode === 'accelerometer';
      const pad = { left: width < 420 ? 32 : 39, right: 14, top: annotate && beat ? 35 : 22, bottom: 30 };
      const plotWidth = Math.max(1, width - pad.left - pad.right);
      const plotHeight = Math.max(1, height - pad.top - pad.bottom);
      const count = Math.max(160, Math.min(1000, Math.ceil(plotWidth * 1.3)));
      const minY = accelerometer ? -2 : -0.14;
      const maxY = accelerometer ? 2 : 1.48;
      const mapY = (value: number) => pad.top + (maxY - value) / (maxY - minY) * plotHeight;
      const mapX = (index: number) => pad.left + index / (count - 1) * plotWidth;
      const span = beat ? 60 / Math.max(1, physiology.heartRate) : 5;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.font = '10px "Geist Mono Variable", "SFMono-Regular", Consolas, monospace';
      ctx.textBaseline = 'middle';

      // The vertical scale stays fixed as physiology changes, preserving amplitude.
      const ticks = accelerometer ? [-2, -1, 0, 1, 2] : [0, 0.5, 1];
      ctx.setLineDash([]);
      for (const tick of ticks) {
        const y = mapY(tick);
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 0.65;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(width - pad.right, y);
        ctx.stroke();
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = 'right';
        ctx.fillText(tick.toFixed(accelerometer ? 0 : 1), pad.left - 9, y);
      }

      const divisions = width < 400 ? 4 : 5;
      for (let i = 0; i <= divisions * 4; i++) {
        const major = i % 4 === 0;
        const x = pad.left + i / (divisions * 4) * plotWidth;
        ctx.strokeStyle = major ? COLORS.grid : '#29241f';
        ctx.lineWidth = major ? 0.65 : 0.35;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, height - pad.bottom);
        ctx.stroke();
        if (!major) continue;
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = i === 0 ? 'left' : i === divisions * 4 ? 'right' : 'center';
        const fraction = i / (divisions * 4);
        const label = beat
          ? `${Math.round(fraction * 100)}${i === divisions * 4 ? '% cycle' : ''}`
          : i === divisions * 4 ? 'now' : `−${((1 - fraction) * span).toFixed(fraction === 0 ? 0 : 1)}s`;
        ctx.fillText(label, x, height - 12);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(accelerometer ? 'g' : 'a.u.', 3, 10);
      if (!beat) {
        ctx.textAlign = 'right';
        if (accelerometer) {
          const axes = [{ label: 'X', color: COLORS.trace }, { label: 'Y', color: COLORS.cyan }, { label: 'Z', color: COLORS.comparison }];
          axes.forEach((axis, index) => {
            ctx.fillStyle = axis.color;
            ctx.fillText(axis.label, width - pad.right - (2 - index) * 27, 10);
          });
        } else ctx.fillText('5 s window', width - pad.right, 10);
      }

      const samples = new Float32Array(count);
      const comparison = compare && !accelerometer ? new Float32Array(count) : null;
      const axisY = accelerometer ? new Float32Array(count) : null;
      const axisZ = accelerometer ? new Float32Array(count) : null;
      for (let i = 0; i < count; i++) {
        const phase = i / (count - 1);
        const t = time - span + phase * span;
        if (accelerometer) {
          const acceleration = sampleAccelerometer(t, physiology);
          samples[i] = acceleration.x;
          axisY![i] = acceleration.y;
          axisZ![i] = acceleration.z;
        } else {
          samples[i] = beat ? sampleBeat(phase, physiology, site) : samplePPG(t, physiology, site);
          if (comparison && compare) {
            comparison[i] = beat
              ? sampleBeat(phase, compare.physiology, compare.site)
              : samplePPG(t, compare.physiology, compare.site);
          }
        }
      }

      const path = (values: Float32Array) => {
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const x = mapX(i);
          const y = mapY(Number.isFinite(values[i]) ? values[i] : 0);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      };
      const stroke = (values: Float32Array, color: string, glow = false, dashed = false) => {
        path(values);
        ctx.strokeStyle = color;
        ctx.lineWidth = glow ? 1.8 : 1.3;
        ctx.setLineDash(dashed ? [5, 5] : []);
        ctx.shadowBlur = glow ? 7 : 0;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.setLineDash([]);
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.left, pad.top - 2, plotWidth, plotHeight + 4);
      ctx.clip();
      if (!accelerometer) {
        path(samples);
        ctx.lineTo(width - pad.right, mapY(0));
        ctx.lineTo(pad.left, mapY(0));
        ctx.closePath();
        const fill = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
        fill.addColorStop(0, 'rgba(239, 170, 112, 0.10)');
        fill.addColorStop(1, 'rgba(239, 170, 112, 0.005)');
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (comparison) stroke(comparison, COLORS.comparison, false, true);
      if (axisY && axisZ) {
        stroke(axisZ, COLORS.comparison);
        stroke(axisY, COLORS.cyan);
      }
      stroke(samples, COLORS.trace, !accelerometer);

      if (!beat && !accelerometer) {
        const endpointY = mapY(samples[count - 1]);
        ctx.fillStyle = COLORS.trace;
        ctx.shadowColor = COLORS.trace;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(width - pad.right, endpointY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      if (beat && annotate) {
        const landmarks = findLandmarks(samples);
        const labels = landmarks.map((landmark) => {
          const label = width < 480 ? landmark.short : landmark.label;
          return { ...landmark, label, textWidth: ctx.measureText(label).width + 12, labelX: mapX(landmark.index) };
        });
        // Resolve close labels horizontally while keeping leaders on measured points.
        for (let i = 0; i < labels.length; i++) {
          const item = labels[i];
          item.labelX = clamp(item.labelX, pad.left + item.textWidth / 2, width - pad.right - item.textWidth / 2);
          if (i > 0) {
            const previous = labels[i - 1];
            item.labelX = Math.max(item.labelX, previous.labelX + (previous.textWidth + item.textWidth) / 2 + 7);
          }
        }
        for (let i = labels.length - 1; i >= 0; i--) {
          const item = labels[i];
          const next = labels[i + 1];
          const limit = next
            ? next.labelX - (next.textWidth + item.textWidth) / 2 - 7
            : width - pad.right - item.textWidth / 2;
          item.labelX = Math.min(item.labelX, limit);
        }
        for (const landmark of labels) {
          const x = mapX(landmark.index);
          const y = mapY(samples[landmark.index]);
          ctx.strokeStyle = landmark.color;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = 0.8;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.moveTo(landmark.labelX, 24);
          ctx.lineTo(x, y - 7);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#151412';
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = landmark.color;
          ctx.textAlign = 'center';
          ctx.fillText(landmark.label, landmark.labelX, 13);
        }
        if (landmarks.length === 1 && width > 290) {
          ctx.textAlign = 'right';
          ctx.fillStyle = COLORS.text;
          ctx.fillText('No distinct notch', width - pad.right, height - pad.bottom - 11);
        }
      }

      if (hover && hover.x >= pad.left && hover.x <= width - pad.right && hover.y <= height - pad.bottom) {
        const fraction = clamp((hover.x - pad.left) / plotWidth, 0, 1);
        const index = Math.round(fraction * (count - 1));
        const x = mapX(index);
        const y = mapY(samples[index]);
        ctx.strokeStyle = '#b0a294';
        ctx.lineWidth = 0.75;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, height - pad.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLORS.trace;
        ctx.beginPath();
        ctx.arc(x, clamp(y, pad.top, height - pad.bottom), 3, 0, Math.PI * 2);
        ctx.fill();

        const timeText = beat ? `${Math.round(fraction * 100)}% cycle` : `−${((1 - fraction) * span).toFixed(2)} s`;
        const valueText = accelerometer
          ? `X ${samples[index].toFixed(2)}  Y ${axisY![index].toFixed(2)}  Z ${axisZ![index].toFixed(2)} g`
          : `${samples[index].toFixed(3)} a.u.`;
        const text = `${timeText}  ·  ${valueText}`;
        const boxWidth = Math.min(width - 12, ctx.measureText(text).width + 20);
        const boxX = clamp(x - boxWidth / 2, 6, width - boxWidth - 6);
        const boxY = clamp((y > height / 2 ? y - 40 : y + 16), pad.top + 4, height - pad.bottom - 29);
        ctx.fillStyle = 'rgba(24, 21, 18, 0.97)';
        ctx.strokeStyle = '#645244';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, 26, 5);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.bright;
        ctx.fillText(text, boxX + boxWidth / 2, boxY + 13, boxWidth - 14);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      hover = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      dirty = true;
    };
    const onPointerLeave = () => { hover = null; dirty = true; };
    const onFocus = () => { hover = { x: width / 2, y: height / 2 }; dirty = true; };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') hover = null;
      else hover = { x: clamp((hover?.x ?? width / 2) + (event.key === 'ArrowLeft' ? -1 : 1) * 8, 40, width - 15), y: height / 2 };
      dirty = true;
    };

    const animate = (now: number) => {
      frame = requestAnimationFrame(animate);
      if (document.hidden || now - lastFrame < 1000 / 30) return;
      // Resizing clears the backing bitmap. Paint a fresh static frame even if
      // this plot is offscreen, then suspend its continuous animation again.
      if (!visible && !dirty && revisionRef.current === lastRevision) return;
      const current = latestRef.current;
      const currentClock = current.clock.current;
      if (currentClock?.running) displayTime = currentClock.time;
      const timeChanged = displayTime !== lastTime && current.mode !== 'beat';
      if (!dirty && !timeChanged && revisionRef.current === lastRevision) return;
      lastFrame = now;
      lastTime = displayTime;
      lastRevision = revisionRef.current;
      dirty = false;
      draw();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) dirty = true;
    });
    intersectionObserver.observe(host);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('focus', onFocus);
    canvas.addEventListener('blur', onPointerLeave);
    canvas.addEventListener('keydown', onKeyDown);
    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('focus', onFocus);
      canvas.removeEventListener('blur', onPointerLeave);
      canvas.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const accessibleLabel = props.mode === 'accelerometer'
    ? 'Simulated three-axis accelerometer data in g. Amber: X, cyan: Y, lavender: Z. Use left and right arrow keys to inspect values.'
    : `Synthetic ${props.mode === 'beat' ? 'single-cycle' : 'streaming'} PPG waveform at the ${String(props.site).replaceAll('_', ' ')}. Amplitude is in arbitrary units.${props.compare ? ' Dashed lavender trace shows the saved comparison.' : ''} Use left and right arrow keys to inspect values.`;

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 150 }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={accessibleLabel}
        tabIndex={0}
        style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', minHeight: 150, touchAction: 'pan-y' }}
      />
    </div>
  );
}
