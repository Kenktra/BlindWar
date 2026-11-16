import React, { useId, useState } from 'react';
import {
  DEFAULT_THEME_ID,
  getThemeDefinition,
  type TutorialDiagramStep,
} from '../../../shared/src/index.js';
import { useOptionalBlindWarTheme } from '../themes/themeManager.js';
import { PieceArtwork } from './PieceArtwork.js';

export interface InteractiveBoardDiagramProps {
  readonly steps: readonly TutorialDiagramStep[];
  readonly viewerColor?: 'red' | 'black';
  readonly compact?: boolean;
}

const ARROW_STROKE_COLOR: Readonly<Record<string, string>> = {
  move: '#10b981',
  attack: '#ef4444',
  leap: '#f59e0b',
  shoot: '#a855f7',
  pierce: '#fb7185',
  forbidden: '#94a3b8',
};

const VERDICT_CLASS: Readonly<Record<TutorialDiagramStep['verdictBadge'], string>> = {
  AUTORISÉ: 'bw-idiagram-verdict-ok',
  CAPACITÉ: 'bw-idiagram-verdict-special',
  EXEMPLE: 'bw-idiagram-verdict-info',
  INTERDIT: 'bw-idiagram-verdict-forbidden',
};

export const InteractiveBoardDiagram: React.FC<InteractiveBoardDiagramProps> = ({
  steps,
  viewerColor = 'red',
  compact = false,
}) => {
  const [stepIdx, setStepIdx] = useState(0);
  const uid = useId().replace(/:/g, '');
  const themeCtx = useOptionalBlindWarTheme();
  const boardTheme = themeCtx?.boardTheme ?? getThemeDefinition(DEFAULT_THEME_ID);
  const reduceMotion = themeCtx?.effectiveMotionReduced ?? false;

  if (steps.length === 0) return null;
  const safeIdx = Math.min(stepIdx, steps.length - 1);
  const step = steps[safeIdx]!;

  const pieceMap = new Map(step.pieces.map((p) => [`${p.row},${p.col}`, p]));
  const highlightMap = new Map(step.highlights.map((h) => [`${h.row},${h.col}`, h]));

  const arrows = step.arrows ?? [];

  return (
    <div
      className={`bw-idiagram-card${compact ? ' bw-idiagram-compact' : ''}${reduceMotion ? ' bw-idiagram-reduced-motion' : ''}`}
      aria-label={`Démonstration interactive : ${step.stepTitle}`}
    >
      <div className="bw-idiagram-header">
        <span className={`bw-idiagram-verdict ${VERDICT_CLASS[step.verdictBadge]}`}>
          {step.verdictBadge}
        </span>
        <strong className="bw-idiagram-title">{step.stepTitle}</strong>
      </div>

      <div className="bw-idiagram-stage">
        <div
          className="bw-idiagram-board-wrap"
          style={{
            backgroundColor: boardTheme.board.frameBg,
            borderColor: boardTheme.board.frameBorder,
            maxWidth: compact ? '215px' : '255px',
          }}
        >
          <div
            className="bw-idiagram-grid"
            style={{
              gridTemplateColumns: `repeat(${step.cols}, 1fr)`,
              gridTemplateRows: `repeat(${step.rows}, 1fr)`,
            }}
          >
            {Array.from({ length: step.rows }).flatMap((_, row) =>
              Array.from({ length: step.cols }).map((__, col) => {
                const key = `${row},${col}`;
                const isSlotA = (row + col) % 2 === 0;
                const squareBg = isSlotA ? boardTheme.board.squareA : boardTheme.board.squareB;
                const piece = pieceMap.get(key);
                const hl = highlightMap.get(key);
                return (
                  <div
                    key={key}
                    className={`bw-idiagram-cell${hl ? ` bw-idiagram-hl-${hl.kind}` : ''}`}
                    style={{ backgroundColor: squareBg }}
                  >
                    {piece && (
                      <PieceArtwork
                        character={piece.kind}
                        owner={piece.owner}
                        coord={{ row, col }}
                        theme={boardTheme}
                        size={compact ? 'sm' : 'md'}
                      />
                    )}
                    {hl?.tag && <span className="bw-idiagram-tag">{hl.tag}</span>}
                    {hl && !hl.tag && hl.kind === 'move' && !piece && (
                      <span className="bw-idiagram-dot bw-idiagram-dot-move" aria-hidden="true" />
                    )}
                    {hl && !hl.tag && hl.kind === 'forbidden' && !piece && (
                      <span className="bw-idiagram-cross" aria-hidden="true">✕</span>
                    )}
                  </div>
                );
              }),
            )}
          </div>

          {arrows.length > 0 && (
            <svg
              className="bw-idiagram-arrows-svg"
              viewBox={`0 0 ${step.cols * 100} ${step.rows * 100}`}
              aria-hidden="true"
            >
              <defs>
                {Object.entries(ARROW_STROKE_COLOR).map(([k, color]) => (
                  <marker
                    key={k}
                    id={`bw-arrow-${uid}-${k}`}
                    markerWidth="6"
                    markerHeight="6"
                    refX="4.5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill={color} />
                  </marker>
                ))}
              </defs>
              {arrows.map((arrow, i) => {
                const x1 = arrow.from.col * 100 + 50;
                const y1 = arrow.from.row * 100 + 50;
                const x2 = arrow.to.col * 100 + 50;
                const y2 = arrow.to.row * 100 + 50;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.hypot(dx, dy) || 1;
                const endX = x2 - (dx / len) * 18;
                const endY = y2 - (dy / len) * 18;
                const stroke = ARROW_STROKE_COLOR[arrow.kind] ?? '#10b981';
                return (
                  <line
                    key={i}
                    x1={x1}
                    y1={y1}
                    x2={endX}
                    y2={endY}
                    stroke={stroke}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={arrow.kind === 'forbidden' || arrow.kind === 'shoot' ? '14 9' : undefined}
                    markerEnd={`url(#bw-arrow-${uid}-${arrow.kind})`}
                    className={arrow.kind !== 'forbidden' ? 'bw-idiagram-arrow-line' : undefined}
                  />
                );
              })}
            </svg>
          )}
        </div>

        <div className="bw-idiagram-details">
          <p className="bw-idiagram-explanation">{step.explanation}</p>
          <div className="bw-idiagram-legend" data-viewer={viewerColor}>
            <span><i className="bw-il-box bw-il-move" /> Déplacement</span>
            <span><i className="bw-il-box bw-il-attack" /> Capture / Cible</span>
            <span><i className="bw-il-box bw-il-recon" /> Révélation</span>
            <span><i className="bw-il-box bw-il-forbidden" /> Interdit / Bloqué</span>
          </div>

          {steps.length > 1 && (
            <div className="bw-idiagram-controls">
              <button
                type="button"
                className="bw-btn bw-btn-ghost bw-btn-xs"
                disabled={safeIdx === 0}
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              >
                ← Étape préc.
              </button>
              <div className="bw-idiagram-step-dots">
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`bw-idiagram-step-btn${idx === safeIdx ? ' active' : ''}`}
                    onClick={() => setStepIdx(idx)}
                    aria-label={`Étape ${idx + 1} : ${s.stepTitle}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="bw-btn bw-btn-secondary bw-btn-xs"
                disabled={safeIdx >= steps.length - 1}
                onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))}
              >
                Étape suiv. →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
