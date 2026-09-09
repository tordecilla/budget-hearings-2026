const video = document.querySelector('#source-video');
const videoIsYouTube = video?.tagName === 'IFRAME';
let sourceVideoTime = 0;

const agencyFilterInput = document.querySelector('#agency-filter-input');
const agencyFilterEmpty = document.querySelector('#agency-filter-empty');
const agencySessionCards = [...document.querySelectorAll('.session-tile[data-agencies]')];

function applyAgencyFilter() {
  const terms = (agencyFilterInput?.value || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;
  agencySessionCards.forEach((card) => {
    const haystack = (card.dataset.agencies || '').toLocaleLowerCase();
    const matches = terms.every((term) => haystack.includes(term));
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  if (agencyFilterEmpty) agencyFilterEmpty.hidden = visible !== 0;
}

agencyFilterInput?.addEventListener('input', applyAgencyFilter);
agencyFilterInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  agencyFilterInput.value = '';
  applyAgencyFilter();
});

const issuesSearchInput = document.querySelector('#issues-search-input');
const issuesSearchStatus = document.querySelector('#issues-search-status');
const issuesNoResults = document.querySelector('#issues-no-results');
const issueTypeButtons = [...document.querySelectorAll('[data-tag-type]')];
const issueTagCards = [...document.querySelectorAll('[data-tag-card]')];
const issueGrid = document.querySelector('.flat-tag-grid');
const issueSortInputs = [...document.querySelectorAll('input[name="issue-sort"]')];
let activeTagType = 'all';

function applyIssueSort() {
  if (!issueGrid) return;
  const mode = issueSortInputs.find((input) => input.checked)?.value || 'alphabetical';
  const ordered = issueTagCards.map((card, index) => ({ card, index }));
  ordered.sort((a, b) => {
    let difference = 0;
    if (mode === 'discussed') {
      difference = Number(b.card.dataset.issueCount) - Number(a.card.dataset.issueCount);
    } else if (mode === 'latest') {
      difference = (b.card.dataset.issueLatest || '').localeCompare(a.card.dataset.issueLatest || '');
    }
    // The server renders alphabetically; retain that order for ties and the default.
    return difference || a.index - b.index;
  });
  issueGrid.append(...ordered.map(({ card }) => card));
}

issueSortInputs.forEach((input) => input.addEventListener('change', applyIssueSort));
applyIssueSort();

function applyIssueFilters() {
  const terms = (issuesSearchInput?.value || '').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  let visible = 0;
  issueTagCards.forEach((card) => {
    const typeMatches = activeTagType === 'all' || card.dataset.tagTypeValue === activeTagType;
    const textMatches = terms.every((term) => (card.dataset.tagSearch || '').includes(term));
    card.hidden = !(typeMatches && textMatches);
    if (!card.hidden) visible += 1;
  });
  if (issuesSearchStatus) {
    issuesSearchStatus.textContent = terms.length || activeTagType !== 'all'
      ? `${visible} matching issue${visible === 1 ? '' : 's'}`
      : `Showing all ${visible} issues`;
  }
  if (issuesNoResults) issuesNoResults.hidden = visible !== 0;
}

issueTypeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeTagType = button.dataset.tagType || 'all';
    issueTypeButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    applyIssueFilters();
  });
});
issuesSearchInput?.addEventListener('input', applyIssueFilters);
issuesSearchInput?.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  issuesSearchInput.value = '';
  activeTagType = 'all';
  issueTypeButtons.forEach((button) => button.classList.toggle('active', button.dataset.tagType === 'all'));
  applyIssueFilters();
});

function sendSourceVideoCommand(func, args = []) {
  if (!videoIsYouTube || !video?.contentWindow) return;
  video.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com');
}

function seekSourceVideo(seconds, shouldPlay = true) {
  sourceVideoTime = Number(seconds || 0);
  if (videoIsYouTube) {
    sendSourceVideoCommand('seekTo', [sourceVideoTime, true]);
    if (shouldPlay) sendSourceVideoCommand('playVideo');
    window.setTimeout(() => {
      sendSourceVideoCommand('seekTo', [sourceVideoTime, true]);
      if (shouldPlay) sendSourceVideoCommand('playVideo');
    }, 350);
  } else if (video) {
    video.currentTime = sourceVideoTime;
    if (shouldPlay) video.play().catch(() => {});
  }
}

