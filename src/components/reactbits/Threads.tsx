import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

type Props = {
  amplitude?: number;
  distance?: number;
  enableMouseInteraction?: boolean;
  className?: string;
};

const vertex = /* glsl */ `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = /* glsl */ `
precision highp float;

uniform float iTime;
uniform vec3  iResolution;
uniform vec2  uMouse;
uniform float uAmplitude;
uniform float uDistance;

#define PI 3.1415926538

const int   u_line_count = 40;
const float u_line_width = 7.0;
const float u_line_blur  = 10.0;

float Perlin2D(vec2 P) {
  vec2 Pi = floor(P);
  vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
  vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
  Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
  Pt += vec2(26.0, 161.0).xyxy;
  Pt *= Pt;
  Pt = Pt.xzxz * Pt.yyww;
  vec4 hash_x = fract(Pt * (1.0 / 951.135664));
  vec4 hash_y = fract(Pt * (1.0 / 642.949883));
  vec4 grad_x = hash_x - 0.49999;
  vec4 grad_y = hash_y - 0.49999;
  vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
    * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
  grad_results *= 1.4142135623730950488;
  vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
    * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
  vec4 blend2 = vec4(blend, vec2(1.0 - blend));
  return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

float pixel(float count, vec2 res) { return (1.0 / max(res.x, res.y)) * count; }

float lineFn(vec2 st, float width, float perc, float offset, vec2 mouse, float time, float amplitude, float distance) {
  float split_offset = (perc * 0.4);
  float split_point  = 0.1 + split_offset;

  float amplitude_normal   = smoothstep(split_point, 0.7, st.x);
  float amplitude_strength = 0.5;
  float finalAmplitude     = amplitude_normal * amplitude_strength
                             * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

  float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
  float blur        = smoothstep(split_point, split_point + 0.05, st.x) * perc;

  float xnoise = mix(
    Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
    Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
    st.x * 0.3
  );

  float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

  float line_start = smoothstep(
    y + (width / 2.0) + (u_line_blur * pixel(1.0, iResolution.xy) * blur),
    y,
    st.y
  );
  float line_end = smoothstep(
    y,
    y - (width / 2.0) - (u_line_blur * pixel(1.0, iResolution.xy) * blur),
    st.y
  );

  return clamp((line_start - line_end) * (1.0 - smoothstep(0.9, 1.0, perc)), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;

  float line_strength = 1.0;
  for (int i = 0; i < u_line_count; i++) {
    float p = float(i) / float(u_line_count);
    line_strength *= (1.0 - lineFn(
      uv,
      u_line_width * pixel(1.0, iResolution.xy) * (1.0 - p),
      p,
      (PI * 1.0) * p,
      uMouse,
      iTime,
      uAmplitude,
      uDistance
    ));
  }

  float colorVal = 1.0 - line_strength;
  gl_FragColor = vec4(vec3(colorVal), colorVal);
}
`;

export default function Threads({
  amplitude = 1,
  distance = 0,
  enableMouseInteraction = false,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ alpha: true, dpr: Math.min(window.devicePixelRatio, 2) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime:       { value: 0 },
        iResolution: { value: [1, 1, 1] },
        uMouse:      { value: [0.5, 0.5] },
        uAmplitude:  { value: amplitude },
        uDistance:   { value: distance },
      },
    });

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      program.uniforms.iResolution.value = [
        w * renderer.dpr,
        h * renderer.dpr,
        (w * renderer.dpr) / Math.max(h * renderer.dpr, 1),
      ];
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    const target: [number, number] = [0.5, 0.5];
    const current: [number, number] = [0.5, 0.5];

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        target[0] = 0.5;
        target[1] = 0.5;
      } else {
        target[0] = x;
        target[1] = y;
      }
    };
    if (enableMouseInteraction) {
      window.addEventListener("mousemove", onMove);
    }

    let raf = 0;
    const start = performance.now();
    const loop = () => {
      if (enableMouseInteraction) {
        current[0] += (target[0] - current[0]) * 0.05;
        current[1] += (target[1] - current[1]) * 0.05;
        program.uniforms.uMouse.value = [current[0], current[1]];
      }
      program.uniforms.iTime.value = (performance.now() - start) / 1000;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (enableMouseInteraction) {
        window.removeEventListener("mousemove", onMove);
      }
      canvas.remove();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, [amplitude, distance, enableMouseInteraction]);

  return <div ref={containerRef} className={className ?? "absolute inset-0 w-full h-full"} />;
}
