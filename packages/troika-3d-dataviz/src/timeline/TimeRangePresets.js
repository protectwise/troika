import { UIBlock3DFacade as Div } from 'troika-3d-ui'
import { endOfMonth, endOfDay, endOfHour, endOfMinute, subYears, subMonths, subWeeks, subDays, subHours } from 'date-fns'

export const getPastYear = () => [
  +subYears(endOfMonth(Date.now()), 1),
  +endOfMonth(Date.now())
]

export const getPastMonth = () => [
  +subMonths(endOfDay(Date.now()), 1),
  +endOfDay(Date.now())
]

export const getPastWeek = () => [
  +subWeeks(endOfDay(Date.now()), 1),
  +endOfDay(Date.now())
]

export const getPastDay = () => [
  +subDays(endOfHour(Date.now()), 1),
  +endOfHour(Date.now())
]

export const getPastHour = () => [
  +subHours(endOfMinute(Date.now()), 1),
  +endOfMinute(Date.now())
]

const presets = [
  {
    label: 'Year',
    fn: getPastYear
  },
  {
    label: 'Month',
    fn: getPastMonth
  },
  {
    label: 'Week',
    fn: getPastWeek
  },
  {
    label: 'Day',
    fn: getPastDay
  },
  {
    label: 'Hour',
    fn: getPastHour
  }
]

const em = 0.02

export class TimeRangePresets extends Div {
  constructor (parent) {
    super(parent)
    this.fontSize = em
    this.flexDirection = 'row'
  }

  children = presets.map(({label, fn}, i) => {
    return {
      key: i,
      facade: Div,
      margin: 0.5 * em,
      padding: 0.5 * em,
      borderRadius: 0.2 * em,
      backgroundColor: 0x333333,
      text: label,
      onClick: e => {
        const [start, end] = fn()
        this.onSelect(start, end)
      },
      pointerStates: {
        hover: {backgroundColor: 0x444444},
        active: {backgroundColor: 0x222222}
      }
    }
  })

  onSelect(start, end) {}
}
