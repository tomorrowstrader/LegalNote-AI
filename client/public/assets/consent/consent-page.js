// Public consent page. A separate file because the production security policy blocks inline scripts.
(function () {
  var actions = document.getElementById('actions');
  var status = document.getElementById('status');
  if (!actions || !status) return;
  var buttons = actions.querySelectorAll('button[data-response]');

  function setBusy(busy) {
    buttons.forEach(function (button) {
      button.disabled = busy;
    });
  }

  function show(kind, message) {
    status.className = 'status ' + kind;
    status.textContent = message;
  }

  function submit(responseType) {
    setBusy(true);
    status.className = 'status';
    status.textContent = '';
    fetch('/api/pre-consent/acknowledge/' + encodeURIComponent(actions.dataset.token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseType: responseType }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          actions.hidden = true;
          show('ok', result.data.message || 'Thank you. Your response has been recorded.');
        } else {
          setBusy(false);
          show('err', result.data.message || 'Something went wrong. Please try again.');
        }
      })
      .catch(function () {
        setBusy(false);
        show('err', 'Something went wrong. Please try again.');
      });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      submit(button.dataset.response);
    });
  });
})();
