(() => {
  document.querySelectorAll('[data-barsc-table]').forEach(section => {
    const table = section.querySelector('table');
    const rows = [...table.tBodies[0].rows].filter(row => row.dataset.agency);
    const search = section.querySelector('[data-barsc-search]');
    const status = section.querySelector('[data-barsc-status]');
    const cellText = cell => {
      const copy = cell.cloneNode(true);
      copy.querySelectorAll('sup').forEach(node => node.remove());
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };
    const searchText = new Map(rows.map(row => [row, [...row.cells].map(cellText).join(' ').toLocaleLowerCase()]));
    const empty = document.createElement('tr');
    const message = document.createElement('td');
    message.colSpan = table.tHead.rows[0].cells.length;
    message.className = 'barsc-empty';
    message.textContent = 'No amendments match these filters.';
    empty.append(message);
    table.tBodies[0].append(empty);
    const apply = () => {
      const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      let count = 0;
      rows.forEach(row => {
        row.hidden = !terms.every(term => searchText.get(row).includes(term));
        if (!row.hidden) count++;
      });
      empty.hidden = count !== 0;
      status.textContent = `${count} of ${rows.length} rows. CSV downloads include the filtered rows.`;
    };
    search.addEventListener('input', apply);
    section.querySelector('[data-barsc-clear]').addEventListener('click', () => {
      search.value = ''; apply(); search.focus();
    });
    section.querySelector('[data-barsc-csv]').addEventListener('click', event => {
      const headers = [...table.tHead.rows[0].cells].map(cellText);
      const details = table.classList.contains('barsc-details');
      if (details) headers.push('NEP source');
      const records = rows.filter(row => !row.hidden).map(row => {
        const values = [...row.cells].map(cell => cell.classList.contains('barsc-timecodes')
          ? [...cell.querySelectorAll('a')].map(a => `${a.textContent.trim()} (${a.href})`).join('; ')
          : cellText(cell));
        if (details) {
          const sourceLink = row.querySelector('.barsc-nep-footnote');
          const source = sourceLink && document.getElementById(sourceLink.hash.slice(1));
          values.push(source ? `${source.textContent.trim()} (${source.querySelector('a').href})` : '-');
        }
        return values;
      });
      const quote = value => {
        // Prevent spreadsheet formula execution from text fields.
        const safe = /^[=+@\t\r]/.test(value) || /^-[^\d\s]/.test(value) ? "'" + value : value;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      const csv = '\ufeff' + [headers, ...records].map(record => record.map(quote).join(',')).join('\r\n') + '\r\n';
      const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url; link.download = event.currentTarget.dataset.filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    apply();
  });
})();
