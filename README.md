# Insightful-Muon

Yash Jain's portfolio: a minimal pixel-art site with a DOOM-style fire, live at
<https://yash-jain-1.github.io/Insightful-Muon/>.

## Editing content

Everything on the page comes from **[`content/site.yml`](content/site.yml)**.

| To… | Do this |
| --- | --- |
| Add a job or project | Copy an existing block in `experience:` or `projects:` and edit it |
| Remove something but keep it for later | Add `hidden: true` to it |
| Reorder | Move the block up or down; page order = file order |
| Make a project big, with an image | `featured: true` and `image: projects/<file>` (put the file in `assets/img/projects/`) |
| Tuck an old project away | `archived: true` puts it in the "Older projects" drawer |
| Hide or reorder whole sections | Edit the `sections:` list |
| Add a résumé button | Put the PDF in `static/` and set `site.resume: resume.pdf` |
| Change the accent colour or fire | Edit `theme:` |

Text fields accept `**bold**`, `` `code` `` and `[links](https://…)`.

## Building

```sh
npm install
npm start        # builds and previews on http://localhost:8000
npm run build    # just builds into public/
```

The build checks `site.yml` and stops with a list of problems (missing titles,
missing images, unknown section names). Pushing to `main` builds and deploys
via GitHub Actions; pull requests run the same build as a check.

## Files

- `content/site.yml` content
- `scripts/build.mjs` renders the YAML into `public/index.html`
- `assets/styles.css`, `assets/main.js` look and behaviour (fire, pixelated images)
- `assets/img/` images
- `static/` copied as-is to the site root (résumé, etc.)

The fire follows [filipedeschamps/doom-fire-algorithm](https://github.com/filipedeschamps/doom-fire-algorithm) (the PSX DOOM fire); set `theme.fire.wind` to `left`, `right` or `none`. It pauses when off-screen, and shows a
still frame for visitors who prefer reduced motion. Click it to put it out.
