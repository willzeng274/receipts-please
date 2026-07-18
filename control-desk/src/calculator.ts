export type CalculatorOperator = '+' | '−' | '×' | '÷'

export type CalculatorTape = {
  expression: string
  id: number
  note: string
  result: string
}

export type CalculatorState = {
  display: string
  history: string
  operator: CalculatorOperator | null
  replaceDisplay: boolean
  storedValue: number | null
  memory?: number
  status?: string
  tape?: CalculatorTape | null
}

export const INITIAL_CALCULATOR: CalculatorState = {
  display: '0',
  history: 'Ready',
  operator: null,
  replaceDisplay: false,
  storedValue: null,
  memory: 0,
  status: 'READY',
  tape: null,
}

const MAX_DISPLAY_LENGTH = 14

function calculate(left: number, right: number, operator: CalculatorOperator) {
  if (operator === '+') return left + right
  if (operator === '−') return left - right
  if (operator === '×') return left * right
  return right === 0 ? Number.NaN : left / right
}

function formatCalculatorValue(value: number) {
  if (!Number.isFinite(value)) return 'Error'

  const rounded = String(Number(value.toFixed(8)))
  if (rounded.length <= MAX_DISPLAY_LENGTH) return rounded

  const exponential = value.toExponential(7)
  return exponential.length <= MAX_DISPLAY_LENGTH ? exponential : exponential.slice(0, MAX_DISPLAY_LENGTH)
}

function formatTapeValue(display: string) {
  if (display === 'Error') return 'ERROR'

  const [whole, fraction] = display.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const digits = sign ? whole.slice(1) : whole
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}${fraction ? `.${fraction}` : ''}`
}

function tapeNote(result: number) {
  if (!Number.isFinite(result)) return 'DIVIDE BY ZERO.'
  if (Math.abs(result - 4495.412844) < 0.01) return 'CONCERNING.'
  if (result === 0) return 'MATCH.'
  if (result < 0) return 'NEGATIVE VARIANCE.'
  if (Math.abs(result) >= 1000) return 'REVIEW REQUIRED.'
  return 'CHECK COMPLETE.'
}

function clearCalculator(): CalculatorState {
  return { ...INITIAL_CALCULATOR, status: 'CLEARED' }
}

function operatorStatus(operator: CalculatorOperator) {
  if (operator === '+') return 'SUM'
  if (operator === '−') return 'DIFFERENCE'
  if (operator === '×') return 'MULTIPLY'
  return 'DIVIDE'
}

function replaceTrailingOperator(history: string, operator: CalculatorOperator) {
  return history.replace(/[+−×÷]$/, operator)
}

function printTape(state: CalculatorState, result: number, expression: string): CalculatorTape {
  const display = formatCalculatorValue(result)
  return {
    expression,
    id: (state.tape?.id ?? 0) + 1,
    note: tapeNote(result),
    result: formatTapeValue(display),
  }
}

export function updateCalculator(state: CalculatorState, input: string): CalculatorState {
  if (input === 'C') return clearCalculator()

  if (input === 'M+' || input === 'M−') {
    const current = Number(state.display)
    if (!Number.isFinite(current)) return state

    const direction = input === 'M+' ? 1 : -1
    const memory = (state.memory ?? 0) + direction * current
    return {
      ...state,
      memory,
      status: `MEMORY ${formatCalculatorValue(memory)}`,
    }
  }

  if (input === 'Backspace') {
    if (state.replaceDisplay || state.display === 'Error') {
      return { ...state, display: '0', replaceDisplay: false, status: 'ENTRY' }
    }
    const display = state.display.length > 1 ? state.display.slice(0, -1) : '0'
    return { ...state, display, status: 'ENTRY' }
  }

  if (input === '±') {
    if (state.display === '0' || state.display === 'Error') return state
    const display = state.display.startsWith('-') ? state.display.slice(1) : `-${state.display}`
    return { ...state, display, status: 'SIGNED ENTRY' }
  }

  if (input === '%') {
    const value = Number(state.display)
    if (!Number.isFinite(value)) return state
    return {
      ...state,
      display: formatCalculatorValue(value / 100),
      replaceDisplay: true,
      status: 'PERCENT',
    }
  }

  if (/^\d$/.test(input) || input === '.') {
    const startsNewCalculation = state.replaceDisplay && state.operator === null
    const shouldReplace = state.display === 'Error' || state.replaceDisplay
    const baseDisplay = shouldReplace ? (input === '.' ? '0.' : input) : state.display

    if (input === '.' && !shouldReplace && state.display.includes('.')) return state
    if (!shouldReplace && state.display.length >= MAX_DISPLAY_LENGTH) return state

    const display = shouldReplace
      ? baseDisplay
      : state.display === '0' && input !== '.'
        ? input
        : `${state.display}${input}`

    return {
      ...state,
      display,
      history: startsNewCalculation ? 'Ready' : state.history,
      replaceDisplay: false,
      status: 'ENTRY',
      storedValue: startsNewCalculation ? null : state.storedValue,
    }
  }

  if (input === '+' || input === '−' || input === '×' || input === '÷') {
    const current = Number(state.display)
    if (!Number.isFinite(current)) return clearCalculator()

    if (state.storedValue !== null && state.operator) {
      if (state.replaceDisplay) {
        return {
          ...state,
          history: replaceTrailingOperator(state.history, input),
          operator: input,
          status: operatorStatus(input),
        }
      }

      const result = calculate(state.storedValue, current, state.operator)
      if (!Number.isFinite(result)) {
        return {
          ...state,
          display: 'Error',
          history: `${state.history} ${state.display} ${input}`,
          operator: null,
          replaceDisplay: true,
          status: 'DIVIDE BY ZERO',
          storedValue: null,
        }
      }

      const display = formatCalculatorValue(result)
      return {
        ...state,
        display,
        history: `${state.history} ${state.display} ${input}`,
        operator: input,
        replaceDisplay: true,
        status: operatorStatus(input),
        storedValue: result,
      }
    }

    return {
      ...state,
      history: `${state.display} ${input}`,
      operator: input,
      replaceDisplay: true,
      status: operatorStatus(input),
      storedValue: current,
    }
  }

  if (input === '=') {
    const current = Number(state.display)
    if (state.storedValue === null || !state.operator || !Number.isFinite(current)) {
      return { ...state, status: state.display === 'Error' ? 'CLEAR ERROR' : 'ENTER OPERATION' }
    }

    const expression = `${state.history} ${state.display} =`
    const result = calculate(state.storedValue, current, state.operator)
    const tape = printTape(state, result, expression)

    return {
      ...state,
      display: formatCalculatorValue(result),
      history: expression,
      operator: null,
      replaceDisplay: true,
      status: Number.isFinite(result) ? 'PRINTED' : 'DIVIDE BY ZERO',
      storedValue: null,
      tape,
    }
  }

  return state
}

export function enterCalculatorSequence(state: CalculatorState, inputs: readonly string[]) {
  return inputs.reduce(updateCalculator, state)
}