if (videoIsYouTube) {
  video.addEventListener('load', () => {
    video.contentWindow?.postMessage(JSON.stringify({ event: 'listening' }), 'https://www.youtube-nocookie.com');
  });
  window.addEventListener('message', (event) => {
    if (!['https://www.youtube-nocookie.com', 'https://www.youtube.com'].includes(event.origin)) return;
    let payload = event.data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return; }
    }
    const currentTime = payload?.info?.currentTime;
    if (Number.isFinite(currentTime)) sourceVideoTime = Number(currentTime);
  });
}

document.querySelectorAll('[data-seek]').forEach((control) => {
  control.addEventListener('click', (event) => {
    if (!video) return;
    if (control.closest('a')) event.preventDefault();
    seekSourceVideo(Number(control.dataset.seek || 0));
  });
});

function focusTargetTurn() {
  document.querySelector('.turn:target')?.focus({ preventScroll: true });
}

focusTargetTurn();
window.addEventListener('hashchange', focusTargetTurn);

if (video) {
  const time = new URLSearchParams(window.location.search).get('t');
  if (time) {
    if (videoIsYouTube) video.addEventListener('load', () => seekSourceVideo(Number(time), false), { once: true });
    else video.addEventListener('loadedmetadata', () => seekSourceVideo(Number(time), false), { once: true });
  }
}

// Public readers and the editorial workspace share the same find behavior.
const publicTranscript = document.querySelector('.public-transcript');
if (publicTranscript) {
  const stickyParts = [
    [document.querySelector('.masthead'), '--public-masthead-height'],
    [publicTranscript.querySelector('.record-nav'), '--public-record-nav-height'],
    [publicTranscript.querySelector('.public-find-dock'), '--public-find-height'],
  ];
  const updateFindOffsets = () => stickyParts.forEach(([element, property]) => {
    if (element) publicTranscript.style.setProperty(property, `${element.getBoundingClientRect().height}px`);
  });
  updateFindOffsets();
  const findSizeObserver = new ResizeObserver(updateFindOffsets);
  stickyParts.forEach(([element]) => { if (element) findSizeObserver.observe(element); });
}

const textSearchInput = document.querySelector('#transcript-text-search, #public-text-search');
const speakerSearchInput = document.querySelector('#transcript-speaker-search, #public-speaker-search');
const canonicalSpeakerDirectory = JSON.parse(document.querySelector('#canonical-speaker-directory')?.textContent || '[]');
const findPrevious = document.querySelector('#find-previous, #public-find-previous');
const findNext = document.querySelector('#find-next, #public-find-next');
const findClear = document.querySelector('#find-clear, #public-find-clear');
const nextSpeaker = document.querySelector('#next-speaker');
let turns = [...document.querySelectorAll('.turn, #public-turn-list .public-turn')];
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const resultLabel = document.querySelector('#filter-result, #public-result');
const noResults = document.querySelector('#no-filter-results, #public-empty');
let activeFilter = 'all';
let findMatches = [];
let currentFindIndex = -1;

function filterMatches(turn) {
  if (activeFilter === 'reconstructed') return turn.dataset.reconstructed === 'true';
  if (activeFilter === 'flagged') return turn.dataset.flagged === 'true';
  return true;
}

function applyTranscriptFilters() {
  let visible = 0;
  turns.forEach((turn) => {
    const show = filterMatches(turn);
    turn.hidden = !show;
    if (show) visible += 1;
  });
  if (resultLabel) {
    const label = activeFilter === 'all' ? 'all' : activeFilter;
    resultLabel.textContent = activeFilter === 'all'
      ? `All ${visible} turns remain in view`
      : `Showing ${visible} ${label} turn${visible === 1 ? '' : 's'}`;
  }
  if (noResults) noResults.hidden = visible !== 0;
}

function clearTextHighlights() {
  document.querySelectorAll('mark.find-highlight').forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent || ''));
  });
  document.querySelectorAll('[data-transcript-editor], .public-turn .turn-record > p').forEach((copy) => copy.normalize());
}

