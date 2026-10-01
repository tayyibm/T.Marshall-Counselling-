/*
 * Tailwind v3 config for T.Marshall Counselling.
 * Colours and fonts are copied exactly from the original page's inline tailwind.config.
 * The safelist keeps a few classes that are only built inside site.js (result badges, FAQ chevron)
 * or that the owner might use in a later edit, so they are always present in the compiled CSS.
 */
module.exports = {
  content: ['../*.html', '../assets/js/site.js'],
  safelist: [
    'bg-emerald-100', 'text-emerald-800',
    'bg-blue-100', 'text-blue-800',
    'bg-amber-100', 'text-amber-800',
    'bg-rose-100', 'text-rose-800',
    'rotate-180',
    // used only by the server's contact.php result pages (footer link), which is not in this repo
    'text-sage-100', 'hover:text-white', 'hover:underline', 'underline-offset-4',
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f4f7f4',
          100: '#e3eae3',
          200: '#c7d6c7',
          300: '#a3bca3',
          500: '#698a69',
          600: '#527052',
          700: '#425a42',
          800: '#374937',
          900: '#2f3d2f',
        },
        sand: {
          50: '#fdfbf7',
          100: '#f7f2e9',
          200: '#eee3d2',
          300: '#e1cdb2',
          500: '#bf9c72',
        },
        terracotta: {
          100: '#faeee9',
          500: '#c87a58',
          600: '#b46342',
        },
      },
      fontFamily: {
        serif: ['Marcellus', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
