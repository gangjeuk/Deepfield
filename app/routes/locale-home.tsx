import { useEffect, useState, type CSSProperties } from "react";
import { Link, redirect, useLoaderData, useNavigate } from "react-router";

import { AuroraArticleHero } from "~/components/aurora-article-hero";
import type { Route } from "./+types/locale-home";
import {
  getLocaleLandingUrl,
  getPageDate,
  getPageLocale,
  getPageSection,
  isIndexPage,
  isSiteLocale,
  localeRegistry,
  resolveCoverUrl,
  sortPagesByDate,
  summarizePage,
  type SiteLocale,
  type SourcePageLike,
} from "~/lib/docs";

type CardData = {
  url: string;
  title: string;
  summary: string;
  section: string;
  date: string;
  cover: string | null;
  localeLabel: string;
};

type LandingTheme = "dark" | "light";
type HomeThemeVars = CSSProperties & Record<`--home-${string}`, string>;

const copyByLocale = {
  en: {
    comments: "Recent Comments",
    emailPlaceholder: "Enter your email",
    eyebrow: "Silicon Valley VC notes, translated into practical engineering stories.",
    heroCollapse: "Collapse field",
    heroDeckBody: "The latest notes rotate like cards in orbit. Hover a card to bring it forward.",
    heroDeckTitle: "Open field notes",
    heroExpand: "Explore articles",
    heroHint: "Move the cursor for signal noise. Click the field to open the article deck.",
    latest: "Latest Articles",
    liveFeed: "Live Feed",
    login: "Log in",
    more: "More",
    movingNotice: "Moving",
    newsletterBody: "Get Deep Field's weekly insight letter in your inbox.",
    newsletterTitle: "Do not miss a new post",
    popular: "Popular",
    primaryCta: "Latest posts",
    secondaryCta: "Subscribe",
    series: "Article Series",
    subscribe: "Subscribe",
    title: "Deep thinking,\nReal engineering",
    viewAll: "View all",
  },
  jp: {
    comments: "最近のコメント",
    emailPlaceholder: "メールアドレス",
    eyebrow: "シリコンバレーのVCが伝える、深く実用的な技術の話。",
    heroCollapse: "閉じる",
    heroDeckBody: "最新ノートが軌道上のカードのように巡回します。カードに触れると前面に出ます。",
    heroDeckTitle: "フィールドノートを開く",
    heroExpand: "記事を開く",
    heroHint:
      "カーソルを動かすと信号ノイズが走ります。フィールドをクリックすると記事デッキが開きます。",
    latest: "Latest Articles",
    liveFeed: "ライブフィード",
    login: "ログイン",
    more: "もっと見る",
    movingNotice: "移転中",
    newsletterBody: "Deep Fieldのインサイトをメールで受け取れます。",
    newsletterTitle: "新しい記事を見逃さないでください",
    popular: "人気記事",
    primaryCta: "最新記事",
    secondaryCta: "購読する",
    series: "記事シリーズ",
    subscribe: "購読する",
    title: "Deep thinking,\nReal engineering",
    viewAll: "すべて見る",
  },
  kr: {
    comments: "최근 댓글",
    emailPlaceholder: "이메일을 입력하세요",
    eyebrow: "실리콘밸리의 VC가 전하는,\n가장 깊고 실용적인 기술 이야기",
    heroCollapse: "접기",
    heroDeckBody:
      "최신 노트가 궤도 위 카드처럼 순환합니다. 카드에 마우스를 올리면 앞으로 당겨집니다.",
    heroDeckTitle: "필드 노트 열기",
    heroExpand: "아티클 펼치기",
    heroHint: "커서를 움직이면 신호 노이즈가 살아납니다. 필드를 클릭하면 아티클 덱이 열립니다.",
    latest: "Latest Articles",
    liveFeed: "실시간 피드",
    login: "로그인",
    more: "더보기",
    movingNotice: "이사중",
    newsletterBody: "딥필드의 인사이트를 매주 이메일로 받아보세요.",
    newsletterTitle: "새로운 글, 놓치지 마세요",
    popular: "인기 글",
    primaryCta: "최신 글 보기",
    secondaryCta: "구독하기",
    series: "아티클 시리즈",
    subscribe: "구독하기",
    title: "Deep thinking,\nReal engineering",
    viewAll: "전체 보기",
  },
} satisfies Record<SiteLocale, Record<string, string>>;

const clamp2 =
  "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden";
