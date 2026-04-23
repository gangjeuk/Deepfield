import {
  Children,
  cloneElement,
  createRef,
  forwardRef,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import gsap from "gsap";

type CardRef = RefObject<HTMLDivElement | null>;

type Slot = {
  x: number;
  y: number;
  z: number;
  zIndex: number;
};

export type SwapCardProps = HTMLAttributes<HTMLDivElement> & {
  customClass?: string;
};

type CardSwapProps = {
  activeIndex?: number;
  cardDistance?: number;
  children: ReactNode;
  delay?: number;
  height?: number | string;
  onCardClick?: (idx: number) => void;
  onFrontChange?: (idx: number) => void;
  pauseOnHover?: boolean;
  skewAmount?: number;
  verticalDistance?: number;
  width?: number | string;
};

export const SwapCard = forwardRef<HTMLDivElement, SwapCardProps>(
  ({ customClass, ...rest }, ref) => (
    <div
      ref={ref}
      {...rest}
      className={`absolute left-1/2 top-1/2 rounded-xl border border-white bg-black [backface-visibility:hidden] [transform-style:preserve-3d] will-change-transform hover:contrast-105 hover:saturate-105 ${customClass ?? ""} ${rest.className ?? ""}`.trim()}
    />
  ),
);
SwapCard.displayName = "SwapCard";

function makeSlot(i: number, distX: number, distY: number, total: number): Slot {
  return {
    x: i * distX,
    y: -i * distY,
    z: -i * distX * 1.5,
    zIndex: total - i,
  };
}

function placeNow(el: HTMLElement, slot: Slot, skew: number) {
  gsap.set(el, {
    force3D: true,
    skewY: skew,
    transformOrigin: "center center",
    x: slot.x,
    xPercent: -50,
    y: slot.y,
    yPercent: -50,
    z: slot.z,
    zIndex: slot.zIndex,
  });
}

export function CardSwap({
  activeIndex,
  cardDistance = 68,
  children,
  delay = 4200,
  height = 420,
  onCardClick,
  onFrontChange,
  pauseOnHover = true,
  skewAmount = 5,
  verticalDistance = 76,
  width = 560,
}: CardSwapProps) {
  const childArr = useMemo(
    () => Children.toArray(children) as ReactElement<SwapCardProps>[],
    [children],
  );
  const refs = useMemo<CardRef[]>(
    () => childArr.map(() => createRef<HTMLDivElement>()),
    [childArr.length],
  );
  const order = useRef<number[]>(Array.from({ length: childArr.length }, (_, i) => i));
  const intervalRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(activeIndex);

  function applyOrder(nextOrder: number[], animate = true) {
    order.current = nextOrder;
    onFrontChange?.(nextOrder[0] ?? 0);

    nextOrder.forEach((idx, slotIndex) => {
      const el = refs[idx]?.current;
      if (!el) return;

      const slot = makeSlot(slotIndex, cardDistance, verticalDistance, nextOrder.length);
      const vars = {
        duration: animate ? 0.72 : 0,
        ease: "power3.out",
        force3D: true,
        skewY: skewAmount,
        transformOrigin: "center center",
        x: slot.x,
        xPercent: -50,
        y: slot.y,
        yPercent: -50,
        z: slot.z,
        zIndex: slot.zIndex,
      };

      if (animate) gsap.to(el, vars);
      else gsap.set(el, vars);
    });
  }

  useEffect(() => {
    refs.forEach((ref, index) => {
      const el = ref.current;
      if (!el) return;
      placeNow(el, makeSlot(index, cardDistance, verticalDistance, refs.length), skewAmount);
    });
    onFrontChange?.(order.current[0] ?? 0);
  }, [cardDistance, onFrontChange, refs, skewAmount, verticalDistance]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    if (activeIndex === undefined || order.current[0] === activeIndex) return;

    const rest = order.current.filter((idx) => idx !== activeIndex);
    applyOrder([activeIndex, ...rest], true);
  }, [activeIndex]);

  useEffect(() => {
    if (childArr.length < 2) return;

    const swap = () => {
      if (activeIndexRef.current !== undefined) return;
      const [front, ...rest] = order.current;
      const elFront = refs[front]?.current;
      if (!elFront) return;

      const tl = gsap.timeline();
      tl.to(elFront, { duration: 0.8, ease: "power2.in", y: "+=500" });
      tl.addLabel("promote", "-=0.42");

      rest.forEach((idx, slotIndex) => {
        const el = refs[idx]?.current;
        if (!el) return;
        const slot = makeSlot(slotIndex, cardDistance, verticalDistance, refs.length);
        tl.set(el, { zIndex: slot.zIndex }, "promote");
        tl.to(
          el,
          {
            duration: 0.72,
            ease: "power3.out",
            x: slot.x,
            y: slot.y,
            z: slot.z,
          },
          `promote+=${slotIndex * 0.08}`,
        );
      });

      const backSlot = makeSlot(refs.length - 1, cardDistance, verticalDistance, refs.length);
      tl.call(() => gsap.set(elFront, { zIndex: backSlot.zIndex }), undefined, "promote+=0.25");
      tl.to(
        elFront,
        {
          duration: 0.72,
          ease: "power3.out",
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
        },
        "promote+=0.25",
      );
      tl.call(() => {
        order.current = [...rest, front];
        onFrontChange?.(order.current[0] ?? 0);
      });
    };

    intervalRef.current = window.setInterval(swap, delay);

    if (!pauseOnHover) {
      return () => window.clearInterval(intervalRef.current);
    }

    const node = containerRef.current;
    if (!node) return () => window.clearInterval(intervalRef.current);

    const pause = () => window.clearInterval(intervalRef.current);
    const resume = () => {
      window.clearInterval(intervalRef.current);
      intervalRef.current = window.setInterval(swap, delay);
    };

    node.addEventListener("mouseenter", pause);
    node.addEventListener("mouseleave", resume);

    return () => {
      node.removeEventListener("mouseenter", pause);
      node.removeEventListener("mouseleave", resume);
      window.clearInterval(intervalRef.current);
    };
  }, [cardDistance, childArr.length, delay, onFrontChange, pauseOnHover, refs, verticalDistance]);

  const rendered = childArr.map((child, index) =>
    isValidElement<SwapCardProps>(child)
      ? cloneElement(child, {
          key: index,
          onClick: (event) => {
            child.props.onClick?.(event);
            onCardClick?.(index);
          },
          ref: refs[index],
          style: { height, width, ...(child.props.style ?? {}) },
        } as SwapCardProps & { ref: CardRef })
      : child,
  );

  return (
    <div
      className="absolute left-[44%] top-[56%] overflow-visible [perspective:900px] [transform-origin:center_center] [transform:translate(-50%,-50%)] max-lg:left-[42%] max-lg:[transform:scale(0.9)_translate(-50%,-50%)] max-md:left-[38%] max-md:top-[58%] max-md:[transform:scale(0.76)_translate(-50%,-50%)] max-[480px]:left-[31%] max-[480px]:top-[60%] max-[480px]:[transform:scale(0.58)_translate(-50%,-50%)]"
      ref={containerRef}
      style={{ height, width }}
    >
      {rendered}
    </div>
  );
}
