"use client";

import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

const INK = "#2D2D2D";

/* Hand-drawn pipeline icons. Ink outlines, soft paper-accent fills —
   kept consistent with the pipeline animation's station icons. */

export function IdeaIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8.5 4.5L7 3M15.5 4.5L17 3M5 9.5H3M21 9.5h-2"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 3.2c-3.6 0-6.2 2.4-6.2 5.7 0 2.1 1.1 3.8 2.4 5.2l.5 2h6.6l.5-2c1.3-1.4 2.4-3.1 2.4-5.2 0-3.3-2.6-5.7-6.2-5.7z"
        fill="#FEF08A"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11l1.5-2 1 2 1.5-2"
        fill="none"
        stroke={INK}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.5 18.5h5M10.5 21h3" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function DocumentIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 4.5C5 3.7 5.7 3 6.5 3H14l5.5 5.5V19.5c0 .8-.7 1.5-1.5 1.5H6.5C5.7 21 5 20.3 5 19.5V4.5z"
        fill="#BFDBFE"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 3v5.5h5.5" fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 12h8M8 15h7M8 18h5" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TasksIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" fill="#E9D5FF" stroke={INK} strokeWidth="1.8" />
      <rect x="9" y="2.5" width="6" height="3" rx="1.2" fill={INK} stroke={INK} strokeWidth="1" />
      <path
        d="M7.8 10l1.2 1.2 2.4-2.6"
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="13" y1="9.5" x2="17" y2="9.5" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M7.8 15.5l1.2 1.2 2.4-2.6"
        fill="none"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="13" y1="15" x2="17" y2="15" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CodeIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="#A7F3D0" stroke={INK} strokeWidth="1.8" />
      <line x1="3" y1="8.5" x2="21" y2="8.5" stroke={INK} strokeWidth="1.4" />
      <circle cx="6" cy="6.5" r="0.9" fill={INK} />
      <circle cx="8.6" cy="6.5" r="0.9" fill={INK} />
      <circle cx="11.2" cy="6.5" r="0.9" fill={INK} />
      <path
        d="M9 12l-2.5 2.5L9 17M15 12l2.5 2.5L15 17"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="13" y1="11.5" x2="11" y2="17.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ReviewIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="6" fill="#FBCFE8" stroke={INK} strokeWidth="1.8" />
      <path d="M14.5 14.5L20 20" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M7.3 10l1.8 1.9 3.4-4"
        fill="none"
        stroke={INK}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ReleaseIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 2.5c3.2 2.3 4.6 6 4.6 9.2 0 2.6-1 4.6-1 4.6H8.4s-1-2-1-4.6c0-3.2 1.4-6.9 4.6-9.2z"
        fill="#FDBA74"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" />
      <path d="M9.2 15l-2.7 3v2.2h3.2v-2.4M14.8 15l2.7 3v2.2h-3.2v-2.4" fill="#FDBA74" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M10 19.5q2 2.2 4 0" fill="#F97316" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StageIconDispatcher({
  stage,
  size = 24,
  className = "",
}: {
  stage: string;
  size?: number;
  className?: string;
}) {
  switch (stage) {
    case "idea":
      return <IdeaIcon size={size} className={className} />;
    case "document":
      return <DocumentIcon size={size} className={className} />;
    case "tasks":
      return <TasksIcon size={size} className={className} />;
    case "code":
      return <CodeIcon size={size} className={className} />;
    case "review":
      return <ReviewIcon size={size} className={className} />;
    case "release":
      return <ReleaseIcon size={size} className={className} />;
    default:
      return null;
  }
}
