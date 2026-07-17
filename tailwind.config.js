module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Acento principal: enrutado por variables CSS para poder cambiarlo
        // en vivo desde el selector de colores (ver src/lib/themes.ts).
        primary: {
          50: 'var(--p-50)',
          100: 'var(--p-100)',
          200: 'var(--p-200)',
          300: 'var(--p-300)',
          400: 'var(--p-400)',
          500: 'var(--p-500)',
          600: 'var(--p-600)',
          700: 'var(--p-700)',
          800: 'var(--p-800)',
          900: 'var(--p-900)',
        },
        // Verde esmeralda vivo
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10d98a',
          600: '#0bbf76',
          700: '#0a9a61',
          800: '#0a7a4f',
          900: '#095f40',
        },
        // Rojo/rosa vivo
        danger: {
          50: '#fff1f3',
          100: '#ffe4e8',
          200: '#fecdd5',
          300: '#fda4b0',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
      },
    },
  },
  plugins: [],
}
