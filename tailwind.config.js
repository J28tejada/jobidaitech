module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Acento principal: violeta/índigo eléctrico (vivo sobre fondo oscuro)
        primary: {
          50: '#f2f0ff',
          100: '#e7e2ff',
          200: '#cec4ff',
          300: '#ad9dff',
          400: '#8f78ff',
          500: '#7857ff',
          600: '#6a44f5',
          700: '#5a33d8',
          800: '#492bad',
          900: '#3a2388',
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