function highlightText(copy, needle) {
  if (!copy || !needle || copy.closest('form')?.classList.contains('editing')) return;
  const source = copy.textContent || '';
  const lower = source.toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  let matchAt = lower.indexOf(needle);
  while (matchAt !== -1) {
    fragment.append(document.createTextNode(source.slice(cursor, matchAt)));
    const mark = document.createElement('mark');
    mark.className = 'find-highlight';
    mark.textContent = source.slice(matchAt, matchAt + needle.length);
    fragment.append(mark);
    cursor = matchAt + needle.length;
    matchAt = lower.indexOf(needle, cursor);
  }
  fragment.append(document.createTextNode(source.slice(cursor)));
  copy.replaceChildren(fragment);
}

function selectFindMatch(index, shouldScroll = true) {
  turns.forEach((turn) => turn.classList.remove('find-current'));
  if (!findMatches.length) {
    currentFindIndex = -1;
    return;
  }
  currentFindIndex = (index + findMatches.length) % findMatches.length;
  const turn = findMatches[currentFindIndex];
  turn.classList.add('find-current');
  if (shouldScroll) {
    turn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    history.replaceState(null, '', `#${turn.id}`);
  }
  if (resultLabel) {
    resultLabel.textContent = `${currentFindIndex + 1} of ${findMatches.length} matches · all ${turns.length} turns remain in view`;
  }
}

function updateTranscriptFind() {
  const textNeedle = (textSearchInput?.value || '').trim().toLocaleLowerCase();
  const speakerNeedle = (speakerSearchInput?.value || '').trim().toLocaleLowerCase();
  const canonicalMatches = new Set(speakerNeedle ? canonicalSpeakerDirectory
    .filter((entry) => [entry.name, ...entry.aliases].some((name) => name.toLocaleLowerCase().includes(speakerNeedle)))
    .map((entry) => entry.name.toLocaleLowerCase()) : []);
  clearTextHighlights();
  turns.forEach((turn) => turn.classList.remove('find-match', 'find-current', 'find-speaker-match'));
  currentFindIndex = -1;

  if (!textNeedle && !speakerNeedle) {
    findMatches = [];
    applyTranscriptFilters();
    findPrevious?.setAttribute('disabled', '');
    findNext?.setAttribute('disabled', '');
    return;
  }

  activeFilter = 'all';
  filterButtons.forEach((button) => button.classList.toggle('active', button.dataset.filter === 'all'));
  turns.forEach((turn) => { turn.hidden = false; });
  if (noResults) noResults.hidden = true;

  findMatches = turns.filter((turn) => {
    const messageMatch = !textNeedle || (turn.dataset.message || '').includes(textNeedle);
    const speakerMatch = !speakerNeedle || (turn.dataset.speaker || '').includes(speakerNeedle)
      || canonicalMatches.has(turn.dataset.speaker || '');
    return messageMatch && speakerMatch;
  });
  findMatches.forEach((turn) => {
    turn.classList.add('find-match');
    if (speakerNeedle) turn.classList.add('find-speaker-match');
    if (textNeedle) highlightText(turn.querySelector('[data-transcript-editor], .turn-record > p'), textNeedle);
  });
  findPrevious?.toggleAttribute('disabled', !findMatches.length);
  findNext?.toggleAttribute('disabled', !findMatches.length);
  if (resultLabel) {
    resultLabel.textContent = `${findMatches.length} match${findMatches.length === 1 ? '' : 'es'} · all ${turns.length} turns remain in view`;
  }
}

function clearTranscriptFind() {
  if (textSearchInput) textSearchInput.value = '';
  if (speakerSearchInput) speakerSearchInput.value = '';
  updateTranscriptFind();
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    clearTranscriptFind();
    activeFilter = button.dataset.filter;
    filterButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    applyTranscriptFilters();
  });
});

[textSearchInput, speakerSearchInput].forEach((input) => {
  input?.addEventListener('input', updateTranscriptFind);
  input?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    selectFindMatch(currentFindIndex + (event.shiftKey ? -1 : 1));
  });
});
findPrevious?.addEventListener('click', () => selectFindMatch(currentFindIndex - 1));
findNext?.addEventListener('click', () => selectFindMatch(currentFindIndex + 1));
findClear?.addEventListener('click', clearTranscriptFind);
findPrevious?.setAttribute('disabled', '');
findNext?.setAttribute('disabled', '');

