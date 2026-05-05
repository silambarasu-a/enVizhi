/**
 * EnVizhi logomark.
 *
 *   Concept: an eye-shaped lens (Tamil "vizhi" = eye / vision) with an
 *   upward-trending market chart line filling the role of the pupil.
 *   Single-color, scales cleanly from 16px favicon to 512px Android icon.
 *
 * Two variants exposed:
 *   - <LogoMark size />   — outlined mark over `currentColor` (use on
 *                            light surfaces; inherits text color).
 *   - <LogoMark filled /> — solid rounded square in `currentColor`
 *                            with the eye + chart in the contrast color.
 *                            Use as a "logo tile" for top-nav, auth cards,
 *                            email headers — anywhere we need a chip.
 */

import type { CSSProperties } from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** When true, renders the rounded-square chip variant. */
  filled?: boolean;
  /** Override foreground color of the eye/chart inside the filled chip. */
  innerColor?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function LogoMark({
  size = 32,
  className,
  filled = true,
  innerColor = "#FFFFFF",
  style,
  ariaLabel = "EnVizhi",
}: LogoMarkProps) {
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      {filled ? (
        <>
          <rect width="32" height="32" rx="7" fill="currentColor" />
          {/* Eye / lens outline */}
          <path
            d="M 5 16 C 9 10, 23 10, 27 16 C 23 22, 9 22, 5 16 Z"
            fill="none"
            stroke={innerColor}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          {/* Upward-trending chart line — sits inside the eye as the pupil */}
          <path
            d="M 10.5 18 L 14 14.5 L 17.5 16.5 L 21.5 12.5"
            fill="none"
            stroke={innerColor}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <path
            d="M 4 16 C 8 9, 24 9, 28 16 C 24 23, 8 23, 4 16 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M 9.5 18.5 L 13.5 14.5 L 17.5 17 L 22.5 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