const glass =
  "border border-[var(--home-border)] bg-[var(--home-panel)] shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl";

const homeThemeVars = {
  dark: {
    "--home-bg": "#050d18",
    "--home-border": "rgba(28,95,151,0.7)",
    "--home-card": "rgba(10,22,37,0.88)",
    "--home-faint": "#6f859d",
    "--home-muted": "#a8b8ca",
    "--home-panel": "rgba(7,22,37,0.78)",
    "--home-panel-strong": "rgba(7,22,37,0.92)",
    "--home-text": "#f8fbff",
    "--home-text-soft": "#d7e4f2",
    colorScheme: "dark",
  },
  light: {
    "--home-bg": "#f4f7fb",
    "--home-border": "rgba(148,163,184,0.48)",
    "--home-card": "rgba(255,255,255,0.92)",
    "--home-faint": "#64748b",
    "--home-muted": "#475569",
    "--home-panel": "rgba(255,255,255,0.84)",
    "--home-panel-strong": "rgba(255,255,255,0.96)",
    "--home-text": "#0f172a",
    "--home-text-soft": "#334155",
    colorScheme: "light",
  },
} satisfies Record<LandingTheme, HomeThemeVars>;

function formatDate(date: Date | null) {
  if (!date) return "ARCHIVE";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
  })
    .format(date)
    .toUpperCase();
}

function toCardData(page?: SourcePageLike): CardData {
  if (!page) {
    return {
      cover: null,
      date: "ARCHIVE",
      localeLabel: "Archive",
      section: "Archive",
      summary: "",
      title: "Untitled note",
      url: "/docs",
    };
  }

  const locale = getPageLocale(page);
  const localeInfo = locale ? localeRegistry[locale] : null;

  return {
    cover: resolveCoverUrl(page),
    date: formatDate(getPageDate(page)),
    localeLabel: localeInfo?.nativeLabel ?? "Archive",
    section: getPageSection(page),
    summary: summarizePage(page),
    title:
      typeof page.data.title === "string" && page.data.title.trim().length > 0
        ? page.data.title.trim()
        : "Untitled note",
    url: page.url,
  };
}

export async function loader({ params }: Route.LoaderArgs) {
  const localeParam = params.locale;

  if (!isSiteLocale(localeParam)) {
    throw redirect("/kr");
  }

  const { source } = await import("~/lib/source.server");
  const allPages = sortPagesByDate(
    (source.getPages() as unknown as SourcePageLike[]).filter((page) => !isIndexPage(page)),
  );
  const localePages = allPages.filter((page) => getPageLocale(page) === localeParam);
  const coverPages = localePages.filter((page) => resolveCoverUrl(page));
  const seriesSource = coverPages.length >= 4 ? coverPages : localePages;

  return {
    docsUrl: getLocaleLandingUrl(source.pageTree, localeParam) ?? "/docs",
    latestArticles: localePages.slice(0, 4).map(toCardData),
    liveFeed: localePages.slice(7, 10).map(toCardData),
    locale: localeParam,
    popularArticles: localePages.slice(4, 7).map(toCardData),
    seriesArticles: seriesSource.slice(0, 4).map(toCardData),
  };
}

function MailIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      className="h-10 w-10"
    >
      <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect x="2" y="4" width="20" height="16" rx="2" />
    </svg>
  );
}