function effectiveSpeakerKey(turn) {
  const reviewed = (turn?.dataset.speaker || '').trim();
  if (reviewed && reviewed !== 'unresolved') return `reviewed:${reviewed}`;
  const raw = (turn?.dataset.diarization || '').trim();
  return raw ? `raw:${raw}` : 'unresolved';
}

function currentAuditTurn(visibleTurns) {
  const transcriptTop = document.querySelector('#turn-list')?.getBoundingClientRect().top;
  // This control is deliberately stateless: every click starts from the
  // reader's present scroll position, never from the last highlighted/hash
  // target. At the page top (or before the transcript reaches the viewport),
  // navigation therefore restarts from the first visible transcript turn.
  if (window.scrollY <= 8 || transcriptTop == null || transcriptTop >= window.innerHeight) {
    return visibleTurns[0];
  }
  const auditLine = 120;
  const firstAtAuditLine = visibleTurns.find((turn) => {
    const rect = turn.getBoundingClientRect();
    return rect.bottom > auditLine;
  });
  if (firstAtAuditLine) return firstAtAuditLine;
  return visibleTurns.reduce((closest, turn) => {
    const distance = Math.abs(turn.getBoundingClientRect().top - auditLine);
    return !closest || distance < closest.distance ? { turn, distance } : closest;
  }, null)?.turn || visibleTurns[0];
}

nextSpeaker?.addEventListener('click', () => {
  const visibleTurns = turns.filter((turn) => !turn.hidden);
  if (!visibleTurns.length) return;
  const current = currentAuditTurn(visibleTurns);
  const currentIndex = visibleTurns.indexOf(current);
  const currentKey = effectiveSpeakerKey(current);
  const target = visibleTurns.slice(currentIndex + 1).find((turn) => effectiveSpeakerKey(turn) !== currentKey);
  if (!target) {
    if (resultLabel) resultLabel.textContent = 'No later speaker handoff in this view';
    return;
  }
  turns.forEach((turn) => turn.classList.remove('find-current'));
  target.classList.add('find-current');
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.focus({ preventScroll: true });
  history.replaceState(null, '', `#${target.id}`);
  if (video) seekSourceVideo(Number(target.dataset.start || 0), false);
  if (resultLabel) {
    const label = target.dataset.speaker !== 'unresolved'
      ? target.dataset.speaker
      : `raw ${target.dataset.diarization || 'unresolved'}`;
    resultLabel.textContent = `Next speaker at ${target.id} · ${label}`;
  }
});

let lastReviewTurn = document.querySelector('.turn:target');

function speakerNeedsReview(speaker) {
  const label = String(speaker || '').trim().toLocaleLowerCase();
  if (label === 'committee secretary') return false;
  return !label || ['unresolved', 'unidentified', 'unknown', 'mixed', 'needs_review', 'needs_audio_review', 'unknown_acknowledged'].some((marker) => label.includes(marker))
    || /(?:\brespondent\b|\bhouse member questioning\b|(?:official|representative|chairperson|director|secretary)\s*$)/i.test(label);
}

function refreshReviewNavigation(afterTurn = lastReviewTurn) {
  lastReviewTurn = afterTurn;
  const allTurns = [...document.querySelectorAll('.turn')];
  const flagged = allTurns.filter((turn) => turn.classList.contains('unresolved-turn') && !turn.classList.contains('excluded-turn'));
  const afterIndex = allTurns.indexOf(afterTurn);
  const next = flagged.find((turn) => allTurns.indexOf(turn) > afterIndex) || flagged[0];
  document.querySelectorAll('[data-review-anchor], .review-index-link').forEach((link) => {
    link.hidden = flagged.length === 0;
    link.href = next ? `#${next.id}` : '#unresolved';
    const count = link.querySelector('b');
    if (count) count.textContent = flagged.length;
  });
  const total = document.querySelector('.review-metrics .metric-alert dt');
  if (total) total.textContent = flagged.length;
  return next;
}

document.querySelectorAll('[data-review-anchor], .review-index-link').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const target = refreshReviewNavigation();
    if (!target) return;
    activeFilter = 'all';
    clearTranscriptFind();
    filterButtons.forEach((button) => button.classList.toggle('active', button.dataset.filter === 'all'));
    applyTranscriptFilters();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
    history.replaceState(null, '', `#${target.id}`);
    refreshReviewNavigation(target);
  });
});

const boundTurnForms = new WeakSet();

