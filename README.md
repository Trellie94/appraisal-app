# Appraisal App

Property development appraisal web app: sales, build, professional fees, other costs, funding (senior and mezzanine / private loans), land acquisition, a live financial summary and a printable report.

## Layout

- `src/engine.js`: the calculation engine (no browser code)
- `src/samples.js`: blank appraisal template and the 1 Deburgh Road sample
- `src/app.js`, `src/style.css`: the interface
- `build.sh`: bundles everything into one page at `public/index.html`
- `test/engine.test.js`: checks the engine against the 1 Deburgh Road reference report

## Commands

    npm run build   # writes public/index.html
    npm test        # runs the engine checks

Open `public/index.html` in a browser to use it locally. Vercel runs the build on every push to `main`.

## Notes

- Appraisals are saved in the browser (localStorage), not to an account. Use Export backup / Import backup to move them.
- VAT is not handled.
