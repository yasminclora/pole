import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',        // ← IMPORTANT
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}

export default config