function bindTurnForm(form) {
  if (boundTurnForms.has(form)) return;
  boundTurnForms.add(form);
  const save = form.querySelector('.save');
  const check = form.querySelector('[data-check-turn]');
  const editor = form.querySelector('[data-transcript-editor]');
  const value = form.querySelector('[data-transcript-value]');
  const edit = form.querySelector('[data-edit-turn]');
  const speaker = form.querySelector('[name="speaker"]');
  const sourceNote = form.querySelector('[name="source_note"]');
  const cancel = form.querySelector('[data-cancel-edit]');
  const status = form.querySelector('[data-save-status]');
  let originalText = value?.value || '';
  let originalSpeaker = speaker?.value || '';

  function submittedEditorText() {
    const rendered = editor?.innerText || '';
    const domText = editor?.textContent || '';
    return (rendered.trim() ? rendered : domText).trim();
  }

  function setStatus(message, kind = '') {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  }

  function refreshSaveState() {
    if (!save) return;
    const changedText = submittedEditorText() !== originalText;
    const changedSpeaker = (speaker?.value || '').trim() !== originalSpeaker;
    save.disabled = !changedText && !changedSpeaker;
  }

  function cancelEditing() {
    if (!form.classList.contains('editing')) return;
    if (editor) {
      editor.innerText = originalText;
      editor.contentEditable = 'false';
    }
    if (value) value.value = originalText;
    if (speaker) speaker.value = originalSpeaker;
    if (sourceNote) sourceNote.value = '';
    form.querySelectorAll('input:not([type="hidden"])').forEach((field) => { field.disabled = true; });
    form.classList.remove('editing', 'dirty');
    if (edit) {
      edit.textContent = 'Edit';
      edit.disabled = false;
      edit.focus();
    }
    refreshSaveState();
  }

  edit?.addEventListener('click', () => {
    clearTextHighlights();
    form.classList.add('editing');
    editor.contentEditable = 'true';
    form.querySelectorAll('input:not([type="hidden"])').forEach((field) => { field.disabled = false; });
    refreshSaveState();
    editor.focus();
    edit.textContent = 'Editing';
    edit.disabled = true;
  });

  editor?.addEventListener('input', () => {
    if (value) value.value = submittedEditorText();
    form.classList.add('dirty');
    refreshSaveState();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const checking = event.submitter === check;
    const submittedText = checking ? originalText : submittedEditorText();
    if (value) value.value = submittedText;
    refreshSaveState();
    if (!checking && save?.disabled) return;
    if (check?.disabled) return;
    if (check) check.disabled = true;
    save.disabled = true;
    setStatus('Savingâ€¦', 'pending');
    try {
      const formData = new FormData(form);
      formData.set('text', submittedText);
      formData.set('speaker', checking ? originalSpeaker : (speaker?.value || ''));
      if (checking) {
        formData.set('action', 'check');
        formData.set('start_seconds', form.closest('.turn').dataset.start);
        formData.set('end_seconds', form.closest('.turn').dataset.end);
      }
      const response = await fetch(form.getAttribute('action'), {
        method: 'POST',
        body: new URLSearchParams(formData),
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) throw new Error(payload.error || `Save failed (${response.status})`);
      originalText = payload.text ?? value.value;
      originalSpeaker = payload.speaker ?? '';
      value.value = originalText;
      editor.innerText = originalText;
      editor.contentEditable = 'false';
      speaker.value = originalSpeaker;
      if (sourceNote) sourceNote.value = '';
      const turn = form.closest('.turn');
      if (turn) {
        turn.dataset.message = originalText.toLocaleLowerCase();
        turn.dataset.speaker = (originalSpeaker || 'unresolved').toLocaleLowerCase();
        const needsReview = payload.needs_review ?? (!originalSpeaker || originalSpeaker.toLocaleLowerCase().includes('unresolved'));
        turn.classList.toggle('unresolved-turn', needsReview);
        const badge = form.querySelector('.turn-meta .badge-unknown');
        if (!needsReview) badge?.remove();
        else if (!badge && turn.dataset.excluded !== 'true') {
          const reviewBadge = document.createElement('span');
          reviewBadge.className = 'turn-badge badge-unknown';
          reviewBadge.textContent = 'needs review';
          form.querySelector('.turn-meta')?.append(reviewBadge);
        }
        refreshReviewNavigation(turn);
        const speakerLabel = form.querySelector('.turn-meta strong');
        if (speakerLabel) speakerLabel.textContent = originalSpeaker || 'Unresolved';
      }
      form.querySelectorAll('input:not([type="hidden"])').forEach((field) => { field.disabled = true; });
      form.classList.remove('editing', 'dirty');
      edit.textContent = 'Edit';
      edit.disabled = false;
      if (check) check.textContent = checking ? 'Checked' : 'Mark checked';
      setStatus(checking ? 'Checked ? no changes' : 'Saved', 'success');
      window.setTimeout(() => setStatus(''), 1600);
    } catch (error) {
      setStatus(error.message || 'Save failed', 'error');
      refreshSaveState();
    } finally {
      if (check) check.disabled = false;
    }
  });

  form.querySelectorAll('input:not([type="hidden"])').forEach((field) => {
    field.addEventListener('input', () => {
      form.classList.add('dirty');
      if (field === speaker) refreshSaveState();
    });
  });
  cancel?.addEventListener('click', cancelEditing);
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  });
}

