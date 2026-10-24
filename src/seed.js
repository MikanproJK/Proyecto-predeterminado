/* Datos de demostración coherentes con la fecha actual */

import { uid, todayISO, addDaysISO, addMonthsISO, buildSchedule, round2 } from './finance.js';

function pad(n, size = 4) {
  return String(n).padStart(size, '0');
}

const CLIENTS = [
  {
    name: 'Ana Torres',
    phone: '+1 555 0142',
    email: 'ana.torres@correo.com',
    doc: 'V-18.452.301',
    address: 'Av. Los Robles 142, Caracas',
    type: 'regular',
    notes: 'Clienta puntual. Prefiere pagos por transferencia.',
  },
  {
    name: 'Carlos Mendoza',
    phone: '+1 555 0198',
    email: 'carlos.m@correo.com',
    doc: 'V-14.209.877',
    address: 'Calle 5 con Av. Principal, Valencia',
    type: 'regular',
    notes: 'Comerciante. Solicita préstamos para capital de trabajo.',
  },
  {
    name: 'Lucía Fernández',
    phone: '+1 555 0231',
    email: 'lucia.f@correo.com',
    doc: 'V-21.330.455',
    address: 'Sector El Paraíso, Maracay',
    type: 'temporary',
    notes: 'Cliente temporal: referencia de vecino. Seguimiento semanal.',
  },
  {
    name: 'Jorge Ramírez',
    phone: '+1 555 0310',
    email: 'jramirez@correo.com',
    doc: 'V-11.874.200',
    address: 'Urb. La Trinidad, Caracas',
    type: 'regular',
    notes: 'Garantía: vehículo. Excelente historial.',
  },
  {
    name: 'María López',
    phone: '+1 555 0455',
    email: 'maria.lopez@correo.com',
    doc: 'V-19.002.118',
    address: 'Callejón Sucre 18, Barquisimeto',
    type: 'regular',
    notes: '',
  },
  {
    name: 'Pedro Sánchez',
    phone: '+1 555 0502',
    email: '',
    doc: 'V-25.441.003',
    address: 'Mercado Municipal, puesto 34',
    type: 'temporary',
    notes: 'Crédito corto de 30 días. Cobro diario.',
  },
  {
    name: 'Sofía Duarte',
    phone: '+1 555 0677',
    email: 'sofia.d@correo.com',
    doc: 'V-20.118.764',
    address: 'Av. Bolívar, Mérida',
    type: 'regular',
    notes: 'Préstamo familiar sin intereses.',
  },
  {
    name: 'Andrés Rojas',
    phone: '+1 555 0788',
    email: 'andresr@correo.com',
    doc: 'V-16.995.432',
    address: 'Cc. Plaza Mayor, nivel 2, Maracaibo',
    type: 'regular',
    notes: 'Préstamo ya cancelado, buen historial.',
  },
];

