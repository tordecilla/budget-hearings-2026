const video = document.querySelector('#source-video');
const videoIsYouTube = video?.tagName === 'IFRAME';
let sourceVideoTime = 0;

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

const textSearchInput = document.querySelector('#transcript-text-search');
const speakerSearchInput = document.querySelector('#transcript-speaker-search');
const findPrevious = document.querySelector('#find-previous');
const findNext = document.querySelector('#find-next');
const findClear = document.querySelector('#find-clear');
const turns = [...document.querySelectorAll('.turn')];
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const resultLabel = document.querySelector('#filter-result');
const noResults = document.querySelector('#no-filter-results');
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
  document.querySelectorAll('[data-transcript-editor]').forEach((copy) => copy.normalize());
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
    const speakerMatch = !speakerNeedle || (turn.dataset.speaker || '').includes(speakerNeedle);
    return messageMatch && speakerMatch;
  });
  findMatches.forEach((turn) => {
    turn.classList.add('find-match');
    if (speakerNeedle) turn.classList.add('find-speaker-match');
    if (textNeedle) highlightText(turn.querySelector('[data-transcript-editor]'), textNeedle);
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

document.querySelectorAll('[data-review-anchor]').forEach((link) => {
  link.addEventListener('click', () => {
    activeFilter = 'all';
    clearTranscriptFind();
    filterButtons.forEach((button) => button.classList.toggle('active', button.dataset.filter === 'all'));
    applyTranscriptFilters();
  });
});

document.querySelectorAll('[data-turn-form]').forEach((form) => {
  const save = form.querySelector('.save');
  const editor = form.querySelector('[data-transcript-editor]');
  const value = form.querySelector('[data-transcript-value]');
  const edit = form.querySelector('[data-edit-turn]');
  const speaker = form.querySelector('[name="speaker"]');
  const sourceNote = form.querySelector('[name="source_note"]');
  const cancel = form.querySelector('[data-cancel-edit]');
  const originalText = value?.value || '';
  const originalSpeaker = speaker?.value || '';

  function refreshSaveState() {
    if (!save) return;
    const changedText = (editor?.innerText || '').trim() !== originalText;
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
    if (value) value.value = editor.innerText.trim();
    form.classList.add('dirty');
    refreshSaveState();
  });

  form.addEventListener('submit', (event) => {
    if (value && editor) value.value = editor.innerText.trim();
    refreshSaveState();
    if (save?.disabled) event.preventDefault();
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
});

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
const boundary = crossTalkDialog?.querySelector('[data-split-seconds]');
const splitMeta = crossTalkDialog?.querySelector('[data-split-meta]');
let splitStart = 0;
let splitEnd = 0;

document.querySelectorAll('[data-split-turn]').forEach((openButton) => {
  openButton.addEventListener('click', () => {
    const turn = openButton.closest('.turn');
    const transcript = turn?.querySelector('[data-transcript-editor]');
    const speaker = turn?.querySelector('[name="speaker_name"], [name="speaker"]');
    if (!crossTalkDialog || !crossTalkForm || !turn || !transcript) return;
    const text = transcript.innerText.trim();
    const point = editorialSplitPoint(text, selectionOffsetWithin(transcript));
    firstCopy.innerText = text.slice(0, point).trim();
    secondCopy.innerText = text.slice(point).trim();
    splitStart = Number(turn.dataset.start || 0);
    splitEnd = Number(turn.dataset.end || splitStart);
    const videoTime = videoIsYouTube ? sourceVideoTime : Number(video?.currentTime || 0);
    boundary.min = splitStart;
    boundary.max = splitEnd;
    boundary.value = (videoTime > splitStart && videoTime < splitEnd ? videoTime : splitStart + ((splitEnd - splitStart) / 2)).toFixed(2);
    crossTalkForm.action = openButton.dataset.action;
    crossTalkDialog.querySelector('[data-first-speaker]').value = speaker?.value || '';
    crossTalkDialog.querySelector('[name="second_speaker_name"]').value = '';
    splitMeta.textContent = `${turn.id} · ${splitStart.toFixed(2)}–${splitEnd.toFixed(2)} seconds`;
    crossTalkDialog.showModal();
    document.body.classList.add('dialog-open');
    secondCopy.focus();
  });
});

crossTalkDialog?.querySelectorAll('[data-dialog-close]').forEach((button) => {
  button.addEventListener('click', () => crossTalkDialog.close());
});

crossTalkDialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));

crossTalkDialog?.querySelector('[data-use-video-time]')?.addEventListener('click', () => {
  const videoTime = videoIsYouTube ? sourceVideoTime : Number(video?.currentTime || 0);
  if (videoTime > splitStart && videoTime < splitEnd) {
    boundary.value = videoTime.toFixed(2);
  } else {
    boundary.setCustomValidity('Play the video inside this turn, then try again.');
    boundary.reportValidity();
    window.setTimeout(() => boundary.setCustomValidity(''), 1800);
  }
});

crossTalkForm?.addEventListener('submit', (event) => {
  firstValue.value = firstCopy.innerText.trim();
  secondValue.value = secondCopy.innerText.trim();
  if (!firstValue.value || !secondValue.value) {
    event.preventDefault();
    const empty = !firstValue.value ? firstCopy : secondCopy;
    empty.focus();
    empty.classList.add('invalid');
    window.setTimeout(() => empty.classList.remove('invalid'), 1800);
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
const publicTextSearch = document.querySelector('#public-text-search');
const publicSpeakerSearch = document.querySelector('#public-speaker-search');
const publicFindClear = document.querySelector('#public-find-clear');
const publicResult = document.querySelector('#public-result');
const publicEmpty = document.querySelector('#public-empty');
const publicTurns = [...document.querySelectorAll('#public-turn-list .public-turn')];

function filterPublicTurns() {
  const textNeedle = (publicTextSearch?.value || '').trim().toLowerCase();
  const speakerNeedle = (publicSpeakerSearch?.value || '').trim().toLowerCase();
  let visible = 0;
  publicTurns.forEach((turn) => {
    const matches = (!textNeedle || (turn.dataset.message || '').includes(textNeedle))
      && (!speakerNeedle || (turn.dataset.speaker || '').includes(speakerNeedle));
    turn.hidden = !matches;
    if (matches) visible += 1;
  });
  if (publicResult) publicResult.textContent = `${visible} of ${publicTurns.length} turns remain in view`;
  if (publicEmpty) publicEmpty.hidden = visible !== 0 || publicTurns.length === 0;
}

[publicTextSearch, publicSpeakerSearch].forEach((field) => field?.addEventListener('input', filterPublicTurns));
publicFindClear?.addEventListener('click', () => {
  if (publicTextSearch) publicTextSearch.value = '';
  if (publicSpeakerSearch) publicSpeakerSearch.value = '';
  filterPublicTurns();
});

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
