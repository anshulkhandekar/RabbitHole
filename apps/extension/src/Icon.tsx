import React from "react";
const paths = {
  brief: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<rect x="4" y="3.5" width="12" height="13" rx="2.4"/><path d="M7 7.5h6M7 10.5h6M7 13.5h3.5"/>',
      }}
    />
  ),
  memory: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<circle cx="10" cy="10" r="6"/><path d="M10 4a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none"/>',
      }}
    />
  ),
  route: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<circle cx="5.5" cy="14.5" r="1.8"/><circle cx="14.5" cy="5.5" r="1.8"/><path d="M7.3 14.5H12a2.5 2.5 0 0 0 0-5H8a2.5 2.5 0 0 1 0-5h4.7"/>',
      }}
    />
  ),
  quiz: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<rect x="3.5" y="4" width="13" height="12" rx="2.4"/><path d="m7 10.2 2 2 4-4.4"/>',
      }}
    />
  ),
  match: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<circle cx="5" cy="6" r="1.8"/><circle cx="15" cy="14" r="1.8"/><circle cx="5" cy="14" r="1.8"/><circle cx="15" cy="6" r="1.8"/><path d="M6.8 6.6 13.2 13.4M6.8 13.4l6.4-6.8"/>',
      }}
    />
  ),
  cards: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<rect x="6" y="5.5" width="10" height="11.5" rx="2"/><path d="M4 13.5V5.2A2.2 2.2 0 0 1 6.2 3h7"/>',
      }}
    />
  ),
  link: (
    <g
      dangerouslySetInnerHTML={{
        __html:
          '<path d="M8.5 11.5l3-3"/><path d="M9 6.5l1.2-1.2a3 3 0 0 1 4.3 4.3L13.3 10.8M10.8 13.3l-1.1 1.2a3 3 0 0 1-4.3-4.3L6.7 9"/>',
      }}
    />
  ),
  bolt: (
    <g
      dangerouslySetInnerHTML={{
        __html: '<path d="M11 3 5 11h4.5L9 17l6-8h-4.5Z"/>',
      }}
    />
  ),
  moon: (
    <g
      dangerouslySetInnerHTML={{
        __html: '<path d="M15.5 12.2A6 6 0 0 1 7.8 4.5a6 6 0 1 0 7.7 7.7Z"/>',
      }}
    />
  ),

  logo: (
    <>
      <g transform="scale(.3125)" strokeWidth="5">
        <ellipse
          cx="32"
          cy="47.5"
          rx="15"
          ry="4.6"
          fill="currentColor"
          stroke="none"
        />
        <path d="M13 47.5 C13 42.3 19.5 41 24.2 41.6 C20.3 30.5 19.2 16 22.8 9.6 C25.2 5.4 29.1 6.1 30.1 11 C31.6 19 31.2 31.5 30.6 41.2 C32 41 33.2 41 34.5 41.2 C35 31 37.2 18.2 41.7 11.3 C44.2 7.6 48.3 9 47.9 13.5 C47.2 22 43.1 32.8 40.6 41.6 C45.2 41 51 42.4 51 47.5 C51 53.2 42 55.4 32 55.4 C22 55.4 13 53.2 13 47.5 Z" />
      </g>
    </>
  ),
  pause: (
    <>
      <rect
        x="5.6"
        y="4.5"
        width="2.8"
        height="11"
        rx="1.2"
        fill="currentColor"
        stroke="none"
      />
      <rect
        x="11.6"
        y="4.5"
        width="2.8"
        height="11"
        rx="1.2"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  play: (
    <>
      <path
        d="M6.5 4.8v10.4a.8.8 0 0 0 1.2.7l8.4-5.2a.8.8 0 0 0 0-1.4L7.7 4.1a.8.8 0 0 0-1.2.7Z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  plus: (
    <>
      <path d="M10 4.5v11M4.5 10h11" />
    </>
  ),
  minus: (
    <>
      <path d="M4.5 10h11" />
    </>
  ),
  check: (
    <>
      <path d="m4.8 10.4 3.4 3.3 7-7.4" />
    </>
  ),
  x: (
    <>
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </>
  ),
  chevronDown: (
    <>
      <path d="m5.5 8 4.5 4.5L14.5 8" />
    </>
  ),
  chevronRight: (
    <>
      <path d="m8 5.5 4.5 4.5L8 14.5" />
    </>
  ),
  chevronLeft: (
    <>
      <path d="M12 5.5 7.5 10l4.5 4.5" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  workspace: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2.4" />
      <path d="M8 4v12" />
      <path d="M11 8.2h3.2M11 11.6h2" />
    </>
  ),
  panel: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="2.4" />
      <path d="M12.5 4v12" />
    </>
  ),
  handoff: (
    <>
      <path d="M11 4.5h2.6A2.4 2.4 0 0 1 16 6.9v6.2a2.4 2.4 0 0 1-2.4 2.4H11" />
      <path d="M4 10h8m-2.8-3 3 3-3 3" />
    </>
  ),
  copy: (
    <>
      <rect x="7" y="7" width="9" height="9" rx="2" />
      <path d="M13 7V5.6A1.6 1.6 0 0 0 11.4 4H5.6A1.6 1.6 0 0 0 4 5.6v5.8A1.6 1.6 0 0 0 5.6 13H7" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6.5h6m4 0h2M4 13.5h2m4 0h6" />
      <circle cx="12" cy="6.5" r="1.9" />
      <circle cx="8" cy="13.5" r="1.9" />
    </>
  ),
  sync: (
    <>
      <path d="M15.5 8.5A5.6 5.6 0 0 0 5.4 6.8M4.5 11.5a5.6 5.6 0 0 0 10.1 1.7" />
      <path d="M5 3.8v3.3h3.3M15 16.2v-3.3h-3.3" />
    </>
  ),
  offline: (
    <>
      <path d="M3.5 8.3a10 10 0 0 1 3.2-1.9M10 6a10 10 0 0 1 6.5 2.3M6.2 11.2a5.4 5.4 0 0 1 2-1M12.5 10.6a5.4 5.4 0 0 1 1.3.6" />
      <circle cx="10" cy="14.6" r=".9" fill="currentColor" stroke="none" />
      <path d="m4 4 12 12" />
    </>
  ),
  search: (
    <>
      <circle cx="8.8" cy="8.8" r="4.6" />
      <path d="m12.3 12.3 3.4 3.4" />
    </>
  ),
  article: (
    <>
      <path d="M6 3.8h5.6L15 7.2v8a1.6 1.6 0 0 1-1.6 1.6H6a1.6 1.6 0 0 1-1.6-1.6V5.4A1.6 1.6 0 0 1 6 3.8Z" />
      <path d="M11.4 3.9v3.5H15M7.4 11h5.2M7.4 13.6h3.4" />
    </>
  ),
  overview: (
    <>
      <rect x="3.6" y="4" width="12.8" height="12" rx="2.4" />
      <path d="M6.8 8h6.4M6.8 10.8h4.2" />
      <circle cx="13.3" cy="12.9" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  highlight: (
    <>
      <path d="m11.6 4.6 3.8 3.8-6.6 6.6H5v-3.8l6.6-6.6Z" />
      <path d="M4 17h12" />
    </>
  ),
  excluded: (
    <>
      <path d="M3.5 10s2.4-4.6 6.5-4.6c1 0 1.9.3 2.7.7M16.5 10s-.9 1.7-2.6 3" />
      <path d="M8.3 11.7A2.4 2.4 0 0 1 11.7 8.3" />
      <path d="m4 4 12 12" />
    </>
  ),
  flag: (
    <>
      <path d="M5 17V4.2m0 .6c3.5-1.6 6.1 1.6 10 0v7c-3.9 1.6-6.5-1.6-10 0" />
    </>
  ),
  map: (
    <>
      <circle cx="5.5" cy="5.5" r="2" />
      <circle cx="14.5" cy="9" r="2" />
      <circle cx="7" cy="14.8" r="2" />
      <path d="M7.4 6.3 12.6 8.2M13.1 10.5l-4.4 3.2M5.8 7.5l.9 5.3" />
    </>
  ),
  practice: (
    <>
      <path d="M4.2 6.2A2.2 2.2 0 0 1 6.4 4h7.2a2.2 2.2 0 0 1 2.2 2.2v5.2a2.2 2.2 0 0 1-2.2 2.2H9.5L6 16.2v-2.6h0a2.2 2.2 0 0 1-1.8-2.2Z" />
      <path d="M8.4 7.6a1.7 1.7 0 1 1 2.2 1.6c-.4.1-.6.5-.6.9v.2" />
      <circle cx="10" cy="11.9" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  sources: (
    <>
      <path d="M4 5.5h12M4 10h12M4 14.5h7" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h8M8 10h8M8 14h8" />
      <circle cx="4.6" cy="6" r=".9" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="10" r=".9" fill="currentColor" stroke="none" />
      <circle cx="4.6" cy="14" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  fit: (
    <>
      <path d="M4 7.5V5.6A1.6 1.6 0 0 1 5.6 4h1.9M12.5 4h1.9A1.6 1.6 0 0 1 16 5.6v1.9M16 12.5v1.9a1.6 1.6 0 0 1-1.6 1.6h-1.9M7.5 16H5.6A1.6 1.6 0 0 1 4 14.4v-1.9" />
    </>
  ),
  flip: (
    <>
      <path d="M4.5 9A5.5 5.5 0 0 1 14.4 6.4l1.1 1.1M15.5 11a5.5 5.5 0 0 1-9.9 2.6l-1.1-1.1" />
      <path d="M15.5 4.4v3.1h-3.1M4.5 15.6v-3.1h3.1" />
    </>
  ),
};
export type IconName = keyof typeof paths;
export function Icon({
  name,
  size = 18,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`ic ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