export function demoDatabase(defaults) {
  const today = todayISO();
  const clients = [];
  const loans = [];
  const payments = [];
  const transactions = [];

  CLIENTS.forEach((client, index) => {
    clients.push({
      id: `cli_demo_${index + 1}`,
      name: client.name,
      phone: client.phone,
      email: client.email,
      doc: client.doc,
      address: client.address,
      type: client.type,
      active: true,
      notes: client.notes,
      expiresAt: client.type === 'temporary' ? addDaysISO(today, 30 + index * 5) : '',
      createdAt: addMonthsISO(today, -10 + index),
      updatedAt: addMonthsISO(today, -10 + index),
    });
  });

  const specs = [
    {
      client: 0,
      principal: 1500,
      interestRate: 5,
      rateType: 'monthly',
      amortization: 'fixed',
      frequency: 'monthly',
      installments: 12,
      startDate: addMonthsISO(today, -8),
      firstDueDate: addMonthsISO(today, -7),
      lateFeeType: 'percent_daily',
      lateFeeValue: 1,
      graceDays: 2,
      notes: 'Préstamo para remodelación de local.',
      guarantee: 'Ninguna',
      paidCount: 8,
      delayDays: 1,
    },
    {
      client: 1,
      principal: 800,
      interestRate: 3,
      rateType: 'monthly',
      amortization: 'flat',
      frequency: 'biweekly',
      installments: 10,
      startDate: addMonthsISO(today, -4),
      firstDueDate: addDaysISO(addMonthsISO(today, -4), 15),
      lateFeeType: 'percent_daily',
      lateFeeValue: 1.5,
      graceDays: 1,
      notes: 'Capital para compra de mercancía.',
      guarantee: 'Mercancía en depósito',
      paidCount: 6,
      delayDays: 2,
      partialIndexes: [6],
    },
    {
      client: 2,
      principal: 400,
      interestRate: 8,
      rateType: 'monthly',
      amortization: 'declining',
      frequency: 'weekly',
      installments: 8,
      startDate: addMonthsISO(today, -3),
      firstDueDate: addDaysISO(addMonthsISO(today, -3), 7),
      lateFeeType: 'percent_daily',
      lateFeeValue: 2,
      graceDays: 0,
      notes: 'Crédito temporal con referencia vecinal.',
      guarantee: 'Ninguna',
      paidCount: 4,
      delayDays: 6,
      skipIndexes: [5],
    },
    {
      client: 3,
      principal: 3000,
      interestRate: 2.5,
      rateType: 'monthly',
      amortization: 'fixed',
      frequency: 'monthly',
      installments: 18,
      startDate: addMonthsISO(today, -6),
      firstDueDate: addMonthsISO(today, -5),
      lateFeeType: 'percent_monthly',
      lateFeeValue: 3,
      graceDays: 5,
      notes: 'Garantía vehicular. Pago por transferencia.',
      guarantee: 'Vehículo Toyota Corolla 2016',
      paidCount: 6,
      delayDays: 0,
    },
    {
      client: 4,
      principal: 650,
      interestRate: 4,
      rateType: 'monthly',
      amortization: 'bullet',
      frequency: 'monthly',
      installments: 6,
      startDate: addMonthsISO(today, -3),
      firstDueDate: addMonthsISO(today, -2),
      lateFeeType: 'fixed_once',
      lateFeeValue: 15,
      graceDays: 3,
      notes: 'Paga intereses mensuales y capital al final.',
      guarantee: 'Ninguna',
      paidCount: 3,
      delayDays: 2,
      partialIndexes: [],
    },
    {
      client: 5,
      principal: 250,
      interestRate: 10,
      rateType: 'monthly',
      amortization: 'fixed',
      frequency: 'daily',
      installments: 30,
      startDate: addDaysISO(today, -22),
      firstDueDate: addDaysISO(today, -21),
      lateFeeType: 'percent_daily',
      lateFeeValue: 2,
      graceDays: 0,
      notes: 'Cobro diario en el mercado. Cliente temporal.',
      guarantee: 'Ninguna',
      paidCount: 22,
      delayDays: 0,
      skipIndexes: [20],
    },
    {
      client: 6,
      principal: 1200,
      interestRate: 0,
      rateType: 'monthly',
      amortization: 'fixed',
      frequency: 'monthly',
      installments: 6,
      startDate: addMonthsISO(today, -1),
      firstDueDate: addDaysISO(today, 3),
      lateFeeType: 'none',
      lateFeeValue: 0,
      graceDays: 0,
      notes: 'Préstamo familiar, sin intereses ni mora.',
      guarantee: 'Ninguna',
      paidCount: 0,
      delayDays: 0,
    },
    {
      client: 7,
      principal: 900,
      interestRate: 6,
      rateType: 'monthly',
      amortization: 'flat',
      frequency: 'weekly',
      installments: 12,
      startDate: addMonthsISO(today, -7),
      firstDueDate: addDaysISO(addMonthsISO(today, -7), 7),
      lateFeeType: 'percent_daily',
      lateFeeValue: 1,
      graceDays: 2,
      notes: 'Crédito para inventario, ya cancelado.',
      guarantee: 'Ninguna',
      paidCount: 99,
      delayDays: 0,
    },
  ];

  let receiptCounter = 1;

  specs.forEach((spec, index) => {
    const client = clients[spec.client];
    const loanId = `loan_demo_${index + 1}`;
    const loan = {
      id: loanId,
      code: `P-${pad(index + 1)}`,
      clientId: client.id,
      principal: spec.principal,
      interestRate: spec.interestRate,
      rateType: spec.rateType,
      amortization: spec.amortization,
      frequency: spec.frequency,
      customDays: 15,
      installments: spec.installments,
      startDate: spec.startDate,
      firstDueDate: spec.firstDueDate,
      lateFeeType: spec.lateFeeType,
      lateFeeValue: spec.lateFeeValue,
      graceDays: spec.graceDays,
      fees: 0,
      notes: spec.notes,
      guarantee: spec.guarantee,
      status: 'active',
      accountId: 'acc_cash',
      createdAt: spec.startDate,
      updatedAt: spec.startDate,
    };
    loans.push(loan);

    transactions.push({
      id: uid('tx'),
      date: spec.startDate,
      type: 'expense',
      category: 'Préstamo otorgado',
      amount: round2(spec.principal),
      accountId: 'acc_cash',
      description: `Desembolso ${loan.code} · ${client.name}`,
      loanId,
      clientId: client.id,
      createdAt: `${spec.startDate}T10:00:00.000Z`,
      auto: true,
    });

    const rows = buildSchedule(loan);
    const dueRows = rows.filter((row) => row.dueDate <= today);
    const toPay = Math.min(spec.paidCount, dueRows.length);
    const partial = new Set(spec.partialIndexes || []);
    const skip = new Set(spec.skipIndexes || []);

    dueRows.forEach((row, i) => {
      if (i >= toPay || skip.has(i)) return;
      const isPartial = partial.has(i);
      const amount = isPartial ? round2(row.amount * 0.45) : row.amount;
      if (amount <= 0.01) return;
      const date = addDaysISO(row.dueDate, Math.min(spec.delayDays || 0, 0) + (i % 3 === 0 ? 0 : 1));
      const payDate = date > today ? today : date;
      const payment = {
        id: uid('pay'),
        receipt: `REC-${pad(receiptCounter)}`,
        loanId,
        clientId: client.id,
        date: payDate,
        amount,
        method: i % 3 === 0 ? 'Efectivo' : i % 3 === 1 ? 'Transferencia' : 'Billetera digital',
        accountId: i % 3 === 1 ? 'acc_bank' : 'acc_cash',
        note: isPartial ? 'Abono parcial acordado con el cliente.' : '',
        createdAt: `${payDate}T15:30:00.000Z`,
        auto: true,
      };
      receiptCounter += 1;
      payments.push(payment);
      transactions.push({
        id: uid('tx'),
        date: payDate,
        type: 'income',
        category: 'Cobro de cuota',
        amount,
        accountId: payment.accountId,
        description: `Pago ${loan.code} · ${client.name}`,
        loanId,
        clientId: client.id,
        paymentId: payment.id,
        createdAt: payment.createdAt,
        auto: true,
      });
    });
  });

  /* movimientos manuales para dar vida al módulo de finanzas */
  const expenses = [
    { monthsAgo: 2, amount: 120, category: 'Servicios', description: 'Internet y teléfono de la oficina' },
    { monthsAgo: 1, amount: 350, category: 'Operativo', description: 'Alquiler de oficina' },
    { monthsAgo: 1, amount: 85, category: 'Operativo', description: 'Transporte y mensajería' },
    { monthsAgo: 0, amount: 350, category: 'Operativo', description: 'Alquiler de oficina' },
    { monthsAgo: 0, amount: 60, category: 'Servicios', description: 'Papelería y recibos' },
  ];
  expenses.forEach((expense) => {
    const date = addMonthsISO(today, -expense.monthsAgo);
    transactions.push({
      id: uid('tx'),
      date: addDaysISO(date, 2),
      type: 'expense',
      category: expense.category,
      amount: expense.amount,
      accountId: 'acc_cash',
      description: expense.description,
      createdAt: `${date}T09:00:00.000Z`,
      auto: false,
    });
  });

  transactions.push({
    id: uid('tx'),
    date: addMonthsISO(today, -2),
    type: 'income',
    category: 'Otro ingreso',
    amount: 2500,
    accountId: 'acc_bank',
    description: 'Aporte de capital al negocio',
    createdAt: `${addMonthsISO(today, -2)}T11:00:00.000Z`,
    auto: false,
  });

  const db = {
    ...(defaults ? JSON.parse(JSON.stringify(defaults)) : {}),
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      ...(defaults?.settings || {}),
      company: 'Financiera Horizonte',
      owner: 'Dirección General',
      currency: 'USD',
      locale: 'es-419',
      theme: defaults?.settings?.theme || 'aurora',
      density: defaults?.settings?.density || 'comfortable',
      fontScale: defaults?.settings?.fontScale || 1,
      autoTransactions: true,
      defaultAccountId: 'acc_cash',
      lateFeeType: 'percent_daily',
      lateFeeValue: 1,
      graceDays: 0,
      firstRun: false,
      loanCounter: specs.length + 1,
      receiptCounter,
    },
    clients,
    loans,
    payments,
    transactions,
    accounts: [
      { id: 'acc_cash', name: 'Caja principal', type: 'cash', openingBalance: 600, color: '#4f6ef7' },
      { id: 'acc_bank', name: 'Cuenta bancaria', type: 'bank', openingBalance: 1800, color: '#17a673' },
      { id: 'acc_wallet', name: 'Billetera digital', type: 'wallet', openingBalance: 150, color: '#9a5cf5' },
    ],
    categories: {
      income: ['Cobro de cuota', 'Interés', 'Comisión', 'Otro ingreso', 'Aporte de capital'],
      expense: ['Préstamo otorgado', 'Operativo', 'Personal', 'Servicios', 'Retiro', 'Otro egreso'],
    },
  };

  return db;
}
