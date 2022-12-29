const prefix = 'https://fonts.gstatic.com/s/'

// CJK unified ranges: https://www.unicode.org/versions/Unicode14.0.0/ch18.pdf Table 18-1
const cjkRange = 'U+4E00-9FFF,U+3000-303F,U+3400-4DBF,U+20000-2EBEF,U+30000-3134F,U+F900-FAFF,U+2F800-2FA1F';

/**
 * A set of Google-hosted fonts by unicode range that will serve as defaults for when a user-defined
 * font is not supplied or does not support certain characters in the user's text.
 */
export const fallbackFonts = [
  {
    label: 'catchall',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu4mxMKTU1Kg.woff`,
  },
  {
    label: 'emoji',
    src: `${prefix}notoemoji/v34/bMrnmSyK7YY-MEu6aWjPDs-ar6uWaGWuob-r0jws.woff`,
    unicodeRange: 'U+1f004,U+1f0cf,U+1f170-1f19a,U+1f1e6-1f202,U+1f21a,U+1f22f-1f23a,U+1f250-1f251,U+1f300-1f64f,U+1f680-1f6fc,U+1f7e0-1f7f0,U+1f90c-1f9ff,U+1fa70-1faf8,U+e0062-e007f'
  },
  {
    label: 'chinese-simplified',
    lang: /^(?!ja|ko)/, // fallback if a more specific cjk lang was not specified
    src: `${prefix}notosanssc/v25/k3kXo84MPvpLmixcA63oeALhKg.woff`,
    unicodeRange: cjkRange,
  },
  {
    label: 'cjk-chinese-traditional',
    lang: /^zh-Hant$/,
    src: `${prefix}notosanstc/v25/-nF7OG829Oofr2wohFbTp9iFPA.woff`,
    unicodeRange: cjkRange,
  },
  {
    label: 'cjk-japanese',
    lang: /^ja/,
    src: `${prefix}notosansjp/v41/-F62fjtqLzI2JPCgQBnw7HFoxQ.woff`,
    unicodeRange: cjkRange,
  },
  {
    label: 'japanese-hiragama',
    // future: langHint: 'ja',
    src: `${prefix}notosansjp/v41/-F62fjtqLzI2JPCgQBnw7HFoxQ.woff`,
    unicodeRange: 'U+3040-309F',
  },
  {
    label: 'cjk-korean',
    lang: /^ko/,
    src: `${prefix}notosanskr/v26/PbykFmXiEBPT4ITbgNA5Cgm21Q.woff`,
    unicodeRange: cjkRange,
  },
  {
    label: 'korean-hangul',
    // future: langHint: 'ko',
    src: `${prefix}notosanskr/v26/PbykFmXiEBPT4ITbgNA5Cgm21Q.woff`,
    unicodeRange: 'U+AC00-D7AF',
  },
  // TODO Typr chokes on this woff:
  // {
  //   label: 'hebrew',
  //   src: `${prefix}notosanshebrew/v38/or3HQ7v33eiDljA1IufXTtVf7V6RvEEdhQlk0LlGxCyaeNKYZC0sqk3xXGiXd4qtoQ.woff`,
  //   unicodeRange: 'U+2bb-2c6,U+2da-2dc,U+590-5ff,U+1e00-1eff,U+2000-2074,U+20a0-20cf,U+2113-2122,U+2191-2193,U+2212-2215,U+25cc,U+2c60-2c7f,U+a720-a7ff,U+fb1d-fb4f,U+feff,U+fffd'
  // },
  {
    label: 'arabic',
    // src: `${prefix}scheherazadenew/v8/4UaZrFhTvxVnHDvUkUiHg8jprP4DOwFmPXwq9IqeuA.woff`,
    src: `${prefix}notosansarabic/v14/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGyfuXqGNwfKi3ZU.woff`,
    unicodeRange: 'U+0600-06FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE80-FEFC',
  },
  {
    label: 'cyrillic-ext',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu72xMKTU1Kvnz.woff`,
    unicodeRange: 'U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F'
  },
  {
    label: 'cyrillic',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu5mxMKTU1Kvnz.woff`,
    unicodeRange: 'U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116'
  },
  {
    label: 'greek-ext',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu7mxMKTU1Kvnz.woff`,
    unicodeRange: 'U+1F00-1FFF'
  },
  {
    label: 'greek',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu4WxMKTU1Kvnz.woff`,
    unicodeRange: 'U+0370-03FF'
  },
  {
    label: 'vietnamese',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu7WxMKTU1Kvnz.woff`,
    unicodeRange: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+1EA0-1EF9,U+20AB'
  },
  {
    label: 'latin-ext',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu7GxMKTU1Kvnz.woff`,
    unicodeRange: 'U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF'
  },
  {
    label: 'latin',
    src: `${prefix}roboto/v29/KFOmCnqEu92Fr1Mu4mxMKTU1Kg.woff`,
    unicodeRange: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
  },
]

fallbackFonts.forEach(d => {
  d.unicodeRange = unicodeRangeStringToArray(d.unicodeRange)
})

function unicodeRangeStringToArray(str) {
  return str && str.replace(/U\+/g, '').split(/\s*,\s*/g).map(part => part.split('-').map(n => parseInt(n, 16)))
}