document.querySelectorAll('[data-turn-form]').forEach(bindTurnForm);

function selectionOffsetWithin(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) return -1;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(element);
  range.setEnd(selection.anchorNode, selection.anchorOffset);
  return range.toString().length;
}

function editorialSplitPoint(text, preferred) {
  if (preferred > 0 && preferred < text.length) return preferred;
  const midpoint = Math.floor(text.length / 2);
  const candidates = [];
  for (let index = 1; index < text.length - 1; index += 1) {
    if (/\s/.test(text[index])) candidates.push(index);
  }
  return candidates.sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))[0] || midpoint;
}

const crossTalkDialog = document.querySelector('#cross-talk-dialog');
const crossTalkForm = crossTalkDialog?.querySelector('[data-cross-talk-form]');
const firstCopy = crossTalkDialog?.querySelector('[data-split-copy="first"]');
const secondCopy = crossTalkDialog?.querySelector('[data-split-copy="second"]');
const firstValue = crossTalkDialog?.querySelector('[data-split-value="first"]');
const secondValue = crossTalkDialog?.querySelector('[data-split-value="second"]');
const boundary = crossTalkDialog?.querySelector('[name=second_start_seconds]');
const splitMeta = crossTalkDialog?.querySelector('[data-split-meta]');
const splitStatus = crossTalkDialog?.querySelector('[data-split-status]');
const splitSave = crossTalkDialog?.querySelector('.save-split');
let splitStart = 0;
let splitEnd = 0;
const boundSplitButtons = new WeakSet();

