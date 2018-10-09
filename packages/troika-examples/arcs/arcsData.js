

let idCtr = 1

export function refreshArcsData(oldData) {
  let data = {}
  ;['ne1', 'nw1', 'sw1', 'se1', 'ne2', 'nw2', 'sw2', 'se2'].forEach(key => {
    data[key] = []
    // carry forward a random selection of previous items if supplied
    if (oldData && oldData[key]) {
      oldData[key].forEach(d => {
        if (Math.random() > .5) {
          d.isNew = false
          data[key].push(d)
        }
      })
    }
    let angle = 0
    let numArcs = Math.max(data[key].length, Math.ceil(Math.random() * 20))
    let marginAngle = 0.0075
    for (let i = 0; i < numArcs; i++) {
      if (!data[key][i]) {
        data[key].push({
          id: idCtr++,
          isNew: true
        })
      }
      data[key][i].startAngle = angle + marginAngle
      data[key][i].endAngle = (angle += Math.max(Math.random() * Math.PI / 2 / numArcs, 0.02)) - marginAngle
    }
  })

  return data
}