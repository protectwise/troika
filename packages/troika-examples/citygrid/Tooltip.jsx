import React from 'react'

const BGCOLOR = '#222'

const STYLE = {
  boxShadow: '0 0 1px rgba(255,255,255,.5)',
  background: BGCOLOR,
  padding: '5px 10px',
  fontSize: '12px',
  borderRadius: '5px',
  transform: 'translate(-100%, -100%)'
}

const SVG = (
  <svg
    style={ {
      position: 'absolute',
      bottom: -7,
      right: -7,
      height: 17,
      width: 17
    } }>
    <path fill={ BGCOLOR } d="M0,0v10h0.3c2.8,0,6.9,1.3,9.3,2.7c0,0,6.8,3.7,6.8,3.7c0,0-3.7-6.8-3.7-6.8C11.3,7.1,10,3,10,0.2V0H0z"/>
  </svg>
)


export default function(props) {
  return (
    <div style={ STYLE }>
      { SVG }
      { props.text }
    </div>
  )
}
