"use client";

import * as React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type Direction = "left" | "right";
type Fit = "cover" | "contain";
type ImageInput = {
    image?: { src?: string; srcSet?: string; alt?: string } | string;
    focusY?: number;
};

interface RowSettings {
    direction: Direction;
    gap: number;
    arc: number;
}

interface Props {
    topImages?: ImageInput[];
    bottomImages?: ImageInput[];
    topRow?: RowSettings;
    bottomRow?: RowSettings;
    speed?: number;
    rowGap?: number;
    fit?: Fit;
    cardWidth?: number;
    cardHeight?: number;
    rounded?: number;
    fade?: boolean;
    fadeIntensity?: number;
    style?: React.CSSProperties;
}

const DEFAULTS = {
    topRow: {
        direction: "right" as Direction,
        gap: 32,
        arc: 63,
    },
    bottomRow: {
        direction: "left" as Direction,
        gap: 32,
        arc: 63,
    },
    speed: 20,
    rowGap: 0,
    fit: "cover" as Fit,
    focusY: 50,
    cardWidth: 150,
    cardHeight: 200,
    rounded: 2,
    fade: true,
    fadeIntensity: 100,
};

const FALLBACK_TOP: ImageInput[] = [];
const FALLBACK_BOTTOM: ImageInput[] = [];

const MAX_FADE = 40;
const PX_PER_SPEED = 14;
const CARD_SHADOW = "0 18px 42px rgba(22, 24, 29, 0.14)";

function resolveImageSrc(item: unknown): string | undefined {
    const image = (item as ImageInput)?.image;
    if (!image) return undefined;
    if (typeof image === "string") return image.trim() || undefined;
    return image.src || undefined;
}

function resolveSrcSet(item: unknown): string | undefined {
    const image = (item as ImageInput)?.image;
    if (!image || typeof image === "string") return undefined;
    return image.srcSet || undefined;
}

function focusOf(item: unknown): number {
    const value = (item as ImageInput)?.focusY;
    const n = typeof value === "number" ? value : DEFAULTS.focusY;
    return Math.min(100, Math.max(0, n));
}

const roundedPx = (rounded: number, width: number, height: number) =>
    (Math.min(width, height) / 2) * (Math.min(20, Math.max(0, rounded)) / 20);

function repeatToFill<T>(items: T[], step: number, pathWidth: number): T[] {
    if (items.length === 0) return items;
    const setWidth = Math.max(1, items.length * step);
    const copies = Math.max(2, Math.ceil((pathWidth + setWidth) / setWidth) + 1);
    return Array.from({ length: copies }).flatMap(() => items);
}

