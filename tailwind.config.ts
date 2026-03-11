import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        dark: { DEFAULT: '#0f0f0f', card: '#1a1a1a', elevated: '#242424', border: '#2e2e2e' },
        light: { DEFAULT: '#e5e5e5', muted: '#888888', dim: '#555555' },
        accent: { DEFAULT: '#C9953E', muted: '#C9953E33', hover: '#D4A54E' },
        success: '#34D399',
        error: '#F87171',
        warning: '#FBBF24',
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
