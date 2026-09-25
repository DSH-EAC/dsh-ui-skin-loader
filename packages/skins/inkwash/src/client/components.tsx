/**
 * 水墨青烟的 React 组件（client 半）。
 *
 * 只有一个席位组件：`InkwashBackdrop`——宿主 shell.overlay 席位渲染的水墨氛围层
 * （远山一抹 + 淡烟两缕，装饰性 SVG；aria-hidden 不承载交互；SVG 渐变 id 全部带
 * skn-inkwash 前缀防文档级冲突；样式来自皮肤自有 style 节点——见 background.ts）。
 *
 * inkwash 不提供设置 UI（公约 §4.2：皮肤可以不提供设置而不被区别对待），
 * 因此没有 settings.section 席位——这是与 aurora 包的结构性对照。
 */

import type { ReactElement } from "react";

import { CSS_PREFIX } from "../identity.ts";

/** 水墨氛围层：宿主 shell.overlay 席位渲染的装饰层。 */
export function InkwashBackdrop(): ReactElement {
  return (
    <div data-skn-inkwash-backdrop="" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 900">
        <defs>
          <radialGradient id={`${CSS_PREFIX}-mist-a`} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#3a4550" stopOpacity=".16" />
            <stop offset="1" stopColor="#3a4550" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${CSS_PREFIX}-mist-b`} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#5a6672" stopOpacity=".12" />
            <stop offset="1" stopColor="#5a6672" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="330" cy="210" rx="460" ry="240" fill={`url(#${CSS_PREFIX}-mist-a)`} />
        <ellipse cx="1150" cy="330" rx="420" ry="220" fill={`url(#${CSS_PREFIX}-mist-b)`} />
        {/* 远山一抹（压角淡墨） */}
        <path
          d="M-40 780 C 260 640, 520 780, 820 690 S 1320 700, 1500 640"
          fill="none"
          stroke="#3a4550"
          strokeOpacity=".18"
          strokeWidth="52"
          strokeLinecap="round"
        />
        {/* 淡烟两缕 */}
        <path
          d="M120 830 C 420 760, 760 850, 1080 780"
          fill="none"
          stroke="#5a6672"
          strokeOpacity=".14"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M300 870 C 620 820, 980 880, 1320 820"
          fill="none"
          stroke="#5a6672"
          strokeOpacity=".09"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
