// One shared mark for the interface and the printed archive label.
// Neutral ring mark — no third-party logo artwork. Drawn as <path> arcs so
// the boot sequence can dash-animate the outline.
const paths = `<path d="M100 72a55 55 0 1 0 110 0a55 55 0 1 0 -110 0" fill="none" stroke="currentColor" stroke-width="16"/><path d="M135 72a20 20 0 1 0 40 0a20 20 0 1 0 -40 0" fill="none" stroke="currentColor" stroke-width="10"/>`;
export const labelMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 310 145" color="#171713">${paths}</svg>`;
export const logo = `<svg viewBox="0 0 310 185" aria-label="DNT_OF" role="img">${paths}</svg>`;
// The same closed contour, continuous for the opening's moving draw/erase ends.
// Its small printed gap is animated with stroke dashes, not baked into the path.
export const bootMarkContour =
  "M100 72A55 55 0 1 1 210 72A55 55 0 1 1 100 72Z";

// Optical spacing for this fixed wordmark, measured from the reference glyphs.
const analysisPositions = [2, 28, 55, 81, 103, 129, 154, 166];
export const brandHeading = `<h1>DNT_OF</h1><div>SCP:SL PLUGIN DEVELOPER</div><p><span class="brand-analysis" role="img" aria-label="ARCHIVES">${[..."ARCHIVES"].map((letter, i) => `<span aria-hidden="true" style="left:${analysisPositions[i]}px">${letter}</span>`).join("")}</span> <b>OS</b></p>`;
