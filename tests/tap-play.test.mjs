import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTapPlayDevice, tapCardAction, tapPlayMode, allowCardDrag, floorFontSize, PHONE_QUERY, TAP_PLAY_MAX_WIDTH } from '../shared/tap-play.js';

test('phones (coarse primary pointer) use tap-play at any width', () => {
  assert.equal(isTapPlayDevice({ coarse: true, width: 390 }), true);
  assert.equal(isTapPlayDevice({ coarse: true, width: 844 }), true);
  assert.equal(isTapPlayDevice({ coarse: true, width: 1366 }), true);
});

test('narrow screens use tap-play only without a hover-capable primary pointer', () => {
  assert.equal(isTapPlayDevice({ width: 390, hoverNone: true }), true);
  assert.equal(isTapPlayDevice({ width: TAP_PLAY_MAX_WIDTH, anyCoarse: true }), true);
  // A narrow desktop browser window keeps mouse drag.
  assert.equal(isTapPlayDevice({ width: 600 }), false);
  // A wide touch laptop driven by a mouse keeps drag.
  assert.equal(isTapPlayDevice({ width: 1280, anyCoarse: true }), false);
  assert.equal(isTapPlayDevice({ width: 1920 }), false);
  assert.equal(isTapPlayDevice(), false);
});

test('without a browser, tap-play is off and drag is allowed', () => {
  assert.equal(tapPlayMode(), false);
  assert.equal(allowCardDrag('touch'), true);
  assert.equal(allowCardDrag('mouse'), true);
});

test('tapping a card selects it; tapping it again plays it', () => {
  assert.equal(tapCardAction({ selected: null, tapped: 'c1', playable: true }), 'select');
  assert.equal(tapCardAction({ selected: 'c2', tapped: 'c1', playable: true }), 'select');
  assert.equal(tapCardAction({ selected: 'c1', tapped: 'c1', playable: true }), 'play');
});

test('a second tap on a card that needs a target asks for one instead of playing', () => {
  assert.equal(tapCardAction({ selected: 'c1', tapped: 'c1', playable: true, needsTarget: true }), 'need-target');
  // The first tap still just selects it.
  assert.equal(tapCardAction({ selected: null, tapped: 'c1', playable: true, needsTarget: true }), 'select');
});

test('a second tap on an unplayable card deselects it', () => {
  assert.equal(tapCardAction({ selected: 'c1', tapped: 'c1', playable: false }), 'deselect');
  assert.equal(tapCardAction({ selected: null, tapped: 'c1', playable: false }), 'select');
  assert.equal(tapCardAction({}), 'select');
});

test('phone text floor raises only text under 12px', () => {
  assert.equal(floorFontSize(8), 12);
  assert.equal(floorFontSize(10.9), 12);
  assert.equal(floorFontSize(11.6), 12);
  assert.equal(floorFontSize(11.8), null); // rounding noise from scaled layouts
  assert.equal(floorFontSize(12), null);
  assert.equal(floorFontSize(16), null);
  assert.equal(floorFontSize(0), null);
  assert.equal(floorFontSize(NaN), null);
  assert.equal(floorFontSize(13, 14), 14);
  assert.match(PHONE_QUERY, /max-width: 720px/);
});

test('the Wa bundle includes the tap-play module and the long-press sheet closes by back button', () => {
  const build = readFileSync(new URL('../tools/build-browser.mjs', import.meta.url), 'utf8');
  assert.match(build, /'shared\/tap-play\.js'/);
  const sheet = readFileSync(new URL('../shared/touch-feel.js', import.meta.url), 'utf8');
  assert.match(sheet, /popstate/);
});
