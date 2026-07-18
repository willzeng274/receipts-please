import type { EffectPreset } from '../../store/useLabStore'

export type AppId =
  | 'expenses'
  | 'transactions'
  | 'people'
  | 'policy'
  | 'travel'
  | 'inventory'
  | 'vendor'
  | 'cards'
  | 'calculator'

export type CalculatorState = {
  display: string
  history: string
  operator: CalculatorOperator | null
  replaceDisplay: boolean
  storedValue: number | null
}

type AppDefinition = {
  id: AppId
  label: string
  shortLabel: string
}

type CalculatorOperator = '+' | '−' | '×' | '÷'

type Notice = {
  app: AppId
  detail: string
  id: string
  title: string
  urgent?: boolean
}

export const MANUAL_APPS: readonly AppDefinition[] = [
  { id: 'expenses', label: 'Expense inbox', shortLabel: 'EX' },
  { id: 'transactions', label: 'Transactions', shortLabel: 'TX' },
  { id: 'people', label: 'Employee directory', shortLabel: 'PE' },
  { id: 'policy', label: 'Policy PDF', shortLabel: 'PDF' },
  { id: 'travel', label: 'Travel portal', shortLabel: 'TR' },
  { id: 'inventory', label: 'Inventory sheet', shortLabel: 'IV' },
  { id: 'calculator', label: 'Desk calculator', shortLabel: '42' },
]

export const RAMP_APPS: readonly AppDefinition[] = [
  { id: 'expenses', label: 'Case overview', shortLabel: 'EX' },
  { id: 'travel', label: 'Travel', shortLabel: 'TR' },
  { id: 'vendor', label: 'Vendor', shortLabel: 'VN' },
  { id: 'cards', label: 'Cards', shortLabel: 'CD' },
  { id: 'policy', label: 'Policy', shortLabel: 'PO' },
  { id: 'calculator', label: 'Calculator', shortLabel: '42' },
]

export const MANUAL_NOTICES: readonly Notice[] = [
  {
    app: 'transactions',
    detail: 'Transaction says $18.40. Receipt says $81.40.',
    id: 'amount-mismatch',
    title: 'Amount mismatch',
    urgent: true,
  },
  {
    app: 'people',
    detail: 'Maya joined three days after this receipt date.',
    id: 'start-date',
    title: 'Directory lookup finished',
  },
  {
    app: 'expenses',
    detail: 'Need these cleared before lunch. Inbox: 47.',
    id: 'manager-message',
    title: 'Finance Ops',
    urgent: true,
  },
]

export const RAMP_NOTICES: readonly Notice[] = [
  {
    app: 'expenses',
    detail: 'Receipt, transaction, employee, and policy are connected.',
    id: 'evidence-ready',
    title: 'Case evidence ready',
  },
  {
    app: 'cards',
    detail: 'Seven active cards exceed the intern limit.',
    id: 'card-risk',
    title: 'Card controls suggested',
    urgent: true,
  },
]

export const INITIAL_CALCULATOR: CalculatorState = {
  display: '0',
  history: 'Ready',
  operator: null,
  replaceDisplay: false,
  storedValue: null,
}

export const EFFECT_COPY: Record<EffectPreset, string> = {
  'paper-drop': 'Receipt received · inbox 48',
  approve: 'Case 04 approved · audit trail saved',
  reject: 'Case 04 returned · employee notified',
  fraud: 'High-risk pattern connected · card controls ready',
  'printer-jam': 'Printer queue stopped · 14 jobs waiting',
  migration: 'Migration handshake received · unifying workspace',
}

function calculate(left: number, right: number, operator: CalculatorOperator) {
  if (operator === '+') return left + right
  if (operator === '−') return left - right
  if (operator === '×') return left * right
  return right === 0 ? Number.NaN : left / right
}

function formatCalculatorValue(value: number) {
  if (!Number.isFinite(value)) return 'Error'
  return String(Number(value.toFixed(8))).slice(0, 14)
}

export function updateCalculator(state: CalculatorState, input: string): CalculatorState {
  if (input === 'C') return INITIAL_CALCULATOR

  if (input === 'Backspace') {
    if (state.replaceDisplay || state.display === 'Error') {
      return { ...state, display: '0', replaceDisplay: false }
    }
    const display = state.display.length > 1 ? state.display.slice(0, -1) : '0'
    return { ...state, display }
  }

  if (input === '±') {
    if (state.display === '0' || state.display === 'Error') return state
    return { ...state, display: state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}` }
  }

  if (input === '%') {
    const value = Number(state.display)
    if (!Number.isFinite(value)) return state
    return { ...state, display: formatCalculatorValue(value / 100), replaceDisplay: true }
  }

  if (/^\d$/.test(input) || input === '.') {
    if (state.display === 'Error' || state.replaceDisplay) {
      return { ...state, display: input === '.' ? '0.' : input, replaceDisplay: false }
    }
    if (input === '.' && state.display.includes('.')) return state
    if (state.display.length >= 14) return state
    return { ...state, display: state.display === '0' && input !== '.' ? input : `${state.display}${input}` }
  }

  if (input === '+' || input === '−' || input === '×' || input === '÷') {
    const current = Number(state.display)
    if (!Number.isFinite(current)) return INITIAL_CALCULATOR

    if (state.storedValue !== null && state.operator && !state.replaceDisplay) {
      const result = calculate(state.storedValue, current, state.operator)
      const display = formatCalculatorValue(result)
      return {
        display,
        history: `${display} ${input}`,
        operator: input,
        replaceDisplay: true,
        storedValue: result,
      }
    }

    return {
      ...state,
      history: `${state.display} ${input}`,
      operator: input,
      replaceDisplay: true,
      storedValue: current,
    }
  }

  if (input === '=') {
    const current = Number(state.display)
    if (state.storedValue === null || !state.operator || !Number.isFinite(current)) return state
    const result = calculate(state.storedValue, current, state.operator)
    return {
      display: formatCalculatorValue(result),
      history: `${formatCalculatorValue(state.storedValue)} ${state.operator} ${state.display} =`,
      operator: null,
      replaceDisplay: true,
      storedValue: null,
    }
  }

  return state
}
