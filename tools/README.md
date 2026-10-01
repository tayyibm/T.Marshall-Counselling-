# CSS build tools

The page styling is written with Tailwind classes (for example `bg-sage-600`). Browsers cannot read those
directly, so they are compiled once into `assets/css/site.css`. That compiled file is committed to the repo,
so the live site needs no build step.

**You only need to rebuild when a page gains a Tailwind class that was not used before.** Changing wording,
prices or links does not need a rebuild.

How to rebuild (on the maintainer's laptop, needs Node via nvm and internet the first time):

    /home/fd34/Dev/terry/site/tools/build-css.sh

It can be run from any folder. It reads `../*.html` and `../assets/js/site.js`, uses `tailwind.config.js`
(colours and fonts) and `input.css` (fonts, icon style, focus outline), and rewrites `../assets/css/site.css`.
Then commit the new `site.css`.

Classes that are only created inside `site.js` (result badge colours, the FAQ arrow) are listed in the
`safelist` in `tailwind.config.js`, so they are always included.

This folder is not published to the live site.
