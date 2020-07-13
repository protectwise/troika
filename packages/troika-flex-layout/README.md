# `troika-flex-layout`

This package provides a convenient utility for calculating [flexbox layouts](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Flexbox) in JavaScript, for use in building user interfaces. It is used in the Troika framework for laying out UI elements in WebGL scenes, but has no dependencies on that framework so it can just as easily be used on its own in other projects.

Behind the scenes it uses an ASM-compiled version of the [Yoga](https://yogalayout.com/) library to calculate the flexbox layout, and does so within a web worker to prevent main thread frame drops. 

For measurement of text nodes it uses the [troika-three-text](../troika-three-text) library. You will probably get the best results if you also use troika-three-text for rendering the text post-layout, but that's not strictly required.

## Usage

```js
import { requestFlexLayout } from 'troika-flex-layout'

// Describe your layout style tree, with a unique id for each node:
const styleTree = {
  id: 'root',
  width: 100,
  height: 100,
  alignItems: 'center',
  justifyContent: 'center',
  children: [
    {
      id: 'child',
      width: '50%',
      height: '50%'
    }
  ]
}

// Initiate a layout request with a callback function:
requestFlexLayout(styleTree, results => {
  // The results are a mapping of node ids to layout boxes:
  // {
  //   root: { left: 0, top: 0, width: 100, height: 100 },
  //   child: { left: 25, top: 25, width: 50, height: 50 }
  // }
})
```

Each node in the style tree accepts a number of properties related to the flexbox layout as well as some properties controlling the text. See the complete list of [accepted style properties](./src/FlexLayoutStyleNode.typedef.js). All properties are optional except the `id` which is needed to identify that node in the layout results. For allowed values and defaults of the flexbox-related properties, consult the [Yoga documentation](https://yogalayout.com/docs). For the text-related properties see the [troika-three-text documentation](https://github.com/protectwise/troika/blob/master/packages/troika-three-text/README.md).

### This package does not...

- ...manage a style tree's changes over time. It's the responsibility of external framework code to manage a style tree, detect changes, and initiate layout requests as appropriate to respond to those changes.

- ...render anything. Again, other code is required to take the layout results and apply them to some application-specific rendering objects.

For an example of framework code that performs both these functions, see the [troika-3d-ui](../troika-3d-ui) package.
