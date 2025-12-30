import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "slide-up": "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "slide-down": "slideDown 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "slide-in-right": "slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "slide-out-right": "slideOutRight 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "slide-in-left": "slideInLeft 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "fade-in": "fadeIn 0.2s ease-out forwards",
        "fade-out": "fadeOut 0.15s ease-out forwards",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards",
        shimmer: "shimmer 1.5s infinite",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.32, 0.72, 0, 1)",
        bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      },
      transitionDuration: {
        "250": "250ms",
        "350": "350ms",
      },
    },
  },
  plugins: [],
};

export default config;
