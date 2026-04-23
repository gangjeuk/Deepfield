import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { gsap } from "gsap";

import { CardSwap, SwapCard } from "./reactbits-card-swap";

export type AuroraArticleHeroArticle = {
  cover: string | null;
  date: string;
  localeLabel: string;
  section: string;
  summary: string;
  title: string;
  url: string;
};

export type AuroraArticleHeroCopy = {
  heroCollapse: string;
};

const clamp2 =
  "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";

const fallingStarPresets = [
  { delay: 0.15, duration: 2.8, left: "76%", repeatDelay: 3.8, top: "12%", width: "11rem" },
  { delay: 1.6, duration: 3.2, left: "88%", repeatDelay: 4.6, top: "24%", width: "8rem" },
  { delay: 3.4, duration: 2.6, left: "67%", repeatDelay: 5.1, top: "5%", width: "9.5rem" },
  { delay: 5.2, duration: 3, left: "94%", repeatDelay: 4.2, top: "39%", width: "7rem" },
];

const hoverFallingStarPresets = [
  { delay: 0.05, duration: 2.1, left: "70%", repeatDelay: 1.1, top: "16%", width: "8.5rem" },
  { delay: 0.55, duration: 1.9, left: "84%", repeatDelay: 1.4, top: "9%", width: "6.5rem" },
  { delay: 1.05, duration: 2.3, left: "92%", repeatDelay: 1.2, top: "31%", width: "7.5rem" },
  { delay: 1.45, duration: 2, left: "63%", repeatDelay: 1.8, top: "3%", width: "6rem" },
  { delay: 1.9, duration: 2.4, left: "80%", repeatDelay: 1.5, top: "42%", width: "9rem" },
];

function ArticleHeroThumb({ index }: { index: number }) {
  const variant = index % 4;
  const baseClass = "aspect-video h-full w-full";

  if (variant === 0) {
    return (
      <svg className={baseClass} viewBox="0 0 320 180">
        <rect fill="#3a245b" height="180" width="320" />
        <polygon fill="#d8a5ff" points="150,18 206,75 179,165 112,127 96,54" />
        <polygon fill="#8a50d8" points="203,75 240,116 204,160 178,165" />
        <polygon fill="#b889ef" points="96,54 62,111 112,127" />
      </svg>
    );
  }

  if (variant === 1) {
    return (
      <svg className={baseClass} viewBox="0 0 320 180">
        <rect fill="#3189ca" height="180" width="320" />
        <circle
          cx="160"
          cy="86"
          fill="none"
          r="46"
          stroke="#b9e2ff"
          strokeDasharray="78 24"
          strokeWidth="14"
        />
        <path d="m151 88 16 16 34-45" stroke="#fff" strokeLinecap="round" strokeWidth="7" />
        <circle cx="83" cy="80" fill="#f0b07c" r="12" />
        <path d="M68 95h30l13 44H55z" fill="#232943" />
        <circle cx="238" cy="80" fill="#f0b07c" r="12" />
        <path d="M223 95h30l13 44h-56z" fill="#232943" />
      </svg>
    );
  }

  if (variant === 2) {
    return (
      <svg className={baseClass} viewBox="0 0 320 180">
        <rect fill="#0c2445" height="180" width="320" />
        <rect fill="#2378dc" height="82" rx="8" width="132" x="76" y="46" />
        <path d="M96 70h82M96 91h65M96 112h45" stroke="#9dd1ff" strokeWidth="8" />
        <circle cx="204" cy="116" fill="none" r="28" stroke="#55adff" strokeWidth="9" />
        <path d="m226 137 31 31" stroke="#55adff" strokeLinecap="round" strokeWidth="9" />
      </svg>
    );
  }

  return (
    <svg className={baseClass} viewBox="0 0 320 180">
      <rect fill="#1b1b19" height="180" width="320" />
      <text
        fill="#fff"
        fontFamily="Arial Black, sans-serif"
        fontSize="42"
        fontWeight="900"
        x="114"
        y="73"
      >
        UNDER
      </text>
      <text
        fill="#fff"
        fontFamily="Arial Black, sans-serif"
        fontSize="42"
        fontWeight="900"
        x="114"
        y="111"
      >
        COVER
      </text>
      <text
        fill="#fff"
        fontFamily="Georgia, serif"
        fontSize="34"
        fontStyle="italic"
        x="116"
        y="145"
      >
        SILO.
      </text>
      <rect fill="#c7755b" height="10" width="34" x="116" y="153" />
      <rect fill="#f3e0c8" height="10" width="34" x="150" y="153" />
      <rect fill="#7e8c92" height="10" width="34" x="184" y="153" />
    </svg>
  );
}

