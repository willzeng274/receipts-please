import type { AppId } from './workstationData'
import calculatorIcon from '../../assets/expense-os/icons/calculator.svg'
import cardsIcon from '../../assets/expense-os/icons/cards.svg'
import expensesIcon from '../../assets/expense-os/icons/expenses.svg'
import inventoryIcon from '../../assets/expense-os/icons/inventory.svg'
import peopleIcon from '../../assets/expense-os/icons/people.svg'
import policyIcon from '../../assets/expense-os/icons/policy.svg'
import slackIcon from '../../assets/expense-os/icons/slack.svg'
import transactionsIcon from '../../assets/expense-os/icons/transactions.svg'
import travelIcon from '../../assets/expense-os/icons/travel.svg'
import vendorIcon from '../../assets/expense-os/icons/vendor.svg'

type WorkstationAppIconProps = {
  app: AppId | string
}

const APP_ICONS: Record<AppId, string> = {
  calculator: calculatorIcon,
  cards: cardsIcon,
  expenses: expensesIcon,
  inventory: inventoryIcon,
  people: peopleIcon,
  policy: policyIcon,
  slack: slackIcon,
  transactions: transactionsIcon,
  travel: travelIcon,
  vendor: vendorIcon,
}

function normalizeAppId(app: string): AppId {
  const value = app.toLowerCase()
  if (value.includes('slack') || value.includes('message')) return 'slack'
  if (value.includes('employee') || value.includes('people')) return 'people'
  if (value.includes('policy') || value.includes('pdf')) return 'policy'
  if (value.includes('travel') || value.includes('itinerary')) return 'travel'
  if (value.includes('inventory') || value.includes('procurement') || value.includes('purchase')) return 'inventory'
  if (value.includes('vendor')) return 'vendor'
  if (value.includes('card')) return 'cards'
  if (value.includes('calculator') || value.includes('tip')) return 'calculator'
  if (value.includes('transaction')) return 'transactions'
  return 'expenses'
}

export function WorkstationAppIcon({ app }: WorkstationAppIconProps) {
  const id = normalizeAppId(app)

  return (
    <span aria-hidden="true" className={`wsos-app-icon wsos-app-icon--${id}`}>
      <img alt="" src={APP_ICONS[id]} />
    </span>
  )
}
