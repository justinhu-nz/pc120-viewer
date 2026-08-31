# Publishing on GitHub Pages

1. Create a GitHub repository and place the contents of this `pc120-viewer` folder at its root.
2. Push the repository to the `main` branch.
3. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for “Deploy PC120 viewer to GitHub Pages” to finish.

The workflow builds the static viewer into `docs/` and publishes it. All URLs are relative, so it works at both `username.github.io` and `username.github.io/repository-name/`.

To build the publishable folder locally:

```powershell
pnpm build:pages
```

Do not open `docs/index.html` directly from the filesystem because browsers block map-data requests from `file://` pages. Preview it through a web server with:

```powershell
pnpm preview:pages
```