function TickerRow({
    images,
    row,
    side,
    speed,
    width,
    height,
    rowGap,
    fit,
    cardWidth,
    cardHeight,
    radius,
}: {
    images: ImageInput[];
    row: RowSettings;
    side: "top" | "bottom";
    speed: number;
    width: number;
    height: number;
    rowGap: number;
    fit: Fit;
    cardWidth: number;
    cardHeight: number;
    radius: number;
}) {
    const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

    const outside = Math.max(cardWidth * 0.75, width * 0.06);
    const pathWidth = Math.max(1, width - cardWidth + outside * 2);
    const step = Math.max(cardWidth * 0.25, cardWidth + row.gap);

    const cards = useMemo(
        () => repeatToFill(images, step, pathWidth),
        [images, step, pathWidth]
    );
    const loopLength = Math.max(1, cards.length * step);
    const pace = Math.max(1, speed) * PX_PER_SPEED;

    const bow = side === "top" ? -1 : 1;
    const baseline = height / 2 + (bow * rowGap) / 2;
    const headroom = Math.max(0, height / 2 - cardHeight / 2);
    const amplitude = headroom * (Math.min(100, Math.max(0, row.arc)) / 100);

    const dirSign = row.direction === "left" ? -1 : 1;

    const placeAt = (index: number, travel: number) => {
        const raw = index * step + travel;
        const wrapped = ((raw % loopLength) + loopLength) % loopLength;
        const progress = Math.max(0, Math.min(1, wrapped / pathWidth));
        const x = wrapped - outside;
        const y =
            baseline +
            bow * amplitude * Math.sin(Math.PI * progress) -
            cardHeight / 2;
        const visible = x > -cardWidth * 1.25 && x < width + cardWidth * 0.25;
        const z = Math.round(dirSign * x) + 100000;
        return { x, y, visible, z };
    };

    useEffect(() => {
        if (width <= 0 || height <= 0 || cards.length === 0) return;

        let frame = 0;
        const start = performance.now();
        const sign = row.direction === "left" ? -1 : 1;

        const tick = (now: number) => {
            const travel = ((now - start) / 1000) * pace * sign;

            for (let i = 0; i < cards.length; i++) {
                const el = itemRefs.current[i];
                if (!el) continue;
                const { x, y, visible, z } = placeAt(i, travel);
                el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                el.style.opacity = visible ? "1" : "0";
                el.style.zIndex = String(z);
            }

            frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [
        cards.length,
        step,
        loopLength,
        pathWidth,
        outside,
        pace,
        row.direction,
        row.arc,
        side,
        width,
        height,
        rowGap,
        cardWidth,
        cardHeight,
    ]);

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                overflow: "visible",
                pointerEvents: "none",
            }}
        >
            {cards.map((image, index) => {
                const src = resolveImageSrc(image);
                const at = placeAt(index, 0);
                return (
                    <div
                        key={`${index}-${src}`}
                        ref={(el) => {
                            itemRefs.current[index] = el;
                        }}
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: cardWidth,
                            height: cardHeight,
                            borderRadius: radius,
                            boxShadow: CARD_SHADOW,
                            overflow: "hidden",
                            willChange: "transform",
                            transform: `translate3d(${at.x}px, ${at.y}px, 0)`,
                            opacity: at.visible ? 1 : 0,
                            zIndex: at.z,
                        }}
                    >
                        {src ? (
                            <img
                                src={src}
                                srcSet={resolveSrcSet(image)}
                                alt=""
                                draggable={false}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: fit,
                                    objectPosition:
                                        fit === "cover"
                                            ? `center ${focusOf(image)}%`
                                            : "center",
                                    display: "block",
                                }}
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

export default function EyeTicker({
    topImages = FALLBACK_TOP,
    bottomImages = FALLBACK_BOTTOM,
    topRow = DEFAULTS.topRow,
    bottomRow = DEFAULTS.bottomRow,
    speed = DEFAULTS.speed,
    rowGap = DEFAULTS.rowGap,
    fit = DEFAULTS.fit,
    cardWidth = DEFAULTS.cardWidth,
    cardHeight = DEFAULTS.cardHeight,
    rounded = DEFAULTS.rounded,
    fade = DEFAULTS.fade,
    fadeIntensity = DEFAULTS.fadeIntensity,
    style,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [size, setSize] = useState({ width: 920, height: 560 });

    useLayoutEffect(() => {
        const node = containerRef.current;
        if (!node) return;
        const measure = () => {
            const width = node.clientWidth;
            const height = node.clientHeight;
            if (width && height) setSize({ width, height });
        };
        measure();
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(measure);
        observer?.observe(node);
        return () => observer?.disconnect();
    }, []);

    const scale = Math.max(0.42, Math.min(1, size.width / 920));
    const width = cardWidth * scale;
    const height = cardHeight * scale;
    const radius = roundedPx(rounded, width, height);

    const top = { ...DEFAULTS.topRow, ...topRow };
    const bottom = { ...DEFAULTS.bottomRow, ...bottomRow };

    const edge = (Math.min(100, Math.max(0, fadeIntensity)) / 100) * MAX_FADE;
    const fadeMask =
        fade && edge > 0
            ? `linear-gradient(to right, transparent 0%, black ${edge}%, black ${
                  100 - edge
              }%, transparent 100%)`
            : undefined;

    const topKey = JSON.stringify(topImages?.length ? topImages : FALLBACK_TOP);
    const bottomKey = JSON.stringify(
        bottomImages?.length ? bottomImages : FALLBACK_BOTTOM
    );
    const topList = useMemo(
        () => (JSON.parse(topKey) as ImageInput[]).filter(resolveImageSrc),
        [topKey]
    );
    const bottomList = useMemo(
        () => (JSON.parse(bottomKey) as ImageInput[]).filter(resolveImageSrc),
        [bottomKey]
    );

    return (
        <div
            ref={containerRef}
            style={{
                ...style,
                width: "100%",
                height: "100%",
                minWidth: 180,
                position: "relative",
                overflow: "hidden",
                isolation: "isolate",
                boxSizing: "border-box",
                maskImage: fadeMask,
                WebkitMaskImage: fadeMask,
            }}
        >
            <TickerRow
                images={topList}
                row={top}
                side="top"
                speed={speed}
                width={size.width}
                height={size.height}
                rowGap={rowGap}
                fit={fit}
                cardWidth={width}
                cardHeight={height}
                radius={radius}
            />
            <TickerRow
                images={bottomList}
                row={bottom}
                side="bottom"
                speed={speed}
                width={size.width}
                height={size.height}
                rowGap={rowGap}
                fit={fit}
                cardWidth={width}
                cardHeight={height}
                radius={radius}
            />
        </div>
    );
}
