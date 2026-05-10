import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { auth, db } from './firebase-config.js';

const loginPanel = document.querySelector('#loginPanel');
const adminPanel = document.querySelector('#adminPanel');
const loginForm = document.querySelector('#loginForm');
const logoutButton = document.querySelector('#logoutButton');
const aprList = document.querySelector('#aprList');
const toast = document.querySelector('#toast');
const menuButton = document.querySelector('#menuButton');
const mainMenu = document.querySelector('#mainMenu');

let aprs = [];

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

function formatDate(value) {
  if (!value) return 'Sem data';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleDateString('pt-BR');
}

function normalizeFileName(value) {
  return String(value || 'apr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function renderAprs() {
  if (!aprs.length) {
    aprList.innerHTML = '<p class="empty-state">Nenhuma APR finalizada encontrada.</p>';
    return;
  }

  aprList.innerHTML = aprs
    .map((apr, index) => {
      return `
        <article class="apr-card">
          <div>
            <strong>OS ${apr.ordemServico || 'sem número'}</strong>
            <span>${formatDate(apr.data)} - ${apr.responsavel || 'Responsável não informado'}</span>
            <small>${apr.local || 'Local não informado'}${apr.origemLocal ? ' - salvo neste aparelho' : ''}</small>
          </div>
          <button type="button" class="primary-button" data-pdf-index="${index}">PDF</button>
        </article>
      `;
    })
    .join('');
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 6) {
  const lines = doc.splitTextToSize(String(text || '-'), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc, y, needed = 18) {
  if (y + needed <= 282) return y;
  doc.addPage();
  return 16;
}

function generatePdf(apr) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Análise Preliminar de Risco', 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(doc, `OS: ${apr.ordemServico || '-'} | Data: ${formatDate(apr.data)} | Responsável: ${apr.responsavel || '-'}`, 14, y, 180);
  y = addWrappedText(doc, `Local: ${apr.local || '-'}`, 14, y + 2, 180);
  y = addWrappedText(doc, `Atividade: ${apr.atividade || '-'}`, 14, y + 2, 180);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Itens utilizados', 14, y);
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(doc, (apr.itens || []).join(', ') || '-', 14, y + 6, 180);

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('EPI / EPC', 14, y);
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(doc, (apr.protecao || []).join(', ') || '-', 14, y + 6, 180);

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Ambiente de trabalho', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 6;

  (apr.respostas || []).forEach((answer, index) => {
    y = ensureSpace(doc, y, 16);
    const resposta = (answer.resposta || '-').toUpperCase();
    const label = `${String(index + 1).padStart(2, '0')} - ${answer.pergunta} - ${resposta}`;
    y = addWrappedText(doc, label, 14, y, 180, 5) + 1;
  });

  y = ensureSpace(doc, y, 34);
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.text('Observação', 14, y);
  doc.setFont('helvetica', 'normal');
  y = addWrappedText(doc, apr.observacao || '-', 14, y + 6, 180);

  if (apr.assinatura) {
    y = ensureSpace(doc, y, 45);
    doc.setFont('helvetica', 'bold');
    doc.text('Assinatura', 14, y + 5);
    doc.addImage(apr.assinatura, 'PNG', 14, y + 9, 80, 29);
  }

  const fileName = `apr-${normalizeFileName(apr.ordemServico || apr.responsavel || Date.now())}.pdf`;
  doc.save(fileName);
}

function loadLocalAprs() {
  return Object.keys(localStorage)
    .filter((key) => key.startsWith('apr-finalizada-'))
    .map((key) => {
      try {
        return {
          id: key,
          origemLocal: true,
          ...JSON.parse(localStorage.getItem(key)),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(b.salvoLocalEm || b.atualizadoEm || '').localeCompare(String(a.salvoLocalEm || a.atualizadoEm || '')));
}

async function loadAprs() {
  aprList.innerHTML = '<p class="empty-state">Carregando APRs...</p>';
  const localAprs = loadLocalAprs();
  const aprQuery = query(collection(db, 'aprs'), orderBy('criadoEm', 'desc'));
  const snapshot = await getDocs(aprQuery);
  const cloudAprs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const cloudOrders = new Set(cloudAprs.map((apr) => apr.ordemServico).filter(Boolean));
  const pendingLocalAprs = localAprs.filter((apr) => !cloudOrders.has(apr.ordemServico));
  aprs = [...cloudAprs, ...pendingLocalAprs];
  renderAprs();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);

  try {
    await signInWithEmailAndPassword(auth, data.get('email'), data.get('password'));
  } catch {
    showToast('Usuário ou senha inválidos.');
  }
});

logoutButton.addEventListener('click', () => signOut(auth));

aprList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pdf-index]');
  if (!button) return;
  generatePdf(aprs[Number(button.dataset.pdfIndex)]);
});

onAuthStateChanged(auth, async (user) => {
  loginPanel.hidden = Boolean(user);
  adminPanel.hidden = !user;

  if (user) {
    try {
      await loadAprs();
    } catch (error) {
      console.error('Erro ao carregar APRs do Firebase:', error);
      aprs = loadLocalAprs();
      renderAprs();
      showToast('Firebase bloqueou a leitura. Mostrando APRs salvas neste aparelho.');
    }
  }
});

setupMenu();