function formatSplitClock(seconds) {
  const milliseconds = Math.round(Number(seconds) * 1000);
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor(milliseconds / 60000) % 60;
  const wholeSeconds = Math.floor(milliseconds / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(milliseconds % 1000).padStart(3, '0')}`;
}

function parseSplitClock(value) {
  const parts = value.trim().split(':').map(part => part.trim());
  const valid = parts.length >= 2 && parts.length <= 3
    && parts.slice(0, -1).every(part => /^\d+$/.test(part))
    && /^\d{1,2}(?:[.,]\d+)?$/.test(parts.at(-1));
  if (!valid) throw new Error('Enter a split time such as 1:23:45 or 23:45. Decimals are optional.');
  const numbers = parts.map(part => Number(part.replace(',', '.')));
  if (numbers.at(-1) >= 60 || (numbers.length === 3 && numbers[1] >= 60)) {
    throw new Error('Seconds and minutes within an hour must be below 60.');
  }
  const seconds = numbers.reduce((total, part) => total * 60 + part, 0);
  if (!Number.isFinite(seconds)) throw new Error('Enter a valid split time.');
  return seconds;
}

function bindSplitButton(openButton) {
  if (!openButton || boundSplitButtons.has(openButton)) return;
  boundSplitButtons.add(openButton);
  openButton.addEventListener('click', () => {
    const turn = openButton.closest('.turn');
    const transcript = turn?.querySelector('[data-transcript-editor]');
    const speaker = turn?.querySelector('[name="speaker_name"], [name="speaker"]');
    if (!crossTalkDialog || !crossTalkForm || !turn || !transcript) return;
    const text = transcript.innerText.trim();
    const point = editorialSplitPoint(text, selectionOffsetWithin(transcript));
    firstCopy.value = text.slice(0, point).trim();
    secondCopy.value = text.slice(point).trim();
    splitStart = Number(turn.dataset.start || 0);
    splitEnd = Number(turn.dataset.end || splitStart);
    const videoTime = videoIsYouTube ? sourceVideoTime : Number(video?.currentTime || 0);
    crossTalkForm.elements.first_start_seconds.value = formatSplitClock(splitStart);
    crossTalkForm.elements.expected_start_seconds.value = splitStart;
    crossTalkForm.elements.expected_end_seconds.value = splitEnd;
    boundary.value = formatSplitClock(videoTime > splitStart && videoTime < splitEnd ? videoTime : splitStart + ((splitEnd - splitStart) / 2));
    crossTalkForm.action = openButton.dataset.action;
    crossTalkDialog.querySelector('[data-first-speaker]').value = speaker?.value || '';
    crossTalkDialog.querySelector('[name="second_speaker_name"]').value = '';
    if (splitStatus) splitStatus.textContent = '';
    splitMeta.textContent = `Original turn: ${formatSplitClock(splitStart)} \u2013 ${formatSplitClock(splitEnd)}`;
    crossTalkDialog.showModal();
    document.body.classList.add('dialog-open');
    secondCopy.focus();
  });
}

document.querySelectorAll('[data-split-turn]').forEach(bindSplitButton);

crossTalkDialog?.querySelectorAll('[data-dialog-close]').forEach((button) => {
  button.addEventListener('click', () => crossTalkDialog.close());
});

crossTalkDialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));

crossTalkDialog?.querySelector('[data-use-video-time]')?.addEventListener('click', () => {
  const videoTime = videoIsYouTube ? sourceVideoTime : Number(video?.currentTime || 0);
  if (videoTime > splitStart && videoTime < splitEnd) {
    boundary.value = formatSplitClock(videoTime);
  } else {
    boundary.setCustomValidity('Play the video inside this turn, then try again.');
    boundary.reportValidity();
    window.setTimeout(() => boundary.setCustomValidity(''), 1800);
  }
});

function formatTurnTime(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds || 0)));
  return [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60]
    .map((part) => String(part).padStart(2, '0')).join(':');
}

function applySegmentToTurn(turn, segment) {
  const oldId = turn.id;
  turn.id = segment.stable_id;
  turn.dataset.start = segment.start_seconds;
  turn.dataset.end = segment.end_seconds;
  turn.dataset.speaker = (segment.speaker || 'unresolved').toLocaleLowerCase();
  turn.dataset.message = segment.text.toLocaleLowerCase();
  turn.classList.toggle('unresolved-turn', speakerNeedsReview(segment.speaker));
  const timecode = turn.querySelector('.timecode');
  if (timecode) {
    timecode.dataset.seek = segment.start_seconds;
    timecode.textContent = formatTurnTime(segment.start_seconds);
    try {
      const href = new URL(timecode.href, window.location.href);
      href.searchParams.set('t', Math.floor(segment.start_seconds));
      href.hash = 'source-video';
      timecode.href = href.toString();
    } catch {}
  }
  const form = turn.querySelector('[data-turn-form]');
  if (!form) return;
  form.setAttribute('action', form.getAttribute('action').replace(`/segments/${oldId}`, `/segments/${segment.stable_id}`));
  form.classList.remove('editing', 'dirty');
  const meta = form.querySelector('.turn-meta');
  const speakerLabel = meta?.querySelector('strong');
  const stableLabel = meta?.querySelector('span');
  if (speakerLabel) speakerLabel.textContent = segment.speaker || 'Unresolved';
  if (stableLabel) stableLabel.textContent = segment.stable_id;
  const editor = form.querySelector('[data-transcript-editor]');
  const textValue = form.querySelector('[data-transcript-value]');
  const speakerInput = form.querySelector('[name="speaker"]');
  if (editor) { editor.innerText = segment.text; editor.contentEditable = 'false'; }
  if (textValue) textValue.value = segment.text;
  if (speakerInput) speakerInput.value = segment.speaker || '';
  form.querySelectorAll('input:not([type="hidden"])').forEach((field) => { field.disabled = true; });
  const edit = form.querySelector('[data-edit-turn]');
  const save = form.querySelector('.save');
  if (edit) { edit.textContent = 'Edit'; edit.disabled = false; }
  if (save) save.disabled = true;
  const split = form.querySelector('[data-split-turn]');
  if (split) split.dataset.action = `${form.getAttribute('action')}/split`;
}

crossTalkForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  firstValue.value = firstCopy.value.trim();
  secondValue.value = secondCopy.value.trim();
  if (!firstValue.value || !secondValue.value) {
    const empty = !firstValue.value ? firstCopy : secondCopy;
    empty.focus();
    empty.classList.add('invalid');
    window.setTimeout(() => empty.classList.remove('invalid'), 1800);
    return;
  }
  if (splitSave) splitSave.disabled = true;
  if (splitStatus) { splitStatus.textContent = 'Saving splitâ€¦'; splitStatus.dataset.kind = 'pending'; }
  try {
    const splitData = new URLSearchParams(new FormData(crossTalkForm));
    for (const input of crossTalkForm.querySelectorAll('[data-split-clock]')) {
      try { splitData.set(input.name, String(parseSplitClock(input.value))); }
      catch (error) { input.focus(); throw error; }
    }
    const response = await fetch(crossTalkForm.action, {
      method: 'POST',
      body: splitData,
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.error || `Split failed (${response.status})`);
    const [firstSegment, secondSegment] = payload.segments || [];
    if (!firstSegment || !secondSegment) throw new Error('Split response was incomplete.');
    const originalTurn = document.getElementById(firstSegment.stable_id);
    if (!originalTurn) throw new Error('The source turn is no longer visible.');
    const secondTurn = originalTurn.cloneNode(true);
    applySegmentToTurn(originalTurn, firstSegment);
    applySegmentToTurn(secondTurn, secondSegment);
    originalTurn.after(secondTurn);
    const index = turns.indexOf(originalTurn);
    turns.splice(index < 0 ? turns.length : index + 1, 0, secondTurn);
    bindTurnForm(secondTurn.querySelector('[data-turn-form]'));
    bindSplitButton(secondTurn.querySelector('[data-split-turn]'));
    const savedStatus = originalTurn.querySelector('[data-save-status]');
    if (savedStatus) { savedStatus.textContent = 'Split saved'; savedStatus.dataset.kind = 'success'; }
    crossTalkDialog.close();
    history.replaceState(null, '', `#${firstSegment.stable_id}`);
    applyTranscriptFilters();
  } catch (error) {
    if (splitStatus) { splitStatus.textContent = error.message || 'Split failed'; splitStatus.dataset.kind = 'error'; }
  } finally {
    if (splitSave) splitSave.disabled = false;
  }
});

