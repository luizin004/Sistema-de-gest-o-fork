let currentJobId = null;

function qs(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  qs(id).textContent = text;
}

function setDisabled(el, disabled) {
  if (disabled) el.setAttribute('disabled', 'disabled');
  else el.removeAttribute('disabled');
}

function setLinkEnabled(el, enabled, href) {
  if (!enabled) {
    el.classList.add('disabled');
    el.setAttribute('href', '#');
    return;
  }
  el.classList.remove('disabled');
  el.setAttribute('href', href);
}

async function uploadCsv() {
  const fileInput = qs('csvFile');
  if (!fileInput.files || !fileInput.files[0]) {
    alert('Selecione um CSV.');
    return;
  }

  setText('uploadInfo', 'Enviando...');
  setText('preview', '');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  const resp = await fetch('/api/upload', { method: 'POST', body: formData });
  const data = await resp.json();

  if (!resp.ok) {
    setText('uploadInfo', 'Erro ao enviar CSV.');
    alert(data.detail || 'Erro no upload');
    return;
  }

  currentJobId = data.job_id;
  setText('uploadInfo', `Upload OK. job_id=${currentJobId} | total=${data.total}`);
  setText('preview', JSON.stringify({ columns: data.columns, preview: data.preview }, null, 2));

  setDisabled(qs('btnStart'), false);
  setDisabled(qs('btnRefresh'), false);
  await refreshStatus();
}

async function startJob() {
  if (!currentJobId) {
    alert('Faça upload do CSV primeiro.');
    return;
  }

  const batchSizeVal = Number(qs('batchSize').value || 0);
  const batchPauseHoursVal = Number(qs('batchPauseHours').value || 0);
  const batchPauseSecondsVal = Math.max(0, Math.round(batchPauseHoursVal * 3600));

  const payload = {
    job_id: currentJobId,
    message_template: qs('messageTemplate').value || '',
    delay_seconds: Number(qs('delaySeconds').value || 0),
    request_timeout_seconds: Number(qs('timeoutSeconds').value || 30),
    batch_size: batchSizeVal > 0 ? batchSizeVal : null,
    batch_pause_seconds: batchPauseSecondsVal > 0 ? batchPauseSecondsVal : null,
    only_business_hours: Boolean(qs('onlyBusinessHours')?.checked),
  };

  const resp = await fetch('/api/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  if (!resp.ok) {
    alert(data.detail || 'Erro ao iniciar');
    return;
  }

  setText('statusText', 'Iniciado. Acompanhando...');
  setDisabled(qs('btnStart'), true);
  setDisabled(qs('btnStop'), false);
  await refreshStatus();

  const interval = setInterval(async () => {
    const s = await refreshStatus();
    if (!s) return;
    if (s.status === 'done' || s.status === 'erro' || s.status === 'stopped') clearInterval(interval);
  }, 1500);
}

async function stopJob() {
  if (!currentJobId) {
    alert('Nenhum job em andamento.');
    return;
  }

  const ok = confirm('Tem certeza que deseja parar a transmissão?');
  if (!ok) return;

  setDisabled(qs('btnStop'), true);
  const resp = await fetch(`/api/stop/${currentJobId}`, { method: 'POST' });
  const data = await resp.json();
  if (!resp.ok) {
    alert(data.detail || 'Erro ao parar');
    setDisabled(qs('btnStop'), false);
    return;
  }

  setText('statusText', 'Parada solicitada. Aguarde...');
  await refreshStatus();
}

