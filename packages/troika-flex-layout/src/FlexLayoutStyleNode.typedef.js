/**
 * Object holding input styles for a node/subtree in the flex layout tree. All properties
 * except `id` are optional and their allowed values follow those of the CSS flexbox spec
 * and/or the Yoga docs: https://yogalayout.com/docs
 *
 * @typedef {object} FlexLayoutStyleNode
 * @property {string} id - A required identifier for this node. This will be used in the results mapping.
 * @property {number|string} width
 * @property {number|string} height
 * @property {number|string} minWidth
 * @property {number|string} minHeight
 * @property {number|string} maxWidth
 * @property {number|string} maxHeight
 * @property {number|'auto'} aspectRatio
 * @property {string} flexDirection
 * @property {number|string} flex
 * @property {string} flexWrap
 * @property {number|string} flexBasis
 * @property {number} flexGrow
 * @property {number} flexShrink
 * @property {string} alignContent
 * @property {string} alignItems
 * @property {string} alignSelf
 * @property {string} justifyContent
 * @property {'relative'|'absolute'} position
 * @property {number|string} left
 * @property {number|string} right
 * @property {number|string} top
 * @property {number|string} bottom
 * @property {number|string} marginTop
 * @property {number|string} marginRight
 * @property {number|string} marginBottom
 * @property {number|string} marginLeft
 * @property {number|string} paddingTop
 * @property {number|string} paddingRight
 * @property {number|string} paddingBottom
 * @property {number|string} paddingLeft
 * @property {number|string} borderTop
 * @property {number|string} borderRight
 * @property {number|string} borderBottom
 * @property {number|string} borderLeft
 * @property {string} text
 * @property {string} font
 * @property {number} fontSize
 * @property {number|'normal'} lineHeight
 * @property {number} letterSpacing
 * @property {'normal'|'nowrap'} whiteSpace
 * @property {'normal'|'break-word'} overflowWrap
 * @property {array<FlexLayoutStyleNode>} children
 */