function ArticleHeroImage({ index, post }: { index: number; post: AuroraArticleHeroArticle }) {
  if (post.cover) {
    return (
      <img
        alt=""
        className="aspect-video w-full object-cover contrast-105 saturate-95"
        loading="lazy"
        src={post.cover}
      />
    );
  }

  return <ArticleHeroThumb index={index} />;
}

export function AuroraArticleHero({
  articles,
  copy,
}: {
  articles: AuroraArticleHeroArticle[];
  copy: AuroraArticleHeroCopy;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const bgRef = useRef<HTMLImageElement>(null);
  const cosmicCurrentRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  const cachedCursorRef = useRef({ x: 0, y: 0 });
  const displacementMapRef = useRef<SVGFEDisplacementMapElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const stellarDriftRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const deckArticles = articles.slice(0, 4);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const values = {
      displacementScale: 0,
      x: 0,
      y: 0,
      z: 0,
    };

    function lerp(a: number, b: number, n: number) {
      return (1 - n) * a + n * b;
    }

    function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
      return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }

    function render() {
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      const cursor = cursorRef.current;
      const cachedCursor = cachedCursorRef.current;
      const travel = Math.hypot(cursor.x - cachedCursor.x, cursor.y - cachedCursor.y);

      values.x = lerp(values.x, pointerActive ? mapRange(cursor.x, 0, width, -18, 18) : 0, 0.08);
      values.y = lerp(values.y, pointerActive ? mapRange(cursor.y, 0, height, -10, 10) : 0, 0.08);
      values.z = lerp(values.z, pointerActive ? mapRange(cursor.x, 0, width, -2.2, 2.2) : 0, 0.08);
      values.displacementScale = lerp(
        values.displacementScale,
        pointerActive ? mapRange(Math.min(travel, 180), 0, 180, 0, 90) : 0,
        0.08,
      );

      if (bgRef.current) {
        gsap.set(bgRef.current, {
          rotateZ: values.z,
          scale: 1.025,
          x: values.x,
          y: values.y,
        });
      }

      if (displacementMapRef.current) {
        gsap.set(displacementMapRef.current, {
          attr: { scale: values.displacementScale },
        });
      }

      cachedCursorRef.current = { ...cursor };
    }

    gsap.ticker.add(render);

    return () => {
      gsap.ticker.remove(render);
    };
  }, [pointerActive]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      if (cosmicCurrentRef.current) {
        gsap.fromTo(
          cosmicCurrentRef.current,
          { opacity: 0.32, xPercent: -7, yPercent: 4 },
          {
            duration: 7.5,
            ease: "sine.inOut",
            opacity: 0.58,
            repeat: -1,
            xPercent: 8,
            yPercent: -5,
            yoyo: true,
          },
        );
      }

      if (stellarDriftRef.current) {
        gsap.to(stellarDriftRef.current, {
          backgroundPosition: "72px 118px, -46px 82px",
          duration: 13,
          ease: "none",
          repeat: -1,
          yoyo: true,
        });
      }

      gsap.utils.toArray<HTMLElement>("[data-falling-star]").forEach((star) => {
        const duration = Number(star.dataset.duration) || 2.8;
        const delay = Number(star.dataset.delay) || 0;
        const repeatDelay = Number(star.dataset.repeatDelay) || 4;

        gsap.fromTo(
          star,
          { opacity: 0, scaleX: 0.5, x: 0, y: 0 },
          {
            delay,
            duration,
            ease: "power2.inOut",
            keyframes: [
              { opacity: 0, scaleX: 0.5, x: 0, y: 0 },
              { opacity: 0.92, scaleX: 1, x: -72, y: 72 },
              { opacity: 0.44, scaleX: 0.9, x: -178, y: 178 },
              { opacity: 0, scaleX: 0.72, x: -292, y: 292 },
            ],
            repeat: -1,
            repeatDelay,
          },
        );
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const stars = gsap.utils.toArray<HTMLElement>("[data-hover-falling-star]");

      gsap.set(stars, { opacity: 0, scaleX: 0.5, x: 0, y: 0 });
      if (!pointerActive || expanded) return;

      stars.forEach((star) => {
        const duration = Number(star.dataset.duration) || 2;
        const delay = Number(star.dataset.delay) || 0;
        const repeatDelay = Number(star.dataset.repeatDelay) || 1.4;

        gsap.fromTo(
          star,
          { opacity: 0, scaleX: 0.45, x: 0, y: 0 },
          {
            delay,
            duration,
            ease: "power2.inOut",
            keyframes: [
              { opacity: 0, scaleX: 0.45, x: 0, y: 0 },
              { opacity: 0.86, scaleX: 0.95, x: -52, y: 52 },
              { opacity: 0.36, scaleX: 0.8, x: -132, y: 132 },
              { opacity: 0, scaleX: 0.62, x: -218, y: 218 },
            ],
            repeat: -1,
            repeatDelay,
          },
        );
      });
    }, heroRef);

    return () => ctx.revert();
  }, [expanded, pointerActive]);

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const shiftX = (x - 50) / 50;
    const shiftY = (y - 50) / 50;

    event.currentTarget.style.setProperty("--hero-x", `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--hero-y", `${y.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--hero-offset-x", `${(shiftX * -18).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--hero-offset-y", `${(shiftY * -12).toFixed(2)}px`);
    event.currentTarget.style.setProperty("--hero-tilt-x", `${(shiftY * -3).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--hero-tilt-y", `${(shiftX * 4).toFixed(2)}deg`);
    cursorRef.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerLeave() {
    setPointerActive(false);
    heroRef.current?.style.setProperty("--hero-x", "68%");
    heroRef.current?.style.setProperty("--hero-y", "42%");
    heroRef.current?.style.setProperty("--hero-offset-x", "0px");
    heroRef.current?.style.setProperty("--hero-offset-y", "0px");
    heroRef.current?.style.setProperty("--hero-tilt-x", "0deg");
    heroRef.current?.style.setProperty("--hero-tilt-y", "0deg");
  }

  function handleSectionClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (target.closest("a,button,input,label")) return;
    if (!expanded && !transitioning) {
      setTransitioning(true);
      timersRef.current.push(window.setTimeout(() => setExpanded(true), 180));
      timersRef.current.push(window.setTimeout(() => setTransitioning(false), 920));
    }
  }

  function handleCollapse() {
    if (transitioning) return;

    setTransitioning(true);
    timersRef.current.push(window.setTimeout(() => setExpanded(false), 120));
    timersRef.current.push(window.setTimeout(() => setTransitioning(false), 820));
  }

  function renderCardPanel(post: AuroraArticleHeroArticle, index: number) {
    return (
      <article className="h-full overflow-hidden rounded-[1.05rem] border-[1.5px] border-[#f7f4ff]/80 bg-[linear-gradient(180deg,rgb(9_8_14/0.96),rgb(4_3_9/0.96))] text-[#f7f4ff] shadow-[0_28px_80px_rgb(0_0_0/0.48),inset_0_1px_0_rgb(255_255_255/0.12)] transition group-hover:border-[#f7f4ff]">
        <div className="flex min-h-[3.55rem] items-center gap-3 border-b-[1.5px] border-[#f7f4ff]/80 px-5 text-[clamp(1rem,1.8vw,1.55rem)] font-extrabold tracking-[-0.03em] text-[#f7f4ff]/85">
          <span className="inline-flex h-6 w-6 items-center justify-center text-base font-black text-[#f7f4ff]">
            {index === 0 ? "</>" : index === 1 ? "≋" : "●"}
          </span>
          <span className="truncate">{post.section.split("/")[0]?.trim() || "Deep Field"}</span>
        </div>
        <div className="min-h-[22rem] bg-[radial-gradient(circle_at_54%_70%,rgb(108_64_255/0.34),transparent_13rem),radial-gradient(circle_at_16%_64%,rgb(108_255_242/0.16),transparent_12rem),linear-gradient(180deg,rgb(18_8_43/0.78),rgb(5_3_13/0.98))] p-[clamp(1rem,2vw,1.4rem)]">
          <div className="relative overflow-hidden rounded-[1.1rem] border border-white/10">
            <ArticleHeroImage index={index} post={post} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_70%,rgba(111,55,255,0.34),transparent_34%),linear-gradient(180deg,transparent,rgb(8_5_18/0.72))]" />
          </div>
          <p className="mt-4 text-[0.66rem] font-black uppercase tracking-[0.18em] text-[#9b92ad]">
            {post.date} <span className="px-2 text-[#5f566d]">/</span> {post.localeLabel}
          </p>
          <h3
            className={`${clamp2} mt-2 text-[clamp(1.05rem,1.6vw,1.45rem)] font-black leading-tight tracking-[-0.035em] text-[#f7f4ff]`}
          >
            {post.title}
          </h3>
          <p
            className={`${clamp2} mt-2 max-w-[28rem] text-[0.8rem] font-bold leading-6 text-[#a69db4]`}
          >
            {post.summary}
          </p>
        </div>
      </article>
    );
  }

  return (
    <section
      aria-label="Interactive article hero"
      className="group relative isolate mt-6 grid cursor-pointer [--hero-offset-x:0px] [--hero-offset-y:0px] [--hero-tilt-x:0deg] [--hero-tilt-y:0deg] [--hero-x:68%] [--hero-y:42%] [grid-template-rows:1fr_0fr] overflow-hidden rounded-[2rem] border border-[var(--home-border)] bg-[var(--home-panel-strong)] text-[var(--home-text)] shadow-[0_28px_100px_rgba(4,16,33,0.24)] transition-[grid-template-rows,border-color,box-shadow] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] data-[expanded=true]:cursor-default data-[expanded=true]:[grid-template-rows:0fr_1fr] data-[expanded=true]:shadow-[0_34px_110px_rgb(4_16_33/0.3)]"
      data-expanded={expanded}
      data-pointer={pointerActive}
      data-transitioning={transitioning}
      onClick={handleSectionClick}
      onPointerEnter={() => setPointerActive(true)}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      ref={heroRef}
    >
      <svg aria-hidden className="absolute h-0 w-0">
        <filter id="deepfield-decay-filter">
          <feTurbulence
            baseFrequency="0.72"
            numOctaves="2"
            result="noise"
            seed="11"
            type="fractalNoise"
          >
            <animate
              attributeName="baseFrequency"
              dur="1.4s"
              repeatCount="indefinite"
              values="0.54;0.92;0.64"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            ref={displacementMapRef}
            scale="7"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <img
        alt=""
        className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover object-center contrast-[1.01] saturate-[1.04] transition-[filter,opacity,transform] duration-200 will-change-transform [transform:scale(1.02)_translate3d(var(--hero-offset-x),var(--hero-offset-y),0)] group-data-[expanded=true]:opacity-40 group-data-[expanded=true]:brightness-[0.36] group-data-[expanded=true]:contrast-[1.08] group-data-[expanded=true]:saturate-[0.9] group-data-[pointer=true]:[filter:url(#deepfield-decay-filter)_saturate(1.08)_contrast(1.03)]"
        ref={bgRef}
        src="/docs-asset?path=images%2Fhome-bg.png"
      />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgb(248_251_255/0.78)_0%,rgb(248_251_255/0.42)_31%,transparent_58%),radial-gradient(ellipse_at_29%_64%,rgb(208_238_255/0.22),transparent_28rem),linear-gradient(180deg,rgb(255_255_255/0.1),rgb(220_235_250/0.04))] transition-opacity duration-500 group-data-[expanded=true]:bg-[radial-gradient(circle_at_69%_69%,rgb(104_50_255/0.24),transparent_22rem),radial-gradient(circle_at_83%_34%,rgb(20_193_231/0.12),transparent_18rem),linear-gradient(90deg,rgb(17_15_23/0.96),rgb(14_12_20/0.94))]" />
      <div
        className="pointer-events-none absolute inset-0 z-[2] bg-[conic-gradient(from_218deg_at_67%_43%,transparent_0deg,rgb(175_218_255/0.06)_14deg,rgb(184_219_255/0.48)_27deg,rgb(231_193_255/0.22)_40deg,transparent_62deg),radial-gradient(ellipse_at_71%_47%,rgb(198_225_255/0.5),transparent_24rem),radial-gradient(ellipse_at_83%_70%,rgb(151_204_255/0.28),transparent_18rem),linear-gradient(112deg,transparent_18%,rgb(255_255_255/0.22)_42%,transparent_63%)] opacity-[0.86] mix-blend-screen transition-opacity duration-500 [mask-image:linear-gradient(90deg,transparent_14%,#000_38%,#000_92%)] group-data-[expanded=true]:opacity-0"
        ref={cosmicCurrentRef}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(circle,rgb(255_255_255/0.7)_0_0.9px,transparent_1.5px),radial-gradient(circle,rgb(124_190_255/0.46)_0_1px,transparent_1.6px)] [background-position:0_0,21px_29px] [background-size:9px_9px,13px_13px] opacity-[0.34] mix-blend-screen transition-opacity duration-500 [mask-image:linear-gradient(90deg,transparent_16%,#000_34%,#000_100%)] group-data-[expanded=true]:opacity-10"
        ref={stellarDriftRef}
      />
      {fallingStarPresets.map((star, index) => (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[4] h-px origin-right -rotate-45 rounded-full bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.98),rgb(158_213_255/0.68),transparent)] opacity-0 mix-blend-screen shadow-[0_0_18px_rgb(190_224_255/0.58)] group-data-[expanded=true]:hidden"
          data-delay={star.delay}
          data-duration={star.duration}
          data-falling-star
          data-repeat-delay={star.repeatDelay}
          key={index}
          style={{
            left: star.left,
            top: star.top,
            width: star.width,
          }}
        >
          <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_16px_rgb(218_238_255/0.9)]" />
        </div>
      ))}
      {hoverFallingStarPresets.map((star, index) => (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[4] h-px origin-right -rotate-45 rounded-full bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.95),rgb(156_214_255/0.58),transparent)] opacity-0 mix-blend-screen shadow-[0_0_14px_rgb(190_224_255/0.5)] group-data-[expanded=true]:hidden"
          data-delay={star.delay}
          data-duration={star.duration}
          data-hover-falling-star
          data-repeat-delay={star.repeatDelay}
          key={index}
          style={{
            left: star.left,
            top: star.top,
            width: star.width,
          }}
        >
          <span className="absolute right-0 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_12px_rgb(218_238_255/0.82)]" />
        </div>
      ))}
      <div className="pointer-events-none absolute inset-0 z-[4] bg-[repeating-radial-gradient(circle_at_var(--hero-x)_var(--hero-y),rgb(6_17_35/0.34)_0_1px,transparent_1px_4px),repeating-linear-gradient(93deg,rgb(255_255_255/0.22)_0_1px,transparent_1px_5px)] opacity-0 mix-blend-overlay transition-opacity duration-200 [filter:url(#deepfield-decay-filter)] [mask-image:radial-gradient(circle_at_var(--hero-x)_var(--hero-y),#000_0_7rem,transparent_18rem)] group-data-[pointer=true]:opacity-30" />
      <div className="pointer-events-none absolute inset-0 z-30 bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.42),transparent),radial-gradient(circle_at_var(--hero-x)_var(--hero-y),rgb(141_217_255/0.24),transparent_18rem)] opacity-0 transition-[opacity,transform] duration-[820ms] ease-[cubic-bezier(0.16,1,0.3,1)] [transform:translate3d(-18%,0,0)_scaleX(0.55)] group-data-[transitioning=true]:opacity-100 group-data-[transitioning=true]:[transform:translate3d(64%,0,0)_scaleX(1)]" />

      <div className="relative z-10 min-h-0 overflow-hidden">
        <div className="relative grid min-h-[clamp(25rem,44vw,34rem)] items-center p-[clamp(1.35rem,4vw,3.3rem)] opacity-100 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[expanded=true]:pointer-events-none group-data-[expanded=true]:translate-y-[-0.85rem] group-data-[expanded=true]:scale-[0.985] group-data-[expanded=true]:opacity-0">
          <div className="relative z-20 max-w-[37rem]">
            <h1 className="mt-5 text-[clamp(3.2rem,7vw,6.7rem)] font-black leading-[0.86] tracking-[-0.09em] text-[var(--home-text)]">
              Deep Field
            </h1>
          </div>
        </div>
      </div>

      <div className="relative z-10 min-h-0 translate-y-[-1rem] overflow-hidden opacity-0 transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[expanded=true]:translate-y-0 group-data-[expanded=true]:opacity-100">
        <div className="relative z-10 min-h-[clamp(32rem,50vw,39rem)] translate-y-5 p-[clamp(1.35rem,4vw,3.3rem)] opacity-0 transition-[opacity,transform] delay-100 duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[expanded=true]:translate-y-0 group-data-[expanded=true]:opacity-100">
          <button
            className="absolute right-[clamp(1rem,3vw,2rem)] top-[clamp(1rem,3vw,2rem)] z-20 inline-flex min-h-10 items-center justify-center rounded-full border border-[#f7f4ff]/15 bg-[#f7f4ff]/10 px-4 text-[0.72rem] font-black text-[#f7f4ff] transition hover:-translate-y-px hover:bg-[#f7f4ff]/15"
            onClick={handleCollapse}
            type="button"
          >
            {copy.heroCollapse}
          </button>
          <div className="relative z-10 min-h-[clamp(27rem,39vw,31rem)] w-full [perspective:1450px]">
            <CardSwap
              activeIndex={activeCard}
              cardDistance={46}
              height={320}
              onCardClick={setActiveCard}
              skewAmount={3}
              verticalDistance={44}
              width={470}
            >
              {deckArticles.map((post, index) => (
                <SwapCard customClass="group" key={post.url}>
                  {renderCardPanel(post, index)}
                </SwapCard>
              ))}
            </CardSwap>
          </div>
        </div>
      </div>
    </section>
  );
}
