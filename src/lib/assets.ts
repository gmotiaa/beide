/**
 * URLs for files served from `public/`.
 *
 * The packaged window is opened with `loadFile`, so the document lives on
 * `file://` and a root-absolute "/icon.svg" resolves against the drive root
 * instead of the bundle — the image silently fails to load. Vite rewrites such
 * paths inside `index.html` but not inside JSX, so components must go through
 * `BASE_URL`: "/" under the dev server, "./" in the built renderer.
 */
export const appIconUrl = `${import.meta.env.BASE_URL}icon.svg`;
