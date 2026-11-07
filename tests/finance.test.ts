/* Pruebas del motor financiero (sin DOM) */

import assert from 'node:assert/strict';
import {
  num,
  round2,
  addDaysISO,
  addMonthsISO,
  daysBetween,
  buildSchedule,
  computeLoan,
  portfolioSummary,
  accountBalance,
  transactionsSummary,
  monthlySeries,
  toCSV,
  periodRate,
  uid,
  configureFormat,
  money,
  number,
} from '../src/finance.js';
import { currencyMeta, roundToCurrency } from '../src/lib/currencies.js';
import type { LoanTerms, TransactionLike } from '../src/types.js';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
  }
}

function close(actual: number, expected: number, epsilon = 0.01): void {
  assert.ok(Math.abs(actual - expected) <= epsilon, `esperado ${expected}, recibido ${actual}`);
}

function baseLoan(overrides: Partial<LoanTerms> = {}): LoanTerms {
  return {
    id: 'loan_test',
    principal: 300,
    interestRate: 0,
    rateType: 'monthly',
    amortization: 'fixed',
    frequency: 'monthly',
    installments: 3,
    startDate: '2024-01-01',
    firstDueDate: '2024-02-01',
    lateFeeType: 'none',
    lateFeeValue: 0,
    graceDays: 0,
    fees: 0,
    status: 'active',
    ...overrides,
  };
}

console.log('Utilidades numéricas y fechas');

test('num acepta coma decimal y valores inválidos', () => {
  assert.equal(num('12,5'), 12.5);
  assert.equal(num(' 1 000 '), 1000);
  assert.equal(num('abc'), 0);
  assert.equal(num(null), 0);
});

test('round2 redondea a dos decimales', () => {
  assert.equal(round2(10.005), 10.01);
  assert.equal(round2(2.344), 2.34);
});

