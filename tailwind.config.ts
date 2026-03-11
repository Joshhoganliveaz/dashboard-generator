import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FAF6F0",
        terra: { DEFAULT: "#C2703E", light: "#D4915F", dark: "#A85A2A" },
        sage: { DEFAULT: "#7A8B6F", dark: "#5C6B52", light: "#9AAD8E" },
        sand: { DEFAULT: "#D4A574", light: "#E8CDB0", pale: "#F5EDE3" },
        slate: { DEFAULT: "#3D3D3D", light: "#5A5A5A" },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        display: ["Playfair Display", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
