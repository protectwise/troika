import {ListFacade} from 'troika-core'
import {UIBlock3DFacade} from 'troika-3d-ui'


const columns = [
  {key: 'col1', label: 'Column 1'},
  {key: 'col2', label: 'Column 2'},
  {key: 'col3', label: 'Column 3'},
  {key: 'col4', label: 'Column 4'},
  {key: 'col5', label: 'Column 5'}
]

const rows = []
for (let i = 0; i < 100; i++) {
  rows.push({
    col1: `Row ${i + 1} Column 1`,
    col2: `Row ${i + 1} Column 2`,
    col3: `Row ${i + 1} Column 3`,
    col4: `Row ${i + 1} Column 4`,
    col5: `Row ${i + 1} Column 5`,
  })
}




class UITableFacade extends UIBlock3DFacade {
  constructor(parent) {
    super(parent)

    this.flexDirection = 'row'
    this.overflow = 'scroll'
    this.alignItems = 'flex-start'

    this.children = {
      key: 'cols',
      facade: ListFacade,
      data: columns,
      template: {
        key: col => col.key,
        facade: UIBlock3DFacade,
        flexDirection: 'column',
        whiteSpace: 'nowrap',
        children: col => [
          {
            key: 'headerCell',
            facade: TableHeaderCell,
            text: col.label,
            margin: (this.cellSpacing || 0) / 2,
            padding: this.cellPadding || 0,
            backgroundColor: 0x111111,
            transition: {z: {duration: 250}}
          },
          {
            key: 'bodyCells',
            facade: ListFacade,
            data: rows,
            template: {
              key: (row, i) => i,
              facade: UIBlock3DFacade,
              text: d => d[col.key],
              margin: (this.cellSpacing || 0) / 2,
              padding: this.cellPadding || 0,
              backgroundColor: 0x222222
            }
          }
        ]
      }
    }
  }
}

class TableHeaderCell extends UIBlock3DFacade {
  afterUpdate() {
    // Adjust offsetTop to ignore scroll
    // TODO replace this hack with official support for position:'sticky'
    if (typeof this.offsetTop === 'number') {
      const scrollDist = this.parentFlexNode.parentFlexNode.scrollTop || 0
      this.offsetTop = scrollDist
      this.z = scrollDist ? this.offsetHeight / 5 : 0
    }
    super.afterUpdate()
  }
}

export default UITableFacade
