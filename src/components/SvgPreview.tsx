import type { SvgExportResult } from '../svg/exportSvg';

type SvgPreviewProps = {
  result: SvgExportResult;
};

export const SvgPreview = ({ result }: SvgPreviewProps) => (
  <section className="previewPanel" aria-labelledby="svg-preview-heading">
    <div className="previewHeader">
      <div>
        <h2 id="svg-preview-heading">SVG Preview</h2>
        <p>
          {result.stats.mode} · {Math.round(result.stats.width)} x {Math.round(result.stats.height)}px
        </p>
      </div>
      <div className="exportStats">
        <span>{result.stats.selectedCells} cells</span>
        <span>{result.stats.selectedGaps} gaps</span>
        <span>{result.stats.pathCount} paths</span>
      </div>
    </div>
    <div
      className="svgPreviewSurface"
      data-testid="svg-preview"
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  </section>
);