async function refreshStatus() {
  if (!currentJobId) return null;

  const resp = await fetch(`/api/status/${currentJobId}`);
  const data = await resp.json();
  if (!resp.ok) {
    alert(data.detail || 'Erro ao consultar status');
    return null;
  }

  const pct = Number(data.percent || 0);
  qs('progressBar').style.width = `${pct}%`;

  const msg = `status=${data.status} | ${data.processed}/${data.total} | ok=${data.success} | erro=${data.error}`;
  setText('statusText', msg);

  const running = data.status === 'running';
  setDisabled(qs('btnStop'), !running);
  setDisabled(qs('btnStart'), running);

  const canDownloadReport = data.status === 'done' || data.status === 'stopped';
  setLinkEnabled(qs('downloadReport'), canDownloadReport, `/api/report/${currentJobId}`);
  setLinkEnabled(qs('downloadLog'), data.status !== 'uploaded', `/api/log/${currentJobId}`);

  return data;
}

qs('btnUpload').addEventListener('click', () => uploadCsv());
qs('btnStart').addEventListener('click', () => startJob());
qs('btnStop').addEventListener('click', () => stopJob());
qs('btnRefresh').addEventListener('click', () => refreshStatus());

// --- Importar para Supabase (disparos-brumadinho) ---
const EDGE_URL = 'https://wtqhpovjntjbjhobqttk.supabase.co/functions/v1/disparos-brumadinho';

function buildPayload(dateFieldId, supabaseDateKey) {
  const nome = document.querySelector('#importNome')?.value?.trim() || '';
  const telefone = document.querySelector('#importTelefone')?.value?.trim() || '';
  const dataValor = document.querySelector(`#${dateFieldId}`)?.value || '';

  if (!nome || !telefone || !dataValor) {
    alert('Preencha nome, telefone e a data correspondente.');
    return null;
  }

  return {
    nome,
    telefone,
    [supabaseDateKey]: dataValor,
  };
}

async function enviarImport(dateFieldId, supabaseDateKey) {
  const payload = buildPayload(dateFieldId, supabaseDateKey);
  if (!payload) return;

  try {
    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      alert(`Erro ao importar: ${text}`);
      return;
    }
    alert('Importado com sucesso!');
  } catch (err) {
    alert('Erro na requisição: ' + (err?.message || err));
  }
}

qs('btnImportNascimento')?.addEventListener('click', () => enviarImport('dataNascimento', 'data_nascimento'));
qs('btnImportLimpeza')?.addEventListener('click', () => enviarImport('dataLimpeza', 'data_limpeza'));
qs('btnImportClareamento')?.addEventListener('click', () => enviarImport('dataClareamento', 'data_clareamento'));
qs('btnImportConsulta')?.addEventListener('click', () => enviarImport('dataConsulta', 'data_consulta'));

// Importar todo o CSV já carregado para a tabela disparos (um POST por linha)
qs('btnImportCsvSupabase')?.addEventListener('click', async () => {
  const info = qs('importSupabaseInfo');
  const dateKey = document.querySelector('#tipoImportCsv')?.value || 'data_nascimento';
  const raw = localStorage.getItem('csvPreviewData'); // armazenado em uploadCsv
  if (!raw) {
    info.textContent = 'Faça upload do CSV primeiro.';
    return;
  }

  let rows = [];
  try {
    rows = JSON.parse(raw);
  } catch (e) {
    info.textContent = 'Erro ao ler dados do CSV.';
    return;
  }

  if (!Array.isArray(rows) || !rows.length) {
    info.textContent = 'Nenhuma linha disponível para importação.';
    return;
  }

  info.textContent = 'Enviando...';
  let ok = 0;
  let fail = 0;

  for (const r of rows) {
    const nome = r.nome || r.Nome || '';
    const telefone = r.telefone || r.Telefone || '';
    const dataValor = r[dateKey] || r[dateKey.toUpperCase()] || '';

    if (!nome || !telefone || !dataValor) {
      fail += 1;
      continue;
    }

    try {
      const resp = await fetch(EDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome,
          telefone,
          [dateKey]: dataValor,
        }),
      });
      if (!resp.ok) fail += 1;
      else ok += 1;
    } catch (err) {
      fail += 1;
    }
  }

  info.textContent = `Importação concluída. Sucesso: ${ok} | Falhas: ${fail}`;
});