test('addDaysISO y addMonthsISO respetan el calendario', () => {
  assert.equal(addDaysISO('2024-02-28', 1), '2024-02-29');
  assert.equal(addDaysISO('2023-02-28', 1), '2023-03-01');
  assert.equal(addMonthsISO('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonthsISO('2024-03-31', -1), '2024-02-29');
});

test('daysBetween calcula días completos sin zonas horarias', () => {
  assert.equal(daysBetween('2024-01-01', '2024-01-31'), 30);
  assert.equal(daysBetween('2024-01-31', '2024-01-01'), -30);
});

test('uid genera identificadores únicos con prefijo', () => {
  const a = uid('test');
  const b = uid('test');
  assert.ok(a.startsWith('test_'));
  assert.notEqual(a, b);
});

console.log('Tasas y cronograma');

test('periodRate convierte tasa mensual, anual y por período', () => {
  close(periodRate(baseLoan({ interestRate: 5, rateType: 'monthly' })), 0.05, 1e-9);
  close(periodRate(baseLoan({ interestRate: 12, rateType: 'annual' })), (12 / 100) * (30 / 365), 1e-9);
  close(periodRate(baseLoan({ interestRate: 3, rateType: 'period' })), 0.03, 1e-9);
});

test('cuota fija: capital suma el principal y la última cuota liquida el saldo', () => {
  const rows = buildSchedule(baseLoan({ principal: 1000, interestRate: 5, installments: 12 }));
  assert.equal(rows.length, 12);
  close(rows.reduce((acc, row) => acc + row.capital, 0), 1000);
  assert.ok(rows[0].interest > 0);
  assert.ok(rows[0].amount > rows[11].amount);
  close(rows[11].balance, 0);
  rows.forEach((row, index) => {
    if (index > 0) assert.equal(row.dueDate, addMonthsISO(rows[0].dueDate, index));
  });
});

test('abono fijo a capital mantiene el capital constante y la cuota decreciente', () => {
  const rows = buildSchedule(baseLoan({ principal: 900, interestRate: 2, amortization: 'declining', installments: 3 }));
  close(rows[0].capital, 300);
  close(rows[1].capital, 300);
  close(rows[2].capital, 300);
  assert.ok(rows[0].amount > rows[1].amount);
  assert.ok(rows[1].amount > rows[2].amount);
});

test('interés global cobra el mismo interés cada período', () => {
  const rows = buildSchedule(baseLoan({ principal: 1000, interestRate: 3, amortization: 'flat', installments: 4 }));
  rows.forEach((row) => close(row.interest, 30));
  close(rows.reduce((acc, row) => acc + row.capital, 0), 1000);
});

test('solo interés difiere el capital al último período', () => {
  const rows = buildSchedule(baseLoan({ principal: 500, interestRate: 4, amortization: 'bullet', installments: 5 }));
  rows.slice(0, 4).forEach((row) => close(row.capital, 0));
  close(rows[4].capital, 500);
  close(rows[4].balance, 0);
  assert.ok(rows[0].interest > 0);
});

test('interés total fijo se reparte exacto y conserva los cuatro métodos', () => {
  for (const amortization of ['fixed', 'declining', 'flat', 'bullet'] as const) {
    const rows = buildSchedule(
      baseLoan({
        principal: 1000,
        installments: 4,
        amortization,
        interestMode: 'fixed_total',
        fixedInterest: 200,
        interestRate: 0,
      }),
    );
    close(rows.reduce((acc, row) => acc + row.interest, 0), 200);
    close(rows.reduce((acc, row) => acc + row.capital, 0), 1000);
    close(rows[rows.length - 1].balance, 0);
  }
});

test('interés fijo por cuota suma el mismo monto en cada cuota', () => {
  const rows = buildSchedule(
    baseLoan({
      principal: 1200,
      installments: 6,
      interestMode: 'fixed_installment',
      fixedInterest: 15,
      interestRate: 0,
    }),
  );
  rows.forEach((row) => close(row.interest, 15));
  close(rows.reduce((acc, row) => acc + row.interest, 0), 90);
  close(rows.reduce((acc, row) => acc + row.capital, 0), 1200);
});

test('interés fijo por período se cobra mientras exista saldo', () => {
  const rows = buildSchedule(
    baseLoan({
      principal: 900,
      installments: 3,
      amortization: 'declining',
      interestMode: 'fixed_period',
      fixedInterest: 30,
      interestRate: 0,
    }),
  );
  rows.forEach((row) => close(row.interest, 30));
  close(rows[0].amount, 330);
  close(rows[2].balance, 0);
});

test('el interés total fijo se refleja en el total a pagar', () => {
  const view = computeLoan(
    baseLoan({
      principal: 1000,
      installments: 4,
      interestMode: 'fixed_total',
      fixedInterest: 250,
      interestRate: 0,
    }),
    [],
    '2024-01-01',
  );
  close(view.totals.interest, 250);
  close(view.totals.toPay, 1250);
});

test('el cargo inicial se suma solo a la primera cuota', () => {
  const rows = buildSchedule(baseLoan({ principal: 300, installments: 3, fees: 25 }));
  close(rows[0].charge, 25);
  close(rows[1].charge, 0);
  close(rows[0].amount, rows[0].capital + rows[0].interest + 25);
});

console.log('Aplicación de pagos');

test('los pagos se aplican en orden y liquidan el préstamo', () => {
  const loan = baseLoan();
  const payments = [
    { id: 'p1', loanId: loan.id, date: '2024-02-01', amount: 100, createdAt: '2024-02-01T10:00:00Z' },
    { id: 'p2', loanId: loan.id, date: '2024-03-01', amount: 100, createdAt: '2024-03-01T10:00:00Z' },
    { id: 'p3', loanId: loan.id, date: '2024-04-01', amount: 100, createdAt: '2024-04-01T10:00:00Z' },
  ];
  const view = computeLoan(loan, payments, '2024-04-02');
  close(view.totals.toPay, 300);
  close(view.totals.paid, 300);
  close(view.totals.remaining, 0);
  close(view.totals.balance, 0);
  assert.equal(view.state, 'paid');
  assert.equal(view.paymentsCount, 3);
});

test('un pago parcial deja la cuota en estado parcial', () => {
  const view = computeLoan(baseLoan(), [{ id: 'p1', loanId: 'loan_test', date: '2024-02-01', amount: 40 }], '2024-02-10');
  close(view.totals.paid, 40);
  close(view.totals.remaining, 260);
  assert.equal(view.rows[0].state, 'partial_overdue');
  assert.equal(view.state, 'overdue');
});

test('el excedente queda a favor del cliente', () => {
  const view = computeLoan(baseLoan(), [{ id: 'p1', loanId: 'loan_test', date: '2024-02-01', amount: 350 }], '2024-02-02');
  close(view.totals.applied, 300);
  close(view.totals.credit, 50);
  close(view.totals.balance, 0);
});

test('la mora fija diaria se acumula por días vencidos', () => {
  const loan = baseLoan({ principal: 100, installments: 1, firstDueDate: '2024-01-01', lateFeeType: 'fixed_daily', lateFeeValue: 2 });
  const view = computeLoan(loan, [], '2024-01-11');
  close(view.totals.lateDue, 20);
  close(view.totals.balance, 120);
  assert.equal(view.state, 'overdue');
});

test('los días de gracia retrasan la mora', () => {
  const loan = baseLoan({ principal: 100, installments: 1, firstDueDate: '2024-01-01', lateFeeType: 'fixed_daily', lateFeeValue: 2, graceDays: 5 });
  const view = computeLoan(loan, [], '2024-01-11');
  close(view.totals.lateDue, 10);
});

test('la mora se cobra antes que el interés y el capital', () => {
  const loan = baseLoan({
    principal: 100,
    installments: 1,
    firstDueDate: '2024-01-01',
    lateFeeType: 'fixed_once',
    lateFeeValue: 15,
  });
  const view = computeLoan(loan, [{ id: 'p1', loanId: loan.id, date: '2024-01-05', amount: 15 }], '2024-01-06');
  close(view.totals.paidLate, 15);
  close(view.totals.paidCapital, 0);
  close(view.totals.remaining, 100);
});

console.log('Agregados');

test('portfolioSummary suma la cartera sin cancelados', () => {
  const views = [
    computeLoan(baseLoan({ id: 'a', principal: 100, installments: 1 }), [], '2024-01-01'),
    computeLoan(baseLoan({ id: 'b', principal: 200, installments: 1 }), [], '2024-01-01'),
    computeLoan(baseLoan({ id: 'c', principal: 999, installments: 1, status: 'cancelled' }), [], '2024-01-01'),
  ];
  const summary = portfolioSummary(views);
  assert.equal(summary.count, 2);
  close(summary.outstanding, 300);
  close(summary.outstandingCapital, 300);
});

test('accountBalance considera ingresos, egresos y transferencias', () => {
  const account = { id: 'acc', openingBalance: 100 };
  const other = { id: 'other', openingBalance: 0 };
  const transactions: TransactionLike[] = [
    { type: 'income', accountId: 'acc', amount: 50 },
    { type: 'expense', accountId: 'acc', amount: 30 },
    { type: 'transfer', accountId: 'acc', toAccountId: 'other', amount: 20 },
  ];
  close(accountBalance(account, transactions), 100);
  close(accountBalance(other, transactions), 20);
});

test('transactionsSummary filtra por fecha y calcula el neto', () => {
  const list: TransactionLike[] = [
    { date: '2024-01-10', type: 'income', amount: 100 },
    { date: '2024-01-15', type: 'expense', amount: 40 },
    { date: '2024-02-01', type: 'income', amount: 500 },
  ];
  const summary = transactionsSummary(list, '2024-01-01', '2024-01-31');
  close(summary.income, 100);
  close(summary.expense, 40);
  close(summary.net, 60);
  assert.equal(summary.count, 2);
});

test('monthlySeries agrupa por mes y respeta el ancla', () => {
  const list = [
    { date: '2024-01-05', type: 'income', amount: 10 },
    { date: '2024-02-05', type: 'expense', amount: 4 },
    { date: '2024-03-05', type: 'income', amount: 7 },
    { date: '2023-12-05', type: 'income', amount: 99 },
  ];
  const series = monthlySeries(list, { months: 3, typePick: (item) => item.type, asOf: '2024-03-15' });
  assert.deepEqual(series.map((bucket) => bucket.key), ['2024-01', '2024-02', '2024-03']);
  close(series[0].income, 10);
  close(series[1].expense, 4);
  close(series[2].income, 7);
});

console.log('Formato de moneda');

test('el registro reconoce monedas y usa USD como respaldo', () => {
  assert.equal(currencyMeta('clp').symbol, '$');
  assert.equal(currencyMeta('CLP').decimals, 0);
  assert.equal(currencyMeta('USD').symbol, 'US$');
  assert.equal(currencyMeta('USD').decimals, 2);
  assert.equal(currencyMeta('XYZ').code, 'USD');
  assert.equal(currencyMeta(null).code, 'USD');
});

test('roundToCurrency respeta los decimales de la moneda', () => {
  assert.equal(roundToCurrency(1234.5, 'CLP'), 1235);
  assert.equal(roundToCurrency(1234.4, 'CLP'), 1234);
  assert.equal(roundToCurrency(1234.567, 'USD'), 1234.57);
  assert.equal(roundToCurrency(1234.5, 'JPY'), 1235);
});

test('USD y CLP se distinguen por símbolo y decimales', () => {
  configureFormat({ currency: 'USD', locale: 'es-CL' });
  assert.equal(money(1234.5), 'US$1.234,50');
  assert.equal(money(0), 'US$0,00');
  assert.equal(money(-1234.5), '-US$1.234,50');
  assert.equal(money(1234.5, { sign: true }), '+US$1.234,50');

  configureFormat({ currency: 'CLP', locale: 'es-CL' });
  assert.equal(money(1234.5), '$1.235');
  assert.equal(money(1000), '$1.000');
  assert.equal(money(-1234.5), '-$1.235');
  assert.equal(money(2500000, { compact: true }), '$2,5M');
});

test('el formato regional cambia los separadores y otros símbolos', () => {
  configureFormat({ currency: 'USD', locale: 'es-419' });
  assert.equal(money(1234.5), 'US$1,234.50');
  configureFormat({ currency: 'EUR', locale: 'es-ES' });
  assert.equal(money(1234.5), '€1.234,50');
  configureFormat({ currency: 'JPY', locale: 'ja-JP' });
  assert.equal(money(1234.5), '¥1,235');
  configureFormat({ currency: 'XYZ', locale: 'es-419' });
  assert.equal(money(10), 'US$10.00');
});

test('number respeta los decimales solicitados sin reutilizar el formato anterior', () => {
  configureFormat({ currency: 'USD', locale: 'es-CL' });
  assert.equal(number(1234.5, 0), '1.235');
  assert.equal(number(1234.5, 2), '1.234,50');
});

configureFormat({ currency: 'USD', locale: 'es-419' });

console.log('Exportación CSV');

test('toCSV escapa separadores, comillas y agrega BOM', () => {
  const csv = toCSV(['Nombre', 'Monto'], [['Ana; "La Jefa"', 12.345]]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Ana; ""La Jefa"""'));
  assert.ok(csv.includes('12.35'));
  assert.ok(csv.includes('\r\n'));
});

console.log(`\n${passed} pruebas aprobadas, ${failed} fallidas.`);
if (failed) process.exit(1);
