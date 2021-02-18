import {Text} from 'troika-three-text'

function createText() {
  // Create:
  const myText = new Text()

  // Set properties to configure:
  myText.text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  myText.fontSize = 0.2
  myText.font = 'https://fonts.gstatic.com/s/notosans/v7/o-0IIpQlx3QUlC5A4PNr5TRG.woff'
  myText.position.z = 0
  myText.position.y = 0
  myText.position.x = 0
  myText.color = 0x9966FF
  myText.maxWidth= 4
  myText.textAlign= 'justify'
  myText.textIndent= 0,
  myText.anchorX= 'center'
  myText.anchorY= 'middle'
  myText.curveRadius = 4

  // this method will be called once per frame
  myText.tick = (delta) => {
    myText.sync(()=>{
      myText.updateSelection()
    })
  };

  return myText
}

export { createText };
