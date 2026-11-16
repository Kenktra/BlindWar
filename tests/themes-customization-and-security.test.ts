import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BLIND_WAR_THEMES,
  BOARD_COLS,
  BOARD_ROWS,
  CHARACTER_TYPES,
  DEFAULT_THEME_ID,
  DEFAULT_USER_PREFERENCES,
  FAQ_ITEMS,
  SETTINGS_HELP_ITEMS,
  THEME_LIST,
  computeProfileCosmetics,
  getBoardSquareSlot,
  getThemeDefinition,
  getThemedPiecePaletteAtCoord,
  resolveThemeUiForColorMode,
  sanitizeDisplayName,
  sanitizeUserPreferences,
  type Coord,
  type ThemeId,
} from '../shared/src/index.js';
import {
  MAX_AVATAR_BYTES,
  validateAvatarImageDataUrl,
} from '../server/src/auth/avatarValidation.js';
import { BlindWarDatabase, toPublicProfile } from '../server/src/database/db.js';
import {
  buildThemeCssVariables,
  resolveThemeState,
} from '../client/src/themes/themeManager.js';
import {
  PieceArtwork,
  PieceAvatar,
  PieceDualVariantPreview,
} from '../client/src/components/PieceArtwork.js';
import { ALL_PIECE_ART_KINDS } from '../client/src/assets/pieces/silhouettes.js';
import {
  THEME_ASSET_PACKS,
  resolvePieceThemeAsset,
} from '../client/src/assets/themes/index.js';

