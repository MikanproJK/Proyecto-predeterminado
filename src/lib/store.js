/* Estado central, persistencia y acciones de negocio */

import {
  buildLoanViews,
  computeLoan,
  accountBalance,
  configureFormat,
  todayISO,
  uid,
  num,
  round2,
  sum,
  buildSchedule,
  portfolioSummary,
} from '../finance.js';
import { demoDatabase } from '../seed.js';

export { portfolioSummary };

export function defaultAccounts() {
  return [
    { id: 'acc_cash', name: 'Caja principal', type: 'cash', openingBalance: 0, color: '#4f6ef7' },
    { id: 'acc_bank', name: 'Cuenta bancaria', type: 'bank', openingBalance: 0, color: '#17a673' },
  ];
}

export function createDefaultDB() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      company: 'Mi Financiera',
      owner: '',
      currency: 'USD',
      locale: 'es-419',
      theme: 'aurora',
      density: 'comfortable',
      fontScale: 1,
      autoTransactions: true,
      defaultAccountId: 'acc_cash',
      lateFeeType: 'percent_daily',
      lateFeeValue: 1,
      graceDays: 0,
      firstRun: true,
      loanCounter: 1,
      receiptCounter: 1,
    },
    clients: [],
    loans: [],
    payments: [],
    accounts: defaultAccounts(),
    transactions: [],
    categories: {
      income: ['Cobro de cuota', 'Interés', 'Comisión', 'Otro ingreso'],
      expense: ['Préstamo otorgado', 'Operativo', 'Personal', 'Servicios', 'Retiro', 'Otro egreso'],
    },
  };
}

function hydrate(raw) {
  const base = createDefaultDB();
  if (!raw || typeof raw !== 'object') return base;
  const db = {
    ...base,
    ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    categories: { ...base.categories, ...(raw.categories || {}) },
  };
  for (const key of ['clients', 'loans', 'payments', 'accounts', 'transactions']) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  if (!db.accounts.length) db.accounts = defaultAccounts();
  if (!db.settings.defaultAccountId || !db.accounts.some((a) => a.id === db.settings.defaultAccountId)) {
    db.settings.defaultAccountId = db.accounts[0].id;
  }
  db.settings.loanCounter = Math.max(num(db.settings.loanCounter) || 1, db.loans.length + 1);
  db.settings.receiptCounter = Math.max(num(db.settings.receiptCounter) || 1, db.payments.length + 1);
  return db;
}