function MailGlyph() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.75 6.75h14.5v10.5H4.75z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m5.25 7.25 6.75 5 6.75-5M5.25 17l4.9-4.2M18.75 17l-4.9-4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LanguageSelect({ locale }: { locale: SiteLocale }) {
  const navigate = useNavigate();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Select language</span>
      <select
        className="min-h-9 appearance-none rounded-md border border-[var(--home-border)] bg-[var(--home-panel-strong)] px-4 pr-9 text-[0.68rem] font-extrabold text-[var(--home-text)] outline-none transition hover:border-[#519fff]/80"
        onChange={(event) => {
          navigate(`/${event.currentTarget.value}`);
        }}
        value={locale}
      >
        <option value="en">English</option>
        <option value="jp">日本語</option>
        <option value="kr">한국어</option>
      </select>
      <span className="pointer-events-none absolute right-3 text-[0.58rem] text-[var(--home-muted)]">
        ▼
      </span>
    </label>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.4M12 18.85v2.4M21.25 12h-2.4M5.15 12h-2.4M18.54 5.46l-1.7 1.7M7.16 16.84l-1.7 1.7M18.54 18.54l-1.7-1.7M7.16 7.16l-1.7-1.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M20.2 15.15A8.25 8.25 0 0 1 8.86 3.8a8.65 8.65 0 1 0 11.34 11.34Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ThemeButton({ onToggle, theme }: { onToggle: () => void; theme: LandingTheme }) {
  const isDark = theme === "dark";

  return (
    <button
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--home-border)] bg-[var(--home-panel-strong)] text-[var(--home-text)] transition hover:border-[#519fff]/80 hover:text-[#0f6df2]"
      onClick={onToggle}
      type="button"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function AbstractThumb({ index }: { index: number }) {
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

function ArticleImage({
  compact = false,
  index,
  post,
}: {
  compact?: boolean;
  index: number;
  post: CardData;
}) {
  if (post.cover) {
    return (
      <img
        alt=""
        className={
          compact
            ? "h-full w-full object-cover contrast-105 saturate-95"
            : "aspect-video w-full object-cover contrast-105 saturate-95"
        }
        loading="lazy"
        src={post.cover}
      />
    );
  }

  return <AbstractThumb index={index} />;
}

function SectionHead({ action, title }: { action?: string; title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[1.02rem] font-black tracking-[-0.02em] text-[var(--home-text)]">
        {title}
      </h2>
      {action ? (
        <span className="text-[0.68rem] font-extrabold text-[var(--home-muted)]">
          {action} &gt;
        </span>
      ) : null}
    </div>
  );
}

function MainArticle({ index, post }: { index: number; post: CardData }) {
  return (
    <article className="grid gap-3 min-[620px]:grid-cols-[8.7rem_minmax(0,1fr)]">
      <Link
        aria-label={post.title}
        className="relative h-auto overflow-hidden rounded-md border border-[var(--home-border)] bg-[var(--home-card)] min-[620px]:h-[5.35rem]"
        to={post.url}
      >
        <ArticleImage compact index={index} post={post} />
        <span className="absolute left-1.5 top-1.5 max-w-[calc(100%-0.75rem)] truncate rounded border border-[#99cbff]/30 bg-[#1568ec]/80 px-1.5 py-0.5 text-[0.62rem] font-extrabold text-[#ddecff]">
          {post.section.split("/")[0]?.trim() || "AI"}
        </span>
      </Link>
      <div className="min-w-0">
        <Link className="group" to={post.url}>
          <h3
            className={`${clamp2} text-[0.86rem] font-bold leading-snug text-[var(--home-text)] transition group-hover:text-[#0f6df2]`}
          >
            {post.title}
          </h3>
        </Link>
        <p className={`${clamp2} mt-1.5 text-[0.72rem] leading-5 text-[var(--home-muted)]`}>
          {post.summary}
        </p>
        <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[var(--home-faint)]">
          {post.date} <span className="px-2 text-[var(--home-border)]">·</span> {post.localeLabel}
        </p>
      </div>
    </article>
  );
}

function RankedArticle({ post, rank }: { post: CardData; rank: number }) {
  return (
    <Link className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2.5 no-underline" to={post.url}>
      <span className="row-span-2 flex h-[1.75rem] w-[1.75rem] items-center justify-center rounded-full border border-[#2384ff] text-[0.78rem] font-black text-[#77bbff]">
        {rank}
      </span>
      <strong className={`${clamp2} text-[0.78rem] leading-5 text-[var(--home-text)]`}>
        {post.title}
      </strong>
      <small className="mt-0.5 text-[0.66rem] text-[var(--home-muted)]">{post.section}</small>
    </Link>
  );
}

function CommentItem({ index, post }: { index: number; post: CardData }) {
  const names = ["키기순양", "석박엔터", "재밌는너구리"];
  const avatarColor = [
    "bg-[radial-gradient(circle_at_38%_38%,#e6fbe0_0_21%,#8abf8a_22%_100%)]",
    "bg-[radial-gradient(circle_at_38%_38%,#ffe0a0_0_21%,#f08d45_22%_100%)]",
    "bg-[radial-gradient(circle_at_38%_38%,#fff0b7_0_21%,#e4b752_22%_100%)]",
  ][index % 3];

  return (
    <Link className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2.5 no-underline" to={post.url}>
      <span className={`h-7 w-7 rounded-full ${avatarColor}`} />
      <span>
        <strong className="block text-[0.74rem] text-[var(--home-text)]">
          {names[index % names.length]}
        </strong>
        <em
          className={`${clamp2} mt-0.5 block text-[0.68rem] not-italic leading-5 text-[var(--home-muted)]`}
        >
          {post.summary || post.title}
        </em>
      </span>
    </Link>
  );
}

function SeriesCard({ index, post }: { index: number; post: CardData }) {
  return (
    <article
      className={`${glass} overflow-hidden rounded-lg transition hover:-translate-y-0.5 hover:border-[#519fff]/80`}
    >
      <Link className="no-underline" to={post.url}>
        <ArticleImage index={index} post={post} />
        <div className="p-3.5">
          <h3 className={`${clamp2} text-[0.78rem] font-bold leading-snug text-[var(--home-text)]`}>
            {post.title}
          </h3>
          <p className={`${clamp2} mt-2 text-[0.67rem] leading-5 text-[var(--home-muted)]`}>
            {post.summary}
          </p>
          <span className="mt-3 inline-flex rounded-md border border-[var(--home-border)] px-2.5 py-1 text-[0.62rem] font-bold text-[var(--home-text-soft)]">
            아티클 {index * 3 + 4}개
          </span>
        </div>
      </Link>
    </article>
  );
}

export default function LocaleHomePage() {
  const { docsUrl, latestArticles, liveFeed, locale, popularArticles, seriesArticles } =
    useLoaderData<typeof loader>();
  const copy = copyByLocale[locale];
  const [theme, setTheme] = useState<LandingTheme>("dark");

  useEffect(() => {
    const storedTheme =
      localStorage.getItem("deepfield-home-theme") ?? localStorage.getItem("theme");

    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("deepfield-home-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <main
      className="relative isolate min-h-screen overflow-hidden bg-[var(--home-bg)] text-[var(--home-text)] [font-family:'Avenir_Next','Pretendard','Noto_Sans_KR','Apple_SD_Gothic_Neo',sans-serif]"
      data-home-theme={theme}
      style={homeThemeVars[theme]}
    >
      <div
        className={
          theme === "dark"
            ? "absolute inset-0 -z-30 bg-[radial-gradient(circle_at_72%_9%,rgba(33,98,164,0.35),transparent_20rem),radial-gradient(circle_at_18%_44%,rgba(19,83,153,0.2),transparent_23rem),linear-gradient(180deg,#020711_0%,#06111e_48%,#050d18_100%)]"
            : "absolute inset-0 -z-30 bg-[radial-gradient(circle_at_72%_9%,rgba(147,197,253,0.5),transparent_22rem),radial-gradient(circle_at_18%_44%,rgba(219,234,254,0.72),transparent_24rem),linear-gradient(180deg,#f8fbff_0%,#eef5ff_48%,#f4f7fb_100%)]"
        }
      />
      <div
        className={
          theme === "dark"
            ? "pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:radial-gradient(circle,rgba(255,255,255,0.78)_0_1px,transparent_1.6px),radial-gradient(circle,rgba(83,164,255,0.58)_0_1px,transparent_1.5px)] [background-position:0_0,19px_31px] [background-size:54px_54px,97px_97px]"
            : "pointer-events-none absolute inset-0 -z-10 opacity-40 [background-image:radial-gradient(circle,rgba(15,23,42,0.22)_0_1px,transparent_1.6px),radial-gradient(circle,rgba(37,99,235,0.25)_0_1px,transparent_1.5px)] [background-position:0_0,19px_31px] [background-size:54px_54px,97px_97px]"
        }
      />

      <div className="mx-auto max-w-[1330px] px-[clamp(1rem,2.35vw,2rem)] pb-6 pt-6 max-sm:px-3.5">
        <header className="grid min-h-[3.9rem] grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)] items-center gap-4 border-b border-[var(--home-border)] max-xl:grid-cols-1">
          <div className="flex items-center gap-3">
            <Link
              className="inline-flex text-[1.05rem] font-black tracking-[-0.02em] text-[var(--home-text)] no-underline"
              to={`/${locale}`}
            >
              DeepField
            </Link>
            <span className="rounded-full border border-[var(--home-border)] bg-[var(--home-panel)] px-2.5 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.12em] text-[var(--home-muted)]">
              {copy.movingNotice}
            </span>
          </div>

          <nav aria-label="Main navigation" className="flex justify-center">
            <Link
              className="text-[0.72rem] font-extrabold text-[var(--home-text-soft)] no-underline transition hover:text-[#0f6df2]"
              to={docsUrl}
            >
              Docs
            </Link>
          </nav>

          <div className="flex items-center justify-end gap-2.5 max-xl:justify-start max-sm:flex-wrap">
            <LanguageSelect locale={locale} />
          </div>
        </header>

        <AuroraArticleHero articles={latestArticles} copy={copy} />

        <section
          className="grid grid-cols-[minmax(0,1fr)_19.5rem] gap-5 max-lg:grid-cols-1 pt-7"
          id="latest"
        >
          <div>
            <Link className="no-underline" to={docsUrl}>
              <SectionHead action={copy.more} title={copy.latest} />
            </Link>
            <div className="space-y-4">
              {latestArticles.map((post, index) => (
                <MainArticle index={index} key={post.url} post={post} />
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <aside className={`${glass} rounded-lg p-4`}>
              <SectionHead title={copy.popular} />
              <div className="space-y-4">
                {popularArticles.map((post, index) => (
                  <RankedArticle key={post.url} post={post} rank={index + 1} />
                ))}
              </div>
            </aside>

            <aside className={`${glass} rounded-lg p-4`}>
              <SectionHead title={copy.liveFeed} />
              {/* <div className="space-y-4">
                {liveFeed.map((post, index) => (
                  <CommentItem index={index} key={post.url} post={post} />
                ))}
              </div> */}
            </aside>
          </div>
        </section>

        <section className="mt-7">
          <Link className="no-underline" to={docsUrl}>
            <SectionHead action={copy.viewAll} title={copy.series} />
          </Link>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {seriesArticles.map((post, index) => (
              <SeriesCard index={index} key={post.url} post={post} />
            ))}
          </div>
        </section>

        <section
          className={`${glass} mt-4 grid items-center gap-4 rounded-lg p-4 min-[860px]:grid-cols-[auto_minmax(13rem,1fr)_minmax(20rem,0.9fr)]`}
          id="newsletter"
        >
          <div className="flex w-24 justify-center drop-shadow-[0_16px_26px_rgba(74,139,210,0.35)] max-[860px]:w-auto max-[860px]:justify-start">
            <MailIcon />
          </div>
          <div>
            <h2 className="text-[clamp(1.2rem,1.9vw,1.55rem)] font-black tracking-[-0.04em] text-[var(--home-text)]">
              {copy.newsletterTitle}
            </h2>
            <p className="mt-1 text-[0.72rem] text-[var(--home-muted)]">{copy.newsletterBody}</p>
          </div>
          <form
            className="grid overflow-hidden rounded-md border border-[var(--home-border)] min-[620px]:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <label className="sr-only" htmlFor="home-newsletter-email">
              {copy.emailPlaceholder}
            </label>
            <input
              className="min-h-9 min-w-0 bg-[var(--home-card)] px-4 text-[0.7rem] text-[var(--home-text)] outline-none placeholder:text-[var(--home-faint)]"
              id="home-newsletter-email"
              placeholder={copy.emailPlaceholder}
              type="email"
            />
            <button
              aria-label={copy.subscribe}
              className="inline-flex min-h-9 items-center justify-center bg-[#0f6df2] px-5 text-white transition hover:bg-[#2b80ff]"
              type="submit"
            >
              <MailGlyph />
            </button>
          </form>
        </section>

        <footer className="grid grid-cols-[minmax(10rem,1fr)_auto_minmax(10rem,1fr)] items-center gap-4 pt-5 max-xl:grid-cols-1">
          <Link
            className="inline-flex text-[0.98rem] font-black tracking-[-0.02em] text-[var(--home-text)] no-underline"
            to={`/${locale}`}
          >
            DeepField
          </Link>
          <div className="flex gap-[clamp(1rem,2.2vw,2rem)] max-sm:flex-wrap">
            {["About", "Sitemap"].map((item) => (
              <Link
                className="text-[0.68rem] font-bold text-[var(--home-text-soft)] no-underline transition hover:text-[#0f6df2]"
                key={item}
                to={item === "Sitemap" ? "/sitemap.xml" : docsUrl}
              >
                {item}
              </Link>
            ))}
          </div>
          <div className="flex justify-self-end gap-2.5 text-[var(--home-text-soft)] max-xl:justify-self-start max-sm:flex-wrap">
            <LanguageSelect locale={locale} />
            <ThemeButton
              onToggle={() => {
                setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
              }}
              theme={theme}
            />
          </div>
        </footer>
      </div>
    </main>
  );
}
