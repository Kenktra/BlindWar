import React, { useMemo } from 'react';
import {
  getThemeDefinition,
  resolveThemeUiForColorMode,
  type CharacterType,
  type Coord,
  type UserPreferences,
} from '../../../shared/src/index.js';
import { PieceArtwork } from './PieceArtwork.js';

interface MiniBoardSamplePiece {
  readonly coord: Coord;
  readonly char: CharacterType | 'secret';
  readonly owner: 'red' | 'black';
}

const MINI_BOARD_PIECES: readonly MiniBoardSamplePiece[] = [
  { coord: { row: 0, col: 0 }, char: 'secret', owner: 'black' },
  { coord: { row: 0, col: 3 }, char: 'arbaletrier', owner: 'black' },
  { coord: { row: 2, col: 1 }, char: 'cavalier', owner: 'red' },
  { coord: { row: 3, col: 2 }, char: 'roi', owner: 'red' },
];

export interface ThemePreviewPanelProps {
  readonly previewPrefs: UserPreferences;
  readonly activePrefs: UserPreferences;
  readonly onApplyDraft: () => void;
  readonly onResetDefaults: () => void;
}

export const ThemePreviewPanel: React.FC<ThemePreviewPanelProps> = ({
  previewPrefs,
  activePrefs,
  onApplyDraft,
  onResetDefaults,
}) => {
  const siteTheme = getThemeDefinition(previewPrefs.siteThemeId);
  const ui = resolveThemeUiForColorMode(siteTheme, previewPrefs.colorMode);
  const boardTheme =
    previewPrefs.boardThemeId === 'match_site'
      ? siteTheme
      : getThemeDefinition(previewPrefs.boardThemeId);

  const hasPendingChanges =
    previewPrefs.colorMode !== activePrefs.colorMode ||
    previewPrefs.siteThemeId !== activePrefs.siteThemeId ||
    previewPrefs.boardThemeId !== activePrefs.boardThemeId ||
    previewPrefs.brightness !== activePrefs.brightness;

  const pieceByCoordKey = useMemo(() => {
    const map = new Map<string, MiniBoardSamplePiece>();
    for (const p of MINI_BOARD_PIECES) {
      map.set(`${p.coord.row},${p.coord.col}`, p);
    }
    return map;
  }, []);

  const previewFilter =
    previewPrefs.brightness === 'bright'
      ? 'brightness(1.07) saturate(1.04)'
      : previewPrefs.brightness === 'dim'
        ? 'brightness(0.91)'
        : 'none';

  return (
    <div
      className="bw-theme-preview-box"
      style={{
        background: `radial-gradient(circle at 30% 0%, ${ui.bgRadialGlow} 0%, ${ui.bgPanel} 70%)`,
        borderColor: ui.borderBright,
        color: ui.textPrimary,
        filter: previewFilter,
      }}
      aria-label="Aperçu visuel avant application du thème"
    >
      <div className="bw-theme-preview-header">
        <div>
          <strong style={{ fontSize: '0.96rem' }}>
            Aperçu : {siteTheme.name} ({previewPrefs.colorMode === 'light' ? 'Mode clair' : 'Mode sombre'})
            {boardTheme.id !== siteTheme.id ? ` • Échiquier : ${boardTheme.name}` : ''}
          </strong>
          <div style={{ fontSize: '0.76rem', color: ui.textMuted }}>
            {siteTheme.subtitle} — Cases {boardTheme.board.squareALabel} /{' '}
            {boardTheme.board.squareBLabel} • Médaillons originaux adaptatifs
          </div>
        </div>
        <div className="bw-theme-swatches" aria-label="Couleurs principales">
          <span
            className="bw-theme-swatch"
            style={{ backgroundColor: siteTheme.swatchA }}
            title={`Couleur 1 : ${siteTheme.swatchA}`}
          />
          <span
            className="bw-theme-swatch"
            style={{ backgroundColor: siteTheme.swatchB }}
            title={`Couleur 2 : ${siteTheme.swatchB}`}
          />
          <span
            className="bw-theme-swatch"
            style={{ backgroundColor: boardTheme.board.squareA }}
            title={`Case A : ${boardTheme.board.squareA}`}
          />
          <span
            className="bw-theme-swatch"
            style={{ backgroundColor: boardTheme.board.squareB }}
            title={`Case B : ${boardTheme.board.squareB}`}
          />
        </div>
      </div>

      <div className="bw-theme-preview-grid">
        {/* Mini 4x4 Interactive Checkerboard with Restored Medallions */}
        <div
          className="bw-preview-mini-board"
          style={{
            backgroundColor: boardTheme.board.frameBg,
            border: `2px solid ${boardTheme.board.frameBorder}`,
          }}
        >
          {[0, 1, 2, 3].flatMap((row) =>
            [0, 1, 2, 3].map((col) => {
              const coord: Coord = { row, col };
              const isSlotA = (row + col) % 2 === 0;
              const bg = isSlotA ? boardTheme.board.squareA : boardTheme.board.squareB;
              const piece = pieceByCoordKey.get(`${row},${col}`);
              const isSelectedSample = row === 3 && col === 2;
              const isHighlightedMove = row === 2 && col === 2;
              const isHighlightedAttack = row === 0 && col === 3;
              const isSpecialZone = row === 1 && col === 1;
              const { interactions } = boardTheme.board;
              const overlayBg = isSelectedSample
                ? interactions.selectionBg
                : isHighlightedMove
                  ? interactions.moveValidBg
                  : isHighlightedAttack
                    ? interactions.attackValidBg
                    : isSpecialZone
                      ? interactions.specialZoneBg
                      : undefined;
              const outlineStyle = isSelectedSample
                ? `2px solid ${interactions.selectionBorder}`
                : isHighlightedMove
                  ? `2px solid ${interactions.moveValidBorder}`
                  : isHighlightedAttack
                    ? `2px solid ${interactions.attackValidBorder}`
                    : isSpecialZone
                      ? `2px dashed ${interactions.specialZoneBorder}`
                      : undefined;
              return (
                <div
                  key={`${row}-${col}`}
                  className="bw-preview-mini-cell"
                  style={{
                    backgroundColor: bg,
                    backgroundImage: overlayBg
                      ? `linear-gradient(${overlayBg}, ${overlayBg})`
                      : undefined,
                    outline: outlineStyle,
                    border: `1px solid ${interactions.cellBorder}`,
                  }}
                >
                  {piece ? (
                    <PieceArtwork
                      character={piece.char}
                      owner={piece.owner}
                      coord={coord}
                      theme={boardTheme}
                      size="sm"
                    />
                  ) : isHighlightedMove ? (
                    <span
                      style={{
                        color: interactions.moveValidBorder,
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        textShadow: '0 1px 2px rgba(0,0,0,0.65)',
                      }}
                    >
                      •
                    </span>
                  ) : isSpecialZone ? (
                    <span
                      style={{
                        color: interactions.specialZoneBorder,
                        fontWeight: 900,
                        fontSize: '0.68rem',
                      }}
                    >
                      ◎
                    </span>
                  ) : null}
                </div>
              );
            }),
          )}
        </div>

        {/* Sample Interface Components under Selected Theme */}
        <div className="bw-preview-samples">
          <div
            className="bw-preview-sample-card"
            style={{
              backgroundColor: ui.bgPanelAlt,
              border: `1px solid ${ui.border}`,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.84rem', marginBottom: '0.35rem' }}>
              Assets des pièces du thème ({boardTheme.name})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
              {(['roi', 'reine', 'cavalier', 'traqueur', 'arbaletrier'] as const).map((ch) => (
                <React.Fragment key={ch}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '3px',
                      borderRadius: '6px',
                      backgroundColor: boardTheme.board.squareA,
                    }}
                    title={`${ch} (version contrastée sur case ${boardTheme.board.squareALabel})`}
                  >
                    <PieceArtwork character={ch} squareSlot="a" theme={boardTheme} size="xs" />
                  </span>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '3px',
                      borderRadius: '6px',
                      backgroundColor: boardTheme.board.squareB,
                    }}
                    title={`${ch} (version contrastée sur case ${boardTheme.board.squareBLabel})`}
                  >
                    <PieceArtwork character={ch} squareSlot="b" theme={boardTheme} size="xs" />
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div
            className="bw-preview-sample-card"
            style={{
              backgroundColor: ui.bgPanelAlt,
              border: `1px solid ${ui.border}`,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '0.2rem' }}>
              Panneau Tactique & Typographie
            </div>
            <div style={{ fontSize: '0.78rem', color: ui.textSecondary }}>
              Les textes secondaires, bordures, menus et badges adoptent exactement cette harmonie.
            </div>
          </div>

          <div
            className="bw-preview-sample-notif"
            style={{
              background: ui.notifBg,
              border: `1.5px solid ${ui.notifBorder}`,
              color: ui.notifAccent,
            }}
          >
            🔔 Exemple de notification : Nouvelle carte obtenue ou tour actif !
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="bw-btn bw-btn-sm"
              style={{
                background: `linear-gradient(135deg, ${ui.btnPrimaryStart} 0%, ${ui.btnPrimaryEnd} 100%)`,
                color: ui.btnPrimaryText,
                border: `1px solid ${ui.btnPrimaryBorder}`,
              }}
              onClick={onApplyDraft}
            >
              {hasPendingChanges ? '✅ Appliquer ce thème' : '✓ Thème actif'}
            </button>
            <button
              type="button"
              className="bw-btn bw-btn-sm"
              style={{
                backgroundColor: ui.bgElevated,
                color: ui.textPrimary,
                border: `1px solid ${ui.borderBright}`,
              }}
              onClick={onResetDefaults}
            >
              ↺ Rétablir le thème original
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
