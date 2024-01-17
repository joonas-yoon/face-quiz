function addSpinner(parent) {
  const spinner = document.createElement('div');
  spinner.className = 'lds-roller';
  for (let i = 0; i < 8; ++i) {
    spinner.appendChild(document.createElement('div'));
  }
  parent.appendChild(spinner);
}