export const state = {
  db: createDefaultDB(),
  revision: 0,
  ready: false,
  saving: false,
  lastSavedAt: null,
  saveError: null,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(type = 'change') {
  for (const fn of listeners) {
    try {
      fn(type, state);
    } catch (err) {
      console.error('[store] listener', err);
    }
  }
}

/* ---------- persistencia ---------- */

let writeChain = Promise.resolve();

function persist() {
  const snapshot = JSON.parse(JSON.stringify(state.db));
  state.db.updatedAt = snapshot.updatedAt || new Date().toISOString();
  writeChain = writeChain
    .then(async () => {
      state.saving = true;
      try {
        await window.api.save(snapshot);
        state.lastSavedAt = new Date();
        state.saveError = null;
      } catch (err) {
        console.error('[store] error al guardar', err);
        state.saveError = err?.message || String(err);
        emit('save-error');
      } finally {
        state.saving = false;
      }
    })
    .catch(() => {});
  return writeChain;
}

export function flushSave() {
  return writeChain;
}

export async function init() {
  const raw = await window.api.load();
  state.db = hydrate(raw);
  configureFormat({
    currency: state.db.settings.currency,
    locale: state.db.settings.locale,
  });
  state.ready = true;
  state.revision += 1;
  persist();
  return state.db;
}

/* ---------- helpers de consulta ---------- */

let loanViewCache = new Map();

export function loanViews(asOf = todayISO()) {
  const key = `${state.revision}:${asOf}`;
  if (loanViewCache.has(key)) return loanViewCache.get(key);
  const views = buildLoanViews(state.db.loans, state.db.payments, asOf);
  loanViewCache = new Map([[key, views]]);
  return views;
}

export function loanView(id, asOf = todayISO()) {
  return loanViews(asOf).find((loan) => loan.id === id) || null;
}

export function client(id) {
  return state.db.clients.find((c) => c.id === id) || null;
}

export function loan(id) {
  return state.db.loans.find((l) => l.id === id) || null;
}

export function paymentsFor(loanId) {
  return state.db.payments
    .filter((p) => p.loanId === loanId)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function clientLoans(clientId) {
  return loanViews().filter((l) => l.clientId === clientId);
}

export function clientStats(clientId) {
  const loans = clientLoans(clientId);
  return {
    loans: loans.length,
    active: loans.filter((l) => ['active', 'overdue'].includes(l.state)).length,
    principal: round2(sum(loans, (l) => l.totals.principal)),
    paid: round2(sum(loans, (l) => l.totals.paid)),
    balance: round2(sum(loans.filter((l) => l.state !== 'cancelled'), (l) => l.totals.balance)),
    lateDue: round2(sum(loans, (l) => l.totals.lateDue)),
    lastPayment: state.db.payments
      .filter((p) => p.clientId === clientId)
      .map((p) => p.date)
      .sort()
      .pop() || null,
  };
}

export function accountBalances() {
  return state.db.accounts.map((account) => ({
    ...account,
    balance: accountBalance(account, state.db.transactions),
  }));
}

export function totalBalance() {
  return round2(sum(accountBalances(), (a) => a.balance));
}

/* ---------- clientes ---------- */

export function addClient(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('El nombre del cliente es obligatorio.');
  const client = {
    id: uid('cli'),
    name,
    phone: String(input.phone || '').trim(),
    email: String(input.email || '').trim(),
    doc: String(input.doc || '').trim(),
    address: String(input.address || '').trim(),
    type: input.type === 'temporary' ? 'temporary' : 'regular',
    active: input.active !== false,
    notes: String(input.notes || '').trim(),
    expiresAt: input.expiresAt || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.db.clients.unshift(client);
  bump();
  return client;
}

export function updateClient(id, patch) {
  const target = state.db.clients.find((c) => c.id === id);
  if (!target) throw new Error('Cliente no encontrado.');
  if (patch.name !== undefined && !String(patch.name).trim()) {
    throw new Error('El nombre del cliente es obligatorio.');
  }
  Object.assign(target, patch, { updatedAt: new Date().toISOString() });
  bump();
  return target;
}

export function deleteClient(id) {
  const hasLoans = state.db.loans.some((l) => l.clientId === id);
  if (hasLoans) {
    throw new Error('El cliente tiene préstamos asociados. Elimina o reasigna esos préstamos primero.');
  }
  state.db.clients = state.db.clients.filter((c) => c.id !== id);
  bump();
  return true;
}

/* ---------- préstamos ---------- */

function nextLoanCode() {
  const counter = Math.max(1, num(state.db.settings.loanCounter) || 1);
  let code = `P-${String(counter).padStart(4, '0')}`;
  let used = new Set(state.db.loans.map((l) => l.code));
  let next = counter;
  while (used.has(code)) {
    next += 1;
    code = `P-${String(next).padStart(4, '0')}`;
  }
  state.db.settings.loanCounter = next + 1;
  return code;
}

function nextReceipt() {
  const counter = Math.max(1, num(state.db.settings.receiptCounter) || 1);
  state.db.settings.receiptCounter = counter + 1;
  return `REC-${String(counter).padStart(5, '0')}`;
}

export function addLoan(input) {
  const clientRecord = state.db.clients.find((c) => c.id === input.clientId);
  if (!clientRecord) throw new Error('Selecciona un cliente válido.');
  const principal = round2(num(input.principal));
  if (principal <= 0) throw new Error('El monto del préstamo debe ser mayor que cero.');
  const installments = Math.max(1, Math.round(num(input.installments) || 1));
  const startDate = input.startDate || todayISO();
  const firstDueDate = input.firstDueDate || startDate;
  const loan = {
    id: uid('loan'),
    code: nextLoanCode(),
    clientId: clientRecord.id,
    principal,
    interestRate: num(input.interestRate),
    rateType: input.rateType || 'monthly',
    amortization: input.amortization || 'fixed',
    frequency: input.frequency || 'monthly',
    customDays: Math.max(1, Math.round(num(input.customDays) || 15)),
    installments,
    startDate,
    firstDueDate,
    lateFeeType: input.lateFeeType || 'none',
    lateFeeValue: num(input.lateFeeValue),
    graceDays: Math.max(0, Math.round(num(input.graceDays))),
    fees: round2(num(input.fees)),
    notes: String(input.notes || '').trim(),
    guarantee: String(input.guarantee || '').trim(),
    status: 'active',
    accountId: input.accountId || state.db.settings.defaultAccountId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.db.loans.unshift(loan);

  if (state.db.settings.autoTransactions && input.registerDisbursement !== false) {
    state.db.transactions.unshift({
      id: uid('tx'),
      date: startDate,
      type: 'expense',
      category: 'Préstamo otorgado',
      amount: principal,
      accountId: loan.accountId,
      description: `Desembolso ${loan.code} · ${clientRecord.name}`,
      loanId: loan.id,
      clientId: clientRecord.id,
      createdAt: new Date().toISOString(),
      auto: true,
    });
  }

  bump();
  return loan;
}

export function updateLoan(id, patch) {
  const target = state.db.loans.find((l) => l.id === id);
  if (!target) throw new Error('Préstamo no encontrado.');
  const hasPayments = state.db.payments.some((p) => p.loanId === id);
  const safeKeys = ['notes', 'guarantee', 'lateFeeType', 'lateFeeValue', 'graceDays', 'status', 'clientId'];
  const next = { ...patch };
  if (hasPayments) {
    for (const key of Object.keys(next)) {
      if (!safeKeys.includes(key)) delete next[key];
    }
  }
  if (next.principal !== undefined && round2(num(next.principal)) <= 0) {
    throw new Error('El monto del préstamo debe ser mayor que cero.');
  }
  Object.assign(target, next, { updatedAt: new Date().toISOString() });
  if (next.principal !== undefined) target.principal = round2(num(next.principal));
  if (next.installments !== undefined) target.installments = Math.max(1, Math.round(num(next.installments)));
  if (next.graceDays !== undefined) target.graceDays = Math.max(0, Math.round(num(next.graceDays)));
  bump();
  return target;
}

export function cancelLoan(id, reason = '') {
  const target = state.db.loans.find((l) => l.id === id);
  if (!target) throw new Error('Préstamo no encontrado.');
  target.status = 'cancelled';
  target.cancelReason = reason;
  target.cancelledAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();
  bump();
  return target;
}

export function reactivateLoan(id) {
  const target = state.db.loans.find((l) => l.id === id);
  if (!target) throw new Error('Préstamo no encontrado.');
  target.status = 'active';
  delete target.cancelReason;
  delete target.cancelledAt;
  target.updatedAt = new Date().toISOString();
  bump();
  return target;
}

export function deleteLoan(id) {
  const target = state.db.loans.find((l) => l.id === id);
  if (!target) throw new Error('Préstamo no encontrado.');
  const paymentIds = new Set(state.db.payments.filter((p) => p.loanId === id).map((p) => p.id));
  state.db.payments = state.db.payments.filter((p) => p.loanId !== id);
  state.db.transactions = state.db.transactions.filter(
    (t) => t.loanId !== id && !(t.paymentId && paymentIds.has(t.paymentId)),
  );
  state.db.loans = state.db.loans.filter((l) => l.id !== id);
  bump();
  return true;
}

export function previewLoan(loanInput) {
  const temp = {
    id: 'preview',
    ...loanInput,
    principal: num(loanInput.principal),
    installments: Math.max(1, Math.round(num(loanInput.installments) || 1)),
    lateFeeType: 'none',
  };
  return computeLoan(temp, [], todayISO());
}

/* ---------- pagos ---------- */

export function addPayment(input) {
  const target = state.db.loans.find((l) => l.id === input.loanId);
  if (!target) throw new Error('Selecciona un préstamo válido.');
  const amount = round2(num(input.amount));
  if (amount <= 0) throw new Error('El monto del pago debe ser mayor que cero.');
  const payment = {
    id: uid('pay'),
    receipt: nextReceipt(),
    loanId: target.id,
    clientId: target.clientId,
    date: input.date || todayISO(),
    amount,
    method: input.method || 'Efectivo',
    accountId: input.accountId || state.db.settings.defaultAccountId,
    note: String(input.note || '').trim(),
    createdAt: new Date().toISOString(),
    auto: true,
  };
  state.db.payments.unshift(payment);

  if (state.db.settings.autoTransactions && input.registerTransaction !== false) {
    const clientRecord = client(target.clientId);
    state.db.transactions.unshift({
      id: uid('tx'),
      date: payment.date,
      type: 'income',
      category: 'Cobro de cuota',
      amount,
      accountId: payment.accountId,
      description: `Pago ${target.code} · ${clientRecord ? clientRecord.name : 'Cliente'}`,
      loanId: target.id,
      clientId: target.clientId,
      paymentId: payment.id,
      createdAt: new Date().toISOString(),
      auto: true,
    });
  }

  bump();
  return payment;
}

export function updatePayment(id, patch) {
  const payment = state.db.payments.find((p) => p.id === id);
  if (!payment) throw new Error('Pago no encontrado.');
  const next = {};
  if (patch.date) next.date = patch.date;
  if (patch.amount !== undefined) {
    const amount = round2(num(patch.amount));
    if (amount <= 0) throw new Error('El monto del pago debe ser mayor que cero.');
    next.amount = amount;
  }
  if (patch.method) next.method = patch.method;
  if (patch.accountId) next.accountId = patch.accountId;
  if (patch.note !== undefined) next.note = String(patch.note).trim();
  Object.assign(payment, next, { updatedAt: new Date().toISOString() });

  const tx = state.db.transactions.find((t) => t.paymentId === id);
  if (tx) {
    if (next.date) tx.date = next.date;
    if (next.amount) tx.amount = next.amount;
    if (next.accountId) tx.accountId = next.accountId;
  }
  bump();
  return payment;
}

export function deletePayment(id) {
  const payment = state.db.payments.find((p) => p.id === id);
  if (!payment) throw new Error('Pago no encontrado.');
  state.db.payments = state.db.payments.filter((p) => p.id !== id);
  state.db.transactions = state.db.transactions.filter((t) => t.paymentId !== id);
  bump();
  return true;
}

/* ---------- finanzas ---------- */

export function addTransaction(input) {
  const amount = round2(num(input.amount));
  if (amount <= 0) throw new Error('El monto debe ser mayor que cero.');
  const type = ['income', 'expense'].includes(input.type) ? input.type : 'expense';
  const tx = {
    id: uid('tx'),
    date: input.date || todayISO(),
    type,
    category: String(input.category || (type === 'income' ? 'Otro ingreso' : 'Otro egreso')).trim(),
    amount,
    accountId: input.accountId || state.db.settings.defaultAccountId,
    description: String(input.description || '').trim(),
    createdAt: new Date().toISOString(),
    auto: false,
  };
  state.db.transactions.unshift(tx);
  bump();
  return tx;
}

export function addTransfer(input) {
  const amount = round2(num(input.amount));
  if (amount <= 0) throw new Error('El monto debe ser mayor que cero.');
  if (!input.accountId || !input.toAccountId || input.accountId === input.toAccountId) {
    throw new Error('Selecciona dos cuentas diferentes.');
  }
  const tx = {
    id: uid('tx'),
    date: input.date || todayISO(),
    type: 'transfer',
    category: 'Transferencia',
    amount,
    accountId: input.accountId,
    toAccountId: input.toAccountId,
    description: String(input.description || 'Transferencia entre cuentas').trim(),
    createdAt: new Date().toISOString(),
    auto: false,
  };
  state.db.transactions.unshift(tx);
  bump();
  return tx;
}

export function updateTransaction(id, patch) {
  const tx = state.db.transactions.find((t) => t.id === id);
  if (!tx) throw new Error('Movimiento no encontrado.');
  if (tx.auto) throw new Error('Este movimiento se generó automáticamente desde un pago o préstamo. Edita el registro original.');
  const next = { ...patch };
  if (next.amount !== undefined) {
    const amount = round2(num(next.amount));
    if (amount <= 0) throw new Error('El monto debe ser mayor que cero.');
    next.amount = amount;
  }
  Object.assign(tx, next, { updatedAt: new Date().toISOString() });
  bump();
  return tx;
}

export function deleteTransaction(id) {
  const tx = state.db.transactions.find((t) => t.id === id);
  if (!tx) throw new Error('Movimiento no encontrado.');
  if (tx.auto) throw new Error('Este movimiento está vinculado a un pago o préstamo. Elimina el registro original.');
  state.db.transactions = state.db.transactions.filter((t) => t.id !== id);
  bump();
  return true;
}

export function addCategory(kind, name) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Escribe un nombre para la categoría.');
  const key = kind === 'income' ? 'income' : 'expense';
  if (!state.db.categories[key].includes(clean)) state.db.categories[key].push(clean);
  bump();
  return clean;
}

export function removeCategory(kind, name) {
  const key = kind === 'income' ? 'income' : 'expense';
  state.db.categories[key] = state.db.categories[key].filter((c) => c !== name);
  bump();
}

/* ---------- cuentas ---------- */

export function addAccount(input) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Escribe un nombre para la cuenta.');
  const account = {
    id: uid('acc'),
    name,
    type: input.type || 'cash',
    openingBalance: round2(num(input.openingBalance)),
    color: input.color || '#4f6ef7',
    createdAt: new Date().toISOString(),
  };
  state.db.accounts.push(account);
  bump();
  return account;
}

export function updateAccount(id, patch) {
  const account = state.db.accounts.find((a) => a.id === id);
  if (!account) throw new Error('Cuenta no encontrada.');
  Object.assign(account, patch);
  if (patch.openingBalance !== undefined) account.openingBalance = round2(num(patch.openingBalance));
  bump();
  return account;
}

export function deleteAccount(id) {
  if (state.db.accounts.length <= 1) throw new Error('Debe existir al menos una cuenta.');
  const inUse = state.db.transactions.some((t) => t.accountId === id || t.toAccountId === id);
  if (inUse) throw new Error('La cuenta tiene movimientos asociados. No se puede eliminar.');
  state.db.accounts = state.db.accounts.filter((a) => a.id !== id);
  if (state.db.settings.defaultAccountId === id) state.db.settings.defaultAccountId = state.db.accounts[0].id;
  bump();
  return true;
}

/* ---------- ajustes y datos ---------- */

export function updateSettings(patch) {
  Object.assign(state.db.settings, patch);
  configureFormat({
    currency: state.db.settings.currency,
    locale: state.db.settings.locale,
  });
  bump();
  return state.db.settings;
}

export function setTheme(theme) {
  state.db.settings.theme = theme;
  bump();
}

export async function loadDemo() {
  state.db = demoDatabase(state.db);
  state.db = hydrate(state.db);
  configureFormat({ currency: state.db.settings.currency, locale: state.db.settings.locale });
  bump();
  await persist();
}

export async function clearData({ keepSettings = true } = {}) {
  const settings = keepSettings
    ? { ...state.db.settings, firstRun: false, loanCounter: 1, receiptCounter: 1 }
    : createDefaultDB().settings;
  const fresh = createDefaultDB();
  state.db = {
    ...fresh,
    settings,
    accounts: defaultAccounts(),
  };
  state.db.settings.defaultAccountId = 'acc_cash';
  state.db.createdAt = new Date().toISOString();
  configureFormat({ currency: settings.currency, locale: settings.locale });
  bump();
  await persist();
}

export async function replaceDB(raw) {
  state.db = hydrate(raw);
  configureFormat({ currency: state.db.settings.currency, locale: state.db.settings.locale });
  bump();
  await persist();
}

export function markFirstRunSeen() {
  if (state.db.settings.firstRun) {
    state.db.settings.firstRun = false;
    bump();
  }
}

function bump() {
  state.revision += 1;
  state.db.updatedAt = new Date().toISOString();
  loanViewCache = new Map();
  persist();
  emit('change');
}

/* pequeña utilidad usada por la vista de préstamos para previsualizar */
export function schedulePreview(input) {
  return buildSchedule({
    principal: num(input.principal),
    interestRate: num(input.interestRate),
    rateType: input.rateType,
    amortization: input.amortization,
    frequency: input.frequency,
    customDays: input.customDays,
    installments: Math.max(1, Math.round(num(input.installments) || 1)),
    startDate: input.startDate,
    firstDueDate: input.firstDueDate,
    fees: num(input.fees),
    graceDays: 0,
    lateFeeType: 'none',
  });
}
