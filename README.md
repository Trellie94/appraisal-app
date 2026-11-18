# Appraisal App

Property development appraisal web app: sales, build, professional fees, other costs, funding (senior and mezzanine / private loans), land acquisition, a live financial summary and a printable report.

## Layout

- `src/engine.js`: the calculation engine (no browser code)
- `src/samples.js`: blank appraisal template
- `src/app.js`, `src/style.css`: the interface
- `api/`: Vercel functions for login, logout and reading/saving developments
- `server/deburgh.js`: the 1 Deburgh Road sample, added to the database on first use
- `build.sh`: bundles the interface into one page at `public/index.html`
- `test/engine.test.js`: checks the engine against the 1 Deburgh Road reference report

## Setup on Vercel

- Connect a Postgres database (Neon, from the Storage tab) so `DATABASE_URL` is set.
- Add an `APP_PASSWORD` environment variable: the shared password for the site.

Changing `APP_PASSWORD` signs everyone out.

## Commands

    npm run build   # writes public/index.html
    npm test        # runs the engine checks
    npm run dev     # local copy at http://localhost:3000, password "test", data kept in memory only

## Notes

- Every change is saved automatically to the database. If two people edit the same development at once, the last save wins.
- Export backup / Import backup on the developments page moves data in and out as a file.
- VAT is not handled.
