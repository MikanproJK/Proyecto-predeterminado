/* ============================================================
   Tipos de dominio de Préstamos Pro
   Contratos compartidos por el proceso principal, el renderer y las pruebas.
   ============================================================ */

export type ISODate = string;
export type ClientId = string;
export type LoanId = string;
export type PaymentId = string;
export type AccountId = string;
export type TransactionId = string;

export type ClientType = 'regular' | 'temporary';
export type LoanStatus = 'active' | 'cancelled' | 'draft';
export type LoanState = 'active' | 'overdue' | 'paid' | 'cancelled' | 'draft';
export type RateType = 'monthly' | 'annual' | 'period';
export type Amortization = 'fixed' | 'declining' | 'flat' | 'bullet';
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
export type LateFeeType =
  | 'none'
  | 'percent_daily'
  | 'percent_monthly'
  | 'fixed_daily'
  | 'fixed_once';
export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta'
  | 'Depósito'
  | 'Billetera digital'
  | 'Cheque'
  | 'Otro';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'cash' | 'bank' | 'wallet' | 'card' | 'other';
export type Density = 'comfortable' | 'compact';
export type ThemeMode = 'light' | 'dark';
export type ThemeId = 'aurora' | 'ocean' | 'forest' | 'sand' | 'rose' | 'midnight' | 'noir';
export type InstallmentState =
  | 'paid'
  | 'late'
  | 'partial_overdue'
  | 'overdue'
  | 'partial'
  | 'pending';
export type BadgeTone = 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'muted';

/* ---------- entidades persistidas ---------- */

export interface Client {
  id: ClientId;
  name: string;
  phone: string;
  email: string;
  doc: string;
  address: string;
  type: ClientType;
  active: boolean;
  notes: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: LoanId;
  code: string;
  clientId: ClientId;
  principal: number;
  interestRate: number;
  rateType: RateType;
  amortization: Amortization;
  frequency: Frequency;
  customDays: number;
  installments: number;
  startDate: ISODate;
  firstDueDate: ISODate;
  lateFeeType: LateFeeType;
  lateFeeValue: number;
  graceDays: number;
  fees: number;
  notes: string;
  guarantee: string;
  status: LoanStatus;
  accountId: AccountId;
  createdAt: string;
  updatedAt: string;
  cancelReason?: string;
  cancelledAt?: string;
}

/**
 * Campos que consume el motor financiero. Se mantienen opcionales para poder
 * simular un préstamo incompleto sin inventar datos persistidos.
 */
export interface LoanTerms {
  id?: LoanId;
  code?: string;
  clientId?: ClientId;
  principal: number;
  interestRate?: number;
  rateType?: RateType;
  amortization?: Amortization;
  frequency?: Frequency;
  customDays?: number;
  installments?: number;
  startDate?: ISODate;
  firstDueDate?: ISODate;
  lateFeeType?: LateFeeType;
  lateFeeValue?: number;
  graceDays?: number;
  fees?: number;
  notes?: string;
  guarantee?: string;
  status?: LoanStatus;
  accountId?: AccountId;
  createdAt?: string;
  updatedAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
}

export interface PaymentLike {
  id: PaymentId;
  loanId?: LoanId;
  clientId?: ClientId;
  date?: ISODate;
  amount: number;
  createdAt?: string;
}

export interface Payment extends PaymentLike {
  receipt: string;
  loanId: LoanId;
  clientId: ClientId;
  date: ISODate;
  method: string;
  accountId: AccountId;
  note: string;
  createdAt: string;
  updatedAt?: string;
  auto?: boolean;
}

export interface TransactionLike {
  id?: TransactionId;
  date?: ISODate;
  type?: TransactionType;
  category?: string;
  amount?: number;
  accountId?: AccountId;
  toAccountId?: AccountId;
  description?: string;
  loanId?: LoanId;
  clientId?: ClientId;
  paymentId?: PaymentId;
  createdAt?: string;
  updatedAt?: string;
  auto?: boolean;
}

export interface Transaction extends TransactionLike {
  id: TransactionId;
  date: ISODate;
  type: TransactionType;
  category: string;
  amount: number;
  accountId: AccountId;
  description: string;
  createdAt: string;
  auto: boolean;
}

export interface Account {
  id: AccountId;
  name: string;
  type: AccountType;
  openingBalance: number;
  color: string;
  createdAt?: string;
}

export interface Settings {
  company: string;
  owner: string;
  currency: string;
  locale: string;
  theme: ThemeId;
  density: Density;
  fontScale: number;
  autoTransactions: boolean;
  defaultAccountId: AccountId;
  lateFeeType: LateFeeType;
  lateFeeValue: number;
  graceDays: number;
  firstRun: boolean;
  loanCounter: number;
  receiptCounter: number;
  paymentOrder?: string;
  updatedAt?: string;
}

export interface Categories {
  income: string[];
  expense: string[];
}

export interface Database {
  version: number;
  createdAt: string;
  updatedAt: string;
  settings: Settings;
  clients: Client[];
  loans: Loan[];
  payments: Payment[];
  accounts: Account[];
  transactions: Transaction[];
  categories: Categories;
}

/* ---------- cronograma y cálculos ---------- */

export interface ScheduleRow {
  n: number;
  dueDate: ISODate;
  capital: number;
  interest: number;
  charge: number;
  amount: number;
  balance: number;
  graceUntil: ISODate;
}

export interface LoanScheduleRow extends ScheduleRow {
  paidInterest: number;
  paidCapital: number;
  paidCharge: number;
  latePaid: number;
  lateUnpaid: number;
  feeSettledTo: ISODate | null;
  fixedFeeCharged: boolean;
  remaining: number;
  paid: number;
  lateDue: number;
  state: InstallmentState;
  overdueDays: number;
}

