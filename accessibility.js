(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const modalConfigs = [
    ['#modalBackdrop', '#cancelModal'],
    ['#batchAlbumBackdrop', '#cancelBatchAlbum'],
    ['#renameBackdrop', '#cancelRename'],
    ['#mergeBackdrop', '#cancelMerge'],
    ['#compareView', '#closeCompare']
  ];
  const returnFocus = new WeakMap();
  let lastTrigger = null;
  let curvePointIndex = 0;

  const isHidden = element => !element || element.classList.contains('hidden');
  const setPressed = (selector, pressed) => {
    const node = $(selector);
    if (node) node.setAttribute('aria-pressed', String(Boolean(pressed)));
  };

  function syncHiddenState() {
    ['#editor', '#compareView', '#modalBackdrop', '#batchAlbumBackdrop', '#renameBackdrop', '#mergeBackdrop'].forEach(selector => {
      const node = $(selector);
      if (node) node.setAttribute('aria-hidden', String(isHidden(node)));
    });
  }

  function syncSelectionState() {
    $$('[data-route]').forEach(button => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    $$('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));
    $$('#ratingButtons button').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('on'))));
    $$('#modeSwitcher button, #toolTabs button, [data-mobile-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.classList.contains('active'))));

    setPressed('#filterToggle', !isHidden($('#filterBar')));
    setPressed('#selectPhotosBtn', !isHidden($('#batchBar')));
    setPressed('#favoriteBtn', $('#favoriteBtn')?.textContent.trim() === '♥');
    setPressed('#pickBtn', $('#pickBtn')?.classList.contains('on'));
    setPressed('#rejectBtn', $('#rejectBtn')?.classList.contains('rejected'));
    setPressed('#beforeAfterBtn', $('#beforeAfterBtn')?.classList.contains('active'));
    setPressed('#beforeSplitBtn', $('#beforeSplitBtn')?.classList.contains('active'));
    setPressed('#panelToggle', $('#panelToggle')?.classList.contains('active'));
    setPressed('#fullscreenBtn', $('#fullscreenBtn')?.classList.contains('active'));
    setPressed('#mobileFullscreenBtn', $('#fullscreenBtn')?.classList.contains('active'));
  }

  function formatRangeValue(input) {
    if (input.id === 'beforeSplitRange') return `Split at ${input.value}%`;
    const label = input.getAttribute('aria-label') || 'Value';
    const value = Number(input.value);
    const formatted = Number.isFinite(value) && value > 0 ? `+${input.value}` : input.value;
    return `${label}: ${formatted}`;
  }

  function enhanceRanges(root = document) {
    $$('input[type="range"]', root).forEach(input => input.setAttribute('aria-valuetext', formatRangeValue(input)));
  }

  function hideDecorativeGlyphs(root = document) {
    $$('.mask-tool-card > span, .tool-tabs button > span, .mobile-editor-dock button > span', root)
      .forEach(span => span.setAttribute('aria-hidden', 'true'));
  }

  function focusables(container) {
    return $$('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter(node => node.offsetParent !== null && node.getAttribute('aria-hidden') !== 'true');
  }

  function openOverlay(overlay) {
    if (!returnFocus.has(overlay)) {
      const candidate = lastTrigger && document.contains(lastTrigger) ? lastTrigger : document.activeElement;
      if (candidate && !overlay.contains(candidate)) returnFocus.set(overlay, candidate);
    }
    const target = $('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])', overlay);
    requestAnimationFrame(() => target?.focus());
  }

  function closeOverlay(overlay) {
    const target = returnFocus.get(overlay);
    returnFocus.delete(overlay);
    requestAnimationFrame(() => {
      if (target && document.contains(target)) target.focus();
    });
  }

  function syncOverlay(overlay) {
    const nowHidden = isHidden(overlay);
    const wasHidden = overlay.getAttribute('aria-hidden') === 'true';
    overlay.setAttribute('aria-hidden', String(nowHidden));
    if (!nowHidden && wasHidden) openOverlay(overlay);
    if (nowHidden && !wasHidden) closeOverlay(overlay);
  }

  function activeOverlay() {
    for (let i = modalConfigs.length - 1; i >= 0; i--) {
      const overlay = $(modalConfigs[i][0]);
      if (overlay && !isHidden(overlay)) return [overlay, modalConfigs[i][1]];
    }
    return null;
  }

  function closeActiveOverlay(overlay, closeSelector) {
    const closeButton = $(closeSelector, overlay) || $(closeSelector);
    closeButton?.click();
  }

  function updateCurveAccessibleName(canvas, points) {
    if (!canvas || !points?.length) return;
    curvePointIndex = Math.max(0, Math.min(points.length - 1, curvePointIndex));
    const point = points[curvePointIndex];
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', `Tone curve. Point ${curvePointIndex + 1} of ${points.length}, input ${Math.round(point.x * 100)}%, output ${Math.round(point.y * 100)}%. Left and right select points. Up and down adjust output. Alt plus left or right adjusts input. Enter adds a point. Delete removes an interior point.`);
  }

  function handleCurveKeyboard(event) {
    const canvas = event.target.closest?.('#toneCurveCanvas');
    if (!canvas || typeof ensureCurvePoints !== 'function' || typeof currentPhoto === 'undefined' || !currentPhoto) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Delete', 'Backspace', 'Home', 'End'];
    if (!keys.includes(event.key)) return;

    const points = ensureCurvePoints();
    curvePointIndex = Math.max(0, Math.min(points.length - 1, curvePointIndex));

    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey) {
      event.preventDefault();
      curvePointIndex = Math.max(0, Math.min(points.length - 1, curvePointIndex + (event.key === 'ArrowRight' ? 1 : -1)));
      updateCurveAccessibleName(canvas, points);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      curvePointIndex = event.key === 'Home' ? 0 : points.length - 1;
      updateCurveAccessibleName(canvas, points);
      return;
    }

    const selected = points[curvePointIndex];
    let next = points.map(point => ({ ...point }));
    let changed = false;
    const step = event.shiftKey ? 0.05 : 0.01;

    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      next[curvePointIndex].y = Math.max(0, Math.min(1, selected.y + (event.key === 'ArrowUp' ? step : -step)));
      changed = true;
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.altKey && curvePointIndex > 0 && curvePointIndex < points.length - 1) {
      event.preventDefault();
      const min = next[curvePointIndex - 1].x + 0.005;
      const max = next[curvePointIndex + 1].x - 0.005;
      next[curvePointIndex].x = Math.max(min, Math.min(max, selected.x + (event.key === 'ArrowRight' ? step : -step)));
      changed = true;
    } else if (event.key === 'Enter' && curvePointIndex < points.length - 1) {
      event.preventDefault();
      const following = points[curvePointIndex + 1];
      next.splice(curvePointIndex + 1, 0, { x: (selected.x + following.x) / 2, y: (selected.y + following.y) / 2 });
      curvePointIndex += 1;
      changed = true;
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && curvePointIndex > 0 && curvePointIndex < points.length - 1) {
      event.preventDefault();
      next.splice(curvePointIndex, 1);
      curvePointIndex = Math.min(curvePointIndex, next.length - 1);
      changed = true;
    }

    if (!changed) return;
    if (typeof captureHistory === 'function') captureHistory();
    currentPhoto.edits.curvePoints = next;
    if (typeof syncCurveSlidersFromPoints === 'function') syncCurveSlidersFromPoints(next);
    if (typeof captureHistory === 'function') captureHistory();
    if (typeof drawToneCurve === 'function') drawToneCurve();
    if (typeof renderCanvas === 'function') renderCanvas($('#editorCanvas'));
    if (typeof debouncedSave === 'function') debouncedSave();
    updateCurveAccessibleName(canvas, next);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('button, a, input, select, summary')) lastTrigger = event.target.closest('button, a, input, select, summary');
    requestAnimationFrame(() => {
      syncHiddenState();
      syncSelectionState();
    });
  }, true);

  document.addEventListener('input', event => {
    if (event.target.matches('input[type="range"]')) event.target.setAttribute('aria-valuetext', formatRangeValue(event.target));
  }, true);

  document.addEventListener('keydown', event => {
    const active = activeOverlay();
    if (active) {
      const [overlay, closeSelector] = active;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeActiveOverlay(overlay, closeSelector);
        return;
      }
      if (event.key === 'Tab') {
        const items = focusables(overlay);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    handleCurveKeyboard(event);
  }, true);

  modalConfigs.forEach(([overlaySelector, closeSelector]) => {
    const overlay = $(overlaySelector);
    if (!overlay) return;
    new MutationObserver(() => syncOverlay(overlay)).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    if (overlay.classList.contains('modal-backdrop')) {
      overlay.addEventListener('click', event => {
        if (event.target === overlay) closeActiveOverlay(overlay, closeSelector);
      });
    }
  });

  const stateSelectors = ['#filterBar', '#batchBar', '#favoriteBtn', '#pickBtn', '#rejectBtn', '#beforeAfterBtn', '#beforeSplitBtn', '#panelToggle', '#fullscreenBtn', '#editor', '#modeSwitcher', '#toolTabs', '#ratingButtons', '.main-nav', '.mobile-nav'];
  stateSelectors.forEach(selector => {
    const node = $(selector);
    if (node) new MutationObserver(syncSelectionState).observe(node, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  });

  const controls = $('#controls');
  if (controls) new MutationObserver(() => {
    enhanceRanges(controls);
    hideDecorativeGlyphs(controls);
    const canvas = $('#toneCurveCanvas');
    if (canvas && typeof curvePointsForEdit === 'function') updateCurveAccessibleName(canvas, curvePointsForEdit());
  }).observe(controls, { childList: true, subtree: true });

  syncHiddenState();
  syncSelectionState();
  enhanceRanges();
  hideDecorativeGlyphs();
})();
