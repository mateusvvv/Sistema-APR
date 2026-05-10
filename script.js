import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase-config.js';

const protectionItems = [
  'Capacete com jugular',
  'Calçado de segurança',
  'Óculos de segurança',
  'Luva de segurança',
  'Trava quedas com corda 12mm',
  'Mosquetão rosca',
  'Cinto tipo paraquedista/alpinista',
  'Talabarte de posicionamento',
  'Fitas/cones',
  'Detector de tensão',
  'Talabarte duplo Y',
  'Luva isolante com cobertura',
];

const questions = [
  'O trabalhador é treinado em NR-06/10/35 e está autorizado a realizar o serviço?',
  'A área ao redor do trabalho está isolada, identificada e seca, evitando passagem de pessoas e veículos?',
  'A base de apoio para escadas, andaime, rampa ou plataforma possui condições adequadas?',
  'O ponto de ancoragem do cinto de segurança está preso, resistente e seguro?',
  'As condições meteorológicas são favoráveis?',
  'Os cabos elétricos visíveis estão em boas condições e com proteção contra contato?',
  'A equipe foi treinada para o trabalho, está consciente do risco e possui ASO apto?',
  'Existem pessoas suficientes e preparadas para todos os executantes?',
  'Os distanciamentos recomendados estão sendo seguidos conforme projeto aprovado?',
  'Existe linha de vida para instalar o trava quedas?',
  'Energias perigosas relacionadas ao serviço foram desligadas ou protegidas?',
  'O trabalho será realizado próximo à rede energizada de baixa tensão?',
  'O trabalho será realizado próximo à rede energizada de alta tensão?',
  'Existe risco de choque elétrico?',
  'O poste ou estrutura para ancoragem apresenta falha estrutural?',
  'Existe risco de ataque de animais peçonhentos ou domésticos?',
  'O local é classificado como espaço confinado?',
  'Existe alguma forma impeditiva para execução do trabalho?',
];

const form = document.querySelector('#aprForm');
const protectionList = document.querySelector('#protectionList');
const questionList = document.querySelector('#questionList');
const toast = document.querySelector('#toast');
const statusPill = document.querySelector('#statusPill');
const signaturePad = document.querySelector('#signaturePad');
const signatureValue = document.querySelector('#signatureValue');
const signatureContext = signaturePad.getContext('2d');
const menuButton = document.querySelector('#menuButton');
const mainMenu = document.querySelector('#mainMenu');
const submitApr = document.querySelector('#submitApr');

let isDrawing = false;
let hasSignature = false;

function normalizeId(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function renderProtectionItems() {
  protectionList.innerHTML = protectionItems
    .map((item) => {
      const id = `epi-${normalizeId(item)}`;
      return `
        <label for="${id}">
          <input type="checkbox" id="${id}" name="protecao" value="${item}" />
          ${item}
        </label>
      `;
    })
    .join('');
}

function renderQuestions() {
  questionList.innerHTML = questions
    .map((question, index) => {
      const number = String(index + 1).padStart(2, '0');
      return `
        <article class="question-card">
          <div class="question-text">${number} - ${question}</div>
          <div class="answer-row" role="radiogroup" aria-label="${question}">
            <label>
              <input type="radio" name="q${index}" value="sim" required />
              SIM
            </label>
            <label>
              <input type="radio" name="q${index}" value="nao" />
              NÃO
            </label>
            <label>
              <input type="radio" name="q${index}" value="na" />
              N/A
            </label>
          </div>
        </article>
      `;
    })
    .join('');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 3200);
}

function setupMenu() {
  menuButton.addEventListener('click', () => {
    const isOpen = mainMenu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.menu-wrap')) {
      mainMenu.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
  });
}

function setToday() {
  const dateInput = form.elements.data;
  if (!dateInput.value) {
    dateInput.valueAsDate = new Date();
  }
}

function getPointerPosition(event) {
  const rect = signaturePad.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * signaturePad.width,
    y: ((event.clientY - rect.top) / rect.height) * signaturePad.height,
  };
}

function startSignature(event) {
  isDrawing = true;
  hasSignature = true;
  signatureContext.beginPath();
  const point = getPointerPosition(event);
  signatureContext.moveTo(point.x, point.y);
  signatureValue.value = 'assinada';
  updateStatus();
}

function drawSignature(event) {
  if (!isDrawing) return;
  event.preventDefault();
  const point = getPointerPosition(event);
  signatureContext.lineTo(point.x, point.y);
  signatureContext.stroke();
}

function stopSignature() {
  isDrawing = false;
}

function clearSignature() {
  signatureContext.clearRect(0, 0, signaturePad.width, signaturePad.height);
  hasSignature = false;
  signatureValue.value = '';
  updateStatus();
}

function setupSignature() {
  signatureContext.lineWidth = 3;
  signatureContext.lineCap = 'round';
  signatureContext.lineJoin = 'round';
  signatureContext.strokeStyle = '#17212b';

  signaturePad.addEventListener('pointerdown', startSignature);
  signaturePad.addEventListener('pointermove', drawSignature);
  signaturePad.addEventListener('pointerup', stopSignature);
  signaturePad.addEventListener('pointerleave', stopSignature);
  document.querySelector('#clearSignature').addEventListener('click', clearSignature);
}

