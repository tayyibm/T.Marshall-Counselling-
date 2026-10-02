# T.Marshall Counselling website

This holds the pages, pictures and styles of **tmarshallcounselling.co.uk** (the part that sends the contact form lives on the web server). This note is for you and is never shown on the website, but anyone can read it on GitHub, so do not put anything private in it.

## How changes go live

Edit a file here on GitHub and save it with **Commit changes** on the **main** branch. The website collects your change within about **ten minutes**. If it hasn't appeared after half an hour (try refreshing the page), a safety check has held it back. The live site keeps showing the last good version until the problem is fixed, so ask your maintainer.

## Safe to change

- **Wording:** any text *between* the tags in `index.html` and `privacy.html`. Change the words and leave everything inside `< >` alone.
- **Prices:** press Ctrl+F (Cmd+F on a Mac) and search for `£`. Each price appears in several places (the description near the very top of the file that Google shows, the top of the page, price cards, FAQ, the contact form's list and the footer). That covers the £50 one-to-one session, the £30 first session (40 minutes) and the £30-per-person group wording ("groups of around 8"). Change every one so they all match.
- **Your photo:** replace **both** `assets/img/t-marshall.jpg` and `assets/img/t-marshall.webp`, keeping those exact names. Please send new photos to your maintainer to resize first instead of uploading straight from your phone. Phone photos are too big for the website (very large files are skipped) and can carry hidden details, such as where they were taken.

| To change… | Open | Look near the comment |
|---|---|---|
| The headline and welcome | `index.html` | `<!-- Hero Section -->` |
| Your biography | `index.html` | `<!-- About Section -->` |
| Services and prices (including the first-session price and the group wording) | `index.html` | `<!-- Services & Fees Section -->` |
| FAQ answers | `index.html` | `<!-- FAQ Section -->` |
| Contact text, or adding a phone number | `index.html` | `<!-- Contact Section -->` (follow the note there) |
| How quickly you reply (“within a week” / “up to a week”) | `index.html`, `thanks.html` and `privacy.html` | The reply time appears in several places. Search each file for “a week” and change every one. Leave the questionnaire wording (“Over the last 2 weeks”) exactly as it is |
| The privacy notice | `privacy.html` | Anywhere in the file, then change the "Last updated" date |

## Please don't

- **Don't regenerate or re-upload the whole page from an AI site builder.** It will silently remove the working contact form, the privacy wording and the self-hosted fonts.
- **Don't rename** anything written as `id="…"` or `name="…"`, and don't rename, move or delete anything in the `assets` folder. The contact form and self-checks rely on them.
- **Don't add scripts or anything loaded from another website** (fonts, maps, widgets, analytics). The site promises visitors that nothing comes from other companies, and it is set up to refuse them. Ordinary links that people click are fine.
- **Don't restyle things by editing `class="…"`.** The styles are pre-built, so new ones won't show. Ask your maintainer.
- **Don't change the emergency numbers** (999, NHS 111, Samaritans and the rest).
- **The email address** is set on the server as well. Changing it in the text does not change where messages go, so ask your maintainer.

## Notes in double square brackets

While the site was being built, facts still to be confirmed were marked in the pages as notes in double
square brackets starting with the word CONFIRM. None remain. If you ever type such a note into any page,
**the live site will stop updating until it is removed** (the publishing step refuses it on purpose, so an
unfinished page can never go out).

Your ICO (Information Commissioner's Office) registration number is not on the privacy notice yet. When you
have it, ask your maintainer to add it, or add a line under "Who is responsible for your information" in
`privacy.html`.

## Undoing a mistake

Nothing is ever lost, because GitHub keeps every saved version. Open the file, click **History**, open the version from before the mistake and click **Copy raw file**. Then open the current file, click the pencil (Edit), select everything, paste, and **Commit changes**. Or just tell your maintainer which change to undo.

## Who to ask

The person who set up your website for you. Keep their contact details in your phone rather than here, because this page is public.