function makeTempDbFile(name: string): { dir: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bw-theme-test-${name}-`));
  return { dir, filePath: path.join(dir, 'db.json') };
}

function makePngDataUrl(): string {
  // Valid 8-byte PNG signature + minimal IHDR header bytes
  const bytes = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function makeJpegDataUrl(): string {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

function makeWebpDataUrl(): string {
  const bytes = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'ascii'),
    Buffer.from('VP8 ', 'ascii'),
  ]);
  return `data:image/webp;base64,${bytes.toString('base64')}`;
}

describe('Restauration des assets originaux, Thèmes personnalisables, Profil & Sécurité', () => {
  describe('1. Refonte des pièces vectorielles à fond 100% transparent', () => {
    it('renders a sculpted linearGradient transparent-background SVG without any medallion disc for every character and secret pawn', () => {
      const svgs = new Map<string, string>();
      for (const kind of [...CHARACTER_TYPES, 'secret' as const]) {
        const html = renderToStaticMarkup(
          React.createElement(PieceArtwork, {
            character: kind,
            owner: 'red',
            size: 'lg',
            title: kind,
          }),
        );
        expect(html).toContain('viewBox="0 0 64 64"');
        expect(html).toContain('preserveAspectRatio="xMidYMid meet"');
        expect(html).toContain('<linearGradient');
        expect(html).toContain('data-transparent-bg="true"');
        expect(html).not.toContain('<radialGradient');
        expect(html).not.toContain('r="29"');
        expect(html).not.toContain('width="64" height="64"');
        expect(html).toContain(`data-piece-kind="${kind}"`);
        svgs.set(kind, html);
      }

      // Distinct artwork between different roles (roi vs reine vs traqueur vs arbaletrier)
      const stripDynamicIds = (markup: string) =>
        markup.replace(/bw-piece-grad-[^")]+/g, 'GRAD');
      expect(stripDynamicIds(svgs.get('roi')!)).not.toEqual(
        stripDynamicIds(svgs.get('reine')!),
      );
      expect(stripDynamicIds(svgs.get('traqueur')!)).not.toEqual(
        stripDynamicIds(svgs.get('arbaletrier')!),
      );
      expect(stripDynamicIds(svgs.get('executeur')!)).not.toEqual(
        stripDynamicIds(svgs.get('colosse')!),
      );
    });

    it('supports custom uploaded avatar photo in PieceAvatar and falls back to transparent PieceArtwork otherwise', () => {
      const png = makePngDataUrl();
      const photoHtml = renderToStaticMarkup(
        React.createElement(PieceAvatar, {
          badge: '♔',
          avatarImage: png,
          alt: 'Commandant',
          size: 'md',
        }),
      );
      expect(photoHtml).toContain('<img');
      expect(photoHtml).toContain(png);

      const fallbackHtml = renderToStaticMarkup(
        React.createElement(PieceAvatar, {
          badge: '🏹',
          avatarImage: null,
          alt: 'Arbalétrier',
          owner: 'red',
          size: 'md',
        }),
      );
      expect(fallbackHtml).not.toContain('<img');
      expect(fallbackHtml).toContain('data-piece-kind="arbaletrier"');
      expect(fallbackHtml).toContain('<linearGradient');
      expect(fallbackHtml).toContain('data-transparent-bg="true"');
    });

    it('renders theme-aware dual-square piece previews for any selected board theme', () => {
      const html = renderToStaticMarkup(
        React.createElement(PieceDualVariantPreview, {
          character: 'roi',
          theme: BLIND_WAR_THEMES.vert_et_beige,
          showLabels: true,
        }),
      );
      expect(html).toContain(BLIND_WAR_THEMES.vert_et_beige.board.squareA);
      expect(html).toContain(BLIND_WAR_THEMES.vert_et_beige.board.squareB);
      expect(html).toContain('Sur case');
    });

    it('provides complete, non-missing themed piece assets (light & dark variants) across all 6 themes and 13 piece kinds', () => {
      expect(ALL_PIECE_ART_KINDS).toHaveLength(13);

      for (const theme of THEME_LIST) {
        const pack = THEME_ASSET_PACKS[theme.id];
        expect(pack).toBeDefined();
        expect(Object.keys(pack.pieces)).toHaveLength(13);

        for (const kind of ALL_PIECE_ART_KINDS) {
          const desc = resolvePieceThemeAsset(theme.id, kind);
          expect(desc.pieceKind).toBe(kind);
          expect(desc.themeId).toBe(theme.id);
          expect(desc.palettes.light.bgTop).not.toBe(desc.palettes.dark.bgTop);

          const html = renderToStaticMarkup(
            React.createElement(PieceArtwork, {
              character: kind,
              coord: { row: 0, col: 0 },
              theme,
              size: 'md',
            }),
          );
          expect(html).toContain(`data-piece-kind="${kind}"`);
          expect(html).toContain(`data-piece-theme="${theme.id}"`);
          expect(html).toContain(`data-asset-style="${desc.styleVariant}"`);
          expect(html).toContain('viewBox="0 0 64 64"');
        }
      }

      expect(resolvePieceThemeAsset('classique', 'roi').styleVariant).toBe('classic');
      expect(resolvePieceThemeAsset('vert_et_beige', 'roi').styleVariant).toBe('chesscom');
      expect(resolvePieceThemeAsset('noir_et_blanc', 'roi').styleVariant).toBe('monochrome');
      expect(resolvePieceThemeAsset('bleu_et_argent', 'roi').styleVariant).toBe('blue');
    });
  });

  describe('2. Système centralisé des 5 thèmes, inversion sur cases & variables CSS', () => {
    it('defines all 6 curated themes with Rouge et noir as default and complete interaction palettes', () => {
      expect(DEFAULT_THEME_ID).toBe('rouge_et_noir');
      expect(THEME_LIST.map((t) => t.id)).toEqual([
        'rouge_et_noir',
        'classique',
        'vert_et_beige',
        'noir_et_blanc',
        'bleu_et_argent',
        'ambre_et_ebene',
      ]);

      expect(BLIND_WAR_THEMES.rouge_et_noir.board.squareA).toBe('#B51F2B');
      expect(BLIND_WAR_THEMES.rouge_et_noir.board.squareB).toBe('#171717');
      expect(BLIND_WAR_THEMES.classique.board.squareA).toBe('#F0D9B5');
      expect(BLIND_WAR_THEMES.classique.board.squareB).toBe('#B58863');
      expect(BLIND_WAR_THEMES.vert_et_beige.board.squareA).toBe('#769656');
      expect(BLIND_WAR_THEMES.vert_et_beige.board.squareB).toBe('#EEEED2');
      expect(BLIND_WAR_THEMES.noir_et_blanc.board.squareA).toBe('#F5F5F5');
      expect(BLIND_WAR_THEMES.noir_et_blanc.board.squareB).toBe('#202020');
      expect(BLIND_WAR_THEMES.bleu_et_argent.board.squareA).toBe('#2864A5');
      expect(BLIND_WAR_THEMES.bleu_et_argent.board.squareB).toBe('#C8D0D9');
      expect(BLIND_WAR_THEMES.ambre_et_ebene.board.squareA).toBe('#A8742A');
      expect(BLIND_WAR_THEMES.ambre_et_ebene.board.squareB).toBe('#1E1815');

      for (const theme of THEME_LIST) {
        expect(theme.board.interactions.selectionBorder).toBeTruthy();
        expect(theme.board.interactions.moveValidBorder).toBeTruthy();
        expect(theme.board.interactions.attackValidBorder).toBeTruthy();
        expect(theme.board.interactions.specialZoneBorder).toBeTruthy();
        expect(theme.board.interactions.boardHudBorder).toBeTruthy();
      }

      // Unknown theme falls back gracefully
      expect(getThemeDefinition('invalid_theme_id').id).toBe('rouge_et_noir');
    });

    it('alternates square slots and assigns inverted theme palettes across all 81 board coordinates', () => {
      for (const theme of THEME_LIST) {
        let countA = 0;
        let countB = 0;
        for (let row = 0; row < BOARD_ROWS; row += 1) {
          for (let col = 0; col < BOARD_COLS; col += 1) {
            const coord: Coord = { row, col };
            const slot = getBoardSquareSlot(coord);
            const themed = getThemedPiecePaletteAtCoord(theme, coord);
            expect(themed.slot).toBe(slot);
            if (slot === 'a') {
              countA += 1;
              expect(themed.palette).toEqual(theme.board.pieceOnA);
            } else {
              countB += 1;
              expect(themed.palette).toEqual(theme.board.pieceOnB);
            }
          }
        }
        expect(countA).toBe(41);
        expect(countB).toBe(40);
      }
    });

    it('resolves independent site and board themes and produces complete CSS variable maps', () => {
      const resolved = resolveThemeState({
        siteThemeId: 'bleu_et_argent',
        boardThemeId: 'vert_et_beige',
        brightness: 'bright',
        reduceMotion: true,
      });
      expect(resolved.siteTheme.id).toBe('bleu_et_argent');
      expect(resolved.boardTheme.id).toBe('vert_et_beige');
      expect(resolved.effectiveMotionReduced).toBe(true);

      const vars = buildThemeCssVariables(resolved.preferences);
      expect(vars['--bw-accent']).toBe(BLIND_WAR_THEMES.bleu_et_argent.ui.accent);
      expect(vars['--bw-board-square-a']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.squareA);
      expect(vars['--bw-board-square-b']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.squareB);
      expect(vars['--bw-cell-select-border']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.interactions.selectionBorder);
      expect(vars['--bw-cell-move-border']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.interactions.moveValidBorder);
      expect(vars['--bw-cell-attack-border']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.interactions.attackValidBorder);
      expect(vars['--bw-cell-special-border']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.interactions.specialZoneBorder);
      expect(vars['--bw-board-hud-bg']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.interactions.boardHudBg);
      expect(vars['--bw-anim-scale']).toBe('0.01');

      // Noir et blanc must enforce dark text on its bright primary CTA button
      const monoVars = buildThemeCssVariables({ siteThemeId: 'noir_et_blanc' });
      expect(monoVars['--bw-btn-primary-text']).toBe('#141417');

      // Dark mode vs Light mode UI surfaces and persistence readiness
      const lightResolved = resolveThemeState({
        colorMode: 'light',
        siteThemeId: 'bleu_et_argent',
        boardThemeId: 'vert_et_beige',
      });
      expect(lightResolved.colorMode).toBe('light');
      expect(lightResolved.boardTheme.id).toBe('vert_et_beige');
      const lightVars = buildThemeCssVariables(lightResolved.preferences);
      expect(lightVars['--bw-color-scheme']).toBe('light');
      expect(lightVars['--bw-bg-panel']).toBe('#ffffff');
      expect(lightVars['--bw-text-primary']).toBe('#0f172a');
      expect(lightVars['--bw-board-square-a']).toBe(BLIND_WAR_THEMES.vert_et_beige.board.squareA);
      const darkUi = resolveThemeUiForColorMode(BLIND_WAR_THEMES.rouge_et_noir, 'dark');
      const lightUi = resolveThemeUiForColorMode(BLIND_WAR_THEMES.rouge_et_noir, 'light');
      expect(darkUi.bgPanel).not.toBe(lightUi.bgPanel);
    });
  });

  describe('3. Sécurité des photos de profil (PNG/JPEG/WebP & magic bytes)', () => {
    it('accepts authentic PNG, JPEG and WebP data URLs', () => {
      expect(validateAvatarImageDataUrl(makePngDataUrl())).toMatch(/^data:image\/png;base64,/);
      expect(validateAvatarImageDataUrl(makeJpegDataUrl())).toMatch(/^data:image\/jpeg;base64,/);
      expect(validateAvatarImageDataUrl(makeWebpDataUrl())).toMatch(/^data:image\/webp;base64,/);
    });

    it('rejects SVG payloads, external URLs, MIME spoofing and oversized images', () => {
      const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      expect(() =>
        validateAvatarImageDataUrl(`data:image/svg+xml;base64,${svgPayload.toString('base64')}`),
      ).toThrow();
      // Spoofed PNG MIME containing SVG bytes
      expect(() =>
        validateAvatarImageDataUrl(`data:image/png;base64,${svgPayload.toString('base64')}`),
      ).toThrow(/signature invalide/i);
      expect(() => validateAvatarImageDataUrl('https://evil.example/avatar.png')).toThrow();
      expect(() => validateAvatarImageDataUrl('javascript:alert(1)')).toThrow();

      const hugePng = Buffer.alloc(MAX_AVATAR_BYTES + 32, 0);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(hugePng, 0);
      expect(() =>
        validateAvatarImageDataUrl(`data:image/png;base64,${hugePng.toString('base64')}`),
      ).toThrow(/256 Ko/i);
    });
  });

  describe('4. Cosmétiques débloquables, persistance compte et isolation multijoueur', () => {
    it('prevents equipping locked banners/titles/badges, persists user settings/avatar, and strips preferences from sync snapshots', async () => {
      const tmp = makeTempDbFile('cosmetics');
      try {
        const db = new BlindWarDatabase({ diskFilePath: tmp.filePath });
        await db.initSchema();

        const user = await db.createUser({
          id: 'u-custom-1',
          username: 'CommandantAlpha',
          passwordHash: 'hash',
        });

        // Locked cosmetics must be rejected
        await expect(
          db.updateUserProfile(user.id, { profileBanner: 'victor_crest' }),
        ).rejects.toThrow();
        await expect(
          db.updateUserProfile(user.id, { selectedTitle: 'tacticien_elo' }),
        ).rejects.toThrow();
        await expect(
          db.updateUserProfile(user.id, { selectedBadge: 'first_win' }),
        ).rejects.toThrow();

        const png = makePngDataUrl();
        const updated = await db.updateUserProfile(user.id, {
          displayName: 'AlphaPrime',
          avatarImage: png,
          bio: 'Tacticien anonyme',
          profileBanner: 'tactical_grid',
          selectedTitle: 'recrue',
          preferences: {
            colorMode: 'light',
            siteThemeId: 'ambre_et_ebene',
            boardThemeId: 'vert_et_beige',
            soundVolume: 42,
            highContrast: true,
            showPatternMarkers: true,
            confirmImportantActions: false,
          },
        });

        expect(updated.displayName).toBe('AlphaPrime');
        expect(updated.avatarImage).toBe(png);
        expect(updated.preferences.colorMode).toBe('light');
        expect(updated.preferences.siteThemeId).toBe('ambre_et_ebene');
        expect(updated.preferences.boardThemeId).toBe('vert_et_beige');
        expect(updated.preferences.soundVolume).toBe(42);
        expect(updated.preferences.highContrast).toBe(true);
        expect(updated.preferences.showPatternMarkers).toBe(true);
        expect(updated.preferences.confirmImportantActions).toBe(false);

        // Reload DB from disk to prove cross-session persistence
        const reloadedDb = new BlindWarDatabase({ diskFilePath: tmp.filePath });
        const reloadedUser = await reloadedDb.findUserById(user.id);
        expect(reloadedUser).not.toBeNull();
        const reloadedPublic = toPublicProfile(reloadedUser!);
        expect(reloadedPublic.displayName).toBe('AlphaPrime');
        expect(reloadedPublic.avatarImage).toBe(png);
        expect(reloadedPublic.preferences.colorMode).toBe('light');
        expect(reloadedPublic.preferences.siteThemeId).toBe('ambre_et_ebene');

        // Exported sync snapshots must strip private preferences (opponent theme isolation)
        const snapshot = reloadedDb.exportSyncSnapshot();
        expect(snapshot.users).toHaveLength(1);
        expect(snapshot.users[0].preferences).toBeUndefined();

        // Merging a remote sync snapshot must preserve existing local preferences
        const merged = await reloadedDb.mergeRemoteSnapshot({
          users: [
            {
              ...snapshot.users[0],
              wins: 3,
              gamesPlayed: 5,
            },
          ],
          matches: [],
          eloHistory: [],
        });
        expect(typeof merged).toBe('boolean');
        const afterMerge = await reloadedDb.findUserById(user.id);
        expect(afterMerge?.preferences?.siteThemeId).toBe('ambre_et_ebene');
        expect(afterMerge?.preferences?.boardThemeId).toBe('vert_et_beige');

        // Cosmetic unlock verification for high-stat user
        const cosmetics = computeProfileCosmetics({
          wins: 10,
          gamesPlayed: 15,
          eloRating: 1300,
          totalEliminations: 25,
        });
        expect(cosmetics.banners.find((b) => b.id === 'victor_crest')?.unlocked).toBe(true);
        expect(cosmetics.titles.find((t) => t.id === 'tacticien_elo')?.unlocked).toBe(true);
        expect(cosmetics.badges.find((b) => b.id === 'first_win')?.unlocked).toBe(true);
      } finally {
        fs.rmSync(tmp.dir, { recursive: true, force: true });
      }
    });
  });

  describe('5. Sanitisation des préférences & documentation d’aide', () => {
    it('clamps soundVolume, rejects unknown enums/themes, and sanitizes display names', () => {
      const sanitized = sanitizeUserPreferences({
        siteThemeId: 'not_a_theme' as ThemeId,
        boardThemeId: 'bleu_et_argent',
        soundVolume: 250,
        textScale: 'xlarge',
        brightness: 'invalid' as 'standard',
      });

      expect(sanitized.siteThemeId).toBe(DEFAULT_USER_PREFERENCES.siteThemeId);
      expect(sanitized.boardThemeId).toBe('bleu_et_argent');
      expect(sanitized.soundVolume).toBe(100);
      expect(sanitized.textScale).toBe('xlarge');
      expect(sanitized.brightness).toBe('standard');

      const muted = sanitizeUserPreferences({ soundVolume: -40 });
      expect(muted.soundVolume).toBe(0);

      expect(sanitizeDisplayName('  <b>Général</b>  ')).toBe('bGénéral/b');
      expect(() => sanitizeDisplayName('   ')).toThrow(/2 et 24/i);
      expect(() => sanitizeDisplayName('Joueur (invité)')).toThrow();
    });

    it('provides complete in-game FAQ and Settings help items', () => {
      expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5);
      expect(SETTINGS_HELP_ITEMS.length).toBeGreaterThanOrEqual(4);
      for (const item of FAQ_ITEMS) {
        expect(item.question.trim().length).toBeGreaterThan(5);
        expect(item.answer.trim().length).toBeGreaterThan(10);
      }
      for (const item of SETTINGS_HELP_ITEMS) {
        expect(item.section.trim().length).toBeGreaterThan(3);
        expect(item.summary.trim().length).toBeGreaterThan(10);
      }
    });
  });
});
