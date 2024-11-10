import React from "react";
import { Canvas3D } from "troika-3d";
import { Text3DFacade, BatchedText3DFacade } from "troika-3d-text";
import { FONTS } from '../text/TextExample'
import { Color } from "three/src/math/Color";

export default function BatchedTextExample ({ stats, width, height }) {
  const [texts, setTexts] = React.useState(randomizeText());

  function randomizeText() {
    const all = [
      "One", "Two", "Three", "Four", "Five",
      "Six", "Seven", "Eight", "Nine", "Ten",
      "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
      "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"
    ]
    const subset = all.slice(0, Math.max(8, Math.floor(Math.random() * all.length)))
    return subset.map((text, i) => ({
      facade: Text3DFacade,
      text,
      font: Object.values(FONTS)[i % Object.values(FONTS).length],
      fontSize: randRange(0.05, 0.25),
      x: randRange(-1, 1),
      y: randRange(-1, 1),
      z: randRange(-1, 1),
      rotateZ: randRange(-0.01, 0.01),
      anchorX: "50%",
      anchorY: "50%",
      color: randColor(),
      // fillOpacity: Math.random() < 0.5 ? 0.2 : 1,
      animation: {
        from: { rotateY: 0 },
        to: { rotateY: Math.PI * 2 },
        duration: randRange(800, 3000),
        iterations: Infinity
      }
    }))
  }

  return <div>
    <Canvas3D
      antialias
      stats={stats}
      width={width}
      height={height}
      onBackgroundClick={() => {
        setTexts(randomizeText())
      }}
      camera={{
        fov: 75,
        aspect: width / height,
        x: 0,
        y: 0,
        z: 2.5
      }}
      objects={[
        {
          facade: BatchedText3DFacade,
          children: texts,
          animation: {
            from: { rotateY: 0 },
            to: { rotateY: Math.PI * 2 },
            duration: 10000,
            iterations: Infinity
          }
        }
      ]}
    />
  </div>;
}

function randRange (min, max) {
  return min + Math.random() * (max - min);
}
function randColor() {
  return new Color().setHSL(Math.random(), 1, 0.5)
}
// function randFromArray(array) {
//   return array[Math.floor(Math.random() * array.length)];
// }
