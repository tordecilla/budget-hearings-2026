(() => {
  const search = document.querySelector('#leader-search');
  const buttons = [...document.querySelectorAll('[data-group]')].filter(el => el.tagName === 'BUTTON');
  const cards = [...document.querySelectorAll('.leader-card')];
  const result = document.querySelector('#leaders-result');
  const empty = document.querySelector('#leaders-empty');
  let group = 'all';
  function refresh() {
    const term = search.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const card of cards) {
      const visible = (group === 'all' || card.dataset.group === group) && card.dataset.search.includes(term);
      card.hidden = !visible;
      if (visible) shown++;
    }
    result.textContent = `${shown} ${shown === 1 ? 'person' : 'people'} shown`;
    empty.hidden = shown !== 0;
  }
  search.addEventListener('input', refresh);
  buttons.forEach(button => button.addEventListener('click', () => {
    group = button.dataset.group;
    buttons.forEach(item => item.classList.toggle('active', item === button));
    refresh();
  }));
  const lightbox = document.querySelector('#leader-lightbox');
  const lightboxImage = lightbox.querySelector('img');
  const lightboxHeading = lightbox.querySelector('h2');
  const lightboxCredit = lightbox.querySelector('p');
  const lightboxSource = lightbox.querySelector('a');
  document.querySelectorAll('.leader-photo').forEach(button => button.addEventListener('click', () => {
    lightboxImage.src = button.dataset.photo;
    lightboxImage.alt = button.dataset.person + ' — ' + button.dataset.title;
    lightboxHeading.textContent = button.dataset.person;
    lightboxCredit.textContent = button.dataset.title + ' · ' + button.dataset.credit;
    lightboxSource.href = button.dataset.source;
    lightbox.showModal();
  }));
  lightbox.querySelector('.leader-lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  refresh();
})();
