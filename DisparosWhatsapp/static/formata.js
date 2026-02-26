let formataSessionId = null;
let filtrosAtivos = [];

function qs(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = qs(id);
  if (el) el.textContent = text;
}

function setDisabled(el, disabled) {
  if (!el) return;
  if (disabled) el.setAttribute('disabled', 'disabled');
  else el.removeAttribute('disabled');
}

async function uploadFormataFile() {
  const fileInput = qs('formataFile');
  if (!fileInput.files || !fileInput.files[0]) {
    alert('Selecione um arquivo CSV, XLSX ou XLS.');
    return;
  }

  setText('formataUploadInfo', 'Enviando...');
  setText('formataPreview', '');
  setText('formataStatus', 'Processando upload...');

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  try {
    const resp = await fetch('/api/formata-lista/upload', { 
      method: 'POST', 
      body: formData 
    });
    const data = await resp.json();

    if (!resp.ok) {
      setText('formataUploadInfo', 'Erro ao enviar arquivo.');
      setText('formataStatus', `Erro: ${data.detail || 'Erro no upload'}`);
      alert(data.detail || 'Erro no upload');
      return;
    }

    formataSessionId = data.session_id;
    
    const info = `✓ Arquivo: ${data.filename}\n` +
                 `✓ Total de linhas: ${data.total_linhas}\n` +
                 `✓ Colunas detectadas:\n` +
                 `  - Nome: ${data.colunas_detectadas.nome}\n` +
                 `  - Telefone: ${data.colunas_detectadas.telefone}\n` +
                 `  - Cidade: ${data.colunas_detectadas.cidade}\n` +
                 `✓ Separador: ${data.separador}`;
    
    setText('formataUploadInfo', info);
    setText('formataPreview', JSON.stringify(data.preview, null, 2));
    setText('formataStatus', 'Arquivo carregado com sucesso! Configure a formatação e clique em "Processar".');
    
    setDisabled(qs('btnProcessar'), false);

  } catch (error) {
    setText('formataUploadInfo', 'Erro ao enviar arquivo.');
    setText('formataStatus', `Erro: ${error.message}`);
    alert('Erro ao enviar arquivo: ' + error.message);
  }
}

function adicionarFiltro() {
  const campo = qs('filtroCampo').value;
  const operador = qs('filtroOperador').value;
  const valor = qs('filtroValor').value.trim();

  if (!valor) {
    alert('Digite um valor para o filtro.');
    return;
  }

  filtrosAtivos.push({ campo, operador, valor });
  
  const li = document.createElement('li');
  li.className = 'filtro-item';
  li.innerHTML = `
    <span>${campo} ${operador} "${valor}"</span>
    <button class="btn-remove" onclick="removerFiltro(${filtrosAtivos.length - 1})">✕</button>
  `;
  
  qs('filtrosList').appendChild(li);
  qs('filtroValor').value = '';
}

function removerFiltro(index) {
  filtrosAtivos.splice(index, 1);
  atualizarListaFiltros();
}

function atualizarListaFiltros() {
  const lista = qs('filtrosList');
  lista.innerHTML = '';
  
  filtrosAtivos.forEach((filtro, index) => {
    const li = document.createElement('li');
    li.className = 'filtro-item';
    li.innerHTML = `
      <span>${filtro.campo} ${filtro.operador} "${filtro.valor}"</span>
      <button class="btn-remove" onclick="removerFiltro(${index})">✕</button>
    `;
    lista.appendChild(li);
  });
}

async function processarArquivo() {
  if (!formataSessionId) {
    alert('Faça upload do arquivo primeiro.');
    return;
  }

  setText('formataStatus', 'Processando arquivo...');
  setDisabled(qs('btnProcessar'), true);

  const incluirNonoDigito = (() => {
    const val = qs('nonoDigito').value;
    if (val === 'incluir') return true;
    if (val === 'remover') return false;
    return null;
  })();

  const payload = {
    telefone_config: {
      incluir_ddi: qs('incluirDDI').checked,
      incluir_ddd: qs('incluirDDD').checked,
      incluir_nono_digito: incluirNonoDigito
    },
    apenas_primeiro_nome: qs('apenasNome').checked,
    filtros: filtrosAtivos
  };

  try {
    const resp = await fetch(`/api/formata-lista/processar/${formataSessionId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const data = await resp.json();
      setText('formataStatus', `Erro: ${data.detail || 'Erro ao processar'}`);
      alert(data.detail || 'Erro ao processar');
      setDisabled(qs('btnProcessar'), false);
      return;
    }

    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_formatado.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    setText('formataStatus', '✓ Arquivo processado e baixado com sucesso!');
    setDisabled(qs('btnProcessar'), false);

  } catch (error) {
    setText('formataStatus', `Erro: ${error.message}`);
    alert('Erro ao processar: ' + error.message);
    setDisabled(qs('btnProcessar'), false);
  }
}

function resetarFormata() {
  if (formataSessionId) {
    fetch(`/api/formata-lista/session/${formataSessionId}`, { method: 'DELETE' })
      .catch(() => {});
  }

  formataSessionId = null;
  filtrosAtivos = [];
  
  qs('formataFile').value = '';
  setText('formataUploadInfo', '');
  setText('formataPreview', '');
  setText('formataStatus', 'Aguardando upload...');
  
  qs('incluirDDI').checked = false;
  qs('incluirDDD').checked = true;
  qs('nonoDigito').value = 'auto';
  qs('apenasNome').checked = false;
  
  qs('filtroValor').value = '';
  qs('filtrosList').innerHTML = '';
  
  setDisabled(qs('btnProcessar'), true);
}

document.addEventListener('DOMContentLoaded', () => {
  const btnFormataUpload = qs('btnFormataUpload');
  const btnProcessar = qs('btnProcessar');
  const btnResetFormata = qs('btnResetFormata');
  const btnAddFiltro = qs('btnAddFiltro');

  if (btnFormataUpload) btnFormataUpload.addEventListener('click', uploadFormataFile);
  if (btnProcessar) btnProcessar.addEventListener('click', processarArquivo);
  if (btnResetFormata) btnResetFormata.addEventListener('click', resetarFormata);
  if (btnAddFiltro) btnAddFiltro.addEventListener('click', adicionarFiltro);
});