function collectFormData() {
  const data = new FormData(form);
  return {
    ordemServico: data.get('ordemServico'),
    data: data.get('data'),
    responsavel: data.get('responsavel'),
    local: data.get('local'),
    atividade: data.get('atividade'),
    itens: data.getAll('itens'),
    protecao: data.getAll('protecao'),
    respostas: questions.map((question, index) => ({
      pergunta: question,
      resposta: data.get(`q${index}`),
    })),
    confirmacao: data.get('confirmacao') === 'on',
    observacao: data.get('observacao'),
    assinatura: hasSignature ? signaturePad.toDataURL('image/png') : '',
    atualizadoEm: new Date().toISOString(),
  };
}

function validateRiskAnswers() {
  const answers = questions.map((_, index) => form.elements[`q${index}`]?.value);
  const unanswered = answers.findIndex((answer) => !answer);
  if (unanswered >= 0) {
    showToast(`Responda a pergunta ${String(unanswered + 1).padStart(2, '0')} antes de finalizar.`);
    return false;
  }

  const blockingAnswers = [12, 13, 14, 15, 16, 17].filter((questionNumber) => {
    return answers[questionNumber - 1] === 'sim';
  });

  if (blockingAnswers.length) {
    showToast(`Atenção: há risco crítico marcado nas perguntas ${blockingAnswers.join(', ')}.`);
  }

  return true;
}

function updateStatus() {
  const requiredFields = [...form.querySelectorAll('[required]')];
  const ready = requiredFields.every((field) => {
    if (field.type === 'radio') {
      return form.elements[field.name].value;
    }
    if (field.type === 'checkbox') {
      return field.checked;
    }
    return field.value;
  });

  statusPill.textContent = ready ? 'Completa' : 'Pendente';
  statusPill.classList.toggle('ready', ready);
}

function saveDraft() {
  localStorage.setItem('apr-rascunho', JSON.stringify(collectFormData()));
  showToast('Rascunho salvo neste aparelho.');
}

function saveLocalApr(apr, firebaseStatus) {
  const localKey = `apr-finalizada-${apr.ordemServico || Date.now()}`;
  localStorage.setItem(
    localKey,
    JSON.stringify({
      ...apr,
      firebaseStatus,
      salvoLocalEm: new Date().toISOString(),
    }),
  );
  return localKey;
}

function restoreDraft() {
  const draft = localStorage.getItem('apr-rascunho');
  if (!draft) return;

  try {
    const data = JSON.parse(draft);
    Object.entries(data).forEach(([key, value]) => {
      if (!form.elements[key] || Array.isArray(value) || typeof value === 'object') return;
      if (form.elements[key].type === 'checkbox') {
        form.elements[key].checked = Boolean(value);
      } else {
        form.elements[key].value = value ?? '';
      }
    });

    [...(data.itens || []), ...(data.protecao || [])].forEach((value) => {
      const field = [...form.querySelectorAll('input[type="checkbox"]')].find((input) => input.value === value);
      if (field) field.checked = true;
    });

    (data.respostas || []).forEach((answer, index) => {
      const field = form.querySelector(`input[name="q${index}"][value="${answer.resposta}"]`);
      if (field) field.checked = true;
    });

    if (data.confirmacao) {
      form.elements.confirmacao.checked = true;
    }
  } catch {
    localStorage.removeItem('apr-rascunho');
  }
}

async function saveFinalApr(apr) {
  const localKey = saveLocalApr(apr, 'pendente');

  await addDoc(collection(db, 'aprs'), {
    ...apr,
    criadoEm: serverTimestamp(),
  });

  saveLocalApr({ ...apr, localKey }, 'enviado');
}

document.querySelector('#markProtection').addEventListener('click', () => {
  protectionList.querySelectorAll('input').forEach((input) => {
    input.checked = true;
  });
  updateStatus();
});

document.querySelector('#markSafe').addEventListener('click', () => {
  questions.forEach((_, index) => {
    const safeAnswer = index < 11 ? 'sim' : 'nao';
    const field = form.querySelector(`input[name="q${index}"][value="${safeAnswer}"]`);
    if (field) field.checked = true;
  });
  updateStatus();
});

document.querySelector('#saveDraft').addEventListener('click', saveDraft);

form.addEventListener('input', updateStatus);
form.addEventListener('change', updateStatus);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!form.reportValidity() || !validateRiskAnswers()) return;
  if (!hasSignature) {
    showToast('Assine a APR antes de finalizar.');
    return;
  }

  const apr = collectFormData();
  submitApr.disabled = true;
  submitApr.textContent = 'Enviando...';

  try {
    await saveFinalApr(apr);
    localStorage.removeItem('apr-rascunho');
    showToast('APR finalizada e enviada para o painel admin.');
    form.reset();
    clearSignature();
    setToday();
  } catch (error) {
    console.error('Erro ao enviar APR para o Firebase:', error);
    saveLocalApr(apr, 'erro');
    showToast('APR salva no aparelho, mas o Firebase recusou o envio. Verifique as regras do Firestore.');
  } finally {
    submitApr.disabled = false;
    submitApr.textContent = 'Finalizar APR';
    updateStatus();
  }
});

renderProtectionItems();
renderQuestions();
setupSignature();
setupMenu();
setToday();
restoreDraft();
updateStatus();