export interface LoanTotals {
  principal: number;
  interest: number;
  charges: number;
  toPay: number;
  paidCapital: number;
  paidInterest: number;
  paidCharges: number;
  paidLate: number;
  paid: number;
  remaining: number;
  remainingCapital: number;
  remainingInterest: number;
  lateDue: number;
  applied: number;
  credit: number;
  totalPaid: number;
  balance: number;
  payoff: number;
  overdueCount: number;
  overdueAmount: number;
  overdueDays: number;
  nextDueDate: ISODate | null;
  nextDueAmount: number;
  progress: number;
  lastPaymentDate: ISODate | null;
}

export interface LoanView extends Loan {
  rows: LoanScheduleRow[];
  totals: LoanTotals;
  state: LoanState;
  paidRatio: number;
  paymentsCount: number;
}

export interface PortfolioSummary {
  count: number;
  activeCount: number;
  overdueCount: number;
  paidCount: number;
  principal: number;
  outstanding: number;
  outstandingCapital: number;
  lateDue: number;
  toPay: number;
  paid: number;
  paidInterest: number;
  paidLate: number;
  overdueAmount: number;
  progress: number;
}

export interface PaymentAllocation {
  late: number;
  charges: number;
  interest: number;
  capital: number;
}

export interface PaymentSimulation {
  before: LoanTotals;
  after: LoanTotals;
  applied: PaymentAllocation;
  credit: number;
  loan: LoanView;
}

export interface MonthlyBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
}

export interface TransactionsSummary {
  income: number;
  expense: number;
  net: number;
  count: number;
  list: TransactionLike[];
}

export interface ClientStats {
  loans: number;
  active: number;
  principal: number;
  paid: number;
  balance: number;
  lateDue: number;
  lastPayment: ISODate | null;
}

export interface AccountWithBalance extends Account {
  balance: number;
}

/* ---------- entradas de acciones ---------- */

export interface ClientInput {
  name: string;
  phone?: string;
  email?: string;
  doc?: string;
  address?: string;
  type?: ClientType | string;
  active?: boolean;
  notes?: string;
  expiresAt?: string;
}

export interface LoanInput {
  clientId: string;
  principal: number;
  interestRate?: number;
  rateType?: RateType | string;
  amortization?: Amortization | string;
  frequency?: Frequency | string;
  customDays?: number;
  installments?: number;
  startDate?: ISODate;
  firstDueDate?: ISODate;
  lateFeeType?: LateFeeType | string;
  lateFeeValue?: number;
  graceDays?: number;
  fees?: number;
  notes?: string;
  guarantee?: string;
  accountId?: AccountId;
  registerDisbursement?: boolean;
}

export type LoanPatch = Partial<Omit<Loan, 'id' | 'createdAt'>>;

export interface PaymentInput {
  loanId: string;
  amount: number;
  date?: ISODate;
  method?: string;
  accountId?: AccountId;
  note?: string;
  registerTransaction?: boolean;
}

export interface PaymentPatch {
  date?: ISODate;
  amount?: number;
  method?: string;
  accountId?: AccountId;
  note?: string;
}

export interface TransactionInput {
  date?: ISODate;
  type?: TransactionType | string;
  category?: string;
  amount: number;
  accountId?: AccountId;
  description?: string;
}

export interface TransferInput {
  date?: ISODate;
  amount: number;
  accountId: AccountId;
  toAccountId: AccountId;
  description?: string;
}

export interface TransactionPatch {
  date?: ISODate;
  type?: TransactionType;
  category?: string;
  amount?: number;
  accountId?: AccountId;
  description?: string;
}

export interface AccountInput {
  name: string;
  type?: AccountType | string;
  openingBalance?: number;
  color?: string;
}

export type SettingsPatch = Partial<Settings>;

/* ---------- estado del store ---------- */

export interface StoreState {
  db: Database;
  revision: number;
  ready: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;
}

export type StoreEventType = 'change' | 'save-error';
export type StoreListener = (type: StoreEventType, state: StoreState) => void;

/* ---------- IPC / Electron ---------- */

export interface AppInfo {
  version: string;
  platform: string;
  electron: string;
  dataFile: string;
}

export interface OverlayColors {
  color?: string;
  symbolColor?: string;
}

export interface SaveTextPayload {
  title?: string;
  defaultName?: string;
  content: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface SaveDatabaseResult {
  ok: true;
  updatedAt: string;
  path: string;
}

export interface FileDialogResult {
  ok: boolean;
  canceled?: boolean;
  path?: string;
}

export interface RestoreDatabaseResult extends FileDialogResult {
  data?: Database;
}

export interface ElectronApi {
  load(): Promise<unknown>;
  save(data: Database): Promise<SaveDatabaseResult>;
  dataPath(): Promise<string>;
  openFolder(): Promise<boolean>;
  backup(): Promise<FileDialogResult>;
  restore(): Promise<RestoreDatabaseResult>;
  saveText(payload: SaveTextPayload): Promise<FileDialogResult>;
  setOverlay(colors: OverlayColors): Promise<boolean>;
  info(): Promise<AppInfo>;
  relaunch(): Promise<void>;
}

/* ---------- renderer ---------- */

export type RouteName =
  | 'dashboard'
  | 'clients'
  | 'client'
  | 'loans'
  | 'loan'
  | 'payments'
  | 'finance'
  | 'reports'
  | 'settings';

export interface ViewContext {
  id: string | null;
  navigate: (path: string) => void;
}

export interface ViewModule {
  render(root: HTMLElement, ctx: ViewContext): void;
}

export type FormValue = string | number | boolean | string[] | null;
export type FormValues = Record<string, FormValue>;

declare global {
  interface Window {
    api: ElectronApi;
  }
}