const digestVideo = document.querySelector('#digest-video');
const digestVideoFrame = document.querySelector('.digest-video-frame');
const digestCueStatus = document.querySelector('#video-cue-status');

function sendYouTubeCommand(func, args = []) {
  if (!digestVideo?.contentWindow) return;
  digestVideo.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com');
}

document.querySelectorAll('[data-video-seek]').forEach((citation) => {
  citation.addEventListener('click', (event) => {
    if (!digestVideo || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const seconds = Number(citation.dataset.videoSeek || 0);
    document.querySelectorAll('[data-video-seek]').forEach((item) => item.classList.toggle('is-playing', item === citation));
    digestVideoFrame?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    sendYouTubeCommand('seekTo', [seconds, true]);
    sendYouTubeCommand('playVideo');
    window.setTimeout(() => {
      sendYouTubeCommand('seekTo', [seconds, true]);
      sendYouTubeCommand('playVideo');
    }, 450);
    if (digestCueStatus) digestCueStatus.textContent = `Cued to ${citation.textContent.trim().replace('▶', '').trim()}.`;
  });
});

const publicSourceVideo = document.querySelector('#source-frame');

function sendPublicYouTubeCommand(func, args = []) {
  if (!publicSourceVideo?.contentWindow) return;
  publicSourceVideo.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com');
}

document.querySelectorAll('[data-public-seek]').forEach((control) => {
  control.addEventListener('click', (event) => {
    if (!publicSourceVideo || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const seconds = Number(control.dataset.publicSeek || 0);
    sendPublicYouTubeCommand('seekTo', [seconds, true]);
    sendPublicYouTubeCommand('playVideo');
    publicSourceVideo.closest('.youtube-frame')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});
