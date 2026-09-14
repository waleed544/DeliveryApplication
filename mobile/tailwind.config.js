/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
      },
      colors: {
        // New brand palette
        primary: {
          50:  '#f5ffd4',
          100: '#eaffaa',
          200: '#d8f970',
          300: '#c6f040',
          400: '#b9fa08',  // main accent
          500: '#b9fa08',  // same — the lime-neon
          600: '#97cb00',
          700: '#739b00',
          800: '#526e00',
          900: '#384b00',
        },
        navy: {
          900: '#05142B',  // darkest bg
          800: '#0a1f3f',
          700: '#0e2a52',
          600: '#133564',
          500: '#1a4480',
        },
        brand: {
          bg:    '#05142B',
          green: '#B9FA08',
        }
      },
      backgroundImage: {
        'navy-gradient': 'linear-gradient(135deg, #05142B 0%, #0a1f3f 100%)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}