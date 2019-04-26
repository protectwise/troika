
// Custom build of OpenType (https://opentype.js.org/) for use in Troika text rendering. 
// Original MIT license applies: https://github.com/nodebox/opentype.js/blob/master/LICENSE

export default function() {
  // Trick opentype into being able to run in a web worker
  if (typeof window === 'undefined') {
    self.window = self
  }

  
var opentype = (function (exports) {
	'use strict';

	/*! https://mths.be/codepointat v0.2.0 by @mathias */
	if (!String.prototype.codePointAt) {
		(function() {
			var defineProperty = (function() {
				// IE 8 only supports `Object.defineProperty` on DOM elements
				try {
					var object = {};
					var $defineProperty = Object.defineProperty;
					var result = $defineProperty(object, object, object) && $defineProperty;
				} catch(error) {}
				return result;
			}());
			var codePointAt = function(position) {
				if (this == null) {
					throw TypeError();
				}
				var string = String(this);
				var size = string.length;
				// `ToInteger`
				var index = position ? Number(position) : 0;
				if (index != index) { // better `isNaN`
					index = 0;
				}
				// Account for out-of-bounds indices:
				if (index < 0 || index >= size) {
					return undefined;
				}
				// Get the first code unit
				var first = string.charCodeAt(index);
				var second;
				if ( // check if it’s the start of a surrogate pair
					first >= 0xD800 && first <= 0xDBFF && // high surrogate
					size > index + 1 // there is a next code unit
				) {
					second = string.charCodeAt(index + 1);
					if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
						// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
						return (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
					}
				}
				return first;
			};
			if (defineProperty) {
				defineProperty(String.prototype, 'codePointAt', {
					'value': codePointAt,
					'configurable': true,
					'writable': true
				});
			} else {
				String.prototype.codePointAt = codePointAt;
			}
		}());
	}

	var TINF_OK = 0;
	var TINF_DATA_ERROR = -3;

	function Tree() {
	  this.table = new Uint16Array(16);   /* table of code length counts */
	  this.trans = new Uint16Array(288);  /* code -> symbol translation table */
	}

	function Data(source, dest) {
	  this.source = source;
	  this.sourceIndex = 0;
	  this.tag = 0;
	  this.bitcount = 0;
	  
	  this.dest = dest;
	  this.destLen = 0;
	  
	  this.ltree = new Tree();  /* dynamic length/symbol tree */
	  this.dtree = new Tree();  /* dynamic distance tree */
	}

	/* --------------------------------------------------- *
	 * -- uninitialized global data (static structures) -- *
	 * --------------------------------------------------- */

	var sltree = new Tree();
	var sdtree = new Tree();

	/* extra bits and base tables for length codes */
	var length_bits = new Uint8Array(30);
	var length_base = new Uint16Array(30);

	/* extra bits and base tables for distance codes */
	var dist_bits = new Uint8Array(30);
	var dist_base = new Uint16Array(30);

	/* special ordering of code length codes */
	var clcidx = new Uint8Array([
	  16, 17, 18, 0, 8, 7, 9, 6,
	  10, 5, 11, 4, 12, 3, 13, 2,
	  14, 1, 15
	]);

	/* used by tinf_decode_trees, avoids allocations every call */
	var code_tree = new Tree();
	var lengths = new Uint8Array(288 + 32);

	/* ----------------------- *
	 * -- utility functions -- *
	 * ----------------------- */

	/* build extra bits and base tables */
	function tinf_build_bits_base(bits, base, delta, first) {
	  var i, sum;

	  /* build bits table */
	  for (i = 0; i < delta; ++i) bits[i] = 0;
	  for (i = 0; i < 30 - delta; ++i) bits[i + delta] = i / delta | 0;

	  /* build base table */
	  for (sum = first, i = 0; i < 30; ++i) {
	    base[i] = sum;
	    sum += 1 << bits[i];
	  }
	}

	/* build the fixed huffman trees */
	function tinf_build_fixed_trees(lt, dt) {
	  var i;

	  /* build fixed length tree */
	  for (i = 0; i < 7; ++i) lt.table[i] = 0;

	  lt.table[7] = 24;
	  lt.table[8] = 152;
	  lt.table[9] = 112;

	  for (i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
	  for (i = 0; i < 144; ++i) lt.trans[24 + i] = i;
	  for (i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
	  for (i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;

	  /* build fixed distance tree */
	  for (i = 0; i < 5; ++i) dt.table[i] = 0;

	  dt.table[5] = 32;

	  for (i = 0; i < 32; ++i) dt.trans[i] = i;
	}

	/* given an array of code lengths, build a tree */
	var offs = new Uint16Array(16);

	function tinf_build_tree(t, lengths, off, num) {
	  var i, sum;

	  /* clear code length count table */
	  for (i = 0; i < 16; ++i) t.table[i] = 0;

	  /* scan symbol lengths, and sum code length counts */
	  for (i = 0; i < num; ++i) t.table[lengths[off + i]]++;

	  t.table[0] = 0;

	  /* compute offset table for distribution sort */
	  for (sum = 0, i = 0; i < 16; ++i) {
	    offs[i] = sum;
	    sum += t.table[i];
	  }

	  /* create code->symbol translation table (symbols sorted by code) */
	  for (i = 0; i < num; ++i) {
	    if (lengths[off + i]) t.trans[offs[lengths[off + i]]++] = i;
	  }
	}

	/* ---------------------- *
	 * -- decode functions -- *
	 * ---------------------- */

	/* get one bit from source stream */
	function tinf_getbit(d) {
	  /* check if tag is empty */
	  if (!d.bitcount--) {
	    /* load next tag */
	    d.tag = d.source[d.sourceIndex++];
	    d.bitcount = 7;
	  }

	  /* shift bit out of tag */
	  var bit = d.tag & 1;
	  d.tag >>>= 1;

	  return bit;
	}

	/* read a num bit value from a stream and add base */
	function tinf_read_bits(d, num, base) {
	  if (!num)
	    return base;

	  while (d.bitcount < 24) {
	    d.tag |= d.source[d.sourceIndex++] << d.bitcount;
	    d.bitcount += 8;
	  }

	  var val = d.tag & (0xffff >>> (16 - num));
	  d.tag >>>= num;
	  d.bitcount -= num;
	  return val + base;
	}

	/* given a data stream and a tree, decode a symbol */
	function tinf_decode_symbol(d, t) {
	  while (d.bitcount < 24) {
	    d.tag |= d.source[d.sourceIndex++] << d.bitcount;
	    d.bitcount += 8;
	  }
	  
	  var sum = 0, cur = 0, len = 0;
	  var tag = d.tag;

	  /* get more bits while code value is above sum */
	  do {
	    cur = 2 * cur + (tag & 1);
	    tag >>>= 1;
	    ++len;

	    sum += t.table[len];
	    cur -= t.table[len];
	  } while (cur >= 0);
	  
	  d.tag = tag;
	  d.bitcount -= len;

	  return t.trans[sum + cur];
	}

	/* given a data stream, decode dynamic trees from it */
	function tinf_decode_trees(d, lt, dt) {
	  var hlit, hdist, hclen;
	  var i, num, length;

	  /* get 5 bits HLIT (257-286) */
	  hlit = tinf_read_bits(d, 5, 257);

	  /* get 5 bits HDIST (1-32) */
	  hdist = tinf_read_bits(d, 5, 1);

	  /* get 4 bits HCLEN (4-19) */
	  hclen = tinf_read_bits(d, 4, 4);

	  for (i = 0; i < 19; ++i) lengths[i] = 0;

	  /* read code lengths for code length alphabet */
	  for (i = 0; i < hclen; ++i) {
	    /* get 3 bits code length (0-7) */
	    var clen = tinf_read_bits(d, 3, 0);
	    lengths[clcidx[i]] = clen;
	  }

	  /* build code length tree */
	  tinf_build_tree(code_tree, lengths, 0, 19);

	  /* decode code lengths for the dynamic trees */
	  for (num = 0; num < hlit + hdist;) {
	    var sym = tinf_decode_symbol(d, code_tree);

	    switch (sym) {
	      case 16:
	        /* copy previous code length 3-6 times (read 2 bits) */
	        var prev = lengths[num - 1];
	        for (length = tinf_read_bits(d, 2, 3); length; --length) {
	          lengths[num++] = prev;
	        }
	        break;
	      case 17:
	        /* repeat code length 0 for 3-10 times (read 3 bits) */
	        for (length = tinf_read_bits(d, 3, 3); length; --length) {
	          lengths[num++] = 0;
	        }
	        break;
	      case 18:
	        /* repeat code length 0 for 11-138 times (read 7 bits) */
	        for (length = tinf_read_bits(d, 7, 11); length; --length) {
	          lengths[num++] = 0;
	        }
	        break;
	      default:
	        /* values 0-15 represent the actual code lengths */
	        lengths[num++] = sym;
	        break;
	    }
	  }

	  /* build dynamic trees */
	  tinf_build_tree(lt, lengths, 0, hlit);
	  tinf_build_tree(dt, lengths, hlit, hdist);
	}

	/* ----------------------------- *
	 * -- block inflate functions -- *
	 * ----------------------------- */

	/* given a stream and two trees, inflate a block of data */
	function tinf_inflate_block_data(d, lt, dt) {
	  while (1) {
	    var sym = tinf_decode_symbol(d, lt);

	    /* check for end of block */
	    if (sym === 256) {
	      return TINF_OK;
	    }

	    if (sym < 256) {
	      d.dest[d.destLen++] = sym;
	    } else {
	      var length, dist, offs;
	      var i;

	      sym -= 257;

	      /* possibly get more bits from length code */
	      length = tinf_read_bits(d, length_bits[sym], length_base[sym]);

	      dist = tinf_decode_symbol(d, dt);

	      /* possibly get more bits from distance code */
	      offs = d.destLen - tinf_read_bits(d, dist_bits[dist], dist_base[dist]);

	      /* copy match */
	      for (i = offs; i < offs + length; ++i) {
	        d.dest[d.destLen++] = d.dest[i];
	      }
	    }
	  }
	}

	/* inflate an uncompressed block of data */
	function tinf_inflate_uncompressed_block(d) {
	  var length, invlength;
	  var i;
	  
	  /* unread from bitbuffer */
	  while (d.bitcount > 8) {
	    d.sourceIndex--;
	    d.bitcount -= 8;
	  }

	  /* get length */
	  length = d.source[d.sourceIndex + 1];
	  length = 256 * length + d.source[d.sourceIndex];

	  /* get one's complement of length */
	  invlength = d.source[d.sourceIndex + 3];
	  invlength = 256 * invlength + d.source[d.sourceIndex + 2];

	  /* check length */
	  if (length !== (~invlength & 0x0000ffff))
	    return TINF_DATA_ERROR;

	  d.sourceIndex += 4;

	  /* copy block */
	  for (i = length; i; --i)
	    d.dest[d.destLen++] = d.source[d.sourceIndex++];

	  /* make sure we start next block on a byte boundary */
	  d.bitcount = 0;

	  return TINF_OK;
	}

	/* inflate stream from source to dest */
	function tinf_uncompress(source, dest) {
	  var d = new Data(source, dest);
	  var bfinal, btype, res;

	  do {
	    /* read final block flag */
	    bfinal = tinf_getbit(d);

	    /* read block type (2 bits) */
	    btype = tinf_read_bits(d, 2, 0);

	    /* decompress block */
	    switch (btype) {
	      case 0:
	        /* decompress uncompressed block */
	        res = tinf_inflate_uncompressed_block(d);
	        break;
	      case 1:
	        /* decompress block with fixed huffman trees */
	        res = tinf_inflate_block_data(d, sltree, sdtree);
	        break;
	      case 2:
	        /* decompress block with dynamic huffman trees */
	        tinf_decode_trees(d, d.ltree, d.dtree);
	        res = tinf_inflate_block_data(d, d.ltree, d.dtree);
	        break;
	      default:
	        res = TINF_DATA_ERROR;
	    }

	    if (res !== TINF_OK)
	      throw new Error('Data error');

	  } while (!bfinal);

	  if (d.destLen < d.dest.length) {
	    if (typeof d.dest.slice === 'function')
	      return d.dest.slice(0, d.destLen);
	    else
	      return d.dest.subarray(0, d.destLen);
	  }
	  
	  return d.dest;
	}

	/* -------------------- *
	 * -- initialization -- *
	 * -------------------- */

	/* build fixed huffman trees */
	tinf_build_fixed_trees(sltree, sdtree);

	/* build extra bits and base tables */
	tinf_build_bits_base(length_bits, length_base, 4, 3);
	tinf_build_bits_base(dist_bits, dist_base, 2, 1);

	/* fix a special case */
	length_bits[28] = 0;
	length_base[28] = 258;

	var tinyInflate = tinf_uncompress;

	// The Bounding Box object

	function derive(v0, v1, v2, v3, t) {
	    return Math.pow(1 - t, 3) * v0 +
	        3 * Math.pow(1 - t, 2) * t * v1 +
	        3 * (1 - t) * Math.pow(t, 2) * v2 +
	        Math.pow(t, 3) * v3;
	}
	/**
	 * A bounding box is an enclosing box that describes the smallest measure within which all the points lie.
	 * It is used to calculate the bounding box of a glyph or text path.
	 *
	 * On initialization, x1/y1/x2/y2 will be NaN. Check if the bounding box is empty using `isEmpty()`.
	 *
	 * @exports opentype.BoundingBox
	 * @class
	 * @constructor
	 */
	function BoundingBox() {
	    this.x1 = Number.NaN;
	    this.y1 = Number.NaN;
	    this.x2 = Number.NaN;
	    this.y2 = Number.NaN;
	}

	/**
	 * Returns true if the bounding box is empty, that is, no points have been added to the box yet.
	 */
	BoundingBox.prototype.isEmpty = function() {
	    return isNaN(this.x1) || isNaN(this.y1) || isNaN(this.x2) || isNaN(this.y2);
	};

	/**
	 * Add the point to the bounding box.
	 * The x1/y1/x2/y2 coordinates of the bounding box will now encompass the given point.
	 * @param {number} x - The X coordinate of the point.
	 * @param {number} y - The Y coordinate of the point.
	 */
	BoundingBox.prototype.addPoint = function(x, y) {
	    if (typeof x === 'number') {
	        if (isNaN(this.x1) || isNaN(this.x2)) {
	            this.x1 = x;
	            this.x2 = x;
	        }
	        if (x < this.x1) {
	            this.x1 = x;
	        }
	        if (x > this.x2) {
	            this.x2 = x;
	        }
	    }
	    if (typeof y === 'number') {
	        if (isNaN(this.y1) || isNaN(this.y2)) {
	            this.y1 = y;
	            this.y2 = y;
	        }
	        if (y < this.y1) {
	            this.y1 = y;
	        }
	        if (y > this.y2) {
	            this.y2 = y;
	        }
	    }
	};

	/**
	 * Add a X coordinate to the bounding box.
	 * This extends the bounding box to include the X coordinate.
	 * This function is used internally inside of addBezier.
	 * @param {number} x - The X coordinate of the point.
	 */
	BoundingBox.prototype.addX = function(x) {
	    this.addPoint(x, null);
	};

	/**
	 * Add a Y coordinate to the bounding box.
	 * This extends the bounding box to include the Y coordinate.
	 * This function is used internally inside of addBezier.
	 * @param {number} y - The Y coordinate of the point.
	 */
	BoundingBox.prototype.addY = function(y) {
	    this.addPoint(null, y);
	};

	/**
	 * Add a Bézier curve to the bounding box.
	 * This extends the bounding box to include the entire Bézier.
	 * @param {number} x0 - The starting X coordinate.
	 * @param {number} y0 - The starting Y coordinate.
	 * @param {number} x1 - The X coordinate of the first control point.
	 * @param {number} y1 - The Y coordinate of the first control point.
	 * @param {number} x2 - The X coordinate of the second control point.
	 * @param {number} y2 - The Y coordinate of the second control point.
	 * @param {number} x - The ending X coordinate.
	 * @param {number} y - The ending Y coordinate.
	 */
	BoundingBox.prototype.addBezier = function(x0, y0, x1, y1, x2, y2, x, y) {
	    // This code is based on http://nishiohirokazu.blogspot.com/2009/06/how-to-calculate-bezier-curves-bounding.html
	    // and https://github.com/icons8/svg-path-bounding-box

	    const p0 = [x0, y0];
	    const p1 = [x1, y1];
	    const p2 = [x2, y2];
	    const p3 = [x, y];

	    this.addPoint(x0, y0);
	    this.addPoint(x, y);

	    for (let i = 0; i <= 1; i++) {
	        const b = 6 * p0[i] - 12 * p1[i] + 6 * p2[i];
	        const a = -3 * p0[i] + 9 * p1[i] - 9 * p2[i] + 3 * p3[i];
	        const c = 3 * p1[i] - 3 * p0[i];

	        if (a === 0) {
	            if (b === 0) continue;
	            const t = -c / b;
	            if (0 < t && t < 1) {
	                if (i === 0) this.addX(derive(p0[i], p1[i], p2[i], p3[i], t));
	                if (i === 1) this.addY(derive(p0[i], p1[i], p2[i], p3[i], t));
	            }
	            continue;
	        }

	        const b2ac = Math.pow(b, 2) - 4 * c * a;
	        if (b2ac < 0) continue;
	        const t1 = (-b + Math.sqrt(b2ac)) / (2 * a);
	        if (0 < t1 && t1 < 1) {
	            if (i === 0) this.addX(derive(p0[i], p1[i], p2[i], p3[i], t1));
	            if (i === 1) this.addY(derive(p0[i], p1[i], p2[i], p3[i], t1));
	        }
	        const t2 = (-b - Math.sqrt(b2ac)) / (2 * a);
	        if (0 < t2 && t2 < 1) {
	            if (i === 0) this.addX(derive(p0[i], p1[i], p2[i], p3[i], t2));
	            if (i === 1) this.addY(derive(p0[i], p1[i], p2[i], p3[i], t2));
	        }
	    }
	};

	/**
	 * Add a quadratic curve to the bounding box.
	 * This extends the bounding box to include the entire quadratic curve.
	 * @param {number} x0 - The starting X coordinate.
	 * @param {number} y0 - The starting Y coordinate.
	 * @param {number} x1 - The X coordinate of the control point.
	 * @param {number} y1 - The Y coordinate of the control point.
	 * @param {number} x - The ending X coordinate.
	 * @param {number} y - The ending Y coordinate.
	 */
	BoundingBox.prototype.addQuad = function(x0, y0, x1, y1, x, y) {
	    const cp1x = x0 + 2 / 3 * (x1 - x0);
	    const cp1y = y0 + 2 / 3 * (y1 - y0);
	    const cp2x = cp1x + 1 / 3 * (x - x0);
	    const cp2y = cp1y + 1 / 3 * (y - y0);
	    this.addBezier(x0, y0, cp1x, cp1y, cp2x, cp2y, x, y);
	};

	// Geometric objects

	/**
	 * A bézier path containing a set of path commands similar to a SVG path.
	 * Paths can be drawn on a context using `draw`.
	 * @exports opentype.Path
	 * @class
	 * @constructor
	 */
	function Path() {
	    this.commands = [];
	    this.fill = 'black';
	    this.stroke = null;
	    this.strokeWidth = 1;
	}

	/**
	 * @param  {number} x
	 * @param  {number} y
	 */
	Path.prototype.moveTo = function(x, y) {
	    this.commands.push({
	        type: 'M',
	        x: x,
	        y: y
	    });
	};

	/**
	 * @param  {number} x
	 * @param  {number} y
	 */
	Path.prototype.lineTo = function(x, y) {
	    this.commands.push({
	        type: 'L',
	        x: x,
	        y: y
	    });
	};

	/**
	 * Draws cubic curve
	 * @function
	 * curveTo
	 * @memberof opentype.Path.prototype
	 * @param  {number} x1 - x of control 1
	 * @param  {number} y1 - y of control 1
	 * @param  {number} x2 - x of control 2
	 * @param  {number} y2 - y of control 2
	 * @param  {number} x - x of path point
	 * @param  {number} y - y of path point
	 */

	/**
	 * Draws cubic curve
	 * @function
	 * bezierCurveTo
	 * @memberof opentype.Path.prototype
	 * @param  {number} x1 - x of control 1
	 * @param  {number} y1 - y of control 1
	 * @param  {number} x2 - x of control 2
	 * @param  {number} y2 - y of control 2
	 * @param  {number} x - x of path point
	 * @param  {number} y - y of path point
	 * @see curveTo
	 */
	Path.prototype.curveTo = Path.prototype.bezierCurveTo = function(x1, y1, x2, y2, x, y) {
	    this.commands.push({
	        type: 'C',
	        x1: x1,
	        y1: y1,
	        x2: x2,
	        y2: y2,
	        x: x,
	        y: y
	    });
	};

	/**
	 * Draws quadratic curve
	 * @function
	 * quadraticCurveTo
	 * @memberof opentype.Path.prototype
	 * @param  {number} x1 - x of control
	 * @param  {number} y1 - y of control
	 * @param  {number} x - x of path point
	 * @param  {number} y - y of path point
	 */

	/**
	 * Draws quadratic curve
	 * @function
	 * quadTo
	 * @memberof opentype.Path.prototype
	 * @param  {number} x1 - x of control
	 * @param  {number} y1 - y of control
	 * @param  {number} x - x of path point
	 * @param  {number} y - y of path point
	 */
	Path.prototype.quadTo = Path.prototype.quadraticCurveTo = function(x1, y1, x, y) {
	    this.commands.push({
	        type: 'Q',
	        x1: x1,
	        y1: y1,
	        x: x,
	        y: y
	    });
	};

	/**
	 * Closes the path
	 * @function closePath
	 * @memberof opentype.Path.prototype
	 */

	/**
	 * Close the path
	 * @function close
	 * @memberof opentype.Path.prototype
	 */
	Path.prototype.close = Path.prototype.closePath = function() {
	    this.commands.push({
	        type: 'Z'
	    });
	};

	/**
	 * Add the given path or list of commands to the commands of this path.
	 * @param  {Array} pathOrCommands - another opentype.Path, an opentype.BoundingBox, or an array of commands.
	 */
	Path.prototype.extend = function(pathOrCommands) {
	    if (pathOrCommands.commands) {
	        pathOrCommands = pathOrCommands.commands;
	    } else if (pathOrCommands instanceof BoundingBox) {
	        const box = pathOrCommands;
	        this.moveTo(box.x1, box.y1);
	        this.lineTo(box.x2, box.y1);
	        this.lineTo(box.x2, box.y2);
	        this.lineTo(box.x1, box.y2);
	        this.close();
	        return;
	    }

	    Array.prototype.push.apply(this.commands, pathOrCommands);
	};

	/**
	 * Calculate the bounding box of the path.
	 * @returns {opentype.BoundingBox}
	 */
	Path.prototype.getBoundingBox = function() {
	    const box = new BoundingBox();

	    let startX = 0;
	    let startY = 0;
	    let prevX = 0;
	    let prevY = 0;
	    for (let i = 0; i < this.commands.length; i++) {
	        const cmd = this.commands[i];
	        switch (cmd.type) {
	            case 'M':
	                box.addPoint(cmd.x, cmd.y);
	                startX = prevX = cmd.x;
	                startY = prevY = cmd.y;
	                break;
	            case 'L':
	                box.addPoint(cmd.x, cmd.y);
	                prevX = cmd.x;
	                prevY = cmd.y;
	                break;
	            case 'Q':
	                box.addQuad(prevX, prevY, cmd.x1, cmd.y1, cmd.x, cmd.y);
	                prevX = cmd.x;
	                prevY = cmd.y;
	                break;
	            case 'C':
	                box.addBezier(prevX, prevY, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
	                prevX = cmd.x;
	                prevY = cmd.y;
	                break;
	            case 'Z':
	                prevX = startX;
	                prevY = startY;
	                break;
	            default:
	                throw new Error('Unexpected path command ' + cmd.type);
	        }
	    }
	    if (box.isEmpty()) {
	        box.addPoint(0, 0);
	    }
	    return box;
	};

	/**
	 * Draw the path to a 2D context.
	 * @param {CanvasRenderingContext2D} ctx - A 2D drawing context.
	 */
	Path.prototype.draw = function(ctx) {
	    ctx.beginPath();
	    for (let i = 0; i < this.commands.length; i += 1) {
	        const cmd = this.commands[i];
	        if (cmd.type === 'M') {
	            ctx.moveTo(cmd.x, cmd.y);
	        } else if (cmd.type === 'L') {
	            ctx.lineTo(cmd.x, cmd.y);
	        } else if (cmd.type === 'C') {
	            ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
	        } else if (cmd.type === 'Q') {
	            ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
	        } else if (cmd.type === 'Z') {
	            ctx.closePath();
	        }
	    }

	    if (this.fill) {
	        ctx.fillStyle = this.fill;
	        ctx.fill();
	    }

	    if (this.stroke) {
	        ctx.strokeStyle = this.stroke;
	        ctx.lineWidth = this.strokeWidth;
	        ctx.stroke();
	    }
	};

	/**
	 * Convert the Path to a string of path data instructions
	 * See http://www.w3.org/TR/SVG/paths.html#PathData
	 * @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
	 * @return {string}
	 */
	Path.prototype.toPathData = function(decimalPlaces) {
	    decimalPlaces = decimalPlaces !== undefined ? decimalPlaces : 2;

	    function floatToString(v) {
	        if (Math.round(v) === v) {
	            return '' + Math.round(v);
	        } else {
	            return v.toFixed(decimalPlaces);
	        }
	    }

	    function packValues() {
	        let s = '';
	        for (let i = 0; i < arguments.length; i += 1) {
	            const v = arguments[i];
	            if (v >= 0 && i > 0) {
	                s += ' ';
	            }

	            s += floatToString(v);
	        }

	        return s;
	    }

	    let d = '';
	    for (let i = 0; i < this.commands.length; i += 1) {
	        const cmd = this.commands[i];
	        if (cmd.type === 'M') {
	            d += 'M' + packValues(cmd.x, cmd.y);
	        } else if (cmd.type === 'L') {
	            d += 'L' + packValues(cmd.x, cmd.y);
	        } else if (cmd.type === 'C') {
	            d += 'C' + packValues(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
	        } else if (cmd.type === 'Q') {
	            d += 'Q' + packValues(cmd.x1, cmd.y1, cmd.x, cmd.y);
	        } else if (cmd.type === 'Z') {
	            d += 'Z';
	        }
	    }

	    return d;
	};

	/**
	 * Convert the path to an SVG <path> element, as a string.
	 * @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
	 * @return {string}
	 */
	Path.prototype.toSVG = function(decimalPlaces) {
	    let svg = '<path d="';
	    svg += this.toPathData(decimalPlaces);
	    svg += '"';
	    if (this.fill && this.fill !== 'black') {
	        if (this.fill === null) {
	            svg += ' fill="none"';
	        } else {
	            svg += ' fill="' + this.fill + '"';
	        }
	    }

	    if (this.stroke) {
	        svg += ' stroke="' + this.stroke + '" stroke-width="' + this.strokeWidth + '"';
	    }

	    svg += '/>';
	    return svg;
	};

	/**
	 * Convert the path to a DOM element.
	 * @param  {number} [decimalPlaces=2] - The amount of decimal places for floating-point values
	 * @return {SVGPathElement}
	 */
	Path.prototype.toDOMElement = function(decimalPlaces) {
	    const temporaryPath = this.toPathData(decimalPlaces);
	    const newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

	    newPath.setAttribute('d', temporaryPath);

	    return newPath;
	};

	// Run-time checking of preconditions.

	function fail(message) {
	    throw new Error(message);
	}

	// Precondition function that checks if the given predicate is true.
	// If not, it will throw an error.
	function argument(predicate, message) {
	    if (!predicate) {
	        fail(message);
	    }
	}
	var check = { fail, argument, assert: argument };

	// Data types used in the OpenType font file.

	const LIMIT16 = 32768; // The limit at which a 16-bit number switches signs == 2^15
	const LIMIT32 = 2147483648; // The limit at which a 32-bit number switches signs == 2 ^ 31

	/**
	 * @exports opentype.decode
	 * @class
	 */
	const decode = {};
	/**
	 * @exports opentype.encode
	 * @class
	 */
	const encode = {};
	/**
	 * @exports opentype.sizeOf
	 * @class
	 */
	const sizeOf = {};

	// Return a function that always returns the same value.
	function constant(v) {
	    return function() {
	        return v;
	    };
	}

	// OpenType data types //////////////////////////////////////////////////////

	/**
	 * Convert an 8-bit unsigned integer to a list of 1 byte.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.BYTE = function(v) {
	    check.argument(v >= 0 && v <= 255, 'Byte value should be between 0 and 255.');
	    return [v];
	};
	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.BYTE = constant(1);

	/**
	 * Convert a 8-bit signed integer to a list of 1 byte.
	 * @param {string}
	 * @returns {Array}
	 */
	encode.CHAR = function(v) {
	    return [v.charCodeAt(0)];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.CHAR = constant(1);

	/**
	 * Convert an ASCII string to a list of bytes.
	 * @param {string}
	 * @returns {Array}
	 */
	encode.CHARARRAY = function(v) {
	    const b = [];
	    for (let i = 0; i < v.length; i += 1) {
	        b[i] = v.charCodeAt(i);
	    }

	    return b;
	};

	/**
	 * @param {Array}
	 * @returns {number}
	 */
	sizeOf.CHARARRAY = function(v) {
	    return v.length;
	};

	/**
	 * Convert a 16-bit unsigned integer to a list of 2 bytes.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.USHORT = function(v) {
	    return [(v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.USHORT = constant(2);

	/**
	 * Convert a 16-bit signed integer to a list of 2 bytes.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.SHORT = function(v) {
	    // Two's complement
	    if (v >= LIMIT16) {
	        v = -(2 * LIMIT16 - v);
	    }

	    return [(v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.SHORT = constant(2);

	/**
	 * Convert a 24-bit unsigned integer to a list of 3 bytes.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.UINT24 = function(v) {
	    return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.UINT24 = constant(3);

	/**
	 * Convert a 32-bit unsigned integer to a list of 4 bytes.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.ULONG = function(v) {
	    return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.ULONG = constant(4);

	/**
	 * Convert a 32-bit unsigned integer to a list of 4 bytes.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.LONG = function(v) {
	    // Two's complement
	    if (v >= LIMIT32) {
	        v = -(2 * LIMIT32 - v);
	    }

	    return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.LONG = constant(4);

	encode.FIXED = encode.ULONG;
	sizeOf.FIXED = sizeOf.ULONG;

	encode.FWORD = encode.SHORT;
	sizeOf.FWORD = sizeOf.SHORT;

	encode.UFWORD = encode.USHORT;
	sizeOf.UFWORD = sizeOf.USHORT;

	/**
	 * Convert a 32-bit Apple Mac timestamp integer to a list of 8 bytes, 64-bit timestamp.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.LONGDATETIME = function(v) {
	    return [0, 0, 0, 0, (v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.LONGDATETIME = constant(8);

	/**
	 * Convert a 4-char tag to a list of 4 bytes.
	 * @param {string}
	 * @returns {Array}
	 */
	encode.TAG = function(v) {
	    check.argument(v.length === 4, 'Tag should be exactly 4 ASCII characters.');
	    return [v.charCodeAt(0),
	            v.charCodeAt(1),
	            v.charCodeAt(2),
	            v.charCodeAt(3)];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.TAG = constant(4);

	// CFF data types ///////////////////////////////////////////////////////////

	encode.Card8 = encode.BYTE;
	sizeOf.Card8 = sizeOf.BYTE;

	encode.Card16 = encode.USHORT;
	sizeOf.Card16 = sizeOf.USHORT;

	encode.OffSize = encode.BYTE;
	sizeOf.OffSize = sizeOf.BYTE;

	encode.SID = encode.USHORT;
	sizeOf.SID = sizeOf.USHORT;

	// Convert a numeric operand or charstring number to a variable-size list of bytes.
	/**
	 * Convert a numeric operand or charstring number to a variable-size list of bytes.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.NUMBER = function(v) {
	    if (v >= -107 && v <= 107) {
	        return [v + 139];
	    } else if (v >= 108 && v <= 1131) {
	        v = v - 108;
	        return [(v >> 8) + 247, v & 0xFF];
	    } else if (v >= -1131 && v <= -108) {
	        v = -v - 108;
	        return [(v >> 8) + 251, v & 0xFF];
	    } else if (v >= -32768 && v <= 32767) {
	        return encode.NUMBER16(v);
	    } else {
	        return encode.NUMBER32(v);
	    }
	};

	/**
	 * @param {number}
	 * @returns {number}
	 */
	sizeOf.NUMBER = function(v) {
	    return encode.NUMBER(v).length;
	};

	/**
	 * Convert a signed number between -32768 and +32767 to a three-byte value.
	 * This ensures we always use three bytes, but is not the most compact format.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.NUMBER16 = function(v) {
	    return [28, (v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.NUMBER16 = constant(3);

	/**
	 * Convert a signed number between -(2^31) and +(2^31-1) to a five-byte value.
	 * This is useful if you want to be sure you always use four bytes,
	 * at the expense of wasting a few bytes for smaller numbers.
	 * @param {number}
	 * @returns {Array}
	 */
	encode.NUMBER32 = function(v) {
	    return [29, (v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
	};

	/**
	 * @constant
	 * @type {number}
	 */
	sizeOf.NUMBER32 = constant(5);

	/**
	 * @param {number}
	 * @returns {Array}
	 */
	encode.REAL = function(v) {
	    let value = v.toString();

	    // Some numbers use an epsilon to encode the value. (e.g. JavaScript will store 0.0000001 as 1e-7)
	    // This code converts it back to a number without the epsilon.
	    const m = /\.(\d*?)(?:9{5,20}|0{5,20})\d{0,2}(?:e(.+)|$)/.exec(value);
	    if (m) {
	        const epsilon = parseFloat('1e' + ((m[2] ? +m[2] : 0) + m[1].length));
	        value = (Math.round(v * epsilon) / epsilon).toString();
	    }

	    let nibbles = '';
	    for (let i = 0, ii = value.length; i < ii; i += 1) {
	        const c = value[i];
	        if (c === 'e') {
	            nibbles += value[++i] === '-' ? 'c' : 'b';
	        } else if (c === '.') {
	            nibbles += 'a';
	        } else if (c === '-') {
	            nibbles += 'e';
	        } else {
	            nibbles += c;
	        }
	    }

	    nibbles += (nibbles.length & 1) ? 'f' : 'ff';
	    const out = [30];
	    for (let i = 0, ii = nibbles.length; i < ii; i += 2) {
	        out.push(parseInt(nibbles.substr(i, 2), 16));
	    }

	    return out;
	};

	/**
	 * @param {number}
	 * @returns {number}
	 */
	sizeOf.REAL = function(v) {
	    return encode.REAL(v).length;
	};

	encode.NAME = encode.CHARARRAY;
	sizeOf.NAME = sizeOf.CHARARRAY;

	encode.STRING = encode.CHARARRAY;
	sizeOf.STRING = sizeOf.CHARARRAY;

	/**
	 * @param {DataView} data
	 * @param {number} offset
	 * @param {number} numBytes
	 * @returns {string}
	 */
	decode.UTF8 = function(data, offset, numBytes) {
	    const codePoints = [];
	    const numChars = numBytes;
	    for (let j = 0; j < numChars; j++, offset += 1) {
	        codePoints[j] = data.getUint8(offset);
	    }

	    return String.fromCharCode.apply(null, codePoints);
	};

	/**
	 * @param {DataView} data
	 * @param {number} offset
	 * @param {number} numBytes
	 * @returns {string}
	 */
	decode.UTF16 = function(data, offset, numBytes) {
	    const codePoints = [];
	    const numChars = numBytes / 2;
	    for (let j = 0; j < numChars; j++, offset += 2) {
	        codePoints[j] = data.getUint16(offset);
	    }

	    return String.fromCharCode.apply(null, codePoints);
	};

	/**
	 * Convert a JavaScript string to UTF16-BE.
	 * @param {string}
	 * @returns {Array}
	 */
	encode.UTF16 = function(v) {
	    const b = [];
	    for (let i = 0; i < v.length; i += 1) {
	        const codepoint = v.charCodeAt(i);
	        b[b.length] = (codepoint >> 8) & 0xFF;
	        b[b.length] = codepoint & 0xFF;
	    }

	    return b;
	};

	/**
	 * @param {string}
	 * @returns {number}
	 */
	sizeOf.UTF16 = function(v) {
	    return v.length * 2;
	};

	// Data for converting old eight-bit Macintosh encodings to Unicode.
	// This representation is optimized for decoding; encoding is slower
	// and needs more memory. The assumption is that all opentype.js users
	// want to open fonts, but saving a font will be comparatively rare
	// so it can be more expensive. Keyed by IANA character set name.
	//
	// Python script for generating these strings:
	//
	//     s = u''.join([chr(c).decode('mac_greek') for c in range(128, 256)])
	//     print(s.encode('utf-8'))
	/**
	 * @private
	 */
	const eightBitMacEncodings = {
	    'x-mac-croatian':  // Python: 'mac_croatian'
	    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø' +
	    '¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊©⁄€‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ',
	    'x-mac-cyrillic':  // Python: 'mac_cyrillic'
	    'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњ' +
	    'јЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю',
	    'x-mac-gaelic': // http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/GAELIC.TXT
	    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØḂ±≤≥ḃĊċḊḋḞḟĠġṀæø' +
	    'ṁṖṗɼƒſṠ«»… ÀÃÕŒœ–—“”‘’ṡẛÿŸṪ€‹›Ŷŷṫ·Ỳỳ⁊ÂÊÁËÈÍÎÏÌÓÔ♣ÒÚÛÙıÝýŴŵẄẅẀẁẂẃ',
	    'x-mac-greek':  // Python: 'mac_greek'
	    'Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦€ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩ' +
	    'άΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ\u00AD',
	    'x-mac-icelandic':  // Python: 'mac_iceland'
	    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
	    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ',
	    'x-mac-inuit': // http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/INUIT.TXT
	    'ᐃᐄᐅᐆᐊᐋᐱᐲᐳᐴᐸᐹᑉᑎᑏᑐᑑᑕᑖᑦᑭᑮᑯᑰᑲᑳᒃᒋᒌᒍᒎᒐᒑ°ᒡᒥᒦ•¶ᒧ®©™ᒨᒪᒫᒻᓂᓃᓄᓅᓇᓈᓐᓯᓰᓱᓲᓴᓵᔅᓕᓖᓗ' +
	    'ᓘᓚᓛᓪᔨᔩᔪᔫᔭ… ᔮᔾᕕᕖᕗ–—“”‘’ᕘᕙᕚᕝᕆᕇᕈᕉᕋᕌᕐᕿᖀᖁᖂᖃᖄᖅᖏᖐᖑᖒᖓᖔᖕᙱᙲᙳᙴᙵᙶᖖᖠᖡᖢᖣᖤᖥᖦᕼŁł',
	    'x-mac-ce':  // Python: 'mac_latin2'
	    'ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅ' +
	    'ņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ',
	    macintosh:  // Python: 'mac_roman'
	    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
	    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ',
	    'x-mac-romanian':  // Python: 'mac_romanian'
	    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂȘ∞±≤≥¥µ∂∑∏π∫ªºΩăș' +
	    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›Țț‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ',
	    'x-mac-turkish':  // Python: 'mac_turkish'
	    'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø' +
	    '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙˆ˜¯˘˙˚¸˝˛ˇ'
	};

	/**
	 * Decodes an old-style Macintosh string. Returns either a Unicode JavaScript
	 * string, or 'undefined' if the encoding is unsupported. For example, we do
	 * not support Chinese, Japanese or Korean because these would need large
	 * mapping tables.
	 * @param {DataView} dataView
	 * @param {number} offset
	 * @param {number} dataLength
	 * @param {string} encoding
	 * @returns {string}
	 */
	decode.MACSTRING = function(dataView, offset, dataLength, encoding) {
	    const table = eightBitMacEncodings[encoding];
	    if (table === undefined) {
	        return undefined;
	    }

	    let result = '';
	    for (let i = 0; i < dataLength; i++) {
	        const c = dataView.getUint8(offset + i);
	        // In all eight-bit Mac encodings, the characters 0x00..0x7F are
	        // mapped to U+0000..U+007F; we only need to look up the others.
	        if (c <= 0x7F) {
	            result += String.fromCharCode(c);
	        } else {
	            result += table[c & 0x7F];
	        }
	    }

	    return result;
	};

	// Helper function for encode.MACSTRING. Returns a dictionary for mapping
	// Unicode character codes to their 8-bit MacOS equivalent. This table
	// is not exactly a super cheap data structure, but we do not care because
	// encoding Macintosh strings is only rarely needed in typical applications.
	const macEncodingTableCache = typeof WeakMap === 'function' && new WeakMap();
	let macEncodingCacheKeys;
	const getMacEncodingTable = function (encoding) {
	    // Since we use encoding as a cache key for WeakMap, it has to be
	    // a String object and not a literal. And at least on NodeJS 2.10.1,
	    // WeakMap requires that the same String instance is passed for cache hits.
	    if (!macEncodingCacheKeys) {
	        macEncodingCacheKeys = {};
	        for (let e in eightBitMacEncodings) {
	            /*jshint -W053 */  // Suppress "Do not use String as a constructor."
	            macEncodingCacheKeys[e] = new String(e);
	        }
	    }

	    const cacheKey = macEncodingCacheKeys[encoding];
	    if (cacheKey === undefined) {
	        return undefined;
	    }

	    // We can't do "if (cache.has(key)) {return cache.get(key)}" here:
	    // since garbage collection may run at any time, it could also kick in
	    // between the calls to cache.has() and cache.get(). In that case,
	    // we would return 'undefined' even though we do support the encoding.
	    if (macEncodingTableCache) {
	        const cachedTable = macEncodingTableCache.get(cacheKey);
	        if (cachedTable !== undefined) {
	            return cachedTable;
	        }
	    }

	    const decodingTable = eightBitMacEncodings[encoding];
	    if (decodingTable === undefined) {
	        return undefined;
	    }

	    const encodingTable = {};
	    for (let i = 0; i < decodingTable.length; i++) {
	        encodingTable[decodingTable.charCodeAt(i)] = i + 0x80;
	    }

	    if (macEncodingTableCache) {
	        macEncodingTableCache.set(cacheKey, encodingTable);
	    }

	    return encodingTable;
	};

	/**
	 * Encodes an old-style Macintosh string. Returns a byte array upon success.
	 * If the requested encoding is unsupported, or if the input string contains
	 * a character that cannot be expressed in the encoding, the function returns
	 * 'undefined'.
	 * @param {string} str
	 * @param {string} encoding
	 * @returns {Array}
	 */
	encode.MACSTRING = function(str, encoding) {
	    const table = getMacEncodingTable(encoding);
	    if (table === undefined) {
	        return undefined;
	    }

	    const result = [];
	    for (let i = 0; i < str.length; i++) {
	        let c = str.charCodeAt(i);

	        // In all eight-bit Mac encodings, the characters 0x00..0x7F are
	        // mapped to U+0000..U+007F; we only need to look up the others.
	        if (c >= 0x80) {
	            c = table[c];
	            if (c === undefined) {
	                // str contains a Unicode character that cannot be encoded
	                // in the requested encoding.
	                return undefined;
	            }
	        }
	        result[i] = c;
	        // result.push(c);
	    }

	    return result;
	};

	/**
	 * @param {string} str
	 * @param {string} encoding
	 * @returns {number}
	 */
	sizeOf.MACSTRING = function(str, encoding) {
	    const b = encode.MACSTRING(str, encoding);
	    if (b !== undefined) {
	        return b.length;
	    } else {
	        return 0;
	    }
	};

	// Helper for encode.VARDELTAS
	function isByteEncodable(value) {
	    return value >= -128 && value <= 127;
	}

	// Helper for encode.VARDELTAS
	function encodeVarDeltaRunAsZeroes(deltas, pos, result) {
	    let runLength = 0;
	    const numDeltas = deltas.length;
	    while (pos < numDeltas && runLength < 64 && deltas[pos] === 0) {
	        ++pos;
	        ++runLength;
	    }
	    result.push(0x80 | (runLength - 1));
	    return pos;
	}

	// Helper for encode.VARDELTAS
	function encodeVarDeltaRunAsBytes(deltas, offset, result) {
	    let runLength = 0;
	    const numDeltas = deltas.length;
	    let pos = offset;
	    while (pos < numDeltas && runLength < 64) {
	        const value = deltas[pos];
	        if (!isByteEncodable(value)) {
	            break;
	        }

	        // Within a byte-encoded run of deltas, a single zero is best
	        // stored literally as 0x00 value. However, if we have two or
	        // more zeroes in a sequence, it is better to start a new run.
	        // Fore example, the sequence of deltas [15, 15, 0, 15, 15]
	        // becomes 6 bytes (04 0F 0F 00 0F 0F) when storing the zero
	        // within the current run, but 7 bytes (01 0F 0F 80 01 0F 0F)
	        // when starting a new run.
	        if (value === 0 && pos + 1 < numDeltas && deltas[pos + 1] === 0) {
	            break;
	        }

	        ++pos;
	        ++runLength;
	    }
	    result.push(runLength - 1);
	    for (let i = offset; i < pos; ++i) {
	        result.push((deltas[i] + 256) & 0xff);
	    }
	    return pos;
	}

	// Helper for encode.VARDELTAS
	function encodeVarDeltaRunAsWords(deltas, offset, result) {
	    let runLength = 0;
	    const numDeltas = deltas.length;
	    let pos = offset;
	    while (pos < numDeltas && runLength < 64) {
	        const value = deltas[pos];

	        // Within a word-encoded run of deltas, it is easiest to start
	        // a new run (with a different encoding) whenever we encounter
	        // a zero value. For example, the sequence [0x6666, 0, 0x7777]
	        // needs 7 bytes when storing the zero inside the current run
	        // (42 66 66 00 00 77 77), and equally 7 bytes when starting a
	        // new run (40 66 66 80 40 77 77).
	        if (value === 0) {
	            break;
	        }

	        // Within a word-encoded run of deltas, a single value in the
	        // range (-128..127) should be encoded within the current run
	        // because it is more compact. For example, the sequence
	        // [0x6666, 2, 0x7777] becomes 7 bytes when storing the value
	        // literally (42 66 66 00 02 77 77), but 8 bytes when starting
	        // a new run (40 66 66 00 02 40 77 77).
	        if (isByteEncodable(value) && pos + 1 < numDeltas && isByteEncodable(deltas[pos + 1])) {
	            break;
	        }

	        ++pos;
	        ++runLength;
	    }
	    result.push(0x40 | (runLength - 1));
	    for (let i = offset; i < pos; ++i) {
	        const val = deltas[i];
	        result.push(((val + 0x10000) >> 8) & 0xff, (val + 0x100) & 0xff);
	    }
	    return pos;
	}

	/**
	 * Encode a list of variation adjustment deltas.
	 *
	 * Variation adjustment deltas are used in ‘gvar’ and ‘cvar’ tables.
	 * They indicate how points (in ‘gvar’) or values (in ‘cvar’) get adjusted
	 * when generating instances of variation fonts.
	 *
	 * @see https://www.microsoft.com/typography/otspec/gvar.htm
	 * @see https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6gvar.html
	 * @param {Array}
	 * @return {Array}
	 */
	encode.VARDELTAS = function(deltas) {
	    let pos = 0;
	    const result = [];
	    while (pos < deltas.length) {
	        const value = deltas[pos];
	        if (value === 0) {
	            pos = encodeVarDeltaRunAsZeroes(deltas, pos, result);
	        } else if (value >= -128 && value <= 127) {
	            pos = encodeVarDeltaRunAsBytes(deltas, pos, result);
	        } else {
	            pos = encodeVarDeltaRunAsWords(deltas, pos, result);
	        }
	    }
	    return result;
	};

	// Convert a list of values to a CFF INDEX structure.
	// The values should be objects containing name / type / value.
	/**
	 * @param {Array} l
	 * @returns {Array}
	 */
	encode.INDEX = function(l) {
	    //var offset, offsets, offsetEncoder, encodedOffsets, encodedOffset, data,
	    //    i, v;
	    // Because we have to know which data type to use to encode the offsets,
	    // we have to go through the values twice: once to encode the data and
	    // calculate the offsets, then again to encode the offsets using the fitting data type.
	    let offset = 1; // First offset is always 1.
	    const offsets = [offset];
	    const data = [];
	    for (let i = 0; i < l.length; i += 1) {
	        const v = encode.OBJECT(l[i]);
	        Array.prototype.push.apply(data, v);
	        offset += v.length;
	        offsets.push(offset);
	    }

	    if (data.length === 0) {
	        return [0, 0];
	    }

	    const encodedOffsets = [];
	    const offSize = (1 + Math.floor(Math.log(offset) / Math.log(2)) / 8) | 0;
	    const offsetEncoder = [undefined, encode.BYTE, encode.USHORT, encode.UINT24, encode.ULONG][offSize];
	    for (let i = 0; i < offsets.length; i += 1) {
	        const encodedOffset = offsetEncoder(offsets[i]);
	        Array.prototype.push.apply(encodedOffsets, encodedOffset);
	    }

	    return Array.prototype.concat(encode.Card16(l.length),
	                           encode.OffSize(offSize),
	                           encodedOffsets,
	                           data);
	};

	/**
	 * @param {Array}
	 * @returns {number}
	 */
	sizeOf.INDEX = function(v) {
	    return encode.INDEX(v).length;
	};

	/**
	 * Convert an object to a CFF DICT structure.
	 * The keys should be numeric.
	 * The values should be objects containing name / type / value.
	 * @param {Object} m
	 * @returns {Array}
	 */
	encode.DICT = function(m) {
	    let d = [];
	    const keys = Object.keys(m);
	    const length = keys.length;

	    for (let i = 0; i < length; i += 1) {
	        // Object.keys() return string keys, but our keys are always numeric.
	        const k = parseInt(keys[i], 0);
	        const v = m[k];
	        // Value comes before the key.
	        d = d.concat(encode.OPERAND(v.value, v.type));
	        d = d.concat(encode.OPERATOR(k));
	    }

	    return d;
	};

	/**
	 * @param {Object}
	 * @returns {number}
	 */
	sizeOf.DICT = function(m) {
	    return encode.DICT(m).length;
	};

	/**
	 * @param {number}
	 * @returns {Array}
	 */
	encode.OPERATOR = function(v) {
	    if (v < 1200) {
	        return [v];
	    } else {
	        return [12, v - 1200];
	    }
	};

	/**
	 * @param {Array} v
	 * @param {string}
	 * @returns {Array}
	 */
	encode.OPERAND = function(v, type) {
	    let d = [];
	    if (Array.isArray(type)) {
	        for (let i = 0; i < type.length; i += 1) {
	            check.argument(v.length === type.length, 'Not enough arguments given for type' + type);
	            d = d.concat(encode.OPERAND(v[i], type[i]));
	        }
	    } else {
	        if (type === 'SID') {
	            d = d.concat(encode.NUMBER(v));
	        } else if (type === 'offset') {
	            // We make it easy for ourselves and always encode offsets as
	            // 4 bytes. This makes offset calculation for the top dict easier.
	            d = d.concat(encode.NUMBER32(v));
	        } else if (type === 'number') {
	            d = d.concat(encode.NUMBER(v));
	        } else if (type === 'real') {
	            d = d.concat(encode.REAL(v));
	        } else {
	            throw new Error('Unknown operand type ' + type);
	            // FIXME Add support for booleans
	        }
	    }

	    return d;
	};

	encode.OP = encode.BYTE;
	sizeOf.OP = sizeOf.BYTE;

	// memoize charstring encoding using WeakMap if available
	const wmm = typeof WeakMap === 'function' && new WeakMap();

	/**
	 * Convert a list of CharString operations to bytes.
	 * @param {Array}
	 * @returns {Array}
	 */
	encode.CHARSTRING = function(ops) {
	    // See encode.MACSTRING for why we don't do "if (wmm && wmm.has(ops))".
	    if (wmm) {
	        const cachedValue = wmm.get(ops);
	        if (cachedValue !== undefined) {
	            return cachedValue;
	        }
	    }

	    let d = [];
	    const length = ops.length;

	    for (let i = 0; i < length; i += 1) {
	        const op = ops[i];
	        d = d.concat(encode[op.type](op.value));
	    }

	    if (wmm) {
	        wmm.set(ops, d);
	    }

	    return d;
	};

	/**
	 * @param {Array}
	 * @returns {number}
	 */
	sizeOf.CHARSTRING = function(ops) {
	    return encode.CHARSTRING(ops).length;
	};

	// Utility functions ////////////////////////////////////////////////////////

	/**
	 * Convert an object containing name / type / value to bytes.
	 * @param {Object}
	 * @returns {Array}
	 */
	encode.OBJECT = function(v) {
	    const encodingFunction = encode[v.type];
	    check.argument(encodingFunction !== undefined, 'No encoding function for type ' + v.type);
	    return encodingFunction(v.value);
	};

	/**
	 * @param {Object}
	 * @returns {number}
	 */
	sizeOf.OBJECT = function(v) {
	    const sizeOfFunction = sizeOf[v.type];
	    check.argument(sizeOfFunction !== undefined, 'No sizeOf function for type ' + v.type);
	    return sizeOfFunction(v.value);
	};

	/**
	 * Convert a table object to bytes.
	 * A table contains a list of fields containing the metadata (name, type and default value).
	 * The table itself has the field values set as attributes.
	 * @param {opentype.Table}
	 * @returns {Array}
	 */
	encode.TABLE = function(table) {
	    let d = [];
	    const length = table.fields.length;
	    const subtables = [];
	    const subtableOffsets = [];

	    for (let i = 0; i < length; i += 1) {
	        const field = table.fields[i];
	        const encodingFunction = encode[field.type];
	        check.argument(encodingFunction !== undefined, 'No encoding function for field type ' + field.type + ' (' + field.name + ')');
	        let value = table[field.name];
	        if (value === undefined) {
	            value = field.value;
	        }

	        const bytes = encodingFunction(value);

	        if (field.type === 'TABLE') {
	            subtableOffsets.push(d.length);
	            d = d.concat([0, 0]);
	            subtables.push(bytes);
	        } else {
	            d = d.concat(bytes);
	        }
	    }

	    for (let i = 0; i < subtables.length; i += 1) {
	        const o = subtableOffsets[i];
	        const offset = d.length;
	        check.argument(offset < 65536, 'Table ' + table.tableName + ' too big.');
	        d[o] = offset >> 8;
	        d[o + 1] = offset & 0xff;
	        d = d.concat(subtables[i]);
	    }

	    return d;
	};

	/**
	 * @param {opentype.Table}
	 * @returns {number}
	 */
	sizeOf.TABLE = function(table) {
	    let numBytes = 0;
	    const length = table.fields.length;

	    for (let i = 0; i < length; i += 1) {
	        const field = table.fields[i];
	        const sizeOfFunction = sizeOf[field.type];
	        check.argument(sizeOfFunction !== undefined, 'No sizeOf function for field type ' + field.type + ' (' + field.name + ')');
	        let value = table[field.name];
	        if (value === undefined) {
	            value = field.value;
	        }

	        numBytes += sizeOfFunction(value);

	        // Subtables take 2 more bytes for offsets.
	        if (field.type === 'TABLE') {
	            numBytes += 2;
	        }
	    }

	    return numBytes;
	};

	encode.RECORD = encode.TABLE;
	sizeOf.RECORD = sizeOf.TABLE;

	// Merge in a list of bytes.
	encode.LITERAL = function(v) {
	    return v;
	};

	sizeOf.LITERAL = function(v) {
	    return v.length;
	};

	// Table metadata

	/**
	 * @exports opentype.Table
	 * @class
	 * @param {string} tableName
	 * @param {Array} fields
	 * @param {Object} options
	 * @constructor
	 */
	function Table(tableName, fields, options) {
	    for (let i = 0; i < fields.length; i += 1) {
	        const field = fields[i];
	        this[field.name] = field.value;
	    }

	    this.tableName = tableName;
	    this.fields = fields;
	    if (options) {
	        const optionKeys = Object.keys(options);
	        for (let i = 0; i < optionKeys.length; i += 1) {
	            const k = optionKeys[i];
	            const v = options[k];
	            if (this[k] !== undefined) {
	                this[k] = v;
	            }
	        }
	    }
	}

	/**
	 * Encodes the table and returns an array of bytes
	 * @return {Array}
	 */
	Table.prototype.encode = function() {
	    return encode.TABLE(this);
	};

	/**
	 * Get the size of the table.
	 * @return {number}
	 */
	Table.prototype.sizeOf = function() {
	    return sizeOf.TABLE(this);
	};

	/**
	 * @private
	 */
	function ushortList(itemName, list, count) {
	    if (count === undefined) {
	        count = list.length;
	    }
	    const fields = new Array(list.length + 1);
	    fields[0] = {name: itemName + 'Count', type: 'USHORT', value: count};
	    for (let i = 0; i < list.length; i++) {
	        fields[i + 1] = {name: itemName + i, type: 'USHORT', value: list[i]};
	    }
	    return fields;
	}

	/**
	 * @private
	 */
	function tableList(itemName, records, itemCallback) {
	    const count = records.length;
	    const fields = new Array(count + 1);
	    fields[0] = {name: itemName + 'Count', type: 'USHORT', value: count};
	    for (let i = 0; i < count; i++) {
	        fields[i + 1] = {name: itemName + i, type: 'TABLE', value: itemCallback(records[i], i)};
	    }
	    return fields;
	}

	/**
	 * @private
	 */
	function recordList(itemName, records, itemCallback) {
	    const count = records.length;
	    let fields = [];
	    fields[0] = {name: itemName + 'Count', type: 'USHORT', value: count};
	    for (let i = 0; i < count; i++) {
	        fields = fields.concat(itemCallback(records[i], i));
	    }
	    return fields;
	}

	// Common Layout Tables

	/**
	 * @exports opentype.Coverage
	 * @class
	 * @param {opentype.Table}
	 * @constructor
	 * @extends opentype.Table
	 */
	function Coverage(coverageTable) {
	    if (coverageTable.format === 1) {
	        Table.call(this, 'coverageTable',
	            [{name: 'coverageFormat', type: 'USHORT', value: 1}]
	            .concat(ushortList('glyph', coverageTable.glyphs))
	        );
	    } else {
	        check.assert(false, 'Can\'t create coverage table format 2 yet.');
	    }
	}
	Coverage.prototype = Object.create(Table.prototype);
	Coverage.prototype.constructor = Coverage;

	function ScriptList(scriptListTable) {
	    Table.call(this, 'scriptListTable',
	        recordList('scriptRecord', scriptListTable, function(scriptRecord, i) {
	            const script = scriptRecord.script;
	            let defaultLangSys = script.defaultLangSys;
	            check.assert(!!defaultLangSys, 'Unable to write GSUB: script ' + scriptRecord.tag + ' has no default language system.');
	            return [
	                {name: 'scriptTag' + i, type: 'TAG', value: scriptRecord.tag},
	                {name: 'script' + i, type: 'TABLE', value: new Table('scriptTable', [
	                    {name: 'defaultLangSys', type: 'TABLE', value: new Table('defaultLangSys', [
	                        {name: 'lookupOrder', type: 'USHORT', value: 0},
	                        {name: 'reqFeatureIndex', type: 'USHORT', value: defaultLangSys.reqFeatureIndex}]
	                        .concat(ushortList('featureIndex', defaultLangSys.featureIndexes)))}
	                    ].concat(recordList('langSys', script.langSysRecords, function(langSysRecord, i) {
	                        const langSys = langSysRecord.langSys;
	                        return [
	                            {name: 'langSysTag' + i, type: 'TAG', value: langSysRecord.tag},
	                            {name: 'langSys' + i, type: 'TABLE', value: new Table('langSys', [
	                                {name: 'lookupOrder', type: 'USHORT', value: 0},
	                                {name: 'reqFeatureIndex', type: 'USHORT', value: langSys.reqFeatureIndex}
	                                ].concat(ushortList('featureIndex', langSys.featureIndexes)))}
	                        ];
	                    })))}
	            ];
	        })
	    );
	}
	ScriptList.prototype = Object.create(Table.prototype);
	ScriptList.prototype.constructor = ScriptList;

	/**
	 * @exports opentype.FeatureList
	 * @class
	 * @param {opentype.Table}
	 * @constructor
	 * @extends opentype.Table
	 */
	function FeatureList(featureListTable) {
	    Table.call(this, 'featureListTable',
	        recordList('featureRecord', featureListTable, function(featureRecord, i) {
	            const feature = featureRecord.feature;
	            return [
	                {name: 'featureTag' + i, type: 'TAG', value: featureRecord.tag},
	                {name: 'feature' + i, type: 'TABLE', value: new Table('featureTable', [
	                    {name: 'featureParams', type: 'USHORT', value: feature.featureParams},
	                    ].concat(ushortList('lookupListIndex', feature.lookupListIndexes)))}
	            ];
	        })
	    );
	}
	FeatureList.prototype = Object.create(Table.prototype);
	FeatureList.prototype.constructor = FeatureList;

	/**
	 * @exports opentype.LookupList
	 * @class
	 * @param {opentype.Table}
	 * @param {Object}
	 * @constructor
	 * @extends opentype.Table
	 */
	function LookupList(lookupListTable, subtableMakers) {
	    Table.call(this, 'lookupListTable', tableList('lookup', lookupListTable, function(lookupTable) {
	        let subtableCallback = subtableMakers[lookupTable.lookupType];
	        check.assert(!!subtableCallback, 'Unable to write GSUB lookup type ' + lookupTable.lookupType + ' tables.');
	        return new Table('lookupTable', [
	            {name: 'lookupType', type: 'USHORT', value: lookupTable.lookupType},
	            {name: 'lookupFlag', type: 'USHORT', value: lookupTable.lookupFlag}
	        ].concat(tableList('subtable', lookupTable.subtables, subtableCallback)));
	    }));
	}
	LookupList.prototype = Object.create(Table.prototype);
	LookupList.prototype.constructor = LookupList;

	// Record = same as Table, but inlined (a Table has an offset and its data is further in the stream)
	// Don't use offsets inside Records (probable bug), only in Tables.
	var table = {
	    Table,
	    Record: Table,
	    Coverage,
	    ScriptList,
	    FeatureList,
	    LookupList,
	    ushortList,
	    tableList,
	    recordList,
	};

	// Parsing utility functions

	// Retrieve an unsigned byte from the DataView.
	function getByte(dataView, offset) {
	    return dataView.getUint8(offset);
	}

	// Retrieve an unsigned 16-bit short from the DataView.
	// The value is stored in big endian.
	function getUShort(dataView, offset) {
	    return dataView.getUint16(offset, false);
	}

	// Retrieve a signed 16-bit short from the DataView.
	// The value is stored in big endian.
	function getShort(dataView, offset) {
	    return dataView.getInt16(offset, false);
	}

	// Retrieve an unsigned 32-bit long from the DataView.
	// The value is stored in big endian.
	function getULong(dataView, offset) {
	    return dataView.getUint32(offset, false);
	}

	// Retrieve a 32-bit signed fixed-point number (16.16) from the DataView.
	// The value is stored in big endian.
	function getFixed(dataView, offset) {
	    const decimal = dataView.getInt16(offset, false);
	    const fraction = dataView.getUint16(offset + 2, false);
	    return decimal + fraction / 65535;
	}

	// Retrieve a 4-character tag from the DataView.
	// Tags are used to identify tables.
	function getTag(dataView, offset) {
	    let tag = '';
	    for (let i = offset; i < offset + 4; i += 1) {
	        tag += String.fromCharCode(dataView.getInt8(i));
	    }

	    return tag;
	}

	// Retrieve an offset from the DataView.
	// Offsets are 1 to 4 bytes in length, depending on the offSize argument.
	function getOffset(dataView, offset, offSize) {
	    let v = 0;
	    for (let i = 0; i < offSize; i += 1) {
	        v <<= 8;
	        v += dataView.getUint8(offset + i);
	    }

	    return v;
	}

	// Retrieve a number of bytes from start offset to the end offset from the DataView.
	function getBytes(dataView, startOffset, endOffset) {
	    const bytes = [];
	    for (let i = startOffset; i < endOffset; i += 1) {
	        bytes.push(dataView.getUint8(i));
	    }

	    return bytes;
	}

	// Convert the list of bytes to a string.
	function bytesToString(bytes) {
	    let s = '';
	    for (let i = 0; i < bytes.length; i += 1) {
	        s += String.fromCharCode(bytes[i]);
	    }

	    return s;
	}

	const typeOffsets = {
	    byte: 1,
	    uShort: 2,
	    short: 2,
	    uLong: 4,
	    fixed: 4,
	    longDateTime: 8,
	    tag: 4
	};

	// A stateful parser that changes the offset whenever a value is retrieved.
	// The data is a DataView.
	function Parser(data, offset) {
	    this.data = data;
	    this.offset = offset;
	    this.relativeOffset = 0;
	}

	Parser.prototype.parseByte = function() {
	    const v = this.data.getUint8(this.offset + this.relativeOffset);
	    this.relativeOffset += 1;
	    return v;
	};

	Parser.prototype.parseChar = function() {
	    const v = this.data.getInt8(this.offset + this.relativeOffset);
	    this.relativeOffset += 1;
	    return v;
	};

	Parser.prototype.parseCard8 = Parser.prototype.parseByte;

	Parser.prototype.parseUShort = function() {
	    const v = this.data.getUint16(this.offset + this.relativeOffset);
	    this.relativeOffset += 2;
	    return v;
	};

	Parser.prototype.parseCard16 = Parser.prototype.parseUShort;
	Parser.prototype.parseSID = Parser.prototype.parseUShort;
	Parser.prototype.parseOffset16 = Parser.prototype.parseUShort;

	Parser.prototype.parseShort = function() {
	    const v = this.data.getInt16(this.offset + this.relativeOffset);
	    this.relativeOffset += 2;
	    return v;
	};

	Parser.prototype.parseF2Dot14 = function() {
	    const v = this.data.getInt16(this.offset + this.relativeOffset) / 16384;
	    this.relativeOffset += 2;
	    return v;
	};

	Parser.prototype.parseULong = function() {
	    const v = getULong(this.data, this.offset + this.relativeOffset);
	    this.relativeOffset += 4;
	    return v;
	};

	Parser.prototype.parseOffset32 = Parser.prototype.parseULong;

	Parser.prototype.parseFixed = function() {
	    const v = getFixed(this.data, this.offset + this.relativeOffset);
	    this.relativeOffset += 4;
	    return v;
	};

	Parser.prototype.parseString = function(length) {
	    const dataView = this.data;
	    const offset = this.offset + this.relativeOffset;
	    let string = '';
	    this.relativeOffset += length;
	    for (let i = 0; i < length; i++) {
	        string += String.fromCharCode(dataView.getUint8(offset + i));
	    }

	    return string;
	};

	Parser.prototype.parseTag = function() {
	    return this.parseString(4);
	};

	// LONGDATETIME is a 64-bit integer.
	// JavaScript and unix timestamps traditionally use 32 bits, so we
	// only take the last 32 bits.
	// + Since until 2038 those bits will be filled by zeros we can ignore them.
	Parser.prototype.parseLongDateTime = function() {
	    let v = getULong(this.data, this.offset + this.relativeOffset + 4);
	    // Subtract seconds between 01/01/1904 and 01/01/1970
	    // to convert Apple Mac timestamp to Standard Unix timestamp
	    v -= 2082844800;
	    this.relativeOffset += 8;
	    return v;
	};

	Parser.prototype.parseVersion = function(minorBase) {
	    const major = getUShort(this.data, this.offset + this.relativeOffset);

	    // How to interpret the minor version is very vague in the spec. 0x5000 is 5, 0x1000 is 1
	    // Default returns the correct number if minor = 0xN000 where N is 0-9
	    // Set minorBase to 1 for tables that use minor = N where N is 0-9
	    const minor = getUShort(this.data, this.offset + this.relativeOffset + 2);
	    this.relativeOffset += 4;
	    if (minorBase === undefined) minorBase = 0x1000;
	    return major + minor / minorBase / 10;
	};

	Parser.prototype.skip = function(type, amount) {
	    if (amount === undefined) {
	        amount = 1;
	    }

	    this.relativeOffset += typeOffsets[type] * amount;
	};

	///// Parsing lists and records ///////////////////////////////

	// Parse a list of 32 bit unsigned integers.
	Parser.prototype.parseULongList = function(count) {
	    if (count === undefined) { count = this.parseULong(); }
	    const offsets = new Array(count);
	    const dataView = this.data;
	    let offset = this.offset + this.relativeOffset;
	    for (let i = 0; i < count; i++) {
	        offsets[i] = dataView.getUint32(offset);
	        offset += 4;
	    }

	    this.relativeOffset += count * 4;
	    return offsets;
	};

	// Parse a list of 16 bit unsigned integers. The length of the list can be read on the stream
	// or provided as an argument.
	Parser.prototype.parseOffset16List =
	Parser.prototype.parseUShortList = function(count) {
	    if (count === undefined) { count = this.parseUShort(); }
	    const offsets = new Array(count);
	    const dataView = this.data;
	    let offset = this.offset + this.relativeOffset;
	    for (let i = 0; i < count; i++) {
	        offsets[i] = dataView.getUint16(offset);
	        offset += 2;
	    }

	    this.relativeOffset += count * 2;
	    return offsets;
	};

	// Parses a list of 16 bit signed integers.
	Parser.prototype.parseShortList = function(count) {
	    const list = new Array(count);
	    const dataView = this.data;
	    let offset = this.offset + this.relativeOffset;
	    for (let i = 0; i < count; i++) {
	        list[i] = dataView.getInt16(offset);
	        offset += 2;
	    }

	    this.relativeOffset += count * 2;
	    return list;
	};

	// Parses a list of bytes.
	Parser.prototype.parseByteList = function(count) {
	    const list = new Array(count);
	    const dataView = this.data;
	    let offset = this.offset + this.relativeOffset;
	    for (let i = 0; i < count; i++) {
	        list[i] = dataView.getUint8(offset++);
	    }

	    this.relativeOffset += count;
	    return list;
	};

	/**
	 * Parse a list of items.
	 * Record count is optional, if omitted it is read from the stream.
	 * itemCallback is one of the Parser methods.
	 */
	Parser.prototype.parseList = function(count, itemCallback) {
	    if (!itemCallback) {
	        itemCallback = count;
	        count = this.parseUShort();
	    }
	    const list = new Array(count);
	    for (let i = 0; i < count; i++) {
	        list[i] = itemCallback.call(this);
	    }
	    return list;
	};

	Parser.prototype.parseList32 = function(count, itemCallback) {
	    if (!itemCallback) {
	        itemCallback = count;
	        count = this.parseULong();
	    }
	    const list = new Array(count);
	    for (let i = 0; i < count; i++) {
	        list[i] = itemCallback.call(this);
	    }
	    return list;
	};

	/**
	 * Parse a list of records.
	 * Record count is optional, if omitted it is read from the stream.
	 * Example of recordDescription: { sequenceIndex: Parser.uShort, lookupListIndex: Parser.uShort }
	 */
	Parser.prototype.parseRecordList = function(count, recordDescription) {
	    // If the count argument is absent, read it in the stream.
	    if (!recordDescription) {
	        recordDescription = count;
	        count = this.parseUShort();
	    }
	    const records = new Array(count);
	    const fields = Object.keys(recordDescription);
	    for (let i = 0; i < count; i++) {
	        const rec = {};
	        for (let j = 0; j < fields.length; j++) {
	            const fieldName = fields[j];
	            const fieldType = recordDescription[fieldName];
	            rec[fieldName] = fieldType.call(this);
	        }
	        records[i] = rec;
	    }
	    return records;
	};

	Parser.prototype.parseRecordList32 = function(count, recordDescription) {
	    // If the count argument is absent, read it in the stream.
	    if (!recordDescription) {
	        recordDescription = count;
	        count = this.parseULong();
	    }
	    const records = new Array(count);
	    const fields = Object.keys(recordDescription);
	    for (let i = 0; i < count; i++) {
	        const rec = {};
	        for (let j = 0; j < fields.length; j++) {
	            const fieldName = fields[j];
	            const fieldType = recordDescription[fieldName];
	            rec[fieldName] = fieldType.call(this);
	        }
	        records[i] = rec;
	    }
	    return records;
	};

	// Parse a data structure into an object
	// Example of description: { sequenceIndex: Parser.uShort, lookupListIndex: Parser.uShort }
	Parser.prototype.parseStruct = function(description) {
	    if (typeof description === 'function') {
	        return description.call(this);
	    } else {
	        const fields = Object.keys(description);
	        const struct = {};
	        for (let j = 0; j < fields.length; j++) {
	            const fieldName = fields[j];
	            const fieldType = description[fieldName];
	            struct[fieldName] = fieldType.call(this);
	        }
	        return struct;
	    }
	};

	/**
	 * Parse a GPOS valueRecord
	 * https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#value-record
	 * valueFormat is optional, if omitted it is read from the stream.
	 */
	Parser.prototype.parseValueRecord = function(valueFormat) {
	    if (valueFormat === undefined) {
	        valueFormat = this.parseUShort();
	    }
	    if (valueFormat === 0) {
	        // valueFormat2 in kerning pairs is most often 0
	        // in this case return undefined instead of an empty object, to save space
	        return;
	    }
	    const valueRecord = {};

	    if (valueFormat & 0x0001) { valueRecord.xPlacement = this.parseShort(); }
	    if (valueFormat & 0x0002) { valueRecord.yPlacement = this.parseShort(); }
	    if (valueFormat & 0x0004) { valueRecord.xAdvance = this.parseShort(); }
	    if (valueFormat & 0x0008) { valueRecord.yAdvance = this.parseShort(); }

	    // Device table (non-variable font) / VariationIndex table (variable font) not supported
	    // https://docs.microsoft.com/fr-fr/typography/opentype/spec/chapter2#devVarIdxTbls
	    if (valueFormat & 0x0010) { valueRecord.xPlaDevice = undefined; this.parseShort(); }
	    if (valueFormat & 0x0020) { valueRecord.yPlaDevice = undefined; this.parseShort(); }
	    if (valueFormat & 0x0040) { valueRecord.xAdvDevice = undefined; this.parseShort(); }
	    if (valueFormat & 0x0080) { valueRecord.yAdvDevice = undefined; this.parseShort(); }

	    return valueRecord;
	};

	/**
	 * Parse a list of GPOS valueRecords
	 * https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#value-record
	 * valueFormat and valueCount are read from the stream.
	 */
	Parser.prototype.parseValueRecordList = function() {
	    const valueFormat = this.parseUShort();
	    const valueCount = this.parseUShort();
	    const values = new Array(valueCount);
	    for (let i = 0; i < valueCount; i++) {
	        values[i] = this.parseValueRecord(valueFormat);
	    }
	    return values;
	};

	Parser.prototype.parsePointer = function(description) {
	    const structOffset = this.parseOffset16();
	    if (structOffset > 0) {
	        // NULL offset => return undefined
	        return new Parser(this.data, this.offset + structOffset).parseStruct(description);
	    }
	    return undefined;
	};

	Parser.prototype.parsePointer32 = function(description) {
	    const structOffset = this.parseOffset32();
	    if (structOffset > 0) {
	        // NULL offset => return undefined
	        return new Parser(this.data, this.offset + structOffset).parseStruct(description);
	    }
	    return undefined;
	};

	/**
	 * Parse a list of offsets to lists of 16-bit integers,
	 * or a list of offsets to lists of offsets to any kind of items.
	 * If itemCallback is not provided, a list of list of UShort is assumed.
	 * If provided, itemCallback is called on each item and must parse the item.
	 * See examples in tables/gsub.js
	 */
	Parser.prototype.parseListOfLists = function(itemCallback) {
	    const offsets = this.parseOffset16List();
	    const count = offsets.length;
	    const relativeOffset = this.relativeOffset;
	    const list = new Array(count);
	    for (let i = 0; i < count; i++) {
	        const start = offsets[i];
	        if (start === 0) {
	            // NULL offset
	            // Add i as owned property to list. Convenient with assert.
	            list[i] = undefined;
	            continue;
	        }
	        this.relativeOffset = start;
	        if (itemCallback) {
	            const subOffsets = this.parseOffset16List();
	            const subList = new Array(subOffsets.length);
	            for (let j = 0; j < subOffsets.length; j++) {
	                this.relativeOffset = start + subOffsets[j];
	                subList[j] = itemCallback.call(this);
	            }
	            list[i] = subList;
	        } else {
	            list[i] = this.parseUShortList();
	        }
	    }
	    this.relativeOffset = relativeOffset;
	    return list;
	};

	///// Complex tables parsing //////////////////////////////////

	// Parse a coverage table in a GSUB, GPOS or GDEF table.
	// https://www.microsoft.com/typography/OTSPEC/chapter2.htm
	// parser.offset must point to the start of the table containing the coverage.
	Parser.prototype.parseCoverage = function() {
	    const startOffset = this.offset + this.relativeOffset;
	    const format = this.parseUShort();
	    const count = this.parseUShort();
	    if (format === 1) {
	        return {
	            format: 1,
	            glyphs: this.parseUShortList(count)
	        };
	    } else if (format === 2) {
	        const ranges = new Array(count);
	        for (let i = 0; i < count; i++) {
	            ranges[i] = {
	                start: this.parseUShort(),
	                end: this.parseUShort(),
	                index: this.parseUShort()
	            };
	        }
	        return {
	            format: 2,
	            ranges: ranges
	        };
	    }
	    throw new Error('0x' + startOffset.toString(16) + ': Coverage format must be 1 or 2.');
	};

	// Parse a Class Definition Table in a GSUB, GPOS or GDEF table.
	// https://www.microsoft.com/typography/OTSPEC/chapter2.htm
	Parser.prototype.parseClassDef = function() {
	    const startOffset = this.offset + this.relativeOffset;
	    const format = this.parseUShort();
	    if (format === 1) {
	        return {
	            format: 1,
	            startGlyph: this.parseUShort(),
	            classes: this.parseUShortList()
	        };
	    } else if (format === 2) {
	        return {
	            format: 2,
	            ranges: this.parseRecordList({
	                start: Parser.uShort,
	                end: Parser.uShort,
	                classId: Parser.uShort
	            })
	        };
	    }
	    throw new Error('0x' + startOffset.toString(16) + ': ClassDef format must be 1 or 2.');
	};

	///// Static methods ///////////////////////////////////
	// These convenience methods can be used as callbacks and should be called with "this" context set to a Parser instance.

	Parser.list = function(count, itemCallback) {
	    return function() {
	        return this.parseList(count, itemCallback);
	    };
	};

	Parser.list32 = function(count, itemCallback) {
	    return function() {
	        return this.parseList32(count, itemCallback);
	    };
	};

	Parser.recordList = function(count, recordDescription) {
	    return function() {
	        return this.parseRecordList(count, recordDescription);
	    };
	};

	Parser.recordList32 = function(count, recordDescription) {
	    return function() {
	        return this.parseRecordList32(count, recordDescription);
	    };
	};

	Parser.pointer = function(description) {
	    return function() {
	        return this.parsePointer(description);
	    };
	};

	Parser.pointer32 = function(description) {
	    return function() {
	        return this.parsePointer32(description);
	    };
	};

	Parser.tag = Parser.prototype.parseTag;
	Parser.byte = Parser.prototype.parseByte;
	Parser.uShort = Parser.offset16 = Parser.prototype.parseUShort;
	Parser.uShortList = Parser.prototype.parseUShortList;
	Parser.uLong = Parser.offset32 = Parser.prototype.parseULong;
	Parser.uLongList = Parser.prototype.parseULongList;
	Parser.struct = Parser.prototype.parseStruct;
	Parser.coverage = Parser.prototype.parseCoverage;
	Parser.classDef = Parser.prototype.parseClassDef;

	///// Script, Feature, Lookup lists ///////////////////////////////////////////////
	// https://www.microsoft.com/typography/OTSPEC/chapter2.htm

	const langSysTable = {
	    reserved: Parser.uShort,
	    reqFeatureIndex: Parser.uShort,
	    featureIndexes: Parser.uShortList
	};

	Parser.prototype.parseScriptList = function() {
	    return this.parsePointer(Parser.recordList({
	        tag: Parser.tag,
	        script: Parser.pointer({
	            defaultLangSys: Parser.pointer(langSysTable),
	            langSysRecords: Parser.recordList({
	                tag: Parser.tag,
	                langSys: Parser.pointer(langSysTable)
	            })
	        })
	    })) || [];
	};

	Parser.prototype.parseFeatureList = function() {
	    return this.parsePointer(Parser.recordList({
	        tag: Parser.tag,
	        feature: Parser.pointer({
	            featureParams: Parser.offset16,
	            lookupListIndexes: Parser.uShortList
	        })
	    })) || [];
	};

	Parser.prototype.parseLookupList = function(lookupTableParsers) {
	    return this.parsePointer(Parser.list(Parser.pointer(function() {
	        const lookupType = this.parseUShort();
	        check.argument(1 <= lookupType && lookupType <= 9, 'GPOS/GSUB lookup type ' + lookupType + ' unknown.');
	        const lookupFlag = this.parseUShort();
	        const useMarkFilteringSet = lookupFlag & 0x10;
	        return {
	            lookupType: lookupType,
	            lookupFlag: lookupFlag,
	            subtables: this.parseList(Parser.pointer(lookupTableParsers[lookupType])),
	            markFilteringSet: useMarkFilteringSet ? this.parseUShort() : undefined
	        };
	    }))) || [];
	};

	Parser.prototype.parseFeatureVariationsList = function() {
	    return this.parsePointer32(function() {
	        const majorVersion = this.parseUShort();
	        const minorVersion = this.parseUShort();
	        check.argument(majorVersion === 1 && minorVersion < 1, 'GPOS/GSUB feature variations table unknown.');
	        const featureVariations = this.parseRecordList32({
	            conditionSetOffset: Parser.offset32,
	            featureTableSubstitutionOffset: Parser.offset32
	        });
	        return featureVariations;
	    }) || [];
	};

	var parse = {
	    getByte,
	    getCard8: getByte,
	    getUShort,
	    getCard16: getUShort,
	    getShort,
	    getULong,
	    getFixed,
	    getTag,
	    getOffset,
	    getBytes,
	    bytesToString,
	    Parser,
	};

	// The `cmap` table stores the mappings from characters to glyphs.

	function parseCmapTableFormat12(cmap, p) {
	    //Skip reserved.
	    p.parseUShort();

	    // Length in bytes of the sub-tables.
	    cmap.length = p.parseULong();
	    cmap.language = p.parseULong();

	    let groupCount;
	    cmap.groupCount = groupCount = p.parseULong();
	    cmap.glyphIndexMap = {};

	    for (let i = 0; i < groupCount; i += 1) {
	        const startCharCode = p.parseULong();
	        const endCharCode = p.parseULong();
	        let startGlyphId = p.parseULong();

	        for (let c = startCharCode; c <= endCharCode; c += 1) {
	            cmap.glyphIndexMap[c] = startGlyphId;
	            startGlyphId++;
	        }
	    }
	}

	function parseCmapTableFormat4(cmap, p, data, start, offset) {
	    // Length in bytes of the sub-tables.
	    cmap.length = p.parseUShort();
	    cmap.language = p.parseUShort();

	    // segCount is stored x 2.
	    let segCount;
	    cmap.segCount = segCount = p.parseUShort() >> 1;

	    // Skip searchRange, entrySelector, rangeShift.
	    p.skip('uShort', 3);

	    // The "unrolled" mapping from character codes to glyph indices.
	    cmap.glyphIndexMap = {};
	    const endCountParser = new parse.Parser(data, start + offset + 14);
	    const startCountParser = new parse.Parser(data, start + offset + 16 + segCount * 2);
	    const idDeltaParser = new parse.Parser(data, start + offset + 16 + segCount * 4);
	    const idRangeOffsetParser = new parse.Parser(data, start + offset + 16 + segCount * 6);
	    let glyphIndexOffset = start + offset + 16 + segCount * 8;
	    for (let i = 0; i < segCount - 1; i += 1) {
	        let glyphIndex;
	        const endCount = endCountParser.parseUShort();
	        const startCount = startCountParser.parseUShort();
	        const idDelta = idDeltaParser.parseShort();
	        const idRangeOffset = idRangeOffsetParser.parseUShort();
	        for (let c = startCount; c <= endCount; c += 1) {
	            if (idRangeOffset !== 0) {
	                // The idRangeOffset is relative to the current position in the idRangeOffset array.
	                // Take the current offset in the idRangeOffset array.
	                glyphIndexOffset = (idRangeOffsetParser.offset + idRangeOffsetParser.relativeOffset - 2);

	                // Add the value of the idRangeOffset, which will move us into the glyphIndex array.
	                glyphIndexOffset += idRangeOffset;

	                // Then add the character index of the current segment, multiplied by 2 for USHORTs.
	                glyphIndexOffset += (c - startCount) * 2;
	                glyphIndex = parse.getUShort(data, glyphIndexOffset);
	                if (glyphIndex !== 0) {
	                    glyphIndex = (glyphIndex + idDelta) & 0xFFFF;
	                }
	            } else {
	                glyphIndex = (c + idDelta) & 0xFFFF;
	            }

	            cmap.glyphIndexMap[c] = glyphIndex;
	        }
	    }
	}

	// Parse the `cmap` table. This table stores the mappings from characters to glyphs.
	// There are many available formats, but we only support the Windows format 4 and 12.
	// This function returns a `CmapEncoding` object or null if no supported format could be found.
	function parseCmapTable(data, start) {
	    const cmap = {};
	    cmap.version = parse.getUShort(data, start);
	    check.argument(cmap.version === 0, 'cmap table version should be 0.');

	    // The cmap table can contain many sub-tables, each with their own format.
	    // We're only interested in a "platform 0" (Unicode format) and "platform 3" (Windows format) table.
	    cmap.numTables = parse.getUShort(data, start + 2);
	    let offset = -1;
	    for (let i = cmap.numTables - 1; i >= 0; i -= 1) {
	        const platformId = parse.getUShort(data, start + 4 + (i * 8));
	        const encodingId = parse.getUShort(data, start + 4 + (i * 8) + 2);
	        if ((platformId === 3 && (encodingId === 0 || encodingId === 1 || encodingId === 10)) ||
	            (platformId === 0 && (encodingId === 0 || encodingId === 1 || encodingId === 2 || encodingId === 3 || encodingId === 4))) {
	            offset = parse.getULong(data, start + 4 + (i * 8) + 4);
	            break;
	        }
	    }

	    if (offset === -1) {
	        // There is no cmap table in the font that we support.
	        throw new Error('No valid cmap sub-tables found.');
	    }

	    const p = new parse.Parser(data, start + offset);
	    cmap.format = p.parseUShort();

	    if (cmap.format === 12) {
	        parseCmapTableFormat12(cmap, p);
	    } else if (cmap.format === 4) {
	        parseCmapTableFormat4(cmap, p, data, start, offset);
	    } else {
	        throw new Error('Only format 4 and 12 cmap tables are supported (found format ' + cmap.format + ').');
	    }

	    return cmap;
	}

	function addSegment(t, code, glyphIndex) {
	    t.segments.push({
	        end: code,
	        start: code,
	        delta: -(code - glyphIndex),
	        offset: 0,
	        glyphIndex: glyphIndex
	    });
	}

	function addTerminatorSegment(t) {
	    t.segments.push({
	        end: 0xFFFF,
	        start: 0xFFFF,
	        delta: 1,
	        offset: 0
	    });
	}

	// Make cmap table, format 4 by default, 12 if needed only
	function makeCmapTable(glyphs) {
	    // Plan 0 is the base Unicode Plan but emojis, for example are on another plan, and needs cmap 12 format (with 32bit)
	    let isPlan0Only = true;
	    let i;

	    // Check if we need to add cmap format 12 or if format 4 only is fine
	    for (i = glyphs.length - 1; i > 0; i -= 1) {
	        const g = glyphs.get(i);
	        if (g.unicode > 65535) {
	            console.log('Adding CMAP format 12 (needed!)');
	            isPlan0Only = false;
	            break;
	        }
	    }

	    let cmapTable = [
	        {name: 'version', type: 'USHORT', value: 0},
	        {name: 'numTables', type: 'USHORT', value: isPlan0Only ? 1 : 2},

	        // CMAP 4 header
	        {name: 'platformID', type: 'USHORT', value: 3},
	        {name: 'encodingID', type: 'USHORT', value: 1},
	        {name: 'offset', type: 'ULONG', value: isPlan0Only ? 12 : (12 + 8)}
	    ];

	    if (!isPlan0Only)
	        cmapTable = cmapTable.concat([
	            // CMAP 12 header
	            {name: 'cmap12PlatformID', type: 'USHORT', value: 3}, // We encode only for PlatformID = 3 (Windows) because it is supported everywhere
	            {name: 'cmap12EncodingID', type: 'USHORT', value: 10},
	            {name: 'cmap12Offset', type: 'ULONG', value: 0}
	        ]);

	    cmapTable = cmapTable.concat([
	        // CMAP 4 Subtable
	        {name: 'format', type: 'USHORT', value: 4},
	        {name: 'cmap4Length', type: 'USHORT', value: 0},
	        {name: 'language', type: 'USHORT', value: 0},
	        {name: 'segCountX2', type: 'USHORT', value: 0},
	        {name: 'searchRange', type: 'USHORT', value: 0},
	        {name: 'entrySelector', type: 'USHORT', value: 0},
	        {name: 'rangeShift', type: 'USHORT', value: 0}
	    ]);

	    const t = new table.Table('cmap', cmapTable);

	    t.segments = [];
	    for (i = 0; i < glyphs.length; i += 1) {
	        const glyph = glyphs.get(i);
	        for (let j = 0; j < glyph.unicodes.length; j += 1) {
	            addSegment(t, glyph.unicodes[j], i);
	        }

	        t.segments = t.segments.sort(function (a, b) {
	            return a.start - b.start;
	        });
	    }

	    addTerminatorSegment(t);

	    const segCount = t.segments.length;
	    let segCountToRemove = 0;

	    // CMAP 4
	    // Set up parallel segment arrays.
	    let endCounts = [];
	    let startCounts = [];
	    let idDeltas = [];
	    let idRangeOffsets = [];
	    let glyphIds = [];

	    // CMAP 12
	    let cmap12Groups = [];

	    // Reminder this loop is not following the specification at 100%
	    // The specification -> find suites of characters and make a group
	    // Here we're doing one group for each letter
	    // Doing as the spec can save 8 times (or more) space
	    for (i = 0; i < segCount; i += 1) {
	        const segment = t.segments[i];

	        // CMAP 4
	        if (segment.end <= 65535 && segment.start <= 65535) {
	            endCounts = endCounts.concat({name: 'end_' + i, type: 'USHORT', value: segment.end});
	            startCounts = startCounts.concat({name: 'start_' + i, type: 'USHORT', value: segment.start});
	            idDeltas = idDeltas.concat({name: 'idDelta_' + i, type: 'SHORT', value: segment.delta});
	            idRangeOffsets = idRangeOffsets.concat({name: 'idRangeOffset_' + i, type: 'USHORT', value: segment.offset});
	            if (segment.glyphId !== undefined) {
	                glyphIds = glyphIds.concat({name: 'glyph_' + i, type: 'USHORT', value: segment.glyphId});
	            }
	        } else {
	            // Skip Unicode > 65535 (16bit unsigned max) for CMAP 4, will be added in CMAP 12
	            segCountToRemove += 1;
	        }

	        // CMAP 12
	        // Skip Terminator Segment
	        if (!isPlan0Only && segment.glyphIndex !== undefined) {
	            cmap12Groups = cmap12Groups.concat({name: 'cmap12Start_' + i, type: 'ULONG', value: segment.start});
	            cmap12Groups = cmap12Groups.concat({name: 'cmap12End_' + i, type: 'ULONG', value: segment.end});
	            cmap12Groups = cmap12Groups.concat({name: 'cmap12Glyph_' + i, type: 'ULONG', value: segment.glyphIndex});
	        }
	    }

	    // CMAP 4 Subtable
	    t.segCountX2 = (segCount - segCountToRemove) * 2;
	    t.searchRange = Math.pow(2, Math.floor(Math.log((segCount - segCountToRemove)) / Math.log(2))) * 2;
	    t.entrySelector = Math.log(t.searchRange / 2) / Math.log(2);
	    t.rangeShift = t.segCountX2 - t.searchRange;

	    t.fields = t.fields.concat(endCounts);
	    t.fields.push({name: 'reservedPad', type: 'USHORT', value: 0});
	    t.fields = t.fields.concat(startCounts);
	    t.fields = t.fields.concat(idDeltas);
	    t.fields = t.fields.concat(idRangeOffsets);
	    t.fields = t.fields.concat(glyphIds);

	    t.cmap4Length = 14 + // Subtable header
	        endCounts.length * 2 +
	        2 + // reservedPad
	        startCounts.length * 2 +
	        idDeltas.length * 2 +
	        idRangeOffsets.length * 2 +
	        glyphIds.length * 2;

	    if (!isPlan0Only) {
	        // CMAP 12 Subtable
	        const cmap12Length = 16 + // Subtable header
	            cmap12Groups.length * 4;

	        t.cmap12Offset = 12 + (2 * 2) + 4 + t.cmap4Length;
	        t.fields = t.fields.concat([
	            {name: 'cmap12Format', type: 'USHORT', value: 12},
	            {name: 'cmap12Reserved', type: 'USHORT', value: 0},
	            {name: 'cmap12Length', type: 'ULONG', value: cmap12Length},
	            {name: 'cmap12Language', type: 'ULONG', value: 0},
	            {name: 'cmap12nGroups', type: 'ULONG', value: cmap12Groups.length / 3}
	        ]);

	        t.fields = t.fields.concat(cmap12Groups);
	    }

	    return t;
	}

	var cmap = { parse: parseCmapTable, make: makeCmapTable };

	// Glyph encoding

	const cffStandardStrings = [
	    '.notdef', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent', 'ampersand', 'quoteright',
	    'parenleft', 'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash', 'zero', 'one', 'two',
	    'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less', 'equal', 'greater',
	    'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
	    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
	    'quoteleft', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
	    'u', 'v', 'w', 'x', 'y', 'z', 'braceleft', 'bar', 'braceright', 'asciitilde', 'exclamdown', 'cent', 'sterling',
	    'fraction', 'yen', 'florin', 'section', 'currency', 'quotesingle', 'quotedblleft', 'guillemotleft',
	    'guilsinglleft', 'guilsinglright', 'fi', 'fl', 'endash', 'dagger', 'daggerdbl', 'periodcentered', 'paragraph',
	    'bullet', 'quotesinglbase', 'quotedblbase', 'quotedblright', 'guillemotright', 'ellipsis', 'perthousand',
	    'questiondown', 'grave', 'acute', 'circumflex', 'tilde', 'macron', 'breve', 'dotaccent', 'dieresis', 'ring',
	    'cedilla', 'hungarumlaut', 'ogonek', 'caron', 'emdash', 'AE', 'ordfeminine', 'Lslash', 'Oslash', 'OE',
	    'ordmasculine', 'ae', 'dotlessi', 'lslash', 'oslash', 'oe', 'germandbls', 'onesuperior', 'logicalnot', 'mu',
	    'trademark', 'Eth', 'onehalf', 'plusminus', 'Thorn', 'onequarter', 'divide', 'brokenbar', 'degree', 'thorn',
	    'threequarters', 'twosuperior', 'registered', 'minus', 'eth', 'multiply', 'threesuperior', 'copyright',
	    'Aacute', 'Acircumflex', 'Adieresis', 'Agrave', 'Aring', 'Atilde', 'Ccedilla', 'Eacute', 'Ecircumflex',
	    'Edieresis', 'Egrave', 'Iacute', 'Icircumflex', 'Idieresis', 'Igrave', 'Ntilde', 'Oacute', 'Ocircumflex',
	    'Odieresis', 'Ograve', 'Otilde', 'Scaron', 'Uacute', 'Ucircumflex', 'Udieresis', 'Ugrave', 'Yacute',
	    'Ydieresis', 'Zcaron', 'aacute', 'acircumflex', 'adieresis', 'agrave', 'aring', 'atilde', 'ccedilla', 'eacute',
	    'ecircumflex', 'edieresis', 'egrave', 'iacute', 'icircumflex', 'idieresis', 'igrave', 'ntilde', 'oacute',
	    'ocircumflex', 'odieresis', 'ograve', 'otilde', 'scaron', 'uacute', 'ucircumflex', 'udieresis', 'ugrave',
	    'yacute', 'ydieresis', 'zcaron', 'exclamsmall', 'Hungarumlautsmall', 'dollaroldstyle', 'dollarsuperior',
	    'ampersandsmall', 'Acutesmall', 'parenleftsuperior', 'parenrightsuperior', '266 ff', 'onedotenleader',
	    'zerooldstyle', 'oneoldstyle', 'twooldstyle', 'threeoldstyle', 'fouroldstyle', 'fiveoldstyle', 'sixoldstyle',
	    'sevenoldstyle', 'eightoldstyle', 'nineoldstyle', 'commasuperior', 'threequartersemdash', 'periodsuperior',
	    'questionsmall', 'asuperior', 'bsuperior', 'centsuperior', 'dsuperior', 'esuperior', 'isuperior', 'lsuperior',
	    'msuperior', 'nsuperior', 'osuperior', 'rsuperior', 'ssuperior', 'tsuperior', 'ff', 'ffi', 'ffl',
	    'parenleftinferior', 'parenrightinferior', 'Circumflexsmall', 'hyphensuperior', 'Gravesmall', 'Asmall',
	    'Bsmall', 'Csmall', 'Dsmall', 'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall', 'Jsmall', 'Ksmall', 'Lsmall',
	    'Msmall', 'Nsmall', 'Osmall', 'Psmall', 'Qsmall', 'Rsmall', 'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall',
	    'Xsmall', 'Ysmall', 'Zsmall', 'colonmonetary', 'onefitted', 'rupiah', 'Tildesmall', 'exclamdownsmall',
	    'centoldstyle', 'Lslashsmall', 'Scaronsmall', 'Zcaronsmall', 'Dieresissmall', 'Brevesmall', 'Caronsmall',
	    'Dotaccentsmall', 'Macronsmall', 'figuredash', 'hypheninferior', 'Ogoneksmall', 'Ringsmall', 'Cedillasmall',
	    'questiondownsmall', 'oneeighth', 'threeeighths', 'fiveeighths', 'seveneighths', 'onethird', 'twothirds',
	    'zerosuperior', 'foursuperior', 'fivesuperior', 'sixsuperior', 'sevensuperior', 'eightsuperior', 'ninesuperior',
	    'zeroinferior', 'oneinferior', 'twoinferior', 'threeinferior', 'fourinferior', 'fiveinferior', 'sixinferior',
	    'seveninferior', 'eightinferior', 'nineinferior', 'centinferior', 'dollarinferior', 'periodinferior',
	    'commainferior', 'Agravesmall', 'Aacutesmall', 'Acircumflexsmall', 'Atildesmall', 'Adieresissmall',
	    'Aringsmall', 'AEsmall', 'Ccedillasmall', 'Egravesmall', 'Eacutesmall', 'Ecircumflexsmall', 'Edieresissmall',
	    'Igravesmall', 'Iacutesmall', 'Icircumflexsmall', 'Idieresissmall', 'Ethsmall', 'Ntildesmall', 'Ogravesmall',
	    'Oacutesmall', 'Ocircumflexsmall', 'Otildesmall', 'Odieresissmall', 'OEsmall', 'Oslashsmall', 'Ugravesmall',
	    'Uacutesmall', 'Ucircumflexsmall', 'Udieresissmall', 'Yacutesmall', 'Thornsmall', 'Ydieresissmall', '001.000',
	    '001.001', '001.002', '001.003', 'Black', 'Bold', 'Book', 'Light', 'Medium', 'Regular', 'Roman', 'Semibold'];

	const cffStandardEncoding = [
	    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
	    '', '', '', '', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent', 'ampersand', 'quoteright',
	    'parenleft', 'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash', 'zero', 'one', 'two',
	    'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less', 'equal', 'greater',
	    'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
	    'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright', 'asciicircum', 'underscore',
	    'quoteleft', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
	    'u', 'v', 'w', 'x', 'y', 'z', 'braceleft', 'bar', 'braceright', 'asciitilde', '', '', '', '', '', '', '', '',
	    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
	    'exclamdown', 'cent', 'sterling', 'fraction', 'yen', 'florin', 'section', 'currency', 'quotesingle',
	    'quotedblleft', 'guillemotleft', 'guilsinglleft', 'guilsinglright', 'fi', 'fl', '', 'endash', 'dagger',
	    'daggerdbl', 'periodcentered', '', 'paragraph', 'bullet', 'quotesinglbase', 'quotedblbase', 'quotedblright',
	    'guillemotright', 'ellipsis', 'perthousand', '', 'questiondown', '', 'grave', 'acute', 'circumflex', 'tilde',
	    'macron', 'breve', 'dotaccent', 'dieresis', '', 'ring', 'cedilla', '', 'hungarumlaut', 'ogonek', 'caron',
	    'emdash', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'AE', '', 'ordfeminine', '', '', '',
	    '', 'Lslash', 'Oslash', 'OE', 'ordmasculine', '', '', '', '', '', 'ae', '', '', '', 'dotlessi', '', '',
	    'lslash', 'oslash', 'oe', 'germandbls'];

	const cffExpertEncoding = [
	    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
	    '', '', '', '', 'space', 'exclamsmall', 'Hungarumlautsmall', '', 'dollaroldstyle', 'dollarsuperior',
	    'ampersandsmall', 'Acutesmall', 'parenleftsuperior', 'parenrightsuperior', 'twodotenleader', 'onedotenleader',
	    'comma', 'hyphen', 'period', 'fraction', 'zerooldstyle', 'oneoldstyle', 'twooldstyle', 'threeoldstyle',
	    'fouroldstyle', 'fiveoldstyle', 'sixoldstyle', 'sevenoldstyle', 'eightoldstyle', 'nineoldstyle', 'colon',
	    'semicolon', 'commasuperior', 'threequartersemdash', 'periodsuperior', 'questionsmall', '', 'asuperior',
	    'bsuperior', 'centsuperior', 'dsuperior', 'esuperior', '', '', 'isuperior', '', '', 'lsuperior', 'msuperior',
	    'nsuperior', 'osuperior', '', '', 'rsuperior', 'ssuperior', 'tsuperior', '', 'ff', 'fi', 'fl', 'ffi', 'ffl',
	    'parenleftinferior', '', 'parenrightinferior', 'Circumflexsmall', 'hyphensuperior', 'Gravesmall', 'Asmall',
	    'Bsmall', 'Csmall', 'Dsmall', 'Esmall', 'Fsmall', 'Gsmall', 'Hsmall', 'Ismall', 'Jsmall', 'Ksmall', 'Lsmall',
	    'Msmall', 'Nsmall', 'Osmall', 'Psmall', 'Qsmall', 'Rsmall', 'Ssmall', 'Tsmall', 'Usmall', 'Vsmall', 'Wsmall',
	    'Xsmall', 'Ysmall', 'Zsmall', 'colonmonetary', 'onefitted', 'rupiah', 'Tildesmall', '', '', '', '', '', '', '',
	    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
	    'exclamdownsmall', 'centoldstyle', 'Lslashsmall', '', '', 'Scaronsmall', 'Zcaronsmall', 'Dieresissmall',
	    'Brevesmall', 'Caronsmall', '', 'Dotaccentsmall', '', '', 'Macronsmall', '', '', 'figuredash', 'hypheninferior',
	    '', '', 'Ogoneksmall', 'Ringsmall', 'Cedillasmall', '', '', '', 'onequarter', 'onehalf', 'threequarters',
	    'questiondownsmall', 'oneeighth', 'threeeighths', 'fiveeighths', 'seveneighths', 'onethird', 'twothirds', '',
	    '', 'zerosuperior', 'onesuperior', 'twosuperior', 'threesuperior', 'foursuperior', 'fivesuperior',
	    'sixsuperior', 'sevensuperior', 'eightsuperior', 'ninesuperior', 'zeroinferior', 'oneinferior', 'twoinferior',
	    'threeinferior', 'fourinferior', 'fiveinferior', 'sixinferior', 'seveninferior', 'eightinferior',
	    'nineinferior', 'centinferior', 'dollarinferior', 'periodinferior', 'commainferior', 'Agravesmall',
	    'Aacutesmall', 'Acircumflexsmall', 'Atildesmall', 'Adieresissmall', 'Aringsmall', 'AEsmall', 'Ccedillasmall',
	    'Egravesmall', 'Eacutesmall', 'Ecircumflexsmall', 'Edieresissmall', 'Igravesmall', 'Iacutesmall',
	    'Icircumflexsmall', 'Idieresissmall', 'Ethsmall', 'Ntildesmall', 'Ogravesmall', 'Oacutesmall',
	    'Ocircumflexsmall', 'Otildesmall', 'Odieresissmall', 'OEsmall', 'Oslashsmall', 'Ugravesmall', 'Uacutesmall',
	    'Ucircumflexsmall', 'Udieresissmall', 'Yacutesmall', 'Thornsmall', 'Ydieresissmall'];

	const standardNames = [
	    '.notdef', '.null', 'nonmarkingreturn', 'space', 'exclam', 'quotedbl', 'numbersign', 'dollar', 'percent',
	    'ampersand', 'quotesingle', 'parenleft', 'parenright', 'asterisk', 'plus', 'comma', 'hyphen', 'period', 'slash',
	    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'colon', 'semicolon', 'less',
	    'equal', 'greater', 'question', 'at', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
	    'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'bracketleft', 'backslash', 'bracketright',
	    'asciicircum', 'underscore', 'grave', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
	    'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'braceleft', 'bar', 'braceright', 'asciitilde',
	    'Adieresis', 'Aring', 'Ccedilla', 'Eacute', 'Ntilde', 'Odieresis', 'Udieresis', 'aacute', 'agrave',
	    'acircumflex', 'adieresis', 'atilde', 'aring', 'ccedilla', 'eacute', 'egrave', 'ecircumflex', 'edieresis',
	    'iacute', 'igrave', 'icircumflex', 'idieresis', 'ntilde', 'oacute', 'ograve', 'ocircumflex', 'odieresis',
	    'otilde', 'uacute', 'ugrave', 'ucircumflex', 'udieresis', 'dagger', 'degree', 'cent', 'sterling', 'section',
	    'bullet', 'paragraph', 'germandbls', 'registered', 'copyright', 'trademark', 'acute', 'dieresis', 'notequal',
	    'AE', 'Oslash', 'infinity', 'plusminus', 'lessequal', 'greaterequal', 'yen', 'mu', 'partialdiff', 'summation',
	    'product', 'pi', 'integral', 'ordfeminine', 'ordmasculine', 'Omega', 'ae', 'oslash', 'questiondown',
	    'exclamdown', 'logicalnot', 'radical', 'florin', 'approxequal', 'Delta', 'guillemotleft', 'guillemotright',
	    'ellipsis', 'nonbreakingspace', 'Agrave', 'Atilde', 'Otilde', 'OE', 'oe', 'endash', 'emdash', 'quotedblleft',
	    'quotedblright', 'quoteleft', 'quoteright', 'divide', 'lozenge', 'ydieresis', 'Ydieresis', 'fraction',
	    'currency', 'guilsinglleft', 'guilsinglright', 'fi', 'fl', 'daggerdbl', 'periodcentered', 'quotesinglbase',
	    'quotedblbase', 'perthousand', 'Acircumflex', 'Ecircumflex', 'Aacute', 'Edieresis', 'Egrave', 'Iacute',
	    'Icircumflex', 'Idieresis', 'Igrave', 'Oacute', 'Ocircumflex', 'apple', 'Ograve', 'Uacute', 'Ucircumflex',
	    'Ugrave', 'dotlessi', 'circumflex', 'tilde', 'macron', 'breve', 'dotaccent', 'ring', 'cedilla', 'hungarumlaut',
	    'ogonek', 'caron', 'Lslash', 'lslash', 'Scaron', 'scaron', 'Zcaron', 'zcaron', 'brokenbar', 'Eth', 'eth',
	    'Yacute', 'yacute', 'Thorn', 'thorn', 'minus', 'multiply', 'onesuperior', 'twosuperior', 'threesuperior',
	    'onehalf', 'onequarter', 'threequarters', 'franc', 'Gbreve', 'gbreve', 'Idotaccent', 'Scedilla', 'scedilla',
	    'Cacute', 'cacute', 'Ccaron', 'ccaron', 'dcroat'];

	/**
	 * This is the encoding used for fonts created from scratch.
	 * It loops through all glyphs and finds the appropriate unicode value.
	 * Since it's linear time, other encodings will be faster.
	 * @exports opentype.DefaultEncoding
	 * @class
	 * @constructor
	 * @param {opentype.Font}
	 */
	function DefaultEncoding(font) {
	    this.font = font;
	}

	DefaultEncoding.prototype.charToGlyphIndex = function(c) {
	    const code = c.codePointAt(0);
	    const glyphs = this.font.glyphs;
	    if (glyphs) {
	        for (let i = 0; i < glyphs.length; i += 1) {
	            const glyph = glyphs.get(i);
	            for (let j = 0; j < glyph.unicodes.length; j += 1) {
	                if (glyph.unicodes[j] === code) {
	                    return i;
	                }
	            }
	        }
	    }
	    return null;
	};

	/**
	 * @exports opentype.CmapEncoding
	 * @class
	 * @constructor
	 * @param {Object} cmap - a object with the cmap encoded data
	 */
	function CmapEncoding(cmap) {
	    this.cmap = cmap;
	}

	/**
	 * @param  {string} c - the character
	 * @return {number} The glyph index.
	 */
	CmapEncoding.prototype.charToGlyphIndex = function(c) {
	    return this.cmap.glyphIndexMap[c.codePointAt(0)] || 0;
	};

	/**
	 * @exports opentype.CffEncoding
	 * @class
	 * @constructor
	 * @param {string} encoding - The encoding
	 * @param {Array} charset - The character set.
	 */
	function CffEncoding(encoding, charset) {
	    this.encoding = encoding;
	    this.charset = charset;
	}

	/**
	 * @param  {string} s - The character
	 * @return {number} The index.
	 */
	CffEncoding.prototype.charToGlyphIndex = function(s) {
	    const code = s.codePointAt(0);
	    const charName = this.encoding[code];
	    return this.charset.indexOf(charName);
	};

	/**
	 * @exports opentype.GlyphNames
	 * @class
	 * @constructor
	 * @param {Object} post
	 */
	function GlyphNames(post) {
	    switch (post.version) {
	        case 1:
	            this.names = standardNames.slice();
	            break;
	        case 2:
	            this.names = new Array(post.numberOfGlyphs);
	            for (let i = 0; i < post.numberOfGlyphs; i++) {
	                if (post.glyphNameIndex[i] < standardNames.length) {
	                    this.names[i] = standardNames[post.glyphNameIndex[i]];
	                } else {
	                    this.names[i] = post.names[post.glyphNameIndex[i] - standardNames.length];
	                }
	            }

	            break;
	        case 2.5:
	            this.names = new Array(post.numberOfGlyphs);
	            for (let i = 0; i < post.numberOfGlyphs; i++) {
	                this.names[i] = standardNames[i + post.glyphNameIndex[i]];
	            }

	            break;
	        case 3:
	            this.names = [];
	            break;
	        default:
	            this.names = [];
	            break;
	    }
	}

	/**
	 * Gets the index of a glyph by name.
	 * @param  {string} name - The glyph name
	 * @return {number} The index
	 */
	GlyphNames.prototype.nameToGlyphIndex = function(name) {
	    return this.names.indexOf(name);
	};

	/**
	 * @param  {number} gid
	 * @return {string}
	 */
	GlyphNames.prototype.glyphIndexToName = function(gid) {
	    return this.names[gid];
	};

	function addGlyphNamesAll(font) {
	    let glyph;
	    const glyphIndexMap = font.tables.cmap.glyphIndexMap;
	    const charCodes = Object.keys(glyphIndexMap);

	    for (let i = 0; i < charCodes.length; i += 1) {
	        const c = charCodes[i];
	        const glyphIndex = glyphIndexMap[c];
	        glyph = font.glyphs.get(glyphIndex);
	        glyph.addUnicode(parseInt(c));
	    }

	    for (let i = 0; i < font.glyphs.length; i += 1) {
	        glyph = font.glyphs.get(i);
	        if (font.cffEncoding) {
	            if (font.isCIDFont) {
	                glyph.name = 'gid' + i;
	            } else {
	                glyph.name = font.cffEncoding.charset[i];
	            }
	        } else if (font.glyphNames.names) {
	            glyph.name = font.glyphNames.glyphIndexToName(i);
	        }
	    }
	}

	function addGlyphNamesToUnicodeMap(font) {
	    font._IndexToUnicodeMap = {};

	    const glyphIndexMap = font.tables.cmap.glyphIndexMap;
	    const charCodes = Object.keys(glyphIndexMap);

	    for (let i = 0; i < charCodes.length; i += 1) {
	        const c = charCodes[i];
	        let glyphIndex = glyphIndexMap[c];
	        if (font._IndexToUnicodeMap[glyphIndex] === undefined) {
	            font._IndexToUnicodeMap[glyphIndex] = {
	                unicodes: [parseInt(c)]
	            };
	        } else {
	            font._IndexToUnicodeMap[glyphIndex].unicodes.push(parseInt(c));
	        }
	    }
	}

	/**
	 * @alias opentype.addGlyphNames
	 * @param {opentype.Font}
	 * @param {Object}
	 */
	function addGlyphNames(font, opt) {
	    if (opt.lowMemory) {
	        addGlyphNamesToUnicodeMap(font);
	    } else {
	        addGlyphNamesAll(font);
	    }
	}

	// Drawing utility functions.

	// Draw a line on the given context from point `x1,y1` to point `x2,y2`.
	function line(ctx, x1, y1, x2, y2) {
	    ctx.beginPath();
	    ctx.moveTo(x1, y1);
	    ctx.lineTo(x2, y2);
	    ctx.stroke();
	}

	var draw = { line };

	// The Glyph object
	// import glyf from './tables/glyf' Can't be imported here, because it's a circular dependency

	function getPathDefinition(glyph, path) {
	    let _path = path || new Path();
	    return {
	        configurable: true,

	        get: function() {
	            if (typeof _path === 'function') {
	                _path = _path();
	            }

	            return _path;
	        },

	        set: function(p) {
	            _path = p;
	        }
	    };
	}
	/**
	 * @typedef GlyphOptions
	 * @type Object
	 * @property {string} [name] - The glyph name
	 * @property {number} [unicode]
	 * @property {Array} [unicodes]
	 * @property {number} [xMin]
	 * @property {number} [yMin]
	 * @property {number} [xMax]
	 * @property {number} [yMax]
	 * @property {number} [advanceWidth]
	 */

	// A Glyph is an individual mark that often corresponds to a character.
	// Some glyphs, such as ligatures, are a combination of many characters.
	// Glyphs are the basic building blocks of a font.
	//
	// The `Glyph` class contains utility methods for drawing the path and its points.
	/**
	 * @exports opentype.Glyph
	 * @class
	 * @param {GlyphOptions}
	 * @constructor
	 */
	function Glyph(options) {
	    // By putting all the code on a prototype function (which is only declared once)
	    // we reduce the memory requirements for larger fonts by some 2%
	    this.bindConstructorValues(options);
	}

	/**
	 * @param  {GlyphOptions}
	 */
	Glyph.prototype.bindConstructorValues = function(options) {
	    this.index = options.index || 0;

	    // These three values cannot be deferred for memory optimization:
	    this.name = options.name || null;
	    this.unicode = options.unicode || undefined;
	    this.unicodes = options.unicodes || options.unicode !== undefined ? [options.unicode] : [];

	    // But by binding these values only when necessary, we reduce can
	    // the memory requirements by almost 3% for larger fonts.
	    if (options.xMin) {
	        this.xMin = options.xMin;
	    }

	    if (options.yMin) {
	        this.yMin = options.yMin;
	    }

	    if (options.xMax) {
	        this.xMax = options.xMax;
	    }

	    if (options.yMax) {
	        this.yMax = options.yMax;
	    }

	    if (options.advanceWidth) {
	        this.advanceWidth = options.advanceWidth;
	    }

	    // The path for a glyph is the most memory intensive, and is bound as a value
	    // with a getter/setter to ensure we actually do path parsing only once the
	    // path is actually needed by anything.
	    Object.defineProperty(this, 'path', getPathDefinition(this, options.path));
	};

	/**
	 * @param {number}
	 */
	Glyph.prototype.addUnicode = function(unicode) {
	    if (this.unicodes.length === 0) {
	        this.unicode = unicode;
	    }

	    this.unicodes.push(unicode);
	};

	/**
	 * Calculate the minimum bounding box for this glyph.
	 * @return {opentype.BoundingBox}
	 */
	Glyph.prototype.getBoundingBox = function() {
	    return this.path.getBoundingBox();
	};

	/**
	 * Convert the glyph to a Path we can draw on a drawing context.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {Object=} options - xScale, yScale to stretch the glyph.
	 * @param  {opentype.Font} if hinting is to be used, the font
	 * @return {opentype.Path}
	 */
	Glyph.prototype.getPath = function(x, y, fontSize, options, font) {
	    x = x !== undefined ? x : 0;
	    y = y !== undefined ? y : 0;
	    fontSize = fontSize !== undefined ? fontSize : 72;
	    let commands;
	    let hPoints;
	    if (!options) options = { };
	    let xScale = options.xScale;
	    let yScale = options.yScale;

	    if (options.hinting && font && font.hinting) {
	        // in case of hinting, the hinting engine takes care
	        // of scaling the points (not the path) before hinting.
	        hPoints = this.path && font.hinting.exec(this, fontSize);
	        // in case the hinting engine failed hPoints is undefined
	        // and thus reverts to plain rending
	    }

	    if (hPoints) {
	        // Call font.hinting.getCommands instead of `glyf.getPath(hPoints).commands` to avoid a circular dependency
	        commands = font.hinting.getCommands(hPoints);
	        x = Math.round(x);
	        y = Math.round(y);
	        // TODO in case of hinting xyScaling is not yet supported
	        xScale = yScale = 1;
	    } else {
	        commands = this.path.commands;
	        const scale = 1 / (this.path.unitsPerEm || 1000) * fontSize;
	        if (xScale === undefined) xScale = scale;
	        if (yScale === undefined) yScale = scale;
	    }

	    const p = new Path();
	    for (let i = 0; i < commands.length; i += 1) {
	        const cmd = commands[i];
	        if (cmd.type === 'M') {
	            p.moveTo(x + (cmd.x * xScale), y + (-cmd.y * yScale));
	        } else if (cmd.type === 'L') {
	            p.lineTo(x + (cmd.x * xScale), y + (-cmd.y * yScale));
	        } else if (cmd.type === 'Q') {
	            p.quadraticCurveTo(x + (cmd.x1 * xScale), y + (-cmd.y1 * yScale),
	                               x + (cmd.x * xScale), y + (-cmd.y * yScale));
	        } else if (cmd.type === 'C') {
	            p.curveTo(x + (cmd.x1 * xScale), y + (-cmd.y1 * yScale),
	                      x + (cmd.x2 * xScale), y + (-cmd.y2 * yScale),
	                      x + (cmd.x * xScale), y + (-cmd.y * yScale));
	        } else if (cmd.type === 'Z') {
	            p.closePath();
	        }
	    }

	    return p;
	};

	/**
	 * Split the glyph into contours.
	 * This function is here for backwards compatibility, and to
	 * provide raw access to the TrueType glyph outlines.
	 * @return {Array}
	 */
	Glyph.prototype.getContours = function() {
	    if (this.points === undefined) {
	        return [];
	    }

	    const contours = [];
	    let currentContour = [];
	    for (let i = 0; i < this.points.length; i += 1) {
	        const pt = this.points[i];
	        currentContour.push(pt);
	        if (pt.lastPointOfContour) {
	            contours.push(currentContour);
	            currentContour = [];
	        }
	    }

	    check.argument(currentContour.length === 0, 'There are still points left in the current contour.');
	    return contours;
	};

	/**
	 * Calculate the xMin/yMin/xMax/yMax/lsb/rsb for a Glyph.
	 * @return {Object}
	 */
	Glyph.prototype.getMetrics = function() {
	    const commands = this.path.commands;
	    const xCoords = [];
	    const yCoords = [];
	    for (let i = 0; i < commands.length; i += 1) {
	        const cmd = commands[i];
	        if (cmd.type !== 'Z') {
	            xCoords.push(cmd.x);
	            yCoords.push(cmd.y);
	        }

	        if (cmd.type === 'Q' || cmd.type === 'C') {
	            xCoords.push(cmd.x1);
	            yCoords.push(cmd.y1);
	        }

	        if (cmd.type === 'C') {
	            xCoords.push(cmd.x2);
	            yCoords.push(cmd.y2);
	        }
	    }

	    const metrics = {
	        xMin: Math.min.apply(null, xCoords),
	        yMin: Math.min.apply(null, yCoords),
	        xMax: Math.max.apply(null, xCoords),
	        yMax: Math.max.apply(null, yCoords),
	        leftSideBearing: this.leftSideBearing
	    };

	    if (!isFinite(metrics.xMin)) {
	        metrics.xMin = 0;
	    }

	    if (!isFinite(metrics.xMax)) {
	        metrics.xMax = this.advanceWidth;
	    }

	    if (!isFinite(metrics.yMin)) {
	        metrics.yMin = 0;
	    }

	    if (!isFinite(metrics.yMax)) {
	        metrics.yMax = 0;
	    }

	    metrics.rightSideBearing = this.advanceWidth - metrics.leftSideBearing - (metrics.xMax - metrics.xMin);
	    return metrics;
	};

	/**
	 * Draw the glyph on the given context.
	 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {Object=} options - xScale, yScale to stretch the glyph.
	 */
	Glyph.prototype.draw = function(ctx, x, y, fontSize, options) {
	    this.getPath(x, y, fontSize, options).draw(ctx);
	};

	/**
	 * Draw the points of the glyph.
	 * On-curve points will be drawn in blue, off-curve points will be drawn in red.
	 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 */
	Glyph.prototype.drawPoints = function(ctx, x, y, fontSize) {
	    function drawCircles(l, x, y, scale) {
	        const PI_SQ = Math.PI * 2;
	        ctx.beginPath();
	        for (let j = 0; j < l.length; j += 1) {
	            ctx.moveTo(x + (l[j].x * scale), y + (l[j].y * scale));
	            ctx.arc(x + (l[j].x * scale), y + (l[j].y * scale), 2, 0, PI_SQ, false);
	        }

	        ctx.closePath();
	        ctx.fill();
	    }

	    x = x !== undefined ? x : 0;
	    y = y !== undefined ? y : 0;
	    fontSize = fontSize !== undefined ? fontSize : 24;
	    const scale = 1 / this.path.unitsPerEm * fontSize;

	    const blueCircles = [];
	    const redCircles = [];
	    const path = this.path;
	    for (let i = 0; i < path.commands.length; i += 1) {
	        const cmd = path.commands[i];
	        if (cmd.x !== undefined) {
	            blueCircles.push({x: cmd.x, y: -cmd.y});
	        }

	        if (cmd.x1 !== undefined) {
	            redCircles.push({x: cmd.x1, y: -cmd.y1});
	        }

	        if (cmd.x2 !== undefined) {
	            redCircles.push({x: cmd.x2, y: -cmd.y2});
	        }
	    }

	    ctx.fillStyle = 'blue';
	    drawCircles(blueCircles, x, y, scale);
	    ctx.fillStyle = 'red';
	    drawCircles(redCircles, x, y, scale);
	};

	/**
	 * Draw lines indicating important font measurements.
	 * Black lines indicate the origin of the coordinate system (point 0,0).
	 * Blue lines indicate the glyph bounding box.
	 * Green line indicates the advance width of the glyph.
	 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 */
	Glyph.prototype.drawMetrics = function(ctx, x, y, fontSize) {
	    let scale;
	    x = x !== undefined ? x : 0;
	    y = y !== undefined ? y : 0;
	    fontSize = fontSize !== undefined ? fontSize : 24;
	    scale = 1 / this.path.unitsPerEm * fontSize;
	    ctx.lineWidth = 1;

	    // Draw the origin
	    ctx.strokeStyle = 'black';
	    draw.line(ctx, x, -10000, x, 10000);
	    draw.line(ctx, -10000, y, 10000, y);

	    // This code is here due to memory optimization: by not using
	    // defaults in the constructor, we save a notable amount of memory.
	    const xMin = this.xMin || 0;
	    let yMin = this.yMin || 0;
	    const xMax = this.xMax || 0;
	    let yMax = this.yMax || 0;
	    const advanceWidth = this.advanceWidth || 0;

	    // Draw the glyph box
	    ctx.strokeStyle = 'blue';
	    draw.line(ctx, x + (xMin * scale), -10000, x + (xMin * scale), 10000);
	    draw.line(ctx, x + (xMax * scale), -10000, x + (xMax * scale), 10000);
	    draw.line(ctx, -10000, y + (-yMin * scale), 10000, y + (-yMin * scale));
	    draw.line(ctx, -10000, y + (-yMax * scale), 10000, y + (-yMax * scale));

	    // Draw the advance width
	    ctx.strokeStyle = 'green';
	    draw.line(ctx, x + (advanceWidth * scale), -10000, x + (advanceWidth * scale), 10000);
	};

	// The GlyphSet object

	// Define a property on the glyph that depends on the path being loaded.
	function defineDependentProperty(glyph, externalName, internalName) {
	    Object.defineProperty(glyph, externalName, {
	        get: function() {
	            // Request the path property to make sure the path is loaded.
	            glyph.path; // jshint ignore:line
	            return glyph[internalName];
	        },
	        set: function(newValue) {
	            glyph[internalName] = newValue;
	        },
	        enumerable: true,
	        configurable: true
	    });
	}

	/**
	 * A GlyphSet represents all glyphs available in the font, but modelled using
	 * a deferred glyph loader, for retrieving glyphs only once they are absolutely
	 * necessary, to keep the memory footprint down.
	 * @exports opentype.GlyphSet
	 * @class
	 * @param {opentype.Font}
	 * @param {Array}
	 */
	function GlyphSet(font, glyphs) {
	    this.font = font;
	    this.glyphs = {};
	    if (Array.isArray(glyphs)) {
	        for (let i = 0; i < glyphs.length; i++) {
	            const glyph = glyphs[i];
	            glyph.path.unitsPerEm = font.unitsPerEm;
	            this.glyphs[i] = glyph;
	        }
	    }

	    this.length = (glyphs && glyphs.length) || 0;
	}

	/**
	 * @param  {number} index
	 * @return {opentype.Glyph}
	 */
	GlyphSet.prototype.get = function(index) {
	    // this.glyphs[index] is 'undefined' when low memory mode is on. glyph is pushed on request only.
	    if (this.glyphs[index] === undefined) {
	        this.font._push(index);
	        if (typeof this.glyphs[index] === 'function') {
	            this.glyphs[index] = this.glyphs[index]();
	        }

	        let glyph = this.glyphs[index];
	        let unicodeObj = this.font._IndexToUnicodeMap[index];

	        if (unicodeObj) {
	            for (let j = 0; j < unicodeObj.unicodes.length; j++)
	                glyph.addUnicode(unicodeObj.unicodes[j]);
	        }

	        if (this.font.cffEncoding) {
	            if (this.font.isCIDFont) {
	                glyph.name = 'gid' + index;
	            } else {
	                glyph.name = this.font.cffEncoding.charset[index];
	            }
	        } else if (this.font.glyphNames.names) {
	            glyph.name = this.font.glyphNames.glyphIndexToName(index);
	        }

	        this.glyphs[index].advanceWidth = this.font._hmtxTableData[index].advanceWidth;
	        this.glyphs[index].leftSideBearing = this.font._hmtxTableData[index].leftSideBearing;
	    } else {
	        if (typeof this.glyphs[index] === 'function') {
	            this.glyphs[index] = this.glyphs[index]();
	        }
	    }

	    return this.glyphs[index];
	};

	/**
	 * @param  {number} index
	 * @param  {Object}
	 */
	GlyphSet.prototype.push = function(index, loader) {
	    this.glyphs[index] = loader;
	    this.length++;
	};

	/**
	 * @alias opentype.glyphLoader
	 * @param  {opentype.Font} font
	 * @param  {number} index
	 * @return {opentype.Glyph}
	 */
	function glyphLoader(font, index) {
	    return new Glyph({index: index, font: font});
	}

	/**
	 * Generate a stub glyph that can be filled with all metadata *except*
	 * the "points" and "path" properties, which must be loaded only once
	 * the glyph's path is actually requested for text shaping.
	 * @alias opentype.ttfGlyphLoader
	 * @param  {opentype.Font} font
	 * @param  {number} index
	 * @param  {Function} parseGlyph
	 * @param  {Object} data
	 * @param  {number} position
	 * @param  {Function} buildPath
	 * @return {opentype.Glyph}
	 */
	function ttfGlyphLoader(font, index, parseGlyph, data, position, buildPath) {
	    return function() {
	        const glyph = new Glyph({index: index, font: font});

	        glyph.path = function() {
	            parseGlyph(glyph, data, position);
	            const path = buildPath(font.glyphs, glyph);
	            path.unitsPerEm = font.unitsPerEm;
	            return path;
	        };

	        defineDependentProperty(glyph, 'xMin', '_xMin');
	        defineDependentProperty(glyph, 'xMax', '_xMax');
	        defineDependentProperty(glyph, 'yMin', '_yMin');
	        defineDependentProperty(glyph, 'yMax', '_yMax');

	        return glyph;
	    };
	}
	/**
	 * @alias opentype.cffGlyphLoader
	 * @param  {opentype.Font} font
	 * @param  {number} index
	 * @param  {Function} parseCFFCharstring
	 * @param  {string} charstring
	 * @return {opentype.Glyph}
	 */
	function cffGlyphLoader(font, index, parseCFFCharstring, charstring) {
	    return function() {
	        const glyph = new Glyph({index: index, font: font});

	        glyph.path = function() {
	            const path = parseCFFCharstring(font, glyph, charstring);
	            path.unitsPerEm = font.unitsPerEm;
	            return path;
	        };

	        return glyph;
	    };
	}

	var glyphset = { GlyphSet, glyphLoader, ttfGlyphLoader, cffGlyphLoader };

	// The `CFF` table contains the glyph outlines in PostScript format.

	// Custom equals function that can also check lists.
	function equals(a, b) {
	    if (a === b) {
	        return true;
	    } else if (Array.isArray(a) && Array.isArray(b)) {
	        if (a.length !== b.length) {
	            return false;
	        }

	        for (let i = 0; i < a.length; i += 1) {
	            if (!equals(a[i], b[i])) {
	                return false;
	            }
	        }

	        return true;
	    } else {
	        return false;
	    }
	}

	// Subroutines are encoded using the negative half of the number space.
	// See type 2 chapter 4.7 "Subroutine operators".
	function calcCFFSubroutineBias(subrs) {
	    let bias;
	    if (subrs.length < 1240) {
	        bias = 107;
	    } else if (subrs.length < 33900) {
	        bias = 1131;
	    } else {
	        bias = 32768;
	    }

	    return bias;
	}

	// Parse a `CFF` INDEX array.
	// An index array consists of a list of offsets, then a list of objects at those offsets.
	function parseCFFIndex(data, start, conversionFn) {
	    const offsets = [];
	    const objects = [];
	    const count = parse.getCard16(data, start);
	    let objectOffset;
	    let endOffset;
	    if (count !== 0) {
	        const offsetSize = parse.getByte(data, start + 2);
	        objectOffset = start + ((count + 1) * offsetSize) + 2;
	        let pos = start + 3;
	        for (let i = 0; i < count + 1; i += 1) {
	            offsets.push(parse.getOffset(data, pos, offsetSize));
	            pos += offsetSize;
	        }

	        // The total size of the index array is 4 header bytes + the value of the last offset.
	        endOffset = objectOffset + offsets[count];
	    } else {
	        endOffset = start + 2;
	    }

	    for (let i = 0; i < offsets.length - 1; i += 1) {
	        let value = parse.getBytes(data, objectOffset + offsets[i], objectOffset + offsets[i + 1]);
	        if (conversionFn) {
	            value = conversionFn(value);
	        }

	        objects.push(value);
	    }

	    return {objects: objects, startOffset: start, endOffset: endOffset};
	}

	function parseCFFIndexLowMemory(data, start) {
	    const offsets = [];
	    const count = parse.getCard16(data, start);
	    let objectOffset;
	    let endOffset;
	    if (count !== 0) {
	        const offsetSize = parse.getByte(data, start + 2);
	        objectOffset = start + ((count + 1) * offsetSize) + 2;
	        let pos = start + 3;
	        for (let i = 0; i < count + 1; i += 1) {
	            offsets.push(parse.getOffset(data, pos, offsetSize));
	            pos += offsetSize;
	        }

	        // The total size of the index array is 4 header bytes + the value of the last offset.
	        endOffset = objectOffset + offsets[count];
	    } else {
	        endOffset = start + 2;
	    }

	    return {offsets: offsets, startOffset: start, endOffset: endOffset};
	}
	function getCffIndexObject(i, offsets, data, start, conversionFn) {
	    const count = parse.getCard16(data, start);
	    let objectOffset = 0;
	    if (count !== 0) {
	        const offsetSize = parse.getByte(data, start + 2);
	        objectOffset = start + ((count + 1) * offsetSize) + 2;
	    }

	    let value = parse.getBytes(data, objectOffset + offsets[i], objectOffset + offsets[i + 1]);
	    if (conversionFn) {
	        value = conversionFn(value);
	    }
	    return value;
	}

	// Parse a `CFF` DICT real value.
	function parseFloatOperand(parser) {
	    let s = '';
	    const eof = 15;
	    const lookup = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'E', 'E-', null, '-'];
	    while (true) {
	        const b = parser.parseByte();
	        const n1 = b >> 4;
	        const n2 = b & 15;

	        if (n1 === eof) {
	            break;
	        }

	        s += lookup[n1];

	        if (n2 === eof) {
	            break;
	        }

	        s += lookup[n2];
	    }

	    return parseFloat(s);
	}

	// Parse a `CFF` DICT operand.
	function parseOperand(parser, b0) {
	    let b1;
	    let b2;
	    let b3;
	    let b4;
	    if (b0 === 28) {
	        b1 = parser.parseByte();
	        b2 = parser.parseByte();
	        return b1 << 8 | b2;
	    }

	    if (b0 === 29) {
	        b1 = parser.parseByte();
	        b2 = parser.parseByte();
	        b3 = parser.parseByte();
	        b4 = parser.parseByte();
	        return b1 << 24 | b2 << 16 | b3 << 8 | b4;
	    }

	    if (b0 === 30) {
	        return parseFloatOperand(parser);
	    }

	    if (b0 >= 32 && b0 <= 246) {
	        return b0 - 139;
	    }

	    if (b0 >= 247 && b0 <= 250) {
	        b1 = parser.parseByte();
	        return (b0 - 247) * 256 + b1 + 108;
	    }

	    if (b0 >= 251 && b0 <= 254) {
	        b1 = parser.parseByte();
	        return -(b0 - 251) * 256 - b1 - 108;
	    }

	    throw new Error('Invalid b0 ' + b0);
	}

	// Convert the entries returned by `parseDict` to a proper dictionary.
	// If a value is a list of one, it is unpacked.
	function entriesToObject(entries) {
	    const o = {};
	    for (let i = 0; i < entries.length; i += 1) {
	        const key = entries[i][0];
	        const values = entries[i][1];
	        let value;
	        if (values.length === 1) {
	            value = values[0];
	        } else {
	            value = values;
	        }

	        if (o.hasOwnProperty(key) && !isNaN(o[key])) {
	            throw new Error('Object ' + o + ' already has key ' + key);
	        }

	        o[key] = value;
	    }

	    return o;
	}

	// Parse a `CFF` DICT object.
	// A dictionary contains key-value pairs in a compact tokenized format.
	function parseCFFDict(data, start, size) {
	    start = start !== undefined ? start : 0;
	    const parser = new parse.Parser(data, start);
	    const entries = [];
	    let operands = [];
	    size = size !== undefined ? size : data.length;

	    while (parser.relativeOffset < size) {
	        let op = parser.parseByte();

	        // The first byte for each dict item distinguishes between operator (key) and operand (value).
	        // Values <= 21 are operators.
	        if (op <= 21) {
	            // Two-byte operators have an initial escape byte of 12.
	            if (op === 12) {
	                op = 1200 + parser.parseByte();
	            }

	            entries.push([op, operands]);
	            operands = [];
	        } else {
	            // Since the operands (values) come before the operators (keys), we store all operands in a list
	            // until we encounter an operator.
	            operands.push(parseOperand(parser, op));
	        }
	    }

	    return entriesToObject(entries);
	}

	// Given a String Index (SID), return the value of the string.
	// Strings below index 392 are standard CFF strings and are not encoded in the font.
	function getCFFString(strings, index) {
	    if (index <= 390) {
	        index = cffStandardStrings[index];
	    } else {
	        index = strings[index - 391];
	    }

	    return index;
	}

	// Interpret a dictionary and return a new dictionary with readable keys and values for missing entries.
	// This function takes `meta` which is a list of objects containing `operand`, `name` and `default`.
	function interpretDict(dict, meta, strings) {
	    const newDict = {};
	    let value;

	    // Because we also want to include missing values, we start out from the meta list
	    // and lookup values in the dict.
	    for (let i = 0; i < meta.length; i += 1) {
	        const m = meta[i];

	        if (Array.isArray(m.type)) {
	            const values = [];
	            values.length = m.type.length;
	            for (let j = 0; j < m.type.length; j++) {
	                value = dict[m.op] !== undefined ? dict[m.op][j] : undefined;
	                if (value === undefined) {
	                    value = m.value !== undefined && m.value[j] !== undefined ? m.value[j] : null;
	                }
	                if (m.type[j] === 'SID') {
	                    value = getCFFString(strings, value);
	                }
	                values[j] = value;
	            }
	            newDict[m.name] = values;
	        } else {
	            value = dict[m.op];
	            if (value === undefined) {
	                value = m.value !== undefined ? m.value : null;
	            }

	            if (m.type === 'SID') {
	                value = getCFFString(strings, value);
	            }
	            newDict[m.name] = value;
	        }
	    }

	    return newDict;
	}

	// Parse the CFF header.
	function parseCFFHeader(data, start) {
	    const header = {};
	    header.formatMajor = parse.getCard8(data, start);
	    header.formatMinor = parse.getCard8(data, start + 1);
	    header.size = parse.getCard8(data, start + 2);
	    header.offsetSize = parse.getCard8(data, start + 3);
	    header.startOffset = start;
	    header.endOffset = start + 4;
	    return header;
	}

	const TOP_DICT_META = [
	    {name: 'version', op: 0, type: 'SID'},
	    {name: 'notice', op: 1, type: 'SID'},
	    {name: 'copyright', op: 1200, type: 'SID'},
	    {name: 'fullName', op: 2, type: 'SID'},
	    {name: 'familyName', op: 3, type: 'SID'},
	    {name: 'weight', op: 4, type: 'SID'},
	    {name: 'isFixedPitch', op: 1201, type: 'number', value: 0},
	    {name: 'italicAngle', op: 1202, type: 'number', value: 0},
	    {name: 'underlinePosition', op: 1203, type: 'number', value: -100},
	    {name: 'underlineThickness', op: 1204, type: 'number', value: 50},
	    {name: 'paintType', op: 1205, type: 'number', value: 0},
	    {name: 'charstringType', op: 1206, type: 'number', value: 2},
	    {
	        name: 'fontMatrix',
	        op: 1207,
	        type: ['real', 'real', 'real', 'real', 'real', 'real'],
	        value: [0.001, 0, 0, 0.001, 0, 0]
	    },
	    {name: 'uniqueId', op: 13, type: 'number'},
	    {name: 'fontBBox', op: 5, type: ['number', 'number', 'number', 'number'], value: [0, 0, 0, 0]},
	    {name: 'strokeWidth', op: 1208, type: 'number', value: 0},
	    {name: 'xuid', op: 14, type: [], value: null},
	    {name: 'charset', op: 15, type: 'offset', value: 0},
	    {name: 'encoding', op: 16, type: 'offset', value: 0},
	    {name: 'charStrings', op: 17, type: 'offset', value: 0},
	    {name: 'private', op: 18, type: ['number', 'offset'], value: [0, 0]},
	    {name: 'ros', op: 1230, type: ['SID', 'SID', 'number']},
	    {name: 'cidFontVersion', op: 1231, type: 'number', value: 0},
	    {name: 'cidFontRevision', op: 1232, type: 'number', value: 0},
	    {name: 'cidFontType', op: 1233, type: 'number', value: 0},
	    {name: 'cidCount', op: 1234, type: 'number', value: 8720},
	    {name: 'uidBase', op: 1235, type: 'number'},
	    {name: 'fdArray', op: 1236, type: 'offset'},
	    {name: 'fdSelect', op: 1237, type: 'offset'},
	    {name: 'fontName', op: 1238, type: 'SID'}
	];

	const PRIVATE_DICT_META = [
	    {name: 'subrs', op: 19, type: 'offset', value: 0},
	    {name: 'defaultWidthX', op: 20, type: 'number', value: 0},
	    {name: 'nominalWidthX', op: 21, type: 'number', value: 0}
	];

	// Parse the CFF top dictionary. A CFF table can contain multiple fonts, each with their own top dictionary.
	// The top dictionary contains the essential metadata for the font, together with the private dictionary.
	function parseCFFTopDict(data, strings) {
	    const dict = parseCFFDict(data, 0, data.byteLength);
	    return interpretDict(dict, TOP_DICT_META, strings);
	}

	// Parse the CFF private dictionary. We don't fully parse out all the values, only the ones we need.
	function parseCFFPrivateDict(data, start, size, strings) {
	    const dict = parseCFFDict(data, start, size);
	    return interpretDict(dict, PRIVATE_DICT_META, strings);
	}

	// Returns a list of "Top DICT"s found using an INDEX list.
	// Used to read both the usual high-level Top DICTs and also the FDArray
	// discovered inside CID-keyed fonts.  When a Top DICT has a reference to
	// a Private DICT that is read and saved into the Top DICT.
	//
	// In addition to the expected/optional values as outlined in TOP_DICT_META
	// the following values might be saved into the Top DICT.
	//
	//    _subrs []        array of local CFF subroutines from Private DICT
	//    _subrsBias       bias value computed from number of subroutines
	//                      (see calcCFFSubroutineBias() and parseCFFCharstring())
	//    _defaultWidthX   default widths for CFF characters
	//    _nominalWidthX   bias added to width embedded within glyph description
	//
	//    _privateDict     saved copy of parsed Private DICT from Top DICT
	function gatherCFFTopDicts(data, start, cffIndex, strings) {
	    const topDictArray = [];
	    for (let iTopDict = 0; iTopDict < cffIndex.length; iTopDict += 1) {
	        const topDictData = new DataView(new Uint8Array(cffIndex[iTopDict]).buffer);
	        const topDict = parseCFFTopDict(topDictData, strings);
	        topDict._subrs = [];
	        topDict._subrsBias = 0;
	        const privateSize = topDict.private[0];
	        const privateOffset = topDict.private[1];
	        if (privateSize !== 0 && privateOffset !== 0) {
	            const privateDict = parseCFFPrivateDict(data, privateOffset + start, privateSize, strings);
	            topDict._defaultWidthX = privateDict.defaultWidthX;
	            topDict._nominalWidthX = privateDict.nominalWidthX;
	            if (privateDict.subrs !== 0) {
	                const subrOffset = privateOffset + privateDict.subrs;
	                const subrIndex = parseCFFIndex(data, subrOffset + start);
	                topDict._subrs = subrIndex.objects;
	                topDict._subrsBias = calcCFFSubroutineBias(topDict._subrs);
	            }
	            topDict._privateDict = privateDict;
	        }
	        topDictArray.push(topDict);
	    }
	    return topDictArray;
	}

	// Parse the CFF charset table, which contains internal names for all the glyphs.
	// This function will return a list of glyph names.
	// See Adobe TN #5176 chapter 13, "Charsets".
	function parseCFFCharset(data, start, nGlyphs, strings) {
	    let sid;
	    let count;
	    const parser = new parse.Parser(data, start);

	    // The .notdef glyph is not included, so subtract 1.
	    nGlyphs -= 1;
	    const charset = ['.notdef'];

	    const format = parser.parseCard8();
	    if (format === 0) {
	        for (let i = 0; i < nGlyphs; i += 1) {
	            sid = parser.parseSID();
	            charset.push(getCFFString(strings, sid));
	        }
	    } else if (format === 1) {
	        while (charset.length <= nGlyphs) {
	            sid = parser.parseSID();
	            count = parser.parseCard8();
	            for (let i = 0; i <= count; i += 1) {
	                charset.push(getCFFString(strings, sid));
	                sid += 1;
	            }
	        }
	    } else if (format === 2) {
	        while (charset.length <= nGlyphs) {
	            sid = parser.parseSID();
	            count = parser.parseCard16();
	            for (let i = 0; i <= count; i += 1) {
	                charset.push(getCFFString(strings, sid));
	                sid += 1;
	            }
	        }
	    } else {
	        throw new Error('Unknown charset format ' + format);
	    }

	    return charset;
	}

	// Parse the CFF encoding data. Only one encoding can be specified per font.
	// See Adobe TN #5176 chapter 12, "Encodings".
	function parseCFFEncoding(data, start, charset) {
	    let code;
	    const enc = {};
	    const parser = new parse.Parser(data, start);
	    const format = parser.parseCard8();
	    if (format === 0) {
	        const nCodes = parser.parseCard8();
	        for (let i = 0; i < nCodes; i += 1) {
	            code = parser.parseCard8();
	            enc[code] = i;
	        }
	    } else if (format === 1) {
	        const nRanges = parser.parseCard8();
	        code = 1;
	        for (let i = 0; i < nRanges; i += 1) {
	            const first = parser.parseCard8();
	            const nLeft = parser.parseCard8();
	            for (let j = first; j <= first + nLeft; j += 1) {
	                enc[j] = code;
	                code += 1;
	            }
	        }
	    } else {
	        throw new Error('Unknown encoding format ' + format);
	    }

	    return new CffEncoding(enc, charset);
	}

	// Take in charstring code and return a Glyph object.
	// The encoding is described in the Type 2 Charstring Format
	// https://www.microsoft.com/typography/OTSPEC/charstr2.htm
	function parseCFFCharstring(font, glyph, code) {
	    let c1x;
	    let c1y;
	    let c2x;
	    let c2y;
	    const p = new Path();
	    const stack = [];
	    let nStems = 0;
	    let haveWidth = false;
	    let open = false;
	    let x = 0;
	    let y = 0;
	    let subrs;
	    let subrsBias;
	    let defaultWidthX;
	    let nominalWidthX;
	    if (font.isCIDFont) {
	        const fdIndex = font.tables.cff.topDict._fdSelect[glyph.index];
	        const fdDict = font.tables.cff.topDict._fdArray[fdIndex];
	        subrs = fdDict._subrs;
	        subrsBias = fdDict._subrsBias;
	        defaultWidthX = fdDict._defaultWidthX;
	        nominalWidthX = fdDict._nominalWidthX;
	    } else {
	        subrs = font.tables.cff.topDict._subrs;
	        subrsBias = font.tables.cff.topDict._subrsBias;
	        defaultWidthX = font.tables.cff.topDict._defaultWidthX;
	        nominalWidthX = font.tables.cff.topDict._nominalWidthX;
	    }
	    let width = defaultWidthX;

	    function newContour(x, y) {
	        if (open) {
	            p.closePath();
	        }

	        p.moveTo(x, y);
	        open = true;
	    }

	    function parseStems() {
	        let hasWidthArg;

	        // The number of stem operators on the stack is always even.
	        // If the value is uneven, that means a width is specified.
	        hasWidthArg = stack.length % 2 !== 0;
	        if (hasWidthArg && !haveWidth) {
	            width = stack.shift() + nominalWidthX;
	        }

	        nStems += stack.length >> 1;
	        stack.length = 0;
	        haveWidth = true;
	    }

	    function parse$$1(code) {
	        let b1;
	        let b2;
	        let b3;
	        let b4;
	        let codeIndex;
	        let subrCode;
	        let jpx;
	        let jpy;
	        let c3x;
	        let c3y;
	        let c4x;
	        let c4y;

	        let i = 0;
	        while (i < code.length) {
	            let v = code[i];
	            i += 1;
	            switch (v) {
	                case 1: // hstem
	                    parseStems();
	                    break;
	                case 3: // vstem
	                    parseStems();
	                    break;
	                case 4: // vmoveto
	                    if (stack.length > 1 && !haveWidth) {
	                        width = stack.shift() + nominalWidthX;
	                        haveWidth = true;
	                    }

	                    y += stack.pop();
	                    newContour(x, y);
	                    break;
	                case 5: // rlineto
	                    while (stack.length > 0) {
	                        x += stack.shift();
	                        y += stack.shift();
	                        p.lineTo(x, y);
	                    }

	                    break;
	                case 6: // hlineto
	                    while (stack.length > 0) {
	                        x += stack.shift();
	                        p.lineTo(x, y);
	                        if (stack.length === 0) {
	                            break;
	                        }

	                        y += stack.shift();
	                        p.lineTo(x, y);
	                    }

	                    break;
	                case 7: // vlineto
	                    while (stack.length > 0) {
	                        y += stack.shift();
	                        p.lineTo(x, y);
	                        if (stack.length === 0) {
	                            break;
	                        }

	                        x += stack.shift();
	                        p.lineTo(x, y);
	                    }

	                    break;
	                case 8: // rrcurveto
	                    while (stack.length > 0) {
	                        c1x = x + stack.shift();
	                        c1y = y + stack.shift();
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        x = c2x + stack.shift();
	                        y = c2y + stack.shift();
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    }

	                    break;
	                case 10: // callsubr
	                    codeIndex = stack.pop() + subrsBias;
	                    subrCode = subrs[codeIndex];
	                    if (subrCode) {
	                        parse$$1(subrCode);
	                    }

	                    break;
	                case 11: // return
	                    return;
	                case 12: // flex operators
	                    v = code[i];
	                    i += 1;
	                    switch (v) {
	                        case 35: // flex
	                            // |- dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 dx6 dy6 fd flex (12 35) |-
	                            c1x = x   + stack.shift();    // dx1
	                            c1y = y   + stack.shift();    // dy1
	                            c2x = c1x + stack.shift();    // dx2
	                            c2y = c1y + stack.shift();    // dy2
	                            jpx = c2x + stack.shift();    // dx3
	                            jpy = c2y + stack.shift();    // dy3
	                            c3x = jpx + stack.shift();    // dx4
	                            c3y = jpy + stack.shift();    // dy4
	                            c4x = c3x + stack.shift();    // dx5
	                            c4y = c3y + stack.shift();    // dy5
	                            x = c4x   + stack.shift();    // dx6
	                            y = c4y   + stack.shift();    // dy6
	                            stack.shift();                // flex depth
	                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
	                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
	                            break;
	                        case 34: // hflex
	                            // |- dx1 dx2 dy2 dx3 dx4 dx5 dx6 hflex (12 34) |-
	                            c1x = x   + stack.shift();    // dx1
	                            c1y = y;                      // dy1
	                            c2x = c1x + stack.shift();    // dx2
	                            c2y = c1y + stack.shift();    // dy2
	                            jpx = c2x + stack.shift();    // dx3
	                            jpy = c2y;                    // dy3
	                            c3x = jpx + stack.shift();    // dx4
	                            c3y = c2y;                    // dy4
	                            c4x = c3x + stack.shift();    // dx5
	                            c4y = y;                      // dy5
	                            x = c4x + stack.shift();      // dx6
	                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
	                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
	                            break;
	                        case 36: // hflex1
	                            // |- dx1 dy1 dx2 dy2 dx3 dx4 dx5 dy5 dx6 hflex1 (12 36) |-
	                            c1x = x   + stack.shift();    // dx1
	                            c1y = y   + stack.shift();    // dy1
	                            c2x = c1x + stack.shift();    // dx2
	                            c2y = c1y + stack.shift();    // dy2
	                            jpx = c2x + stack.shift();    // dx3
	                            jpy = c2y;                    // dy3
	                            c3x = jpx + stack.shift();    // dx4
	                            c3y = c2y;                    // dy4
	                            c4x = c3x + stack.shift();    // dx5
	                            c4y = c3y + stack.shift();    // dy5
	                            x = c4x + stack.shift();      // dx6
	                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
	                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
	                            break;
	                        case 37: // flex1
	                            // |- dx1 dy1 dx2 dy2 dx3 dy3 dx4 dy4 dx5 dy5 d6 flex1 (12 37) |-
	                            c1x = x   + stack.shift();    // dx1
	                            c1y = y   + stack.shift();    // dy1
	                            c2x = c1x + stack.shift();    // dx2
	                            c2y = c1y + stack.shift();    // dy2
	                            jpx = c2x + stack.shift();    // dx3
	                            jpy = c2y + stack.shift();    // dy3
	                            c3x = jpx + stack.shift();    // dx4
	                            c3y = jpy + stack.shift();    // dy4
	                            c4x = c3x + stack.shift();    // dx5
	                            c4y = c3y + stack.shift();    // dy5
	                            if (Math.abs(c4x - x) > Math.abs(c4y - y)) {
	                                x = c4x + stack.shift();
	                            } else {
	                                y = c4y + stack.shift();
	                            }

	                            p.curveTo(c1x, c1y, c2x, c2y, jpx, jpy);
	                            p.curveTo(c3x, c3y, c4x, c4y, x, y);
	                            break;
	                        default:
	                            console.log('Glyph ' + glyph.index + ': unknown operator ' + 1200 + v);
	                            stack.length = 0;
	                    }
	                    break;
	                case 14: // endchar
	                    if (stack.length > 0 && !haveWidth) {
	                        width = stack.shift() + nominalWidthX;
	                        haveWidth = true;
	                    }

	                    if (open) {
	                        p.closePath();
	                        open = false;
	                    }

	                    break;
	                case 18: // hstemhm
	                    parseStems();
	                    break;
	                case 19: // hintmask
	                case 20: // cntrmask
	                    parseStems();
	                    i += (nStems + 7) >> 3;
	                    break;
	                case 21: // rmoveto
	                    if (stack.length > 2 && !haveWidth) {
	                        width = stack.shift() + nominalWidthX;
	                        haveWidth = true;
	                    }

	                    y += stack.pop();
	                    x += stack.pop();
	                    newContour(x, y);
	                    break;
	                case 22: // hmoveto
	                    if (stack.length > 1 && !haveWidth) {
	                        width = stack.shift() + nominalWidthX;
	                        haveWidth = true;
	                    }

	                    x += stack.pop();
	                    newContour(x, y);
	                    break;
	                case 23: // vstemhm
	                    parseStems();
	                    break;
	                case 24: // rcurveline
	                    while (stack.length > 2) {
	                        c1x = x + stack.shift();
	                        c1y = y + stack.shift();
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        x = c2x + stack.shift();
	                        y = c2y + stack.shift();
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    }

	                    x += stack.shift();
	                    y += stack.shift();
	                    p.lineTo(x, y);
	                    break;
	                case 25: // rlinecurve
	                    while (stack.length > 6) {
	                        x += stack.shift();
	                        y += stack.shift();
	                        p.lineTo(x, y);
	                    }

	                    c1x = x + stack.shift();
	                    c1y = y + stack.shift();
	                    c2x = c1x + stack.shift();
	                    c2y = c1y + stack.shift();
	                    x = c2x + stack.shift();
	                    y = c2y + stack.shift();
	                    p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    break;
	                case 26: // vvcurveto
	                    if (stack.length % 2) {
	                        x += stack.shift();
	                    }

	                    while (stack.length > 0) {
	                        c1x = x;
	                        c1y = y + stack.shift();
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        x = c2x;
	                        y = c2y + stack.shift();
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    }

	                    break;
	                case 27: // hhcurveto
	                    if (stack.length % 2) {
	                        y += stack.shift();
	                    }

	                    while (stack.length > 0) {
	                        c1x = x + stack.shift();
	                        c1y = y;
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        x = c2x + stack.shift();
	                        y = c2y;
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    }

	                    break;
	                case 28: // shortint
	                    b1 = code[i];
	                    b2 = code[i + 1];
	                    stack.push(((b1 << 24) | (b2 << 16)) >> 16);
	                    i += 2;
	                    break;
	                case 29: // callgsubr
	                    codeIndex = stack.pop() + font.gsubrsBias;
	                    subrCode = font.gsubrs[codeIndex];
	                    if (subrCode) {
	                        parse$$1(subrCode);
	                    }

	                    break;
	                case 30: // vhcurveto
	                    while (stack.length > 0) {
	                        c1x = x;
	                        c1y = y + stack.shift();
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        x = c2x + stack.shift();
	                        y = c2y + (stack.length === 1 ? stack.shift() : 0);
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                        if (stack.length === 0) {
	                            break;
	                        }

	                        c1x = x + stack.shift();
	                        c1y = y;
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        y = c2y + stack.shift();
	                        x = c2x + (stack.length === 1 ? stack.shift() : 0);
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    }

	                    break;
	                case 31: // hvcurveto
	                    while (stack.length > 0) {
	                        c1x = x + stack.shift();
	                        c1y = y;
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        y = c2y + stack.shift();
	                        x = c2x + (stack.length === 1 ? stack.shift() : 0);
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                        if (stack.length === 0) {
	                            break;
	                        }

	                        c1x = x;
	                        c1y = y + stack.shift();
	                        c2x = c1x + stack.shift();
	                        c2y = c1y + stack.shift();
	                        x = c2x + stack.shift();
	                        y = c2y + (stack.length === 1 ? stack.shift() : 0);
	                        p.curveTo(c1x, c1y, c2x, c2y, x, y);
	                    }

	                    break;
	                default:
	                    if (v < 32) {
	                        console.log('Glyph ' + glyph.index + ': unknown operator ' + v);
	                    } else if (v < 247) {
	                        stack.push(v - 139);
	                    } else if (v < 251) {
	                        b1 = code[i];
	                        i += 1;
	                        stack.push((v - 247) * 256 + b1 + 108);
	                    } else if (v < 255) {
	                        b1 = code[i];
	                        i += 1;
	                        stack.push(-(v - 251) * 256 - b1 - 108);
	                    } else {
	                        b1 = code[i];
	                        b2 = code[i + 1];
	                        b3 = code[i + 2];
	                        b4 = code[i + 3];
	                        i += 4;
	                        stack.push(((b1 << 24) | (b2 << 16) | (b3 << 8) | b4) / 65536);
	                    }
	            }
	        }
	    }

	    parse$$1(code);

	    glyph.advanceWidth = width;
	    return p;
	}

	function parseCFFFDSelect(data, start, nGlyphs, fdArrayCount) {
	    const fdSelect = [];
	    let fdIndex;
	    const parser = new parse.Parser(data, start);
	    const format = parser.parseCard8();
	    if (format === 0) {
	        // Simple list of nGlyphs elements
	        for (let iGid = 0; iGid < nGlyphs; iGid++) {
	            fdIndex = parser.parseCard8();
	            if (fdIndex >= fdArrayCount) {
	                throw new Error('CFF table CID Font FDSelect has bad FD index value ' + fdIndex + ' (FD count ' + fdArrayCount + ')');
	            }
	            fdSelect.push(fdIndex);
	        }
	    } else if (format === 3) {
	        // Ranges
	        const nRanges = parser.parseCard16();
	        let first = parser.parseCard16();
	        if (first !== 0) {
	            throw new Error('CFF Table CID Font FDSelect format 3 range has bad initial GID ' + first);
	        }
	        let next;
	        for (let iRange = 0; iRange < nRanges; iRange++) {
	            fdIndex = parser.parseCard8();
	            next = parser.parseCard16();
	            if (fdIndex >= fdArrayCount) {
	                throw new Error('CFF table CID Font FDSelect has bad FD index value ' + fdIndex + ' (FD count ' + fdArrayCount + ')');
	            }
	            if (next > nGlyphs) {
	                throw new Error('CFF Table CID Font FDSelect format 3 range has bad GID ' + next);
	            }
	            for (; first < next; first++) {
	                fdSelect.push(fdIndex);
	            }
	            first = next;
	        }
	        if (next !== nGlyphs) {
	            throw new Error('CFF Table CID Font FDSelect format 3 range has bad final GID ' + next);
	        }
	    } else {
	        throw new Error('CFF Table CID Font FDSelect table has unsupported format ' + format);
	    }
	    return fdSelect;
	}

	// Parse the `CFF` table, which contains the glyph outlines in PostScript format.
	function parseCFFTable(data, start, font, opt) {
	    font.tables.cff = {};
	    const header = parseCFFHeader(data, start);
	    const nameIndex = parseCFFIndex(data, header.endOffset, parse.bytesToString);
	    const topDictIndex = parseCFFIndex(data, nameIndex.endOffset);
	    const stringIndex = parseCFFIndex(data, topDictIndex.endOffset, parse.bytesToString);
	    const globalSubrIndex = parseCFFIndex(data, stringIndex.endOffset);
	    font.gsubrs = globalSubrIndex.objects;
	    font.gsubrsBias = calcCFFSubroutineBias(font.gsubrs);

	    const topDictArray = gatherCFFTopDicts(data, start, topDictIndex.objects, stringIndex.objects);
	    if (topDictArray.length !== 1) {
	        throw new Error('CFF table has too many fonts in \'FontSet\' - count of fonts NameIndex.length = ' + topDictArray.length);
	    }

	    const topDict = topDictArray[0];
	    font.tables.cff.topDict = topDict;

	    if (topDict._privateDict) {
	        font.defaultWidthX = topDict._privateDict.defaultWidthX;
	        font.nominalWidthX = topDict._privateDict.nominalWidthX;
	    }

	    if (topDict.ros[0] !== undefined && topDict.ros[1] !== undefined) {
	        font.isCIDFont = true;
	    }

	    if (font.isCIDFont) {
	        let fdArrayOffset = topDict.fdArray;
	        let fdSelectOffset = topDict.fdSelect;
	        if (fdArrayOffset === 0 || fdSelectOffset === 0) {
	            throw new Error('Font is marked as a CID font, but FDArray and/or FDSelect information is missing');
	        }
	        fdArrayOffset += start;
	        const fdArrayIndex = parseCFFIndex(data, fdArrayOffset);
	        const fdArray = gatherCFFTopDicts(data, start, fdArrayIndex.objects, stringIndex.objects);
	        topDict._fdArray = fdArray;
	        fdSelectOffset += start;
	        topDict._fdSelect = parseCFFFDSelect(data, fdSelectOffset, font.numGlyphs, fdArray.length);
	    }

	    const privateDictOffset = start + topDict.private[1];
	    const privateDict = parseCFFPrivateDict(data, privateDictOffset, topDict.private[0], stringIndex.objects);
	    font.defaultWidthX = privateDict.defaultWidthX;
	    font.nominalWidthX = privateDict.nominalWidthX;

	    if (privateDict.subrs !== 0) {
	        const subrOffset = privateDictOffset + privateDict.subrs;
	        const subrIndex = parseCFFIndex(data, subrOffset);
	        font.subrs = subrIndex.objects;
	        font.subrsBias = calcCFFSubroutineBias(font.subrs);
	    } else {
	        font.subrs = [];
	        font.subrsBias = 0;
	    }

	    // Offsets in the top dict are relative to the beginning of the CFF data, so add the CFF start offset.
	    let charStringsIndex;
	    if (opt.lowMemory) {
	        charStringsIndex = parseCFFIndexLowMemory(data, start + topDict.charStrings);
	        font.nGlyphs = charStringsIndex.offsets.length;
	    } else {
	        charStringsIndex = parseCFFIndex(data, start + topDict.charStrings);
	        font.nGlyphs = charStringsIndex.objects.length;
	    }

	    const charset = parseCFFCharset(data, start + topDict.charset, font.nGlyphs, stringIndex.objects);
	    if (topDict.encoding === 0) {
	        // Standard encoding
	        font.cffEncoding = new CffEncoding(cffStandardEncoding, charset);
	    } else if (topDict.encoding === 1) {
	        // Expert encoding
	        font.cffEncoding = new CffEncoding(cffExpertEncoding, charset);
	    } else {
	        font.cffEncoding = parseCFFEncoding(data, start + topDict.encoding, charset);
	    }

	    // Prefer the CMAP encoding to the CFF encoding.
	    font.encoding = font.encoding || font.cffEncoding;

	    font.glyphs = new glyphset.GlyphSet(font);
	    if (opt.lowMemory) {
	        font._push = function(i) {
	            const charString = getCffIndexObject(i, charStringsIndex.offsets, data, start + topDict.charStrings);
	            font.glyphs.push(i, glyphset.cffGlyphLoader(font, i, parseCFFCharstring, charString));
	        };
	    } else {
	        for (let i = 0; i < font.nGlyphs; i += 1) {
	            const charString = charStringsIndex.objects[i];
	            font.glyphs.push(i, glyphset.cffGlyphLoader(font, i, parseCFFCharstring, charString));
	        }
	    }
	}

	// Convert a string to a String ID (SID).
	// The list of strings is modified in place.
	function encodeString(s, strings) {
	    let sid;

	    // Is the string in the CFF standard strings?
	    let i = cffStandardStrings.indexOf(s);
	    if (i >= 0) {
	        sid = i;
	    }

	    // Is the string already in the string index?
	    i = strings.indexOf(s);
	    if (i >= 0) {
	        sid = i + cffStandardStrings.length;
	    } else {
	        sid = cffStandardStrings.length + strings.length;
	        strings.push(s);
	    }

	    return sid;
	}

	function makeHeader() {
	    return new table.Record('Header', [
	        {name: 'major', type: 'Card8', value: 1},
	        {name: 'minor', type: 'Card8', value: 0},
	        {name: 'hdrSize', type: 'Card8', value: 4},
	        {name: 'major', type: 'Card8', value: 1}
	    ]);
	}

	function makeNameIndex(fontNames) {
	    const t = new table.Record('Name INDEX', [
	        {name: 'names', type: 'INDEX', value: []}
	    ]);
	    t.names = [];
	    for (let i = 0; i < fontNames.length; i += 1) {
	        t.names.push({name: 'name_' + i, type: 'NAME', value: fontNames[i]});
	    }

	    return t;
	}

	// Given a dictionary's metadata, create a DICT structure.
	function makeDict(meta, attrs, strings) {
	    const m = {};
	    for (let i = 0; i < meta.length; i += 1) {
	        const entry = meta[i];
	        let value = attrs[entry.name];
	        if (value !== undefined && !equals(value, entry.value)) {
	            if (entry.type === 'SID') {
	                value = encodeString(value, strings);
	            }

	            m[entry.op] = {name: entry.name, type: entry.type, value: value};
	        }
	    }

	    return m;
	}

	// The Top DICT houses the global font attributes.
	function makeTopDict(attrs, strings) {
	    const t = new table.Record('Top DICT', [
	        {name: 'dict', type: 'DICT', value: {}}
	    ]);
	    t.dict = makeDict(TOP_DICT_META, attrs, strings);
	    return t;
	}

	function makeTopDictIndex(topDict) {
	    const t = new table.Record('Top DICT INDEX', [
	        {name: 'topDicts', type: 'INDEX', value: []}
	    ]);
	    t.topDicts = [{name: 'topDict_0', type: 'TABLE', value: topDict}];
	    return t;
	}

	function makeStringIndex(strings) {
	    const t = new table.Record('String INDEX', [
	        {name: 'strings', type: 'INDEX', value: []}
	    ]);
	    t.strings = [];
	    for (let i = 0; i < strings.length; i += 1) {
	        t.strings.push({name: 'string_' + i, type: 'STRING', value: strings[i]});
	    }

	    return t;
	}

	function makeGlobalSubrIndex() {
	    // Currently we don't use subroutines.
	    return new table.Record('Global Subr INDEX', [
	        {name: 'subrs', type: 'INDEX', value: []}
	    ]);
	}

	function makeCharsets(glyphNames, strings) {
	    const t = new table.Record('Charsets', [
	        {name: 'format', type: 'Card8', value: 0}
	    ]);
	    for (let i = 0; i < glyphNames.length; i += 1) {
	        const glyphName = glyphNames[i];
	        const glyphSID = encodeString(glyphName, strings);
	        t.fields.push({name: 'glyph_' + i, type: 'SID', value: glyphSID});
	    }

	    return t;
	}

	function glyphToOps(glyph) {
	    const ops = [];
	    const path = glyph.path;
	    ops.push({name: 'width', type: 'NUMBER', value: glyph.advanceWidth});
	    let x = 0;
	    let y = 0;
	    for (let i = 0; i < path.commands.length; i += 1) {
	        let dx;
	        let dy;
	        let cmd = path.commands[i];
	        if (cmd.type === 'Q') {
	            // CFF only supports bézier curves, so convert the quad to a bézier.
	            const _13 = 1 / 3;
	            const _23 = 2 / 3;

	            // We're going to create a new command so we don't change the original path.
	            cmd = {
	                type: 'C',
	                x: cmd.x,
	                y: cmd.y,
	                x1: _13 * x + _23 * cmd.x1,
	                y1: _13 * y + _23 * cmd.y1,
	                x2: _13 * cmd.x + _23 * cmd.x1,
	                y2: _13 * cmd.y + _23 * cmd.y1
	            };
	        }

	        if (cmd.type === 'M') {
	            dx = Math.round(cmd.x - x);
	            dy = Math.round(cmd.y - y);
	            ops.push({name: 'dx', type: 'NUMBER', value: dx});
	            ops.push({name: 'dy', type: 'NUMBER', value: dy});
	            ops.push({name: 'rmoveto', type: 'OP', value: 21});
	            x = Math.round(cmd.x);
	            y = Math.round(cmd.y);
	        } else if (cmd.type === 'L') {
	            dx = Math.round(cmd.x - x);
	            dy = Math.round(cmd.y - y);
	            ops.push({name: 'dx', type: 'NUMBER', value: dx});
	            ops.push({name: 'dy', type: 'NUMBER', value: dy});
	            ops.push({name: 'rlineto', type: 'OP', value: 5});
	            x = Math.round(cmd.x);
	            y = Math.round(cmd.y);
	        } else if (cmd.type === 'C') {
	            const dx1 = Math.round(cmd.x1 - x);
	            const dy1 = Math.round(cmd.y1 - y);
	            const dx2 = Math.round(cmd.x2 - cmd.x1);
	            const dy2 = Math.round(cmd.y2 - cmd.y1);
	            dx = Math.round(cmd.x - cmd.x2);
	            dy = Math.round(cmd.y - cmd.y2);
	            ops.push({name: 'dx1', type: 'NUMBER', value: dx1});
	            ops.push({name: 'dy1', type: 'NUMBER', value: dy1});
	            ops.push({name: 'dx2', type: 'NUMBER', value: dx2});
	            ops.push({name: 'dy2', type: 'NUMBER', value: dy2});
	            ops.push({name: 'dx', type: 'NUMBER', value: dx});
	            ops.push({name: 'dy', type: 'NUMBER', value: dy});
	            ops.push({name: 'rrcurveto', type: 'OP', value: 8});
	            x = Math.round(cmd.x);
	            y = Math.round(cmd.y);
	        }

	        // Contours are closed automatically.
	    }

	    ops.push({name: 'endchar', type: 'OP', value: 14});
	    return ops;
	}

	function makeCharStringsIndex(glyphs) {
	    const t = new table.Record('CharStrings INDEX', [
	        {name: 'charStrings', type: 'INDEX', value: []}
	    ]);

	    for (let i = 0; i < glyphs.length; i += 1) {
	        const glyph = glyphs.get(i);
	        const ops = glyphToOps(glyph);
	        t.charStrings.push({name: glyph.name, type: 'CHARSTRING', value: ops});
	    }

	    return t;
	}

	function makePrivateDict(attrs, strings) {
	    const t = new table.Record('Private DICT', [
	        {name: 'dict', type: 'DICT', value: {}}
	    ]);
	    t.dict = makeDict(PRIVATE_DICT_META, attrs, strings);
	    return t;
	}

	function makeCFFTable(glyphs, options) {
	    const t = new table.Table('CFF ', [
	        {name: 'header', type: 'RECORD'},
	        {name: 'nameIndex', type: 'RECORD'},
	        {name: 'topDictIndex', type: 'RECORD'},
	        {name: 'stringIndex', type: 'RECORD'},
	        {name: 'globalSubrIndex', type: 'RECORD'},
	        {name: 'charsets', type: 'RECORD'},
	        {name: 'charStringsIndex', type: 'RECORD'},
	        {name: 'privateDict', type: 'RECORD'}
	    ]);

	    const fontScale = 1 / options.unitsPerEm;
	    // We use non-zero values for the offsets so that the DICT encodes them.
	    // This is important because the size of the Top DICT plays a role in offset calculation,
	    // and the size shouldn't change after we've written correct offsets.
	    const attrs = {
	        version: options.version,
	        fullName: options.fullName,
	        familyName: options.familyName,
	        weight: options.weightName,
	        fontBBox: options.fontBBox || [0, 0, 0, 0],
	        fontMatrix: [fontScale, 0, 0, fontScale, 0, 0],
	        charset: 999,
	        encoding: 0,
	        charStrings: 999,
	        private: [0, 999]
	    };

	    const privateAttrs = {};

	    const glyphNames = [];
	    let glyph;

	    // Skip first glyph (.notdef)
	    for (let i = 1; i < glyphs.length; i += 1) {
	        glyph = glyphs.get(i);
	        glyphNames.push(glyph.name);
	    }

	    const strings = [];

	    t.header = makeHeader();
	    t.nameIndex = makeNameIndex([options.postScriptName]);
	    let topDict = makeTopDict(attrs, strings);
	    t.topDictIndex = makeTopDictIndex(topDict);
	    t.globalSubrIndex = makeGlobalSubrIndex();
	    t.charsets = makeCharsets(glyphNames, strings);
	    t.charStringsIndex = makeCharStringsIndex(glyphs);
	    t.privateDict = makePrivateDict(privateAttrs, strings);

	    // Needs to come at the end, to encode all custom strings used in the font.
	    t.stringIndex = makeStringIndex(strings);

	    const startOffset = t.header.sizeOf() +
	        t.nameIndex.sizeOf() +
	        t.topDictIndex.sizeOf() +
	        t.stringIndex.sizeOf() +
	        t.globalSubrIndex.sizeOf();
	    attrs.charset = startOffset;

	    // We use the CFF standard encoding; proper encoding will be handled in cmap.
	    attrs.encoding = 0;
	    attrs.charStrings = attrs.charset + t.charsets.sizeOf();
	    attrs.private[1] = attrs.charStrings + t.charStringsIndex.sizeOf();

	    // Recreate the Top DICT INDEX with the correct offsets.
	    topDict = makeTopDict(attrs, strings);
	    t.topDictIndex = makeTopDictIndex(topDict);

	    return t;
	}

	var cff = { parse: parseCFFTable, make: makeCFFTable };

	// The `head` table contains global information about the font.

	// Parse the header `head` table
	function parseHeadTable(data, start) {
	    const head = {};
	    const p = new parse.Parser(data, start);
	    head.version = p.parseVersion();
	    head.fontRevision = Math.round(p.parseFixed() * 1000) / 1000;
	    head.checkSumAdjustment = p.parseULong();
	    head.magicNumber = p.parseULong();
	    check.argument(head.magicNumber === 0x5F0F3CF5, 'Font header has wrong magic number.');
	    head.flags = p.parseUShort();
	    head.unitsPerEm = p.parseUShort();
	    head.created = p.parseLongDateTime();
	    head.modified = p.parseLongDateTime();
	    head.xMin = p.parseShort();
	    head.yMin = p.parseShort();
	    head.xMax = p.parseShort();
	    head.yMax = p.parseShort();
	    head.macStyle = p.parseUShort();
	    head.lowestRecPPEM = p.parseUShort();
	    head.fontDirectionHint = p.parseShort();
	    head.indexToLocFormat = p.parseShort();
	    head.glyphDataFormat = p.parseShort();
	    return head;
	}

	function makeHeadTable(options) {
	    // Apple Mac timestamp epoch is 01/01/1904 not 01/01/1970
	    const timestamp = Math.round(new Date().getTime() / 1000) + 2082844800;
	    let createdTimestamp = timestamp;

	    if (options.createdTimestamp) {
	        createdTimestamp = options.createdTimestamp + 2082844800;
	    }

	    return new table.Table('head', [
	        {name: 'version', type: 'FIXED', value: 0x00010000},
	        {name: 'fontRevision', type: 'FIXED', value: 0x00010000},
	        {name: 'checkSumAdjustment', type: 'ULONG', value: 0},
	        {name: 'magicNumber', type: 'ULONG', value: 0x5F0F3CF5},
	        {name: 'flags', type: 'USHORT', value: 0},
	        {name: 'unitsPerEm', type: 'USHORT', value: 1000},
	        {name: 'created', type: 'LONGDATETIME', value: createdTimestamp},
	        {name: 'modified', type: 'LONGDATETIME', value: timestamp},
	        {name: 'xMin', type: 'SHORT', value: 0},
	        {name: 'yMin', type: 'SHORT', value: 0},
	        {name: 'xMax', type: 'SHORT', value: 0},
	        {name: 'yMax', type: 'SHORT', value: 0},
	        {name: 'macStyle', type: 'USHORT', value: 0},
	        {name: 'lowestRecPPEM', type: 'USHORT', value: 0},
	        {name: 'fontDirectionHint', type: 'SHORT', value: 2},
	        {name: 'indexToLocFormat', type: 'SHORT', value: 0},
	        {name: 'glyphDataFormat', type: 'SHORT', value: 0}
	    ], options);
	}

	var head = { parse: parseHeadTable, make: makeHeadTable };

	// The `hhea` table contains information for horizontal layout.

	// Parse the horizontal header `hhea` table
	function parseHheaTable(data, start) {
	    const hhea = {};
	    const p = new parse.Parser(data, start);
	    hhea.version = p.parseVersion();
	    hhea.ascender = p.parseShort();
	    hhea.descender = p.parseShort();
	    hhea.lineGap = p.parseShort();
	    hhea.advanceWidthMax = p.parseUShort();
	    hhea.minLeftSideBearing = p.parseShort();
	    hhea.minRightSideBearing = p.parseShort();
	    hhea.xMaxExtent = p.parseShort();
	    hhea.caretSlopeRise = p.parseShort();
	    hhea.caretSlopeRun = p.parseShort();
	    hhea.caretOffset = p.parseShort();
	    p.relativeOffset += 8;
	    hhea.metricDataFormat = p.parseShort();
	    hhea.numberOfHMetrics = p.parseUShort();
	    return hhea;
	}

	function makeHheaTable(options) {
	    return new table.Table('hhea', [
	        {name: 'version', type: 'FIXED', value: 0x00010000},
	        {name: 'ascender', type: 'FWORD', value: 0},
	        {name: 'descender', type: 'FWORD', value: 0},
	        {name: 'lineGap', type: 'FWORD', value: 0},
	        {name: 'advanceWidthMax', type: 'UFWORD', value: 0},
	        {name: 'minLeftSideBearing', type: 'FWORD', value: 0},
	        {name: 'minRightSideBearing', type: 'FWORD', value: 0},
	        {name: 'xMaxExtent', type: 'FWORD', value: 0},
	        {name: 'caretSlopeRise', type: 'SHORT', value: 1},
	        {name: 'caretSlopeRun', type: 'SHORT', value: 0},
	        {name: 'caretOffset', type: 'SHORT', value: 0},
	        {name: 'reserved1', type: 'SHORT', value: 0},
	        {name: 'reserved2', type: 'SHORT', value: 0},
	        {name: 'reserved3', type: 'SHORT', value: 0},
	        {name: 'reserved4', type: 'SHORT', value: 0},
	        {name: 'metricDataFormat', type: 'SHORT', value: 0},
	        {name: 'numberOfHMetrics', type: 'USHORT', value: 0}
	    ], options);
	}

	var hhea = { parse: parseHheaTable, make: makeHheaTable };

	// The `hmtx` table contains the horizontal metrics for all glyphs.

	function parseHmtxTableAll(data, start, numMetrics, numGlyphs, glyphs) {
	    let advanceWidth;
	    let leftSideBearing;
	    const p = new parse.Parser(data, start);
	    for (let i = 0; i < numGlyphs; i += 1) {
	        // If the font is monospaced, only one entry is needed. This last entry applies to all subsequent glyphs.
	        if (i < numMetrics) {
	            advanceWidth = p.parseUShort();
	            leftSideBearing = p.parseShort();
	        }

	        const glyph = glyphs.get(i);
	        glyph.advanceWidth = advanceWidth;
	        glyph.leftSideBearing = leftSideBearing;
	    }
	}

	function parseHmtxTableOnLowMemory(font, data, start, numMetrics, numGlyphs) {
	    font._hmtxTableData = {};

	    let advanceWidth;
	    let leftSideBearing;
	    const p = new parse.Parser(data, start);
	    for (let i = 0; i < numGlyphs; i += 1) {
	        // If the font is monospaced, only one entry is needed. This last entry applies to all subsequent glyphs.
	        if (i < numMetrics) {
	            advanceWidth = p.parseUShort();
	            leftSideBearing = p.parseShort();
	        }

	        font._hmtxTableData[i] = {
	            advanceWidth: advanceWidth,
	            leftSideBearing: leftSideBearing
	        };
	    }
	}

	// Parse the `hmtx` table, which contains the horizontal metrics for all glyphs.
	// This function augments the glyph array, adding the advanceWidth and leftSideBearing to each glyph.
	function parseHmtxTable(font, data, start, numMetrics, numGlyphs, glyphs, opt) {
	    if (opt.lowMemory)
	        parseHmtxTableOnLowMemory(font, data, start, numMetrics, numGlyphs);
	    else
	        parseHmtxTableAll(data, start, numMetrics, numGlyphs, glyphs);
	}

	function makeHmtxTable(glyphs) {
	    const t = new table.Table('hmtx', []);
	    for (let i = 0; i < glyphs.length; i += 1) {
	        const glyph = glyphs.get(i);
	        const advanceWidth = glyph.advanceWidth || 0;
	        const leftSideBearing = glyph.leftSideBearing || 0;
	        t.fields.push({name: 'advanceWidth_' + i, type: 'USHORT', value: advanceWidth});
	        t.fields.push({name: 'leftSideBearing_' + i, type: 'SHORT', value: leftSideBearing});
	    }

	    return t;
	}

	var hmtx = { parse: parseHmtxTable, make: makeHmtxTable };

	// The `ltag` table stores IETF BCP-47 language tags. It allows supporting

	function makeLtagTable(tags) {
	    const result = new table.Table('ltag', [
	        {name: 'version', type: 'ULONG', value: 1},
	        {name: 'flags', type: 'ULONG', value: 0},
	        {name: 'numTags', type: 'ULONG', value: tags.length}
	    ]);

	    let stringPool = '';
	    const stringPoolOffset = 12 + tags.length * 4;
	    for (let i = 0; i < tags.length; ++i) {
	        let pos = stringPool.indexOf(tags[i]);
	        if (pos < 0) {
	            pos = stringPool.length;
	            stringPool += tags[i];
	        }

	        result.fields.push({name: 'offset ' + i, type: 'USHORT', value: stringPoolOffset + pos});
	        result.fields.push({name: 'length ' + i, type: 'USHORT', value: tags[i].length});
	    }

	    result.fields.push({name: 'stringPool', type: 'CHARARRAY', value: stringPool});
	    return result;
	}

	function parseLtagTable(data, start) {
	    const p = new parse.Parser(data, start);
	    const tableVersion = p.parseULong();
	    check.argument(tableVersion === 1, 'Unsupported ltag table version.');
	    // The 'ltag' specification does not define any flags; skip the field.
	    p.skip('uLong', 1);
	    const numTags = p.parseULong();

	    const tags = [];
	    for (let i = 0; i < numTags; i++) {
	        let tag = '';
	        const offset = start + p.parseUShort();
	        const length = p.parseUShort();
	        for (let j = offset; j < offset + length; ++j) {
	            tag += String.fromCharCode(data.getInt8(j));
	        }

	        tags.push(tag);
	    }

	    return tags;
	}

	var ltag = { make: makeLtagTable, parse: parseLtagTable };

	// The `maxp` table establishes the memory requirements for the font.

	// Parse the maximum profile `maxp` table.
	function parseMaxpTable(data, start) {
	    const maxp = {};
	    const p = new parse.Parser(data, start);
	    maxp.version = p.parseVersion();
	    maxp.numGlyphs = p.parseUShort();
	    if (maxp.version === 1.0) {
	        maxp.maxPoints = p.parseUShort();
	        maxp.maxContours = p.parseUShort();
	        maxp.maxCompositePoints = p.parseUShort();
	        maxp.maxCompositeContours = p.parseUShort();
	        maxp.maxZones = p.parseUShort();
	        maxp.maxTwilightPoints = p.parseUShort();
	        maxp.maxStorage = p.parseUShort();
	        maxp.maxFunctionDefs = p.parseUShort();
	        maxp.maxInstructionDefs = p.parseUShort();
	        maxp.maxStackElements = p.parseUShort();
	        maxp.maxSizeOfInstructions = p.parseUShort();
	        maxp.maxComponentElements = p.parseUShort();
	        maxp.maxComponentDepth = p.parseUShort();
	    }

	    return maxp;
	}

	function makeMaxpTable(numGlyphs) {
	    return new table.Table('maxp', [
	        {name: 'version', type: 'FIXED', value: 0x00005000},
	        {name: 'numGlyphs', type: 'USHORT', value: numGlyphs}
	    ]);
	}

	var maxp = { parse: parseMaxpTable, make: makeMaxpTable };

	// The `name` naming table.

	// NameIDs for the name table.
	const nameTableNames = [
	    'copyright',              // 0
	    'fontFamily',             // 1
	    'fontSubfamily',          // 2
	    'uniqueID',               // 3
	    'fullName',               // 4
	    'version',                // 5
	    'postScriptName',         // 6
	    'trademark',              // 7
	    'manufacturer',           // 8
	    'designer',               // 9
	    'description',            // 10
	    'manufacturerURL',        // 11
	    'designerURL',            // 12
	    'license',                // 13
	    'licenseURL',             // 14
	    'reserved',               // 15
	    'preferredFamily',        // 16
	    'preferredSubfamily',     // 17
	    'compatibleFullName',     // 18
	    'sampleText',             // 19
	    'postScriptFindFontName', // 20
	    'wwsFamily',              // 21
	    'wwsSubfamily'            // 22
	];

	const macLanguages = {
	    0: 'en',
	    1: 'fr',
	    2: 'de',
	    3: 'it',
	    4: 'nl',
	    5: 'sv',
	    6: 'es',
	    7: 'da',
	    8: 'pt',
	    9: 'no',
	    10: 'he',
	    11: 'ja',
	    12: 'ar',
	    13: 'fi',
	    14: 'el',
	    15: 'is',
	    16: 'mt',
	    17: 'tr',
	    18: 'hr',
	    19: 'zh-Hant',
	    20: 'ur',
	    21: 'hi',
	    22: 'th',
	    23: 'ko',
	    24: 'lt',
	    25: 'pl',
	    26: 'hu',
	    27: 'es',
	    28: 'lv',
	    29: 'se',
	    30: 'fo',
	    31: 'fa',
	    32: 'ru',
	    33: 'zh',
	    34: 'nl-BE',
	    35: 'ga',
	    36: 'sq',
	    37: 'ro',
	    38: 'cz',
	    39: 'sk',
	    40: 'si',
	    41: 'yi',
	    42: 'sr',
	    43: 'mk',
	    44: 'bg',
	    45: 'uk',
	    46: 'be',
	    47: 'uz',
	    48: 'kk',
	    49: 'az-Cyrl',
	    50: 'az-Arab',
	    51: 'hy',
	    52: 'ka',
	    53: 'mo',
	    54: 'ky',
	    55: 'tg',
	    56: 'tk',
	    57: 'mn-CN',
	    58: 'mn',
	    59: 'ps',
	    60: 'ks',
	    61: 'ku',
	    62: 'sd',
	    63: 'bo',
	    64: 'ne',
	    65: 'sa',
	    66: 'mr',
	    67: 'bn',
	    68: 'as',
	    69: 'gu',
	    70: 'pa',
	    71: 'or',
	    72: 'ml',
	    73: 'kn',
	    74: 'ta',
	    75: 'te',
	    76: 'si',
	    77: 'my',
	    78: 'km',
	    79: 'lo',
	    80: 'vi',
	    81: 'id',
	    82: 'tl',
	    83: 'ms',
	    84: 'ms-Arab',
	    85: 'am',
	    86: 'ti',
	    87: 'om',
	    88: 'so',
	    89: 'sw',
	    90: 'rw',
	    91: 'rn',
	    92: 'ny',
	    93: 'mg',
	    94: 'eo',
	    128: 'cy',
	    129: 'eu',
	    130: 'ca',
	    131: 'la',
	    132: 'qu',
	    133: 'gn',
	    134: 'ay',
	    135: 'tt',
	    136: 'ug',
	    137: 'dz',
	    138: 'jv',
	    139: 'su',
	    140: 'gl',
	    141: 'af',
	    142: 'br',
	    143: 'iu',
	    144: 'gd',
	    145: 'gv',
	    146: 'ga',
	    147: 'to',
	    148: 'el-polyton',
	    149: 'kl',
	    150: 'az',
	    151: 'nn'
	};

	// MacOS language ID → MacOS script ID
	//
	// Note that the script ID is not sufficient to determine what encoding
	// to use in TrueType files. For some languages, MacOS used a modification
	// of a mainstream script. For example, an Icelandic name would be stored
	// with smRoman in the TrueType naming table, but the actual encoding
	// is a special Icelandic version of the normal Macintosh Roman encoding.
	// As another example, Inuktitut uses an 8-bit encoding for Canadian Aboriginal
	// Syllables but MacOS had run out of available script codes, so this was
	// done as a (pretty radical) "modification" of Ethiopic.
	//
	// http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/Readme.txt
	const macLanguageToScript = {
	    0: 0,  // langEnglish → smRoman
	    1: 0,  // langFrench → smRoman
	    2: 0,  // langGerman → smRoman
	    3: 0,  // langItalian → smRoman
	    4: 0,  // langDutch → smRoman
	    5: 0,  // langSwedish → smRoman
	    6: 0,  // langSpanish → smRoman
	    7: 0,  // langDanish → smRoman
	    8: 0,  // langPortuguese → smRoman
	    9: 0,  // langNorwegian → smRoman
	    10: 5,  // langHebrew → smHebrew
	    11: 1,  // langJapanese → smJapanese
	    12: 4,  // langArabic → smArabic
	    13: 0,  // langFinnish → smRoman
	    14: 6,  // langGreek → smGreek
	    15: 0,  // langIcelandic → smRoman (modified)
	    16: 0,  // langMaltese → smRoman
	    17: 0,  // langTurkish → smRoman (modified)
	    18: 0,  // langCroatian → smRoman (modified)
	    19: 2,  // langTradChinese → smTradChinese
	    20: 4,  // langUrdu → smArabic
	    21: 9,  // langHindi → smDevanagari
	    22: 21,  // langThai → smThai
	    23: 3,  // langKorean → smKorean
	    24: 29,  // langLithuanian → smCentralEuroRoman
	    25: 29,  // langPolish → smCentralEuroRoman
	    26: 29,  // langHungarian → smCentralEuroRoman
	    27: 29,  // langEstonian → smCentralEuroRoman
	    28: 29,  // langLatvian → smCentralEuroRoman
	    29: 0,  // langSami → smRoman
	    30: 0,  // langFaroese → smRoman (modified)
	    31: 4,  // langFarsi → smArabic (modified)
	    32: 7,  // langRussian → smCyrillic
	    33: 25,  // langSimpChinese → smSimpChinese
	    34: 0,  // langFlemish → smRoman
	    35: 0,  // langIrishGaelic → smRoman (modified)
	    36: 0,  // langAlbanian → smRoman
	    37: 0,  // langRomanian → smRoman (modified)
	    38: 29,  // langCzech → smCentralEuroRoman
	    39: 29,  // langSlovak → smCentralEuroRoman
	    40: 0,  // langSlovenian → smRoman (modified)
	    41: 5,  // langYiddish → smHebrew
	    42: 7,  // langSerbian → smCyrillic
	    43: 7,  // langMacedonian → smCyrillic
	    44: 7,  // langBulgarian → smCyrillic
	    45: 7,  // langUkrainian → smCyrillic (modified)
	    46: 7,  // langByelorussian → smCyrillic
	    47: 7,  // langUzbek → smCyrillic
	    48: 7,  // langKazakh → smCyrillic
	    49: 7,  // langAzerbaijani → smCyrillic
	    50: 4,  // langAzerbaijanAr → smArabic
	    51: 24,  // langArmenian → smArmenian
	    52: 23,  // langGeorgian → smGeorgian
	    53: 7,  // langMoldavian → smCyrillic
	    54: 7,  // langKirghiz → smCyrillic
	    55: 7,  // langTajiki → smCyrillic
	    56: 7,  // langTurkmen → smCyrillic
	    57: 27,  // langMongolian → smMongolian
	    58: 7,  // langMongolianCyr → smCyrillic
	    59: 4,  // langPashto → smArabic
	    60: 4,  // langKurdish → smArabic
	    61: 4,  // langKashmiri → smArabic
	    62: 4,  // langSindhi → smArabic
	    63: 26,  // langTibetan → smTibetan
	    64: 9,  // langNepali → smDevanagari
	    65: 9,  // langSanskrit → smDevanagari
	    66: 9,  // langMarathi → smDevanagari
	    67: 13,  // langBengali → smBengali
	    68: 13,  // langAssamese → smBengali
	    69: 11,  // langGujarati → smGujarati
	    70: 10,  // langPunjabi → smGurmukhi
	    71: 12,  // langOriya → smOriya
	    72: 17,  // langMalayalam → smMalayalam
	    73: 16,  // langKannada → smKannada
	    74: 14,  // langTamil → smTamil
	    75: 15,  // langTelugu → smTelugu
	    76: 18,  // langSinhalese → smSinhalese
	    77: 19,  // langBurmese → smBurmese
	    78: 20,  // langKhmer → smKhmer
	    79: 22,  // langLao → smLao
	    80: 30,  // langVietnamese → smVietnamese
	    81: 0,  // langIndonesian → smRoman
	    82: 0,  // langTagalog → smRoman
	    83: 0,  // langMalayRoman → smRoman
	    84: 4,  // langMalayArabic → smArabic
	    85: 28,  // langAmharic → smEthiopic
	    86: 28,  // langTigrinya → smEthiopic
	    87: 28,  // langOromo → smEthiopic
	    88: 0,  // langSomali → smRoman
	    89: 0,  // langSwahili → smRoman
	    90: 0,  // langKinyarwanda → smRoman
	    91: 0,  // langRundi → smRoman
	    92: 0,  // langNyanja → smRoman
	    93: 0,  // langMalagasy → smRoman
	    94: 0,  // langEsperanto → smRoman
	    128: 0,  // langWelsh → smRoman (modified)
	    129: 0,  // langBasque → smRoman
	    130: 0,  // langCatalan → smRoman
	    131: 0,  // langLatin → smRoman
	    132: 0,  // langQuechua → smRoman
	    133: 0,  // langGuarani → smRoman
	    134: 0,  // langAymara → smRoman
	    135: 7,  // langTatar → smCyrillic
	    136: 4,  // langUighur → smArabic
	    137: 26,  // langDzongkha → smTibetan
	    138: 0,  // langJavaneseRom → smRoman
	    139: 0,  // langSundaneseRom → smRoman
	    140: 0,  // langGalician → smRoman
	    141: 0,  // langAfrikaans → smRoman
	    142: 0,  // langBreton → smRoman (modified)
	    143: 28,  // langInuktitut → smEthiopic (modified)
	    144: 0,  // langScottishGaelic → smRoman (modified)
	    145: 0,  // langManxGaelic → smRoman (modified)
	    146: 0,  // langIrishGaelicScript → smRoman (modified)
	    147: 0,  // langTongan → smRoman
	    148: 6,  // langGreekAncient → smRoman
	    149: 0,  // langGreenlandic → smRoman
	    150: 0,  // langAzerbaijanRoman → smRoman
	    151: 0   // langNynorsk → smRoman
	};

	// While Microsoft indicates a region/country for all its language
	// IDs, we omit the region code if it's equal to the "most likely
	// region subtag" according to Unicode CLDR. For scripts, we omit
	// the subtag if it is equal to the Suppress-Script entry in the
	// IANA language subtag registry for IETF BCP 47.
	//
	// For example, Microsoft states that its language code 0x041A is
	// Croatian in Croatia. We transform this to the BCP 47 language code 'hr'
	// and not 'hr-HR' because Croatia is the default country for Croatian,
	// according to Unicode CLDR. As another example, Microsoft states
	// that 0x101A is Croatian (Latin) in Bosnia-Herzegovina. We transform
	// this to 'hr-BA' and not 'hr-Latn-BA' because Latin is the default script
	// for the Croatian language, according to IANA.
	//
	// http://www.unicode.org/cldr/charts/latest/supplemental/likely_subtags.html
	// http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
	const windowsLanguages = {
	    0x0436: 'af',
	    0x041C: 'sq',
	    0x0484: 'gsw',
	    0x045E: 'am',
	    0x1401: 'ar-DZ',
	    0x3C01: 'ar-BH',
	    0x0C01: 'ar',
	    0x0801: 'ar-IQ',
	    0x2C01: 'ar-JO',
	    0x3401: 'ar-KW',
	    0x3001: 'ar-LB',
	    0x1001: 'ar-LY',
	    0x1801: 'ary',
	    0x2001: 'ar-OM',
	    0x4001: 'ar-QA',
	    0x0401: 'ar-SA',
	    0x2801: 'ar-SY',
	    0x1C01: 'aeb',
	    0x3801: 'ar-AE',
	    0x2401: 'ar-YE',
	    0x042B: 'hy',
	    0x044D: 'as',
	    0x082C: 'az-Cyrl',
	    0x042C: 'az',
	    0x046D: 'ba',
	    0x042D: 'eu',
	    0x0423: 'be',
	    0x0845: 'bn',
	    0x0445: 'bn-IN',
	    0x201A: 'bs-Cyrl',
	    0x141A: 'bs',
	    0x047E: 'br',
	    0x0402: 'bg',
	    0x0403: 'ca',
	    0x0C04: 'zh-HK',
	    0x1404: 'zh-MO',
	    0x0804: 'zh',
	    0x1004: 'zh-SG',
	    0x0404: 'zh-TW',
	    0x0483: 'co',
	    0x041A: 'hr',
	    0x101A: 'hr-BA',
	    0x0405: 'cs',
	    0x0406: 'da',
	    0x048C: 'prs',
	    0x0465: 'dv',
	    0x0813: 'nl-BE',
	    0x0413: 'nl',
	    0x0C09: 'en-AU',
	    0x2809: 'en-BZ',
	    0x1009: 'en-CA',
	    0x2409: 'en-029',
	    0x4009: 'en-IN',
	    0x1809: 'en-IE',
	    0x2009: 'en-JM',
	    0x4409: 'en-MY',
	    0x1409: 'en-NZ',
	    0x3409: 'en-PH',
	    0x4809: 'en-SG',
	    0x1C09: 'en-ZA',
	    0x2C09: 'en-TT',
	    0x0809: 'en-GB',
	    0x0409: 'en',
	    0x3009: 'en-ZW',
	    0x0425: 'et',
	    0x0438: 'fo',
	    0x0464: 'fil',
	    0x040B: 'fi',
	    0x080C: 'fr-BE',
	    0x0C0C: 'fr-CA',
	    0x040C: 'fr',
	    0x140C: 'fr-LU',
	    0x180C: 'fr-MC',
	    0x100C: 'fr-CH',
	    0x0462: 'fy',
	    0x0456: 'gl',
	    0x0437: 'ka',
	    0x0C07: 'de-AT',
	    0x0407: 'de',
	    0x1407: 'de-LI',
	    0x1007: 'de-LU',
	    0x0807: 'de-CH',
	    0x0408: 'el',
	    0x046F: 'kl',
	    0x0447: 'gu',
	    0x0468: 'ha',
	    0x040D: 'he',
	    0x0439: 'hi',
	    0x040E: 'hu',
	    0x040F: 'is',
	    0x0470: 'ig',
	    0x0421: 'id',
	    0x045D: 'iu',
	    0x085D: 'iu-Latn',
	    0x083C: 'ga',
	    0x0434: 'xh',
	    0x0435: 'zu',
	    0x0410: 'it',
	    0x0810: 'it-CH',
	    0x0411: 'ja',
	    0x044B: 'kn',
	    0x043F: 'kk',
	    0x0453: 'km',
	    0x0486: 'quc',
	    0x0487: 'rw',
	    0x0441: 'sw',
	    0x0457: 'kok',
	    0x0412: 'ko',
	    0x0440: 'ky',
	    0x0454: 'lo',
	    0x0426: 'lv',
	    0x0427: 'lt',
	    0x082E: 'dsb',
	    0x046E: 'lb',
	    0x042F: 'mk',
	    0x083E: 'ms-BN',
	    0x043E: 'ms',
	    0x044C: 'ml',
	    0x043A: 'mt',
	    0x0481: 'mi',
	    0x047A: 'arn',
	    0x044E: 'mr',
	    0x047C: 'moh',
	    0x0450: 'mn',
	    0x0850: 'mn-CN',
	    0x0461: 'ne',
	    0x0414: 'nb',
	    0x0814: 'nn',
	    0x0482: 'oc',
	    0x0448: 'or',
	    0x0463: 'ps',
	    0x0415: 'pl',
	    0x0416: 'pt',
	    0x0816: 'pt-PT',
	    0x0446: 'pa',
	    0x046B: 'qu-BO',
	    0x086B: 'qu-EC',
	    0x0C6B: 'qu',
	    0x0418: 'ro',
	    0x0417: 'rm',
	    0x0419: 'ru',
	    0x243B: 'smn',
	    0x103B: 'smj-NO',
	    0x143B: 'smj',
	    0x0C3B: 'se-FI',
	    0x043B: 'se',
	    0x083B: 'se-SE',
	    0x203B: 'sms',
	    0x183B: 'sma-NO',
	    0x1C3B: 'sms',
	    0x044F: 'sa',
	    0x1C1A: 'sr-Cyrl-BA',
	    0x0C1A: 'sr',
	    0x181A: 'sr-Latn-BA',
	    0x081A: 'sr-Latn',
	    0x046C: 'nso',
	    0x0432: 'tn',
	    0x045B: 'si',
	    0x041B: 'sk',
	    0x0424: 'sl',
	    0x2C0A: 'es-AR',
	    0x400A: 'es-BO',
	    0x340A: 'es-CL',
	    0x240A: 'es-CO',
	    0x140A: 'es-CR',
	    0x1C0A: 'es-DO',
	    0x300A: 'es-EC',
	    0x440A: 'es-SV',
	    0x100A: 'es-GT',
	    0x480A: 'es-HN',
	    0x080A: 'es-MX',
	    0x4C0A: 'es-NI',
	    0x180A: 'es-PA',
	    0x3C0A: 'es-PY',
	    0x280A: 'es-PE',
	    0x500A: 'es-PR',

	    // Microsoft has defined two different language codes for
	    // “Spanish with modern sorting” and “Spanish with traditional
	    // sorting”. This makes sense for collation APIs, and it would be
	    // possible to express this in BCP 47 language tags via Unicode
	    // extensions (eg., es-u-co-trad is Spanish with traditional
	    // sorting). However, for storing names in fonts, the distinction
	    // does not make sense, so we give “es” in both cases.
	    0x0C0A: 'es',
	    0x040A: 'es',

	    0x540A: 'es-US',
	    0x380A: 'es-UY',
	    0x200A: 'es-VE',
	    0x081D: 'sv-FI',
	    0x041D: 'sv',
	    0x045A: 'syr',
	    0x0428: 'tg',
	    0x085F: 'tzm',
	    0x0449: 'ta',
	    0x0444: 'tt',
	    0x044A: 'te',
	    0x041E: 'th',
	    0x0451: 'bo',
	    0x041F: 'tr',
	    0x0442: 'tk',
	    0x0480: 'ug',
	    0x0422: 'uk',
	    0x042E: 'hsb',
	    0x0420: 'ur',
	    0x0843: 'uz-Cyrl',
	    0x0443: 'uz',
	    0x042A: 'vi',
	    0x0452: 'cy',
	    0x0488: 'wo',
	    0x0485: 'sah',
	    0x0478: 'ii',
	    0x046A: 'yo'
	};

	// Returns a IETF BCP 47 language code, for example 'zh-Hant'
	// for 'Chinese in the traditional script'.
	function getLanguageCode(platformID, languageID, ltag) {
	    switch (platformID) {
	        case 0:  // Unicode
	            if (languageID === 0xFFFF) {
	                return 'und';
	            } else if (ltag) {
	                return ltag[languageID];
	            }

	            break;

	        case 1:  // Macintosh
	            return macLanguages[languageID];

	        case 3:  // Windows
	            return windowsLanguages[languageID];
	    }

	    return undefined;
	}

	const utf16 = 'utf-16';

	// MacOS script ID → encoding. This table stores the default case,
	// which can be overridden by macLanguageEncodings.
	const macScriptEncodings = {
	    0: 'macintosh',           // smRoman
	    1: 'x-mac-japanese',      // smJapanese
	    2: 'x-mac-chinesetrad',   // smTradChinese
	    3: 'x-mac-korean',        // smKorean
	    6: 'x-mac-greek',         // smGreek
	    7: 'x-mac-cyrillic',      // smCyrillic
	    9: 'x-mac-devanagai',     // smDevanagari
	    10: 'x-mac-gurmukhi',     // smGurmukhi
	    11: 'x-mac-gujarati',     // smGujarati
	    12: 'x-mac-oriya',        // smOriya
	    13: 'x-mac-bengali',      // smBengali
	    14: 'x-mac-tamil',        // smTamil
	    15: 'x-mac-telugu',       // smTelugu
	    16: 'x-mac-kannada',      // smKannada
	    17: 'x-mac-malayalam',    // smMalayalam
	    18: 'x-mac-sinhalese',    // smSinhalese
	    19: 'x-mac-burmese',      // smBurmese
	    20: 'x-mac-khmer',        // smKhmer
	    21: 'x-mac-thai',         // smThai
	    22: 'x-mac-lao',          // smLao
	    23: 'x-mac-georgian',     // smGeorgian
	    24: 'x-mac-armenian',     // smArmenian
	    25: 'x-mac-chinesesimp',  // smSimpChinese
	    26: 'x-mac-tibetan',      // smTibetan
	    27: 'x-mac-mongolian',    // smMongolian
	    28: 'x-mac-ethiopic',     // smEthiopic
	    29: 'x-mac-ce',           // smCentralEuroRoman
	    30: 'x-mac-vietnamese',   // smVietnamese
	    31: 'x-mac-extarabic'     // smExtArabic
	};

	// MacOS language ID → encoding. This table stores the exceptional
	// cases, which override macScriptEncodings. For writing MacOS naming
	// tables, we need to emit a MacOS script ID. Therefore, we cannot
	// merge macScriptEncodings into macLanguageEncodings.
	//
	// http://unicode.org/Public/MAPPINGS/VENDORS/APPLE/Readme.txt
	const macLanguageEncodings = {
	    15: 'x-mac-icelandic',    // langIcelandic
	    17: 'x-mac-turkish',      // langTurkish
	    18: 'x-mac-croatian',     // langCroatian
	    24: 'x-mac-ce',           // langLithuanian
	    25: 'x-mac-ce',           // langPolish
	    26: 'x-mac-ce',           // langHungarian
	    27: 'x-mac-ce',           // langEstonian
	    28: 'x-mac-ce',           // langLatvian
	    30: 'x-mac-icelandic',    // langFaroese
	    37: 'x-mac-romanian',     // langRomanian
	    38: 'x-mac-ce',           // langCzech
	    39: 'x-mac-ce',           // langSlovak
	    40: 'x-mac-ce',           // langSlovenian
	    143: 'x-mac-inuit',       // langInuktitut
	    146: 'x-mac-gaelic'       // langIrishGaelicScript
	};

	function getEncoding(platformID, encodingID, languageID) {
	    switch (platformID) {
	        case 0:  // Unicode
	            return utf16;

	        case 1:  // Apple Macintosh
	            return macLanguageEncodings[languageID] || macScriptEncodings[encodingID];

	        case 3:  // Microsoft Windows
	            if (encodingID === 1 || encodingID === 10) {
	                return utf16;
	            }

	            break;
	    }

	    return undefined;
	}

	// Parse the naming `name` table.
	// FIXME: Format 1 additional fields are not supported yet.
	// ltag is the content of the `ltag' table, such as ['en', 'zh-Hans', 'de-CH-1904'].
	function parseNameTable(data, start, ltag) {
	    const name = {};
	    const p = new parse.Parser(data, start);
	    const format = p.parseUShort();
	    const count = p.parseUShort();
	    const stringOffset = p.offset + p.parseUShort();
	    for (let i = 0; i < count; i++) {
	        const platformID = p.parseUShort();
	        const encodingID = p.parseUShort();
	        const languageID = p.parseUShort();
	        const nameID = p.parseUShort();
	        const property = nameTableNames[nameID] || nameID;
	        const byteLength = p.parseUShort();
	        const offset = p.parseUShort();
	        const language = getLanguageCode(platformID, languageID, ltag);
	        const encoding = getEncoding(platformID, encodingID, languageID);
	        if (encoding !== undefined && language !== undefined) {
	            let text;
	            if (encoding === utf16) {
	                text = decode.UTF16(data, stringOffset + offset, byteLength);
	            } else {
	                text = decode.MACSTRING(data, stringOffset + offset, byteLength, encoding);
	            }

	            if (text) {
	                let translations = name[property];
	                if (translations === undefined) {
	                    translations = name[property] = {};
	                }

	                translations[language] = text;
	            }
	        }
	    }

	    let langTagCount = 0;
	    if (format === 1) {
	        // FIXME: Also handle Microsoft's 'name' table 1.
	        langTagCount = p.parseUShort();
	    }

	    return name;
	}

	// {23: 'foo'} → {'foo': 23}
	// ['bar', 'baz'] → {'bar': 0, 'baz': 1}
	function reverseDict(dict) {
	    const result = {};
	    for (let key in dict) {
	        result[dict[key]] = parseInt(key);
	    }

	    return result;
	}

	function makeNameRecord(platformID, encodingID, languageID, nameID, length, offset) {
	    return new table.Record('NameRecord', [
	        {name: 'platformID', type: 'USHORT', value: platformID},
	        {name: 'encodingID', type: 'USHORT', value: encodingID},
	        {name: 'languageID', type: 'USHORT', value: languageID},
	        {name: 'nameID', type: 'USHORT', value: nameID},
	        {name: 'length', type: 'USHORT', value: length},
	        {name: 'offset', type: 'USHORT', value: offset}
	    ]);
	}

	// Finds the position of needle in haystack, or -1 if not there.
	// Like String.indexOf(), but for arrays.
	function findSubArray(needle, haystack) {
	    const needleLength = needle.length;
	    const limit = haystack.length - needleLength + 1;

	    loop:
	    for (let pos = 0; pos < limit; pos++) {
	        for (; pos < limit; pos++) {
	            for (let k = 0; k < needleLength; k++) {
	                if (haystack[pos + k] !== needle[k]) {
	                    continue loop;
	                }
	            }

	            return pos;
	        }
	    }

	    return -1;
	}

	function addStringToPool(s, pool) {
	    let offset = findSubArray(s, pool);
	    if (offset < 0) {
	        offset = pool.length;
	        let i = 0;
	        const len = s.length;
	        for (; i < len; ++i) {
	            pool.push(s[i]);
	        }

	    }

	    return offset;
	}

	function makeNameTable(names, ltag) {
	    let nameID;
	    const nameIDs = [];

	    const namesWithNumericKeys = {};
	    const nameTableIds = reverseDict(nameTableNames);
	    for (let key in names) {
	        let id = nameTableIds[key];
	        if (id === undefined) {
	            id = key;
	        }

	        nameID = parseInt(id);

	        if (isNaN(nameID)) {
	            throw new Error('Name table entry "' + key + '" does not exist, see nameTableNames for complete list.');
	        }

	        namesWithNumericKeys[nameID] = names[key];
	        nameIDs.push(nameID);
	    }

	    const macLanguageIds = reverseDict(macLanguages);
	    const windowsLanguageIds = reverseDict(windowsLanguages);

	    const nameRecords = [];
	    const stringPool = [];

	    for (let i = 0; i < nameIDs.length; i++) {
	        nameID = nameIDs[i];
	        const translations = namesWithNumericKeys[nameID];
	        for (let lang in translations) {
	            const text = translations[lang];

	            // For MacOS, we try to emit the name in the form that was introduced
	            // in the initial version of the TrueType spec (in the late 1980s).
	            // However, this can fail for various reasons: the requested BCP 47
	            // language code might not have an old-style Mac equivalent;
	            // we might not have a codec for the needed character encoding;
	            // or the name might contain characters that cannot be expressed
	            // in the old-style Macintosh encoding. In case of failure, we emit
	            // the name in a more modern fashion (Unicode encoding with BCP 47
	            // language tags) that is recognized by MacOS 10.5, released in 2009.
	            // If fonts were only read by operating systems, we could simply
	            // emit all names in the modern form; this would be much easier.
	            // However, there are many applications and libraries that read
	            // 'name' tables directly, and these will usually only recognize
	            // the ancient form (silently skipping the unrecognized names).
	            let macPlatform = 1;  // Macintosh
	            let macLanguage = macLanguageIds[lang];
	            let macScript = macLanguageToScript[macLanguage];
	            const macEncoding = getEncoding(macPlatform, macScript, macLanguage);
	            let macName = encode.MACSTRING(text, macEncoding);
	            if (macName === undefined) {
	                macPlatform = 0;  // Unicode
	                macLanguage = ltag.indexOf(lang);
	                if (macLanguage < 0) {
	                    macLanguage = ltag.length;
	                    ltag.push(lang);
	                }

	                macScript = 4;  // Unicode 2.0 and later
	                macName = encode.UTF16(text);
	            }

	            const macNameOffset = addStringToPool(macName, stringPool);
	            nameRecords.push(makeNameRecord(macPlatform, macScript, macLanguage,
	                                            nameID, macName.length, macNameOffset));

	            const winLanguage = windowsLanguageIds[lang];
	            if (winLanguage !== undefined) {
	                const winName = encode.UTF16(text);
	                const winNameOffset = addStringToPool(winName, stringPool);
	                nameRecords.push(makeNameRecord(3, 1, winLanguage,
	                                                nameID, winName.length, winNameOffset));
	            }
	        }
	    }

	    nameRecords.sort(function(a, b) {
	        return ((a.platformID - b.platformID) ||
	                (a.encodingID - b.encodingID) ||
	                (a.languageID - b.languageID) ||
	                (a.nameID - b.nameID));
	    });

	    const t = new table.Table('name', [
	        {name: 'format', type: 'USHORT', value: 0},
	        {name: 'count', type: 'USHORT', value: nameRecords.length},
	        {name: 'stringOffset', type: 'USHORT', value: 6 + nameRecords.length * 12}
	    ]);

	    for (let r = 0; r < nameRecords.length; r++) {
	        t.fields.push({name: 'record_' + r, type: 'RECORD', value: nameRecords[r]});
	    }

	    t.fields.push({name: 'strings', type: 'LITERAL', value: stringPool});
	    return t;
	}

	var _name = { parse: parseNameTable, make: makeNameTable };

	// The `OS/2` table contains metrics required in OpenType fonts.

	const unicodeRanges = [
	    {begin: 0x0000, end: 0x007F}, // Basic Latin
	    {begin: 0x0080, end: 0x00FF}, // Latin-1 Supplement
	    {begin: 0x0100, end: 0x017F}, // Latin Extended-A
	    {begin: 0x0180, end: 0x024F}, // Latin Extended-B
	    {begin: 0x0250, end: 0x02AF}, // IPA Extensions
	    {begin: 0x02B0, end: 0x02FF}, // Spacing Modifier Letters
	    {begin: 0x0300, end: 0x036F}, // Combining Diacritical Marks
	    {begin: 0x0370, end: 0x03FF}, // Greek and Coptic
	    {begin: 0x2C80, end: 0x2CFF}, // Coptic
	    {begin: 0x0400, end: 0x04FF}, // Cyrillic
	    {begin: 0x0530, end: 0x058F}, // Armenian
	    {begin: 0x0590, end: 0x05FF}, // Hebrew
	    {begin: 0xA500, end: 0xA63F}, // Vai
	    {begin: 0x0600, end: 0x06FF}, // Arabic
	    {begin: 0x07C0, end: 0x07FF}, // NKo
	    {begin: 0x0900, end: 0x097F}, // Devanagari
	    {begin: 0x0980, end: 0x09FF}, // Bengali
	    {begin: 0x0A00, end: 0x0A7F}, // Gurmukhi
	    {begin: 0x0A80, end: 0x0AFF}, // Gujarati
	    {begin: 0x0B00, end: 0x0B7F}, // Oriya
	    {begin: 0x0B80, end: 0x0BFF}, // Tamil
	    {begin: 0x0C00, end: 0x0C7F}, // Telugu
	    {begin: 0x0C80, end: 0x0CFF}, // Kannada
	    {begin: 0x0D00, end: 0x0D7F}, // Malayalam
	    {begin: 0x0E00, end: 0x0E7F}, // Thai
	    {begin: 0x0E80, end: 0x0EFF}, // Lao
	    {begin: 0x10A0, end: 0x10FF}, // Georgian
	    {begin: 0x1B00, end: 0x1B7F}, // Balinese
	    {begin: 0x1100, end: 0x11FF}, // Hangul Jamo
	    {begin: 0x1E00, end: 0x1EFF}, // Latin Extended Additional
	    {begin: 0x1F00, end: 0x1FFF}, // Greek Extended
	    {begin: 0x2000, end: 0x206F}, // General Punctuation
	    {begin: 0x2070, end: 0x209F}, // Superscripts And Subscripts
	    {begin: 0x20A0, end: 0x20CF}, // Currency Symbol
	    {begin: 0x20D0, end: 0x20FF}, // Combining Diacritical Marks For Symbols
	    {begin: 0x2100, end: 0x214F}, // Letterlike Symbols
	    {begin: 0x2150, end: 0x218F}, // Number Forms
	    {begin: 0x2190, end: 0x21FF}, // Arrows
	    {begin: 0x2200, end: 0x22FF}, // Mathematical Operators
	    {begin: 0x2300, end: 0x23FF}, // Miscellaneous Technical
	    {begin: 0x2400, end: 0x243F}, // Control Pictures
	    {begin: 0x2440, end: 0x245F}, // Optical Character Recognition
	    {begin: 0x2460, end: 0x24FF}, // Enclosed Alphanumerics
	    {begin: 0x2500, end: 0x257F}, // Box Drawing
	    {begin: 0x2580, end: 0x259F}, // Block Elements
	    {begin: 0x25A0, end: 0x25FF}, // Geometric Shapes
	    {begin: 0x2600, end: 0x26FF}, // Miscellaneous Symbols
	    {begin: 0x2700, end: 0x27BF}, // Dingbats
	    {begin: 0x3000, end: 0x303F}, // CJK Symbols And Punctuation
	    {begin: 0x3040, end: 0x309F}, // Hiragana
	    {begin: 0x30A0, end: 0x30FF}, // Katakana
	    {begin: 0x3100, end: 0x312F}, // Bopomofo
	    {begin: 0x3130, end: 0x318F}, // Hangul Compatibility Jamo
	    {begin: 0xA840, end: 0xA87F}, // Phags-pa
	    {begin: 0x3200, end: 0x32FF}, // Enclosed CJK Letters And Months
	    {begin: 0x3300, end: 0x33FF}, // CJK Compatibility
	    {begin: 0xAC00, end: 0xD7AF}, // Hangul Syllables
	    {begin: 0xD800, end: 0xDFFF}, // Non-Plane 0 *
	    {begin: 0x10900, end: 0x1091F}, // Phoenicia
	    {begin: 0x4E00, end: 0x9FFF}, // CJK Unified Ideographs
	    {begin: 0xE000, end: 0xF8FF}, // Private Use Area (plane 0)
	    {begin: 0x31C0, end: 0x31EF}, // CJK Strokes
	    {begin: 0xFB00, end: 0xFB4F}, // Alphabetic Presentation Forms
	    {begin: 0xFB50, end: 0xFDFF}, // Arabic Presentation Forms-A
	    {begin: 0xFE20, end: 0xFE2F}, // Combining Half Marks
	    {begin: 0xFE10, end: 0xFE1F}, // Vertical Forms
	    {begin: 0xFE50, end: 0xFE6F}, // Small Form Variants
	    {begin: 0xFE70, end: 0xFEFF}, // Arabic Presentation Forms-B
	    {begin: 0xFF00, end: 0xFFEF}, // Halfwidth And Fullwidth Forms
	    {begin: 0xFFF0, end: 0xFFFF}, // Specials
	    {begin: 0x0F00, end: 0x0FFF}, // Tibetan
	    {begin: 0x0700, end: 0x074F}, // Syriac
	    {begin: 0x0780, end: 0x07BF}, // Thaana
	    {begin: 0x0D80, end: 0x0DFF}, // Sinhala
	    {begin: 0x1000, end: 0x109F}, // Myanmar
	    {begin: 0x1200, end: 0x137F}, // Ethiopic
	    {begin: 0x13A0, end: 0x13FF}, // Cherokee
	    {begin: 0x1400, end: 0x167F}, // Unified Canadian Aboriginal Syllabics
	    {begin: 0x1680, end: 0x169F}, // Ogham
	    {begin: 0x16A0, end: 0x16FF}, // Runic
	    {begin: 0x1780, end: 0x17FF}, // Khmer
	    {begin: 0x1800, end: 0x18AF}, // Mongolian
	    {begin: 0x2800, end: 0x28FF}, // Braille Patterns
	    {begin: 0xA000, end: 0xA48F}, // Yi Syllables
	    {begin: 0x1700, end: 0x171F}, // Tagalog
	    {begin: 0x10300, end: 0x1032F}, // Old Italic
	    {begin: 0x10330, end: 0x1034F}, // Gothic
	    {begin: 0x10400, end: 0x1044F}, // Deseret
	    {begin: 0x1D000, end: 0x1D0FF}, // Byzantine Musical Symbols
	    {begin: 0x1D400, end: 0x1D7FF}, // Mathematical Alphanumeric Symbols
	    {begin: 0xFF000, end: 0xFFFFD}, // Private Use (plane 15)
	    {begin: 0xFE00, end: 0xFE0F}, // Variation Selectors
	    {begin: 0xE0000, end: 0xE007F}, // Tags
	    {begin: 0x1900, end: 0x194F}, // Limbu
	    {begin: 0x1950, end: 0x197F}, // Tai Le
	    {begin: 0x1980, end: 0x19DF}, // New Tai Lue
	    {begin: 0x1A00, end: 0x1A1F}, // Buginese
	    {begin: 0x2C00, end: 0x2C5F}, // Glagolitic
	    {begin: 0x2D30, end: 0x2D7F}, // Tifinagh
	    {begin: 0x4DC0, end: 0x4DFF}, // Yijing Hexagram Symbols
	    {begin: 0xA800, end: 0xA82F}, // Syloti Nagri
	    {begin: 0x10000, end: 0x1007F}, // Linear B Syllabary
	    {begin: 0x10140, end: 0x1018F}, // Ancient Greek Numbers
	    {begin: 0x10380, end: 0x1039F}, // Ugaritic
	    {begin: 0x103A0, end: 0x103DF}, // Old Persian
	    {begin: 0x10450, end: 0x1047F}, // Shavian
	    {begin: 0x10480, end: 0x104AF}, // Osmanya
	    {begin: 0x10800, end: 0x1083F}, // Cypriot Syllabary
	    {begin: 0x10A00, end: 0x10A5F}, // Kharoshthi
	    {begin: 0x1D300, end: 0x1D35F}, // Tai Xuan Jing Symbols
	    {begin: 0x12000, end: 0x123FF}, // Cuneiform
	    {begin: 0x1D360, end: 0x1D37F}, // Counting Rod Numerals
	    {begin: 0x1B80, end: 0x1BBF}, // Sundanese
	    {begin: 0x1C00, end: 0x1C4F}, // Lepcha
	    {begin: 0x1C50, end: 0x1C7F}, // Ol Chiki
	    {begin: 0xA880, end: 0xA8DF}, // Saurashtra
	    {begin: 0xA900, end: 0xA92F}, // Kayah Li
	    {begin: 0xA930, end: 0xA95F}, // Rejang
	    {begin: 0xAA00, end: 0xAA5F}, // Cham
	    {begin: 0x10190, end: 0x101CF}, // Ancient Symbols
	    {begin: 0x101D0, end: 0x101FF}, // Phaistos Disc
	    {begin: 0x102A0, end: 0x102DF}, // Carian
	    {begin: 0x1F030, end: 0x1F09F}  // Domino Tiles
	];

	function getUnicodeRange(unicode) {
	    for (let i = 0; i < unicodeRanges.length; i += 1) {
	        const range = unicodeRanges[i];
	        if (unicode >= range.begin && unicode < range.end) {
	            return i;
	        }
	    }

	    return -1;
	}

	// Parse the OS/2 and Windows metrics `OS/2` table
	function parseOS2Table(data, start) {
	    const os2 = {};
	    const p = new parse.Parser(data, start);
	    os2.version = p.parseUShort();
	    os2.xAvgCharWidth = p.parseShort();
	    os2.usWeightClass = p.parseUShort();
	    os2.usWidthClass = p.parseUShort();
	    os2.fsType = p.parseUShort();
	    os2.ySubscriptXSize = p.parseShort();
	    os2.ySubscriptYSize = p.parseShort();
	    os2.ySubscriptXOffset = p.parseShort();
	    os2.ySubscriptYOffset = p.parseShort();
	    os2.ySuperscriptXSize = p.parseShort();
	    os2.ySuperscriptYSize = p.parseShort();
	    os2.ySuperscriptXOffset = p.parseShort();
	    os2.ySuperscriptYOffset = p.parseShort();
	    os2.yStrikeoutSize = p.parseShort();
	    os2.yStrikeoutPosition = p.parseShort();
	    os2.sFamilyClass = p.parseShort();
	    os2.panose = [];
	    for (let i = 0; i < 10; i++) {
	        os2.panose[i] = p.parseByte();
	    }

	    os2.ulUnicodeRange1 = p.parseULong();
	    os2.ulUnicodeRange2 = p.parseULong();
	    os2.ulUnicodeRange3 = p.parseULong();
	    os2.ulUnicodeRange4 = p.parseULong();
	    os2.achVendID = String.fromCharCode(p.parseByte(), p.parseByte(), p.parseByte(), p.parseByte());
	    os2.fsSelection = p.parseUShort();
	    os2.usFirstCharIndex = p.parseUShort();
	    os2.usLastCharIndex = p.parseUShort();
	    os2.sTypoAscender = p.parseShort();
	    os2.sTypoDescender = p.parseShort();
	    os2.sTypoLineGap = p.parseShort();
	    os2.usWinAscent = p.parseUShort();
	    os2.usWinDescent = p.parseUShort();
	    if (os2.version >= 1) {
	        os2.ulCodePageRange1 = p.parseULong();
	        os2.ulCodePageRange2 = p.parseULong();
	    }

	    if (os2.version >= 2) {
	        os2.sxHeight = p.parseShort();
	        os2.sCapHeight = p.parseShort();
	        os2.usDefaultChar = p.parseUShort();
	        os2.usBreakChar = p.parseUShort();
	        os2.usMaxContent = p.parseUShort();
	    }

	    return os2;
	}

	function makeOS2Table(options) {
	    return new table.Table('OS/2', [
	        {name: 'version', type: 'USHORT', value: 0x0003},
	        {name: 'xAvgCharWidth', type: 'SHORT', value: 0},
	        {name: 'usWeightClass', type: 'USHORT', value: 0},
	        {name: 'usWidthClass', type: 'USHORT', value: 0},
	        {name: 'fsType', type: 'USHORT', value: 0},
	        {name: 'ySubscriptXSize', type: 'SHORT', value: 650},
	        {name: 'ySubscriptYSize', type: 'SHORT', value: 699},
	        {name: 'ySubscriptXOffset', type: 'SHORT', value: 0},
	        {name: 'ySubscriptYOffset', type: 'SHORT', value: 140},
	        {name: 'ySuperscriptXSize', type: 'SHORT', value: 650},
	        {name: 'ySuperscriptYSize', type: 'SHORT', value: 699},
	        {name: 'ySuperscriptXOffset', type: 'SHORT', value: 0},
	        {name: 'ySuperscriptYOffset', type: 'SHORT', value: 479},
	        {name: 'yStrikeoutSize', type: 'SHORT', value: 49},
	        {name: 'yStrikeoutPosition', type: 'SHORT', value: 258},
	        {name: 'sFamilyClass', type: 'SHORT', value: 0},
	        {name: 'bFamilyType', type: 'BYTE', value: 0},
	        {name: 'bSerifStyle', type: 'BYTE', value: 0},
	        {name: 'bWeight', type: 'BYTE', value: 0},
	        {name: 'bProportion', type: 'BYTE', value: 0},
	        {name: 'bContrast', type: 'BYTE', value: 0},
	        {name: 'bStrokeVariation', type: 'BYTE', value: 0},
	        {name: 'bArmStyle', type: 'BYTE', value: 0},
	        {name: 'bLetterform', type: 'BYTE', value: 0},
	        {name: 'bMidline', type: 'BYTE', value: 0},
	        {name: 'bXHeight', type: 'BYTE', value: 0},
	        {name: 'ulUnicodeRange1', type: 'ULONG', value: 0},
	        {name: 'ulUnicodeRange2', type: 'ULONG', value: 0},
	        {name: 'ulUnicodeRange3', type: 'ULONG', value: 0},
	        {name: 'ulUnicodeRange4', type: 'ULONG', value: 0},
	        {name: 'achVendID', type: 'CHARARRAY', value: 'XXXX'},
	        {name: 'fsSelection', type: 'USHORT', value: 0},
	        {name: 'usFirstCharIndex', type: 'USHORT', value: 0},
	        {name: 'usLastCharIndex', type: 'USHORT', value: 0},
	        {name: 'sTypoAscender', type: 'SHORT', value: 0},
	        {name: 'sTypoDescender', type: 'SHORT', value: 0},
	        {name: 'sTypoLineGap', type: 'SHORT', value: 0},
	        {name: 'usWinAscent', type: 'USHORT', value: 0},
	        {name: 'usWinDescent', type: 'USHORT', value: 0},
	        {name: 'ulCodePageRange1', type: 'ULONG', value: 0},
	        {name: 'ulCodePageRange2', type: 'ULONG', value: 0},
	        {name: 'sxHeight', type: 'SHORT', value: 0},
	        {name: 'sCapHeight', type: 'SHORT', value: 0},
	        {name: 'usDefaultChar', type: 'USHORT', value: 0},
	        {name: 'usBreakChar', type: 'USHORT', value: 0},
	        {name: 'usMaxContext', type: 'USHORT', value: 0}
	    ], options);
	}

	var os2 = { parse: parseOS2Table, make: makeOS2Table, unicodeRanges, getUnicodeRange };

	// The `post` table stores additional PostScript information, such as glyph names.

	// Parse the PostScript `post` table
	function parsePostTable(data, start) {
	    const post = {};
	    const p = new parse.Parser(data, start);
	    post.version = p.parseVersion();
	    post.italicAngle = p.parseFixed();
	    post.underlinePosition = p.parseShort();
	    post.underlineThickness = p.parseShort();
	    post.isFixedPitch = p.parseULong();
	    post.minMemType42 = p.parseULong();
	    post.maxMemType42 = p.parseULong();
	    post.minMemType1 = p.parseULong();
	    post.maxMemType1 = p.parseULong();
	    switch (post.version) {
	        case 1:
	            post.names = standardNames.slice();
	            break;
	        case 2:
	            post.numberOfGlyphs = p.parseUShort();
	            post.glyphNameIndex = new Array(post.numberOfGlyphs);
	            for (let i = 0; i < post.numberOfGlyphs; i++) {
	                post.glyphNameIndex[i] = p.parseUShort();
	            }

	            post.names = [];
	            for (let i = 0; i < post.numberOfGlyphs; i++) {
	                if (post.glyphNameIndex[i] >= standardNames.length) {
	                    const nameLength = p.parseChar();
	                    post.names.push(p.parseString(nameLength));
	                }
	            }

	            break;
	        case 2.5:
	            post.numberOfGlyphs = p.parseUShort();
	            post.offset = new Array(post.numberOfGlyphs);
	            for (let i = 0; i < post.numberOfGlyphs; i++) {
	                post.offset[i] = p.parseChar();
	            }

	            break;
	    }
	    return post;
	}

	function makePostTable() {
	    return new table.Table('post', [
	        {name: 'version', type: 'FIXED', value: 0x00030000},
	        {name: 'italicAngle', type: 'FIXED', value: 0},
	        {name: 'underlinePosition', type: 'FWORD', value: 0},
	        {name: 'underlineThickness', type: 'FWORD', value: 0},
	        {name: 'isFixedPitch', type: 'ULONG', value: 0},
	        {name: 'minMemType42', type: 'ULONG', value: 0},
	        {name: 'maxMemType42', type: 'ULONG', value: 0},
	        {name: 'minMemType1', type: 'ULONG', value: 0},
	        {name: 'maxMemType1', type: 'ULONG', value: 0}
	    ]);
	}

	var post = { parse: parsePostTable, make: makePostTable };

	// The `GSUB` table contains ligatures, among other things.

	const subtableParsers = new Array(9);         // subtableParsers[0] is unused

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#SS
	subtableParsers[1] = function parseLookup1() {
	    const start = this.offset + this.relativeOffset;
	    const substFormat = this.parseUShort();
	    if (substFormat === 1) {
	        return {
	            substFormat: 1,
	            coverage: this.parsePointer(Parser.coverage),
	            deltaGlyphId: this.parseUShort()
	        };
	    } else if (substFormat === 2) {
	        return {
	            substFormat: 2,
	            coverage: this.parsePointer(Parser.coverage),
	            substitute: this.parseOffset16List()
	        };
	    }
	    check.assert(false, '0x' + start.toString(16) + ': lookup type 1 format must be 1 or 2.');
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#MS
	subtableParsers[2] = function parseLookup2() {
	    const substFormat = this.parseUShort();
	    check.argument(substFormat === 1, 'GSUB Multiple Substitution Subtable identifier-format must be 1');
	    return {
	        substFormat: substFormat,
	        coverage: this.parsePointer(Parser.coverage),
	        sequences: this.parseListOfLists()
	    };
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#AS
	subtableParsers[3] = function parseLookup3() {
	    const substFormat = this.parseUShort();
	    check.argument(substFormat === 1, 'GSUB Alternate Substitution Subtable identifier-format must be 1');
	    return {
	        substFormat: substFormat,
	        coverage: this.parsePointer(Parser.coverage),
	        alternateSets: this.parseListOfLists()
	    };
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#LS
	subtableParsers[4] = function parseLookup4() {
	    const substFormat = this.parseUShort();
	    check.argument(substFormat === 1, 'GSUB ligature table identifier-format must be 1');
	    return {
	        substFormat: substFormat,
	        coverage: this.parsePointer(Parser.coverage),
	        ligatureSets: this.parseListOfLists(function() {
	            return {
	                ligGlyph: this.parseUShort(),
	                components: this.parseUShortList(this.parseUShort() - 1)
	            };
	        })
	    };
	};

	const lookupRecordDesc = {
	    sequenceIndex: Parser.uShort,
	    lookupListIndex: Parser.uShort
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#CSF
	subtableParsers[5] = function parseLookup5() {
	    const start = this.offset + this.relativeOffset;
	    const substFormat = this.parseUShort();

	    if (substFormat === 1) {
	        return {
	            substFormat: substFormat,
	            coverage: this.parsePointer(Parser.coverage),
	            ruleSets: this.parseListOfLists(function() {
	                const glyphCount = this.parseUShort();
	                const substCount = this.parseUShort();
	                return {
	                    input: this.parseUShortList(glyphCount - 1),
	                    lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
	                };
	            })
	        };
	    } else if (substFormat === 2) {
	        return {
	            substFormat: substFormat,
	            coverage: this.parsePointer(Parser.coverage),
	            classDef: this.parsePointer(Parser.classDef),
	            classSets: this.parseListOfLists(function() {
	                const glyphCount = this.parseUShort();
	                const substCount = this.parseUShort();
	                return {
	                    classes: this.parseUShortList(glyphCount - 1),
	                    lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
	                };
	            })
	        };
	    } else if (substFormat === 3) {
	        const glyphCount = this.parseUShort();
	        const substCount = this.parseUShort();
	        return {
	            substFormat: substFormat,
	            coverages: this.parseList(glyphCount, Parser.pointer(Parser.coverage)),
	            lookupRecords: this.parseRecordList(substCount, lookupRecordDesc)
	        };
	    }
	    check.assert(false, '0x' + start.toString(16) + ': lookup type 5 format must be 1, 2 or 3.');
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#CC
	subtableParsers[6] = function parseLookup6() {
	    const start = this.offset + this.relativeOffset;
	    const substFormat = this.parseUShort();
	    if (substFormat === 1) {
	        return {
	            substFormat: 1,
	            coverage: this.parsePointer(Parser.coverage),
	            chainRuleSets: this.parseListOfLists(function() {
	                return {
	                    backtrack: this.parseUShortList(),
	                    input: this.parseUShortList(this.parseShort() - 1),
	                    lookahead: this.parseUShortList(),
	                    lookupRecords: this.parseRecordList(lookupRecordDesc)
	                };
	            })
	        };
	    } else if (substFormat === 2) {
	        return {
	            substFormat: 2,
	            coverage: this.parsePointer(Parser.coverage),
	            backtrackClassDef: this.parsePointer(Parser.classDef),
	            inputClassDef: this.parsePointer(Parser.classDef),
	            lookaheadClassDef: this.parsePointer(Parser.classDef),
	            chainClassSet: this.parseListOfLists(function() {
	                return {
	                    backtrack: this.parseUShortList(),
	                    input: this.parseUShortList(this.parseShort() - 1),
	                    lookahead: this.parseUShortList(),
	                    lookupRecords: this.parseRecordList(lookupRecordDesc)
	                };
	            })
	        };
	    } else if (substFormat === 3) {
	        return {
	            substFormat: 3,
	            backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
	            inputCoverage: this.parseList(Parser.pointer(Parser.coverage)),
	            lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
	            lookupRecords: this.parseRecordList(lookupRecordDesc)
	        };
	    }
	    check.assert(false, '0x' + start.toString(16) + ': lookup type 6 format must be 1, 2 or 3.');
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#ES
	subtableParsers[7] = function parseLookup7() {
	    // Extension Substitution subtable
	    const substFormat = this.parseUShort();
	    check.argument(substFormat === 1, 'GSUB Extension Substitution subtable identifier-format must be 1');
	    const extensionLookupType = this.parseUShort();
	    const extensionParser = new Parser(this.data, this.offset + this.parseULong());
	    return {
	        substFormat: 1,
	        lookupType: extensionLookupType,
	        extension: subtableParsers[extensionLookupType].call(extensionParser)
	    };
	};

	// https://www.microsoft.com/typography/OTSPEC/GSUB.htm#RCCS
	subtableParsers[8] = function parseLookup8() {
	    const substFormat = this.parseUShort();
	    check.argument(substFormat === 1, 'GSUB Reverse Chaining Contextual Single Substitution Subtable identifier-format must be 1');
	    return {
	        substFormat: substFormat,
	        coverage: this.parsePointer(Parser.coverage),
	        backtrackCoverage: this.parseList(Parser.pointer(Parser.coverage)),
	        lookaheadCoverage: this.parseList(Parser.pointer(Parser.coverage)),
	        substitutes: this.parseUShortList()
	    };
	};

	// https://www.microsoft.com/typography/OTSPEC/gsub.htm
	function parseGsubTable(data, start) {
	    start = start || 0;
	    const p = new Parser(data, start);
	    const tableVersion = p.parseVersion(1);
	    check.argument(tableVersion === 1 || tableVersion === 1.1, 'Unsupported GSUB table version.');
	    if (tableVersion === 1) {
	        return {
	            version: tableVersion,
	            scripts: p.parseScriptList(),
	            features: p.parseFeatureList(),
	            lookups: p.parseLookupList(subtableParsers)
	        };
	    } else {
	        return {
	            version: tableVersion,
	            scripts: p.parseScriptList(),
	            features: p.parseFeatureList(),
	            lookups: p.parseLookupList(subtableParsers),
	            variations: p.parseFeatureVariationsList()
	        };
	    }

	}

	// GSUB Writing //////////////////////////////////////////////
	const subtableMakers = new Array(9);

	subtableMakers[1] = function makeLookup1(subtable) {
	    if (subtable.substFormat === 1) {
	        return new table.Table('substitutionTable', [
	            {name: 'substFormat', type: 'USHORT', value: 1},
	            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)},
	            {name: 'deltaGlyphID', type: 'USHORT', value: subtable.deltaGlyphId}
	        ]);
	    } else {
	        return new table.Table('substitutionTable', [
	            {name: 'substFormat', type: 'USHORT', value: 2},
	            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
	        ].concat(table.ushortList('substitute', subtable.substitute)));
	    }
	    check.fail('Lookup type 1 substFormat must be 1 or 2.');
	};

	subtableMakers[3] = function makeLookup3(subtable) {
	    check.assert(subtable.substFormat === 1, 'Lookup type 3 substFormat must be 1.');
	    return new table.Table('substitutionTable', [
	        {name: 'substFormat', type: 'USHORT', value: 1},
	        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
	    ].concat(table.tableList('altSet', subtable.alternateSets, function(alternateSet) {
	        return new table.Table('alternateSetTable', table.ushortList('alternate', alternateSet));
	    })));
	};

	subtableMakers[4] = function makeLookup4(subtable) {
	    check.assert(subtable.substFormat === 1, 'Lookup type 4 substFormat must be 1.');
	    return new table.Table('substitutionTable', [
	        {name: 'substFormat', type: 'USHORT', value: 1},
	        {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
	    ].concat(table.tableList('ligSet', subtable.ligatureSets, function(ligatureSet) {
	        return new table.Table('ligatureSetTable', table.tableList('ligature', ligatureSet, function(ligature) {
	            return new table.Table('ligatureTable',
	                [{name: 'ligGlyph', type: 'USHORT', value: ligature.ligGlyph}]
	                .concat(table.ushortList('component', ligature.components, ligature.components.length + 1))
	            );
	        }));
	    })));
	};

	function makeGsubTable(gsub) {
	    return new table.Table('GSUB', [
	        {name: 'version', type: 'ULONG', value: 0x10000},
	        {name: 'scripts', type: 'TABLE', value: new table.ScriptList(gsub.scripts)},
	        {name: 'features', type: 'TABLE', value: new table.FeatureList(gsub.features)},
	        {name: 'lookups', type: 'TABLE', value: new table.LookupList(gsub.lookups, subtableMakers)}
	    ]);
	}

	var gsub = { parse: parseGsubTable, make: makeGsubTable };

	// The `GPOS` table contains kerning pairs, among other things.

	// Parse the metadata `meta` table.
	// https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6meta.html
	function parseMetaTable(data, start) {
	    const p = new parse.Parser(data, start);
	    const tableVersion = p.parseULong();
	    check.argument(tableVersion === 1, 'Unsupported META table version.');
	    p.parseULong(); // flags - currently unused and set to 0
	    p.parseULong(); // tableOffset
	    const numDataMaps = p.parseULong();

	    const tags = {};
	    for (let i = 0; i < numDataMaps; i++) {
	        const tag = p.parseTag();
	        const dataOffset = p.parseULong();
	        const dataLength = p.parseULong();
	        const text = decode.UTF8(data, start + dataOffset, dataLength);

	        tags[tag] = text;
	    }
	    return tags;
	}

	function makeMetaTable(tags) {
	    const numTags = Object.keys(tags).length;
	    let stringPool = '';
	    const stringPoolOffset = 16 + numTags * 12;

	    const result = new table.Table('meta', [
	        {name: 'version', type: 'ULONG', value: 1},
	        {name: 'flags', type: 'ULONG', value: 0},
	        {name: 'offset', type: 'ULONG', value: stringPoolOffset},
	        {name: 'numTags', type: 'ULONG', value: numTags}
	    ]);

	    for (let tag in tags) {
	        const pos = stringPool.length;
	        stringPool += tags[tag];

	        result.fields.push({name: 'tag ' + tag, type: 'TAG', value: tag});
	        result.fields.push({name: 'offset ' + tag, type: 'ULONG', value: stringPoolOffset + pos});
	        result.fields.push({name: 'length ' + tag, type: 'ULONG', value: tags[tag].length});
	    }

	    result.fields.push({name: 'stringPool', type: 'CHARARRAY', value: stringPool});

	    return result;
	}

	var meta = { parse: parseMetaTable, make: makeMetaTable };

	// The `sfnt` wrapper provides organization for the tables in the font.

	function log2(v) {
	    return Math.log(v) / Math.log(2) | 0;
	}

	function computeCheckSum(bytes) {
	    while (bytes.length % 4 !== 0) {
	        bytes.push(0);
	    }

	    let sum = 0;
	    for (let i = 0; i < bytes.length; i += 4) {
	        sum += (bytes[i] << 24) +
	            (bytes[i + 1] << 16) +
	            (bytes[i + 2] << 8) +
	            (bytes[i + 3]);
	    }

	    sum %= Math.pow(2, 32);
	    return sum;
	}

	function makeTableRecord(tag, checkSum, offset, length) {
	    return new table.Record('Table Record', [
	        {name: 'tag', type: 'TAG', value: tag !== undefined ? tag : ''},
	        {name: 'checkSum', type: 'ULONG', value: checkSum !== undefined ? checkSum : 0},
	        {name: 'offset', type: 'ULONG', value: offset !== undefined ? offset : 0},
	        {name: 'length', type: 'ULONG', value: length !== undefined ? length : 0}
	    ]);
	}

	function makeSfntTable(tables) {
	    const sfnt = new table.Table('sfnt', [
	        {name: 'version', type: 'TAG', value: 'OTTO'},
	        {name: 'numTables', type: 'USHORT', value: 0},
	        {name: 'searchRange', type: 'USHORT', value: 0},
	        {name: 'entrySelector', type: 'USHORT', value: 0},
	        {name: 'rangeShift', type: 'USHORT', value: 0}
	    ]);
	    sfnt.tables = tables;
	    sfnt.numTables = tables.length;
	    const highestPowerOf2 = Math.pow(2, log2(sfnt.numTables));
	    sfnt.searchRange = 16 * highestPowerOf2;
	    sfnt.entrySelector = log2(highestPowerOf2);
	    sfnt.rangeShift = sfnt.numTables * 16 - sfnt.searchRange;

	    const recordFields = [];
	    const tableFields = [];

	    let offset = sfnt.sizeOf() + (makeTableRecord().sizeOf() * sfnt.numTables);
	    while (offset % 4 !== 0) {
	        offset += 1;
	        tableFields.push({name: 'padding', type: 'BYTE', value: 0});
	    }

	    for (let i = 0; i < tables.length; i += 1) {
	        const t = tables[i];
	        check.argument(t.tableName.length === 4, 'Table name' + t.tableName + ' is invalid.');
	        const tableLength = t.sizeOf();
	        const tableRecord = makeTableRecord(t.tableName, computeCheckSum(t.encode()), offset, tableLength);
	        recordFields.push({name: tableRecord.tag + ' Table Record', type: 'RECORD', value: tableRecord});
	        tableFields.push({name: t.tableName + ' table', type: 'RECORD', value: t});
	        offset += tableLength;
	        check.argument(!isNaN(offset), 'Something went wrong calculating the offset.');
	        while (offset % 4 !== 0) {
	            offset += 1;
	            tableFields.push({name: 'padding', type: 'BYTE', value: 0});
	        }
	    }

	    // Table records need to be sorted alphabetically.
	    recordFields.sort(function(r1, r2) {
	        if (r1.value.tag > r2.value.tag) {
	            return 1;
	        } else {
	            return -1;
	        }
	    });

	    sfnt.fields = sfnt.fields.concat(recordFields);
	    sfnt.fields = sfnt.fields.concat(tableFields);
	    return sfnt;
	}

	// Get the metrics for a character. If the string has more than one character
	// this function returns metrics for the first available character.
	// You can provide optional fallback metrics if no characters are available.
	function metricsForChar(font, chars, notFoundMetrics) {
	    for (let i = 0; i < chars.length; i += 1) {
	        const glyphIndex = font.charToGlyphIndex(chars[i]);
	        if (glyphIndex > 0) {
	            const glyph = font.glyphs.get(glyphIndex);
	            return glyph.getMetrics();
	        }
	    }

	    return notFoundMetrics;
	}

	function average(vs) {
	    let sum = 0;
	    for (let i = 0; i < vs.length; i += 1) {
	        sum += vs[i];
	    }

	    return sum / vs.length;
	}

	// Convert the font object to a SFNT data structure.
	// This structure contains all the necessary tables and metadata to create a binary OTF file.
	function fontToSfntTable(font) {
	    const xMins = [];
	    const yMins = [];
	    const xMaxs = [];
	    const yMaxs = [];
	    const advanceWidths = [];
	    const leftSideBearings = [];
	    const rightSideBearings = [];
	    let firstCharIndex;
	    let lastCharIndex = 0;
	    let ulUnicodeRange1 = 0;
	    let ulUnicodeRange2 = 0;
	    let ulUnicodeRange3 = 0;
	    let ulUnicodeRange4 = 0;

	    for (let i = 0; i < font.glyphs.length; i += 1) {
	        const glyph = font.glyphs.get(i);
	        const unicode = glyph.unicode | 0;

	        if (isNaN(glyph.advanceWidth)) {
	            throw new Error('Glyph ' + glyph.name + ' (' + i + '): advanceWidth is not a number.');
	        }

	        if (firstCharIndex > unicode || firstCharIndex === undefined) {
	            // ignore .notdef char
	            if (unicode > 0) {
	                firstCharIndex = unicode;
	            }
	        }

	        if (lastCharIndex < unicode) {
	            lastCharIndex = unicode;
	        }

	        const position = os2.getUnicodeRange(unicode);
	        if (position < 32) {
	            ulUnicodeRange1 |= 1 << position;
	        } else if (position < 64) {
	            ulUnicodeRange2 |= 1 << position - 32;
	        } else if (position < 96) {
	            ulUnicodeRange3 |= 1 << position - 64;
	        } else if (position < 123) {
	            ulUnicodeRange4 |= 1 << position - 96;
	        } else {
	            throw new Error('Unicode ranges bits > 123 are reserved for internal usage');
	        }
	        // Skip non-important characters.
	        if (glyph.name === '.notdef') continue;
	        const metrics = glyph.getMetrics();
	        xMins.push(metrics.xMin);
	        yMins.push(metrics.yMin);
	        xMaxs.push(metrics.xMax);
	        yMaxs.push(metrics.yMax);
	        leftSideBearings.push(metrics.leftSideBearing);
	        rightSideBearings.push(metrics.rightSideBearing);
	        advanceWidths.push(glyph.advanceWidth);
	    }

	    const globals = {
	        xMin: Math.min.apply(null, xMins),
	        yMin: Math.min.apply(null, yMins),
	        xMax: Math.max.apply(null, xMaxs),
	        yMax: Math.max.apply(null, yMaxs),
	        advanceWidthMax: Math.max.apply(null, advanceWidths),
	        advanceWidthAvg: average(advanceWidths),
	        minLeftSideBearing: Math.min.apply(null, leftSideBearings),
	        maxLeftSideBearing: Math.max.apply(null, leftSideBearings),
	        minRightSideBearing: Math.min.apply(null, rightSideBearings)
	    };
	    globals.ascender = font.ascender;
	    globals.descender = font.descender;

	    const headTable = head.make({
	        flags: 3, // 00000011 (baseline for font at y=0; left sidebearing point at x=0)
	        unitsPerEm: font.unitsPerEm,
	        xMin: globals.xMin,
	        yMin: globals.yMin,
	        xMax: globals.xMax,
	        yMax: globals.yMax,
	        lowestRecPPEM: 3,
	        createdTimestamp: font.createdTimestamp
	    });

	    const hheaTable = hhea.make({
	        ascender: globals.ascender,
	        descender: globals.descender,
	        advanceWidthMax: globals.advanceWidthMax,
	        minLeftSideBearing: globals.minLeftSideBearing,
	        minRightSideBearing: globals.minRightSideBearing,
	        xMaxExtent: globals.maxLeftSideBearing + (globals.xMax - globals.xMin),
	        numberOfHMetrics: font.glyphs.length
	    });

	    const maxpTable = maxp.make(font.glyphs.length);

	    const os2Table = os2.make({
	        xAvgCharWidth: Math.round(globals.advanceWidthAvg),
	        usWeightClass: font.tables.os2.usWeightClass,
	        usWidthClass: font.tables.os2.usWidthClass,
	        usFirstCharIndex: firstCharIndex,
	        usLastCharIndex: lastCharIndex,
	        ulUnicodeRange1: ulUnicodeRange1,
	        ulUnicodeRange2: ulUnicodeRange2,
	        ulUnicodeRange3: ulUnicodeRange3,
	        ulUnicodeRange4: ulUnicodeRange4,
	        fsSelection: font.tables.os2.fsSelection, // REGULAR
	        // See http://typophile.com/node/13081 for more info on vertical metrics.
	        // We get metrics for typical characters (such as "x" for xHeight).
	        // We provide some fallback characters if characters are unavailable: their
	        // ordering was chosen experimentally.
	        sTypoAscender: globals.ascender,
	        sTypoDescender: globals.descender,
	        sTypoLineGap: 0,
	        usWinAscent: globals.yMax,
	        usWinDescent: Math.abs(globals.yMin),
	        ulCodePageRange1: 1, // FIXME: hard-code Latin 1 support for now
	        sxHeight: metricsForChar(font, 'xyvw', {yMax: Math.round(globals.ascender / 2)}).yMax,
	        sCapHeight: metricsForChar(font, 'HIKLEFJMNTZBDPRAGOQSUVWXY', globals).yMax,
	        usDefaultChar: font.hasChar(' ') ? 32 : 0, // Use space as the default character, if available.
	        usBreakChar: font.hasChar(' ') ? 32 : 0 // Use space as the break character, if available.
	    });

	    const hmtxTable = hmtx.make(font.glyphs);
	    const cmapTable = cmap.make(font.glyphs);

	    const englishFamilyName = font.getEnglishName('fontFamily');
	    const englishStyleName = font.getEnglishName('fontSubfamily');
	    const englishFullName = englishFamilyName + ' ' + englishStyleName;
	    let postScriptName = font.getEnglishName('postScriptName');
	    if (!postScriptName) {
	        postScriptName = englishFamilyName.replace(/\s/g, '') + '-' + englishStyleName;
	    }

	    const names = {};
	    for (let n in font.names) {
	        names[n] = font.names[n];
	    }

	    if (!names.uniqueID) {
	        names.uniqueID = {en: font.getEnglishName('manufacturer') + ':' + englishFullName};
	    }

	    if (!names.postScriptName) {
	        names.postScriptName = {en: postScriptName};
	    }

	    if (!names.preferredFamily) {
	        names.preferredFamily = font.names.fontFamily;
	    }

	    if (!names.preferredSubfamily) {
	        names.preferredSubfamily = font.names.fontSubfamily;
	    }

	    const languageTags = [];
	    const nameTable = _name.make(names, languageTags);
	    const ltagTable = (languageTags.length > 0 ? ltag.make(languageTags) : undefined);

	    const postTable = post.make();
	    const cffTable = cff.make(font.glyphs, {
	        version: font.getEnglishName('version'),
	        fullName: englishFullName,
	        familyName: englishFamilyName,
	        weightName: englishStyleName,
	        postScriptName: postScriptName,
	        unitsPerEm: font.unitsPerEm,
	        fontBBox: [0, globals.yMin, globals.ascender, globals.advanceWidthMax]
	    });

	    const metaTable = (font.metas && Object.keys(font.metas).length > 0) ? meta.make(font.metas) : undefined;

	    // The order does not matter because makeSfntTable() will sort them.
	    const tables = [headTable, hheaTable, maxpTable, os2Table, nameTable, cmapTable, postTable, cffTable, hmtxTable];
	    if (ltagTable) {
	        tables.push(ltagTable);
	    }
	    // Optional tables
	    if (font.tables.gsub) {
	        tables.push(gsub.make(font.tables.gsub));
	    }
	    if (metaTable) {
	        tables.push(metaTable);
	    }

	    const sfntTable = makeSfntTable(tables);

	    // Compute the font's checkSum and store it in head.checkSumAdjustment.
	    const bytes = sfntTable.encode();
	    const checkSum = computeCheckSum(bytes);
	    const tableFields = sfntTable.fields;
	    let checkSumAdjusted = false;
	    for (let i = 0; i < tableFields.length; i += 1) {
	        if (tableFields[i].name === 'head table') {
	            tableFields[i].value.checkSumAdjustment = 0xB1B0AFBA - checkSum;
	            checkSumAdjusted = true;
	            break;
	        }
	    }

	    if (!checkSumAdjusted) {
	        throw new Error('Could not find head table with checkSum to adjust.');
	    }

	    return sfntTable;
	}

	var sfnt = { make: makeSfntTable, fontToTable: fontToSfntTable, computeCheckSum };

	// The Layout object is the prototype of Substitution objects, and provides

	function searchTag(arr, tag) {
	    /* jshint bitwise: false */
	    let imin = 0;
	    let imax = arr.length - 1;
	    while (imin <= imax) {
	        const imid = (imin + imax) >>> 1;
	        const val = arr[imid].tag;
	        if (val === tag) {
	            return imid;
	        } else if (val < tag) {
	            imin = imid + 1;
	        } else { imax = imid - 1; }
	    }
	    // Not found: return -1-insertion point
	    return -imin - 1;
	}

	function binSearch(arr, value) {
	    /* jshint bitwise: false */
	    let imin = 0;
	    let imax = arr.length - 1;
	    while (imin <= imax) {
	        const imid = (imin + imax) >>> 1;
	        const val = arr[imid];
	        if (val === value) {
	            return imid;
	        } else if (val < value) {
	            imin = imid + 1;
	        } else { imax = imid - 1; }
	    }
	    // Not found: return -1-insertion point
	    return -imin - 1;
	}

	// binary search in a list of ranges (coverage, class definition)
	function searchRange(ranges, value) {
	    // jshint bitwise: false
	    let range;
	    let imin = 0;
	    let imax = ranges.length - 1;
	    while (imin <= imax) {
	        const imid = (imin + imax) >>> 1;
	        range = ranges[imid];
	        const start = range.start;
	        if (start === value) {
	            return range;
	        } else if (start < value) {
	            imin = imid + 1;
	        } else { imax = imid - 1; }
	    }
	    if (imin > 0) {
	        range = ranges[imin - 1];
	        if (value > range.end) return 0;
	        return range;
	    }
	}

	/**
	 * @exports opentype.Layout
	 * @class
	 */
	function Layout(font, tableName) {
	    this.font = font;
	    this.tableName = tableName;
	}

	Layout.prototype = {

	    /**
	     * Binary search an object by "tag" property
	     * @instance
	     * @function searchTag
	     * @memberof opentype.Layout
	     * @param  {Array} arr
	     * @param  {string} tag
	     * @return {number}
	     */
	    searchTag: searchTag,

	    /**
	     * Binary search in a list of numbers
	     * @instance
	     * @function binSearch
	     * @memberof opentype.Layout
	     * @param  {Array} arr
	     * @param  {number} value
	     * @return {number}
	     */
	    binSearch: binSearch,

	    /**
	     * Get or create the Layout table (GSUB, GPOS etc).
	     * @param  {boolean} create - Whether to create a new one.
	     * @return {Object} The GSUB or GPOS table.
	     */
	    getTable: function(create) {
	        let layout = this.font.tables[this.tableName];
	        if (!layout && create) {
	            layout = this.font.tables[this.tableName] = this.createDefaultTable();
	        }
	        return layout;
	    },

	    /**
	     * Returns all scripts in the substitution table.
	     * @instance
	     * @return {Array}
	     */
	    getScriptNames: function() {
	        let layout = this.getTable();
	        if (!layout) { return []; }
	        return layout.scripts.map(function(script) {
	            return script.tag;
	        });
	    },

	    /**
	     * Returns the best bet for a script name.
	     * Returns 'DFLT' if it exists.
	     * If not, returns 'latn' if it exists.
	     * If neither exist, returns undefined.
	     */
	    getDefaultScriptName: function() {
	        let layout = this.getTable();
	        if (!layout) { return; }
	        let hasLatn = false;
	        for (let i = 0; i < layout.scripts.length; i++) {
	            const name = layout.scripts[i].tag;
	            if (name === 'DFLT') return name;
	            if (name === 'latn') hasLatn = true;
	        }
	        if (hasLatn) return 'latn';
	    },

	    /**
	     * Returns all LangSysRecords in the given script.
	     * @instance
	     * @param {string} [script='DFLT']
	     * @param {boolean} create - forces the creation of this script table if it doesn't exist.
	     * @return {Object} An object with tag and script properties.
	     */
	    getScriptTable: function(script, create) {
	        const layout = this.getTable(create);
	        if (layout) {
	            script = script || 'DFLT';
	            const scripts = layout.scripts;
	            const pos = searchTag(layout.scripts, script);
	            if (pos >= 0) {
	                return scripts[pos].script;
	            } else if (create) {
	                const scr = {
	                    tag: script,
	                    script: {
	                        defaultLangSys: {reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: []},
	                        langSysRecords: []
	                    }
	                };
	                scripts.splice(-1 - pos, 0, scr);
	                return scr.script;
	            }
	        }
	    },

	    /**
	     * Returns a language system table
	     * @instance
	     * @param {string} [script='DFLT']
	     * @param {string} [language='dlft']
	     * @param {boolean} create - forces the creation of this langSysTable if it doesn't exist.
	     * @return {Object}
	     */
	    getLangSysTable: function(script, language, create) {
	        const scriptTable = this.getScriptTable(script, create);
	        if (scriptTable) {
	            if (!language || language === 'dflt' || language === 'DFLT') {
	                return scriptTable.defaultLangSys;
	            }
	            const pos = searchTag(scriptTable.langSysRecords, language);
	            if (pos >= 0) {
	                return scriptTable.langSysRecords[pos].langSys;
	            } else if (create) {
	                const langSysRecord = {
	                    tag: language,
	                    langSys: {reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: []}
	                };
	                scriptTable.langSysRecords.splice(-1 - pos, 0, langSysRecord);
	                return langSysRecord.langSys;
	            }
	        }
	    },

	    /**
	     * Get a specific feature table.
	     * @instance
	     * @param {string} [script='DFLT']
	     * @param {string} [language='dlft']
	     * @param {string} feature - One of the codes listed at https://www.microsoft.com/typography/OTSPEC/featurelist.htm
	     * @param {boolean} create - forces the creation of the feature table if it doesn't exist.
	     * @return {Object}
	     */
	    getFeatureTable: function(script, language, feature, create) {
	        const langSysTable = this.getLangSysTable(script, language, create);
	        if (langSysTable) {
	            let featureRecord;
	            const featIndexes = langSysTable.featureIndexes;
	            const allFeatures = this.font.tables[this.tableName].features;
	            // The FeatureIndex array of indices is in arbitrary order,
	            // even if allFeatures is sorted alphabetically by feature tag.
	            for (let i = 0; i < featIndexes.length; i++) {
	                featureRecord = allFeatures[featIndexes[i]];
	                if (featureRecord.tag === feature) {
	                    return featureRecord.feature;
	                }
	            }
	            if (create) {
	                const index = allFeatures.length;
	                // Automatic ordering of features would require to shift feature indexes in the script list.
	                check.assert(index === 0 || feature >= allFeatures[index - 1].tag, 'Features must be added in alphabetical order.');
	                featureRecord = {
	                    tag: feature,
	                    feature: { params: 0, lookupListIndexes: [] }
	                };
	                allFeatures.push(featureRecord);
	                featIndexes.push(index);
	                return featureRecord.feature;
	            }
	        }
	    },

	    /**
	     * Get the lookup tables of a given type for a script/language/feature.
	     * @instance
	     * @param {string} [script='DFLT']
	     * @param {string} [language='dlft']
	     * @param {string} feature - 4-letter feature code
	     * @param {number} lookupType - 1 to 9
	     * @param {boolean} create - forces the creation of the lookup table if it doesn't exist, with no subtables.
	     * @return {Object[]}
	     */
	    getLookupTables: function(script, language, feature, lookupType, create) {
	        const featureTable = this.getFeatureTable(script, language, feature, create);
	        const tables = [];
	        if (featureTable) {
	            let lookupTable;
	            const lookupListIndexes = featureTable.lookupListIndexes;
	            const allLookups = this.font.tables[this.tableName].lookups;
	            // lookupListIndexes are in no particular order, so use naive search.
	            for (let i = 0; i < lookupListIndexes.length; i++) {
	                lookupTable = allLookups[lookupListIndexes[i]];
	                if (lookupTable.lookupType === lookupType) {
	                    tables.push(lookupTable);
	                }
	            }
	            if (tables.length === 0 && create) {
	                lookupTable = {
	                    lookupType: lookupType,
	                    lookupFlag: 0,
	                    subtables: [],
	                    markFilteringSet: undefined
	                };
	                const index = allLookups.length;
	                allLookups.push(lookupTable);
	                lookupListIndexes.push(index);
	                return [lookupTable];
	            }
	        }
	        return tables;
	    },

	    /**
	     * Find a glyph in a class definition table
	     * https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#class-definition-table
	     * @param {object} classDefTable - an OpenType Layout class definition table
	     * @param {number} glyphIndex - the index of the glyph to find
	     * @returns {number} -1 if not found
	     */
	    getGlyphClass: function(classDefTable, glyphIndex) {
	        switch (classDefTable.format) {
	            case 1:
	                if (classDefTable.startGlyph <= glyphIndex && glyphIndex < classDefTable.startGlyph + classDefTable.classes.length) {
	                    return classDefTable.classes[glyphIndex - classDefTable.startGlyph];
	                }
	                return 0;
	            case 2:
	                const range = searchRange(classDefTable.ranges, glyphIndex);
	                return range ? range.classId : 0;
	        }
	    },

	    /**
	     * Find a glyph in a coverage table
	     * https://docs.microsoft.com/en-us/typography/opentype/spec/chapter2#coverage-table
	     * @param {object} coverageTable - an OpenType Layout coverage table
	     * @param {number} glyphIndex - the index of the glyph to find
	     * @returns {number} -1 if not found
	     */
	    getCoverageIndex: function(coverageTable, glyphIndex) {
	        switch (coverageTable.format) {
	            case 1:
	                const index = binSearch(coverageTable.glyphs, glyphIndex);
	                return index >= 0 ? index : -1;
	            case 2:
	                const range = searchRange(coverageTable.ranges, glyphIndex);
	                return range ? range.index + glyphIndex - range.start : -1;
	        }
	    },

	    /**
	     * Returns the list of glyph indexes of a coverage table.
	     * Format 1: the list is stored raw
	     * Format 2: compact list as range records.
	     * @instance
	     * @param  {Object} coverageTable
	     * @return {Array}
	     */
	    expandCoverage: function(coverageTable) {
	        if (coverageTable.format === 1) {
	            return coverageTable.glyphs;
	        } else {
	            const glyphs = [];
	            const ranges = coverageTable.ranges;
	            for (let i = 0; i < ranges.length; i++) {
	                const range = ranges[i];
	                const start = range.start;
	                const end = range.end;
	                for (let j = start; j <= end; j++) {
	                    glyphs.push(j);
	                }
	            }
	            return glyphs;
	        }
	    }

	};

	// The Position object provides utility methods to manipulate

	/**
	 * @exports opentype.Position
	 * @class
	 * @extends opentype.Layout
	 * @param {opentype.Font}
	 * @constructor
	 */
	function Position(font) {
	    Layout.call(this, font, 'gpos');
	}

	Position.prototype = Layout.prototype;

	/**
	 * Init some data for faster and easier access later.
	 */
	Position.prototype.init = function() {
	    const script = this.getDefaultScriptName();
	    this.defaultKerningTables = this.getKerningTables(script);
	};

	/**
	 * Find a glyph pair in a list of lookup tables of type 2 and retrieve the xAdvance kerning value.
	 *
	 * @param {integer} leftIndex - left glyph index
	 * @param {integer} rightIndex - right glyph index
	 * @returns {integer}
	 */
	Position.prototype.getKerningValue = function(kerningLookups, leftIndex, rightIndex) {
	    for (let i = 0; i < kerningLookups.length; i++) {
	        const subtables = kerningLookups[i].subtables;
	        for (let j = 0; j < subtables.length; j++) {
	            const subtable = subtables[j];
	            const covIndex = this.getCoverageIndex(subtable.coverage, leftIndex);
	            if (covIndex < 0) continue;
	            switch (subtable.posFormat) {
	                case 1:
	                    // Search Pair Adjustment Positioning Format 1
	                    let pairSet = subtable.pairSets[covIndex];
	                    for (let k = 0; k < pairSet.length; k++) {
	                        let pair = pairSet[k];
	                        if (pair.secondGlyph === rightIndex) {
	                            return pair.value1 && pair.value1.xAdvance || 0;
	                        }
	                    }
	                    break;      // left glyph found, not right glyph - try next subtable
	                case 2:
	                    // Search Pair Adjustment Positioning Format 2
	                    const class1 = this.getGlyphClass(subtable.classDef1, leftIndex);
	                    const class2 = this.getGlyphClass(subtable.classDef2, rightIndex);
	                    const pair = subtable.classRecords[class1][class2];
	                    return pair.value1 && pair.value1.xAdvance || 0;
	            }
	        }
	    }
	    return 0;
	};

	/**
	 * List all kerning lookup tables.
	 *
	 * @param {string} [script='DFLT'] - use font.position.getDefaultScriptName() for a better default value
	 * @param {string} [language='dflt']
	 * @return {object[]} The list of kerning lookup tables (may be empty), or undefined if there is no GPOS table (and we should use the kern table)
	 */
	Position.prototype.getKerningTables = function(script, language) {
	    if (this.font.tables.gpos) {
	        return this.getLookupTables(script, language, 'kern', 2);
	    }
	};

	// The Substitution object provides utility methods to manipulate

	/**
	 * @exports opentype.Substitution
	 * @class
	 * @extends opentype.Layout
	 * @param {opentype.Font}
	 * @constructor
	 */
	function Substitution(font) {
	    Layout.call(this, font, 'gsub');
	}

	// Check if 2 arrays of primitives are equal.
	function arraysEqual(ar1, ar2) {
	    const n = ar1.length;
	    if (n !== ar2.length) { return false; }
	    for (let i = 0; i < n; i++) {
	        if (ar1[i] !== ar2[i]) { return false; }
	    }
	    return true;
	}

	// Find the first subtable of a lookup table in a particular format.
	function getSubstFormat(lookupTable, format, defaultSubtable) {
	    const subtables = lookupTable.subtables;
	    for (let i = 0; i < subtables.length; i++) {
	        const subtable = subtables[i];
	        if (subtable.substFormat === format) {
	            return subtable;
	        }
	    }
	    if (defaultSubtable) {
	        subtables.push(defaultSubtable);
	        return defaultSubtable;
	    }
	    return undefined;
	}

	Substitution.prototype = Layout.prototype;

	/**
	 * Create a default GSUB table.
	 * @return {Object} gsub - The GSUB table.
	 */
	Substitution.prototype.createDefaultTable = function() {
	    // Generate a default empty GSUB table with just a DFLT script and dflt lang sys.
	    return {
	        version: 1,
	        scripts: [{
	            tag: 'DFLT',
	            script: {
	                defaultLangSys: { reserved: 0, reqFeatureIndex: 0xffff, featureIndexes: [] },
	                langSysRecords: []
	            }
	        }],
	        features: [],
	        lookups: []
	    };
	};

	/**
	 * List all single substitutions (lookup type 1) for a given script, language, and feature.
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 * @param {string} feature - 4-character feature name ('aalt', 'salt', 'ss01'...)
	 * @return {Array} substitutions - The list of substitutions.
	 */
	Substitution.prototype.getSingle = function(feature, script, language) {
	    const substitutions = [];
	    const lookupTables = this.getLookupTables(script, language, feature, 1);
	    for (let idx = 0; idx < lookupTables.length; idx++) {
	        const subtables = lookupTables[idx].subtables;
	        for (let i = 0; i < subtables.length; i++) {
	            const subtable = subtables[i];
	            const glyphs = this.expandCoverage(subtable.coverage);
	            let j;
	            if (subtable.substFormat === 1) {
	                const delta = subtable.deltaGlyphId;
	                for (j = 0; j < glyphs.length; j++) {
	                    const glyph = glyphs[j];
	                    substitutions.push({ sub: glyph, by: glyph + delta });
	                }
	            } else {
	                const substitute = subtable.substitute;
	                for (j = 0; j < glyphs.length; j++) {
	                    substitutions.push({ sub: glyphs[j], by: substitute[j] });
	                }
	            }
	        }
	    }
	    return substitutions;
	};

	/**
	 * List all alternates (lookup type 3) for a given script, language, and feature.
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 * @param {string} feature - 4-character feature name ('aalt', 'salt'...)
	 * @return {Array} alternates - The list of alternates
	 */
	Substitution.prototype.getAlternates = function(feature, script, language) {
	    const alternates = [];
	    const lookupTables = this.getLookupTables(script, language, feature, 3);
	    for (let idx = 0; idx < lookupTables.length; idx++) {
	        const subtables = lookupTables[idx].subtables;
	        for (let i = 0; i < subtables.length; i++) {
	            const subtable = subtables[i];
	            const glyphs = this.expandCoverage(subtable.coverage);
	            const alternateSets = subtable.alternateSets;
	            for (let j = 0; j < glyphs.length; j++) {
	                alternates.push({ sub: glyphs[j], by: alternateSets[j] });
	            }
	        }
	    }
	    return alternates;
	};

	/**
	 * List all ligatures (lookup type 4) for a given script, language, and feature.
	 * The result is an array of ligature objects like { sub: [ids], by: id }
	 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 * @return {Array} ligatures - The list of ligatures.
	 */
	Substitution.prototype.getLigatures = function(feature, script, language) {
	    const ligatures = [];
	    const lookupTables = this.getLookupTables(script, language, feature, 4);
	    for (let idx = 0; idx < lookupTables.length; idx++) {
	        const subtables = lookupTables[idx].subtables;
	        for (let i = 0; i < subtables.length; i++) {
	            const subtable = subtables[i];
	            const glyphs = this.expandCoverage(subtable.coverage);
	            const ligatureSets = subtable.ligatureSets;
	            for (let j = 0; j < glyphs.length; j++) {
	                const startGlyph = glyphs[j];
	                const ligSet = ligatureSets[j];
	                for (let k = 0; k < ligSet.length; k++) {
	                    const lig = ligSet[k];
	                    ligatures.push({
	                        sub: [startGlyph].concat(lig.components),
	                        by: lig.ligGlyph
	                    });
	                }
	            }
	        }
	    }
	    return ligatures;
	};

	/**
	 * Add or modify a single substitution (lookup type 1)
	 * Format 2, more flexible, is always used.
	 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
	 * @param {Object} substitution - { sub: id, delta: number } for format 1 or { sub: id, by: id } for format 2.
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 */
	Substitution.prototype.addSingle = function(feature, substitution, script, language) {
	    const lookupTable = this.getLookupTables(script, language, feature, 1, true)[0];
	    const subtable = getSubstFormat(lookupTable, 2, {                // lookup type 1 subtable, format 2, coverage format 1
	        substFormat: 2,
	        coverage: {format: 1, glyphs: []},
	        substitute: []
	    });
	    check.assert(subtable.coverage.format === 1, 'Ligature: unable to modify coverage table format ' + subtable.coverage.format);
	    const coverageGlyph = substitution.sub;
	    let pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	    if (pos < 0) {
	        pos = -1 - pos;
	        subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
	        subtable.substitute.splice(pos, 0, 0);
	    }
	    subtable.substitute[pos] = substitution.by;
	};

	/**
	 * Add or modify an alternate substitution (lookup type 1)
	 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
	 * @param {Object} substitution - { sub: id, by: [ids] }
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 */
	Substitution.prototype.addAlternate = function(feature, substitution, script, language) {
	    const lookupTable = this.getLookupTables(script, language, feature, 3, true)[0];
	    const subtable = getSubstFormat(lookupTable, 1, {                // lookup type 3 subtable, format 1, coverage format 1
	        substFormat: 1,
	        coverage: {format: 1, glyphs: []},
	        alternateSets: []
	    });
	    check.assert(subtable.coverage.format === 1, 'Ligature: unable to modify coverage table format ' + subtable.coverage.format);
	    const coverageGlyph = substitution.sub;
	    let pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	    if (pos < 0) {
	        pos = -1 - pos;
	        subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
	        subtable.alternateSets.splice(pos, 0, 0);
	    }
	    subtable.alternateSets[pos] = substitution.by;
	};

	/**
	 * Add a ligature (lookup type 4)
	 * Ligatures with more components must be stored ahead of those with fewer components in order to be found
	 * @param {string} feature - 4-letter feature name ('liga', 'rlig', 'dlig'...)
	 * @param {Object} ligature - { sub: [ids], by: id }
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 */
	Substitution.prototype.addLigature = function(feature, ligature, script, language) {
	    const lookupTable = this.getLookupTables(script, language, feature, 4, true)[0];
	    let subtable = lookupTable.subtables[0];
	    if (!subtable) {
	        subtable = {                // lookup type 4 subtable, format 1, coverage format 1
	            substFormat: 1,
	            coverage: { format: 1, glyphs: [] },
	            ligatureSets: []
	        };
	        lookupTable.subtables[0] = subtable;
	    }
	    check.assert(subtable.coverage.format === 1, 'Ligature: unable to modify coverage table format ' + subtable.coverage.format);
	    const coverageGlyph = ligature.sub[0];
	    const ligComponents = ligature.sub.slice(1);
	    const ligatureTable = {
	        ligGlyph: ligature.by,
	        components: ligComponents
	    };
	    let pos = this.binSearch(subtable.coverage.glyphs, coverageGlyph);
	    if (pos >= 0) {
	        // ligatureSet already exists
	        const ligatureSet = subtable.ligatureSets[pos];
	        for (let i = 0; i < ligatureSet.length; i++) {
	            // If ligature already exists, return.
	            if (arraysEqual(ligatureSet[i].components, ligComponents)) {
	                return;
	            }
	        }
	        // ligature does not exist: add it.
	        ligatureSet.push(ligatureTable);
	    } else {
	        // Create a new ligatureSet and add coverage for the first glyph.
	        pos = -1 - pos;
	        subtable.coverage.glyphs.splice(pos, 0, coverageGlyph);
	        subtable.ligatureSets.splice(pos, 0, [ligatureTable]);
	    }
	};

	/**
	 * List all feature data for a given script and language.
	 * @param {string} feature - 4-letter feature name
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 * @return {Array} substitutions - The list of substitutions.
	 */
	Substitution.prototype.getFeature = function(feature, script, language) {
	    if (/ss\d\d/.test(feature)) {
	        // ss01 - ss20
	        return this.getSingle(feature, script, language);
	    }
	    switch (feature) {
	        case 'aalt':
	        case 'salt':
	            return this.getSingle(feature, script, language)
	                    .concat(this.getAlternates(feature, script, language));
	        case 'dlig':
	        case 'liga':
	        case 'rlig': return this.getLigatures(feature, script, language);
	    }
	    return undefined;
	};

	/**
	 * Add a substitution to a feature for a given script and language.
	 * @param {string} feature - 4-letter feature name
	 * @param {Object} sub - the substitution to add (an object like { sub: id or [ids], by: id or [ids] })
	 * @param {string} [script='DFLT']
	 * @param {string} [language='dflt']
	 */
	Substitution.prototype.add = function(feature, sub, script, language) {
	    if (/ss\d\d/.test(feature)) {
	        // ss01 - ss20
	        return this.addSingle(feature, sub, script, language);
	    }
	    switch (feature) {
	        case 'aalt':
	        case 'salt':
	            if (typeof sub.by === 'number') {
	                return this.addSingle(feature, sub, script, language);
	            }
	            return this.addAlternate(feature, sub, script, language);
	        case 'dlig':
	        case 'liga':
	        case 'rlig':
	            return this.addLigature(feature, sub, script, language);
	    }
	    return undefined;
	};

	function isBrowser() {
	    return typeof window !== 'undefined';
	}

	function nodeBufferToArrayBuffer(buffer) {
	    const ab = new ArrayBuffer(buffer.length);
	    const view = new Uint8Array(ab);
	    for (let i = 0; i < buffer.length; ++i) {
	        view[i] = buffer[i];
	    }

	    return ab;
	}

	function arrayBufferToNodeBuffer(ab) {
	    const buffer = new Buffer(ab.byteLength);
	    const view = new Uint8Array(ab);
	    for (let i = 0; i < buffer.length; ++i) {
	        buffer[i] = view[i];
	    }

	    return buffer;
	}

	function checkArgument(expression, message) {
	    if (!expression) {
	        throw message;
	    }
	}

	function HintingTrueType(){throw new Error("Hinting disabled")}

	/**
	 * Converts a string into a list of tokens.
	 */

	/**
	 * Create a new token
	 * @param {string} char a single char
	 */
	function Token(char) {
	    this.char = char;
	    this.state = {};
	    this.activeState = null;
	}

	/**
	 * Create a new context range
	 * @param {number} startIndex range start index
	 * @param {number} endOffset range end index offset
	 * @param {string} contextName owner context name
	 */
	function ContextRange(startIndex, endOffset, contextName) {
	    this.contextName = contextName;
	    this.startIndex = startIndex;
	    this.endOffset = endOffset;
	}

	/**
	 * Check context start and end
	 * @param {string} contextName a unique context name
	 * @param {function} checkStart a predicate function the indicates a context's start
	 * @param {function} checkEnd a predicate function the indicates a context's end
	 */
	function ContextChecker(contextName, checkStart, checkEnd) {
	    this.contextName = contextName;
	    this.openRange = null;
	    this.ranges = [];
	    this.checkStart = checkStart;
	    this.checkEnd = checkEnd;
	}

	/**
	 * @typedef ContextParams
	 * @type Object
	 * @property {array} context context items
	 * @property {number} currentIndex current item index
	 */

	/**
	 * Create a context params
	 * @param {array} context a list of items
	 * @param {number} currentIndex current item index
	 */
	function ContextParams(context, currentIndex) {
	    this.context = context;
	    this.index = currentIndex;
	    this.length = context.length;
	    this.current = context[currentIndex];
	    this.backtrack = context.slice(0, currentIndex);
	    this.lookahead = context.slice(currentIndex + 1);
	}

	/**
	 * Create an event instance
	 * @param {string} eventId event unique id
	 */
	function Event(eventId) {
	    this.eventId = eventId;
	    this.subscribers = [];
	}

	/**
	 * Initialize a core events and auto subscribe required event handlers
	 * @param {any} events an object that enlists core events handlers
	 */
	function initializeCoreEvents(events) {
	    const coreEvents = [
	        'start', 'end', 'next', 'newToken', 'contextStart',
	        'contextEnd', 'insertToken', 'removeToken', 'removeRange',
	        'replaceToken', 'replaceRange', 'composeRUD', 'updateContextsRanges'
	    ];

	    coreEvents.forEach(eventId => {
	        Object.defineProperty(this.events, eventId, {
	            value: new Event(eventId)
	        });
	    });

	    if (!!events) {
	        coreEvents.forEach(eventId => {
	            const event = events[eventId];
	            if (typeof event === 'function') {
	                this.events[eventId].subscribe(event);
	            }
	        });
	    }
	    const requiresContextUpdate = [
	        'insertToken', 'removeToken', 'removeRange',
	        'replaceToken', 'replaceRange', 'composeRUD'
	    ];
	    requiresContextUpdate.forEach(eventId => {
	        this.events[eventId].subscribe(
	            this.updateContextsRanges
	        );
	    });
	}

	/**
	 * Converts a string into a list of tokens
	 * @param {any} events tokenizer core events
	 */
	function Tokenizer(events) {
	    this.tokens = [];
	    this.registeredContexts = {};
	    this.contextCheckers = [];
	    this.events = {};
	    this.registeredModifiers = [];

	    initializeCoreEvents.call(this, events);
	}

	/**
	 * Sets the state of a token, usually called by a state modifier.
	 * @param {string} key state item key
	 * @param {any} value state item value
	 */
	Token.prototype.setState = function(key, value) {
	    this.state[key] = value;
	    this.activeState = { key, value: this.state[key] };
	    return this.activeState;
	};

	Token.prototype.getState = function (stateId) {
	    return this.state[stateId] || null;
	};

	/**
	 * Checks if an index exists in the tokens list.
	 * @param {number} index token index
	 */
	Tokenizer.prototype.inboundIndex = function(index) {
	    return index >= 0 && index < this.tokens.length;
	};

	/**
	 * Compose and apply a list of operations (replace, update, delete)
	 * @param {array} RUDs replace, update and delete operations
	 * TODO: Perf. Optimization (lengthBefore === lengthAfter ? dispatch once)
	 */
	Tokenizer.prototype.composeRUD = function (RUDs) {
	    const silent = true;
	    const state = RUDs.map(RUD => (
	        this[RUD[0]].apply(this, RUD.slice(1).concat(silent))
	    ));
	    const hasFAILObject = obj => (
	        typeof obj === 'object' &&
	        obj.hasOwnProperty('FAIL')
	    );
	    if (state.every(hasFAILObject)) {
	        return {
	            FAIL: `composeRUD: one or more operations hasn't completed successfully`,
	            report: state.filter(hasFAILObject)
	        };
	    }
	    this.dispatch('composeRUD', [state.filter(op => !hasFAILObject(op))]);
	};

	/**
	 * Replace a range of tokens with a list of tokens
	 * @param {number} startIndex range start index
	 * @param {number} offset range offset
	 * @param {token} tokens a list of tokens to replace
	 * @param {boolean} silent dispatch events and update context ranges
	 */
	Tokenizer.prototype.replaceRange = function (startIndex, offset, tokens, silent) {
	    offset = offset !== null ? offset : this.tokens.length;
	    const isTokenType = tokens.every(token => token instanceof Token);
	    if (!isNaN(startIndex) && this.inboundIndex(startIndex) && isTokenType) {
	        const replaced = this.tokens.splice.apply(
	            this.tokens, [startIndex, offset].concat(tokens)
	        );
	        if (!silent) this.dispatch('replaceToken', [startIndex, offset, tokens]);
	        return [replaced, tokens];
	    } else {
	        return { FAIL: 'replaceRange: invalid tokens or startIndex.' };
	    }
	};

	/**
	 * Replace a token with another token
	 * @param {number} index token index
	 * @param {token} token a token to replace
	 * @param {boolean} silent dispatch events and update context ranges
	 */
	Tokenizer.prototype.replaceToken = function (index, token, silent) {
	    if (!isNaN(index) && this.inboundIndex(index) && token instanceof Token) {
	        const replaced = this.tokens.splice(index, 1, token);
	        if (!silent) this.dispatch('replaceToken', [index, token]);
	        return [replaced[0], token];
	    } else {
	        return { FAIL: 'replaceToken: invalid token or index.' };
	    }
	};

	/**
	 * Removes a range of tokens
	 * @param {number} startIndex range start index
	 * @param {number} offset range offset
	 * @param {boolean} silent dispatch events and update context ranges
	 */
	Tokenizer.prototype.removeRange = function(startIndex, offset, silent) {
	    offset = !isNaN(offset) ? offset : this.tokens.length;
	    const tokens = this.tokens.splice(startIndex, offset);
	    if (!silent) this.dispatch('removeRange', [tokens, startIndex, offset]);
	    return tokens;
	};

	/**
	 * Remove a token at a certain index
	 * @param {number} index token index
	 * @param {boolean} silent dispatch events and update context ranges
	 */
	Tokenizer.prototype.removeToken = function(index, silent) {
	    if (!isNaN(index) && this.inboundIndex(index)) {
	        const token = this.tokens.splice(index, 1);
	        if (!silent) this.dispatch('removeToken', [token, index]);
	        return token;
	    } else {
	        return { FAIL: 'removeToken: invalid token index.' };
	    }
	};

	/**
	 * Insert a list of tokens at a certain index
	 * @param {array} tokens a list of tokens to insert
	 * @param {number} index insert the list of tokens at index
	 * @param {boolean} silent dispatch events and update context ranges
	 */
	Tokenizer.prototype.insertToken = function (tokens, index, silent) {
	    const tokenType = tokens.every(
	        token => token instanceof Token
	    );
	    if (tokenType) {
	        this.tokens.splice.apply(
	            this.tokens, [index, 0].concat(tokens)
	        );
	        if (!silent) this.dispatch('insertToken', [tokens, index]);
	        return tokens;
	    } else {
	        return { FAIL: 'insertToken: invalid token(s).' };
	    }
	};

	/**
	 * A state modifier that is called on 'newToken' event
	 * @param {string} modifierId state modifier id
	 * @param {function} condition a predicate function that returns true or false
	 * @param {function} modifier a function to update token state
	 */
	Tokenizer.prototype.registerModifier = function(modifierId, condition, modifier) {
	    this.events.newToken.subscribe(function(token, contextParams) {
	        const conditionParams = [token, contextParams];
	        const canApplyModifier = (
	            condition === null ||
	            condition.apply(this, conditionParams) === true
	        );
	        const modifierParams = [token, contextParams];
	        if (canApplyModifier) {
	            let newStateValue = modifier.apply(this, modifierParams);
	            token.setState(modifierId, newStateValue);
	        }
	    });
	    this.registeredModifiers.push(modifierId);
	};

	/**
	 * Subscribe a handler to an event
	 * @param {function} eventHandler an event handler function
	 */
	Event.prototype.subscribe = function (eventHandler) {
	    if (typeof eventHandler === 'function') {
	        return ((this.subscribers.push(eventHandler)) - 1);
	    } else {
	        return { FAIL: `invalid '${this.eventId}' event handler`};
	    }
	};

	/**
	 * Unsubscribe an event handler
	 * @param {string} subsId subscription id
	 */
	Event.prototype.unsubscribe = function (subsId) {
	    this.subscribers.splice(subsId, 1);
	};

	/**
	 * Sets context params current value index
	 * @param {number} index context params current value index
	 */
	ContextParams.prototype.setCurrentIndex = function(index) {
	    this.index = index;
	    this.current = this.context[index];
	    this.backtrack = this.context.slice(0, index);
	    this.lookahead = this.context.slice(index + 1);
	};

	/**
	 * Get an item at an offset from the current value
	 * example (current value is 3):
	 *  1    2   [3]   4    5   |   items values
	 * -2   -1    0    1    2   |   offset values
	 * @param {number} offset an offset from current value index
	 */
	ContextParams.prototype.get = function (offset) {
	    switch (true) {
	        case (offset === 0):
	            return this.current;
	        case (offset < 0 && Math.abs(offset) <= this.backtrack.length):
	            return this.backtrack.slice(offset)[0];
	        case (offset > 0 && offset <= this.lookahead.length):
	            return this.lookahead[offset - 1];
	        default:
	            return null;
	    }
	};

	/**
	 * Converts a context range into a string value
	 * @param {contextRange} range a context range
	 */
	Tokenizer.prototype.rangeToText = function (range) {
	    if (range instanceof ContextRange) {
	        return (
	            this.getRangeTokens(range)
	                .map(token => token.char).join('')
	        );
	    }
	};

	/**
	 * Converts all tokens into a string
	 */
	Tokenizer.prototype.getText = function () {
	    return this.tokens.map(token => token.char).join('');
	};

	/**
	 * Get a context by name
	 * @param {string} contextName context name to get
	 */
	Tokenizer.prototype.getContext = function (contextName) {
	    let context = this.registeredContexts[contextName];
	    return !!context ? context : null;
	};

	/**
	 * Subscribes a new event handler to an event
	 * @param {string} eventName event name to subscribe to
	 * @param {function} eventHandler a function to be invoked on event
	 */
	Tokenizer.prototype.on = function(eventName, eventHandler) {
	    const event = this.events[eventName];
	    if (!!event) {
	        return event.subscribe(eventHandler);
	    } else {
	        return null;
	    }
	};

	/**
	 * Dispatches an event
	 * @param {string} eventName event name
	 * @param {any} args event handler arguments
	 */
	Tokenizer.prototype.dispatch = function(eventName, args) {
	    const event = this.events[eventName];
	    if (event instanceof Event) {
	        event.subscribers.forEach(subscriber => {
	            subscriber.apply(this, args || []);
	        });
	    }
	};

	/**
	 * Register a new context checker
	 * @param {string} contextName a unique context name
	 * @param {function} contextStartCheck a predicate function that returns true on context start
	 * @param {function} contextEndCheck  a predicate function that returns true on context end
	 * TODO: call tokenize on registration to update context ranges with the new context.
	 */
	Tokenizer.prototype.registerContextChecker = function(contextName, contextStartCheck, contextEndCheck) {
	    if (!!this.getContext(contextName)) return {
	        FAIL:
	        `context name '${contextName}' is already registered.`
	    };
	    if (typeof contextStartCheck !== 'function') return {
	        FAIL:
	        `missing context start check.`
	    };
	    if (typeof contextEndCheck !== 'function') return {
	        FAIL:
	        `missing context end check.`
	    };
	    const contextCheckers = new ContextChecker(
	        contextName, contextStartCheck, contextEndCheck
	    );
	    this.registeredContexts[contextName] = contextCheckers;
	    this.contextCheckers.push(contextCheckers);
	    return contextCheckers;
	};

	/**
	 * Gets a context range tokens
	 * @param {contextRange} range a context range
	 */
	Tokenizer.prototype.getRangeTokens = function(range) {
	    const endIndex = range.startIndex + range.endOffset;
	    return [].concat(
	        this.tokens
	            .slice(range.startIndex, endIndex)
	    );
	};

	/**
	 * Gets the ranges of a context
	 * @param {string} contextName context name
	 */
	Tokenizer.prototype.getContextRanges = function(contextName) {
	    const context = this.getContext(contextName);
	    if (!!context) {
	        return context.ranges;
	    } else {
	        return { FAIL: `context checker '${contextName}' is not registered.` };
	    }
	};

	/**
	 * Resets context ranges to run context update
	 */
	Tokenizer.prototype.resetContextsRanges = function () {
	    const registeredContexts = this.registeredContexts;
	    for (const contextName in registeredContexts) {
	        if (registeredContexts.hasOwnProperty(contextName)) {
	            const context = registeredContexts[contextName];
	            context.ranges = [];
	        }
	    }
	};

	/**
	 * Updates context ranges
	 */
	Tokenizer.prototype.updateContextsRanges = function () {
	    this.resetContextsRanges();
	    const chars = this.tokens.map(token => token.char);
	    for (let i = 0; i < chars.length; i++) {
	        const contextParams = new ContextParams(chars, i);
	        this.runContextCheck(contextParams);
	    }
	    this.dispatch('updateContextsRanges', [this.registeredContexts]);
	};

	/**
	 * Sets the end offset of an open range
	 * @param {number} offset range end offset
	 * @param {string} contextName context name
	 */
	Tokenizer.prototype.setEndOffset = function (offset, contextName) {
	    const startIndex = this.getContext(contextName).openRange.startIndex;
	    let range = new ContextRange(startIndex, offset, contextName);
	    const ranges = this.getContext(contextName).ranges;
	    range.rangeId = `${contextName}.${ranges.length}`;
	    ranges.push(range);
	    this.getContext(contextName).openRange = null;
	    return range;
	};

	/**
	 * Runs a context check on the current context
	 * @param {contextParams} contextParams current context params
	 */
	Tokenizer.prototype.runContextCheck = function(contextParams) {
	    const index = contextParams.index;
	    this.contextCheckers.forEach(contextChecker => {
	        let contextName = contextChecker.contextName;
	        let openRange = this.getContext(contextName).openRange;
	        if (!openRange && contextChecker.checkStart(contextParams)) {
	            openRange = new ContextRange(index, null, contextName);
	            this.getContext(contextName).openRange = openRange;
	            this.dispatch('contextStart', [contextName, index]);
	        }
	        if (!!openRange && contextChecker.checkEnd(contextParams)) {
	            const offset = (index - openRange.startIndex) + 1;
	            const range = this.setEndOffset(offset, contextName);
	            this.dispatch('contextEnd', [contextName, range]);
	        }
	    });
	};

	/**
	 * Converts a text into a list of tokens
	 * @param {string} text a text to tokenize
	 */
	Tokenizer.prototype.tokenize = function (text) {
	    this.tokens = [];
	    this.resetContextsRanges();
	    let chars = Array.from(text);
	    this.dispatch('start');
	    for (let i = 0; i < chars.length; i++) {
	        const char = chars[i];
	        const contextParams = new ContextParams(chars, i);
	        this.dispatch('next', [contextParams]);
	        this.runContextCheck(contextParams);
	        let token = new Token(char);
	        this.tokens.push(token);
	        this.dispatch('newToken', [token, contextParams]);
	    }
	    this.dispatch('end', [this.tokens]);
	    return this.tokens;
	};

	// ╭─┄┄┄────────────────────────┄─────────────────────────────────────────────╮
	// ┊ Character Class Assertions ┊ Checks if a char belongs to a certain class ┊
	// ╰─╾──────────────────────────┄─────────────────────────────────────────────╯
	// jscs:disable maximumLineLength
	/**
	 * Check if a char is Arabic
	 * @param {string} c a single char
	 */
	function isArabicChar(c) {
	    return /[\u0600-\u065F\u066A-\u06D2\u06FA-\u06FF]/.test(c);
	}

	/**
	 * Check if a char is an isolated arabic char
	 * @param {string} c a single char
	 */
	function isIsolatedArabicChar(char) {
	    return /[\u0630\u0690\u0621\u0631\u0661\u0671\u0622\u0632\u0672\u0692\u06C2\u0623\u0673\u0693\u06C3\u0624\u0694\u06C4\u0625\u0675\u0695\u06C5\u06E5\u0676\u0696\u06C6\u0627\u0677\u0697\u06C7\u0648\u0688\u0698\u06C8\u0689\u0699\u06C9\u068A\u06CA\u066B\u068B\u06CB\u068C\u068D\u06CD\u06FD\u068E\u06EE\u06FE\u062F\u068F\u06CF\u06EF]/.test(char);
	}

	/**
	 * Check if a char is an Arabic Tashkeel char
	 * @param {string} c a single char
	 */
	function isTashkeelArabicChar(char) {
	    return /[\u0600-\u0605\u060C-\u060E\u0610-\u061B\u061E\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/.test(char);
	}

	/**
	 * Check if a char is Latin
	 * @param {string} c a single char
	 */
	function isLatinChar(c) {
	    return /[A-z]/.test(c);
	}

	/**
	 * Check if a char is whitespace char
	 * @param {string} c a single char
	 */
	function isWhiteSpace(c) {
	    return /\s/.test(c);
	}

	/**
	 * Query a feature by some of it's properties to lookup a glyph substitution.
	 */

	/**
	 * Create feature query instance
	 * @param {Font} font opentype font instance
	 */
	function FeatureQuery(font) {
	    this.font = font;
	    this.features = {};
	}

	/**
	 * @typedef SubstitutionAction
	 * @type Object
	 * @property {number} id substitution type
	 * @property {string} tag feature tag
	 * @property {any} substitution substitution value(s)
	 */

	/**
	 * Create a substitution action instance
	 * @param {SubstitutionAction} action
	 */
	function SubstitutionAction(action) {
	    this.id = action.id;
	    this.tag = action.tag;
	    this.substitution = action.substitution;
	}

	/**
	 * Lookup a coverage table
	 * @param {number} glyphIndex glyph index
	 * @param {CoverageTable} coverage coverage table
	 */
	function lookupCoverage(glyphIndex, coverage) {
	    if (!glyphIndex) return -1;
	    switch (coverage.format) {
	        case 1:
	            return coverage.glyphs.indexOf(glyphIndex);

	        case 2:
	            let ranges = coverage.ranges;
	            for (let i = 0; i < ranges.length; i++) {
	                const range = ranges[i];
	                if (glyphIndex >= range.start && glyphIndex <= range.end) {
	                    let offset = glyphIndex - range.start;
	                    return range.index + offset;
	                }
	            }
	            break;
	        default:
	            return -1; // not found
	    }
	    return -1;
	}

	/**
	 * Handle a single substitution - format 2
	 * @param {ContextParams} contextParams context params to lookup
	 */
	function singleSubstitutionFormat2(glyphIndex, subtable) {
	    let substituteIndex = lookupCoverage(glyphIndex, subtable.coverage);
	    if (substituteIndex === -1) return null;
	    return subtable.substitute[substituteIndex];
	}

	/**
	 * Lookup a list of coverage tables
	 * @param {any} coverageList a list of coverage tables
	 * @param {ContextParams} contextParams context params to lookup
	 */
	function lookupCoverageList(coverageList, contextParams) {
	    let lookupList = [];
	    for (let i = 0; i < coverageList.length; i++) {
	        const coverage = coverageList[i];
	        let glyphIndex = contextParams.current;
	        glyphIndex = Array.isArray(glyphIndex) ? glyphIndex[0] : glyphIndex;
	        const lookupIndex = lookupCoverage(glyphIndex, coverage);
	        if (lookupIndex !== -1) {
	            lookupList.push(lookupIndex);
	        }
	    }
	    if (lookupList.length !== coverageList.length) return -1;
	    return lookupList;
	}

	/**
	 * Handle chaining context substitution - format 3
	 * @param {ContextParams} contextParams context params to lookup
	 */
	function chainingSubstitutionFormat3(contextParams, subtable) {
	    const lookupsCount = (
	        subtable.inputCoverage.length +
	        subtable.lookaheadCoverage.length +
	        subtable.backtrackCoverage.length
	    );
	    if (contextParams.context.length < lookupsCount) return [];
	    // INPUT LOOKUP //
	    let inputLookups = lookupCoverageList(
	        subtable.inputCoverage, contextParams
	    );
	    if (inputLookups === -1) return [];
	    // LOOKAHEAD LOOKUP //
	    const lookaheadOffset = subtable.inputCoverage.length - 1;
	    if (contextParams.lookahead.length < subtable.lookaheadCoverage.length) return [];
	    let lookaheadContext = contextParams.lookahead.slice(lookaheadOffset);
	    while (lookaheadContext.length && isTashkeelArabicChar(lookaheadContext[0].char)) {
	        lookaheadContext.shift();
	    }
	    const lookaheadParams = new ContextParams(lookaheadContext, 0);
	    let lookaheadLookups = lookupCoverageList(
	        subtable.lookaheadCoverage, lookaheadParams
	    );
	    // BACKTRACK LOOKUP //
	    let backtrackContext = [].concat(contextParams.backtrack);
	    backtrackContext.reverse();
	    while (backtrackContext.length && isTashkeelArabicChar(backtrackContext[0].char)) {
	        backtrackContext.shift();
	    }
	    if (backtrackContext.length < subtable.backtrackCoverage.length) return [];
	    const backtrackParams = new ContextParams(backtrackContext, 0);
	    let backtrackLookups = lookupCoverageList(
	        subtable.backtrackCoverage, backtrackParams
	    );
	    const contextRulesMatch = (
	        inputLookups.length === subtable.inputCoverage.length &&
	        lookaheadLookups.length === subtable.lookaheadCoverage.length &&
	        backtrackLookups.length === subtable.backtrackCoverage.length
	    );
	    let substitutions = [];
	    if (contextRulesMatch) {
	        for (let i = 0; i < subtable.lookupRecords.length; i++) {
	            const lookupRecord = subtable.lookupRecords[i];
	            const lookupListIndex = lookupRecord.lookupListIndex;
	            const lookupTable = this.getLookupByIndex(lookupListIndex);
	            for (let s = 0; s < lookupTable.subtables.length; s++) {
	                const subtable = lookupTable.subtables[s];
	                const lookup = this.getLookupMethod(lookupTable, subtable);
	                const substitutionType = this.getSubstitutionType(lookupTable, subtable);
	                if (substitutionType === '12') {
	                    for (let n = 0; n < inputLookups.length; n++) {
	                        const glyphIndex = contextParams.get(n);
	                        const substitution = lookup(glyphIndex);
	                        if (substitution) substitutions.push(substitution);
	                    }
	                }
	            }
	        }
	    }
	    return substitutions;
	}

	/**
	 * Handle ligature substitution - format 1
	 * @param {ContextParams} contextParams context params to lookup
	 */
	function ligatureSubstitutionFormat1(contextParams, subtable) {
	    // COVERAGE LOOKUP //
	    let glyphIndex = contextParams.current;
	    let ligSetIndex = lookupCoverage(glyphIndex, subtable.coverage);
	    if (ligSetIndex === -1) return null;
	    // COMPONENTS LOOKUP
	    // (!) note, components are ordered in the written direction.
	    let ligature;
	    let ligatureSet = subtable.ligatureSets[ligSetIndex];
	    for (let s = 0; s < ligatureSet.length; s++) {
	        ligature = ligatureSet[s];
	        for (let l = 0; l < ligature.components.length; l++) {
	            const lookaheadItem = contextParams.lookahead[l];
	            const component = ligature.components[l];
	            if (lookaheadItem !== component) break;
	            if (l === ligature.components.length - 1) return ligature;
	        }
	    }
	    return null;
	}

	/**
	 * Handle decomposition substitution - format 1
	 * @param {number} glyphIndex glyph index
	 * @param {any} subtable subtable
	 */
	function decompositionSubstitutionFormat1(glyphIndex, subtable) {
	    let substituteIndex = lookupCoverage(glyphIndex, subtable.coverage);
	    if (substituteIndex === -1) return null;
	    return subtable.sequences[substituteIndex];
	}

	/**
	 * Get default script features indexes
	 */
	FeatureQuery.prototype.getDefaultScriptFeaturesIndexes = function () {
	    const scripts = this.font.tables.gsub.scripts;
	    for (let s = 0; s < scripts.length; s++) {
	        const script = scripts[s];
	        if (script.tag === 'DFLT') return (
	            script.script.defaultLangSys.featureIndexes
	        );
	    }
	    return [];
	};

	/**
	 * Get feature indexes of a specific script
	 * @param {string} scriptTag script tag
	 */
	FeatureQuery.prototype.getScriptFeaturesIndexes = function(scriptTag) {
	    const tables = this.font.tables;
	    if (!tables.gsub) return [];
	    if (!scriptTag) return this.getDefaultScriptFeaturesIndexes();
	    const scripts = this.font.tables.gsub.scripts;
	    for (let i = 0; i < scripts.length; i++) {
	        const script = scripts[i];
	        if (script.tag === scriptTag && script.script.defaultLangSys) {
	            return script.script.defaultLangSys.featureIndexes;
	        } else {
	            let langSysRecords = script.langSysRecords;
	            if (!!langSysRecords) {
	                for (let j = 0; j < langSysRecords.length; j++) {
	                    const langSysRecord = langSysRecords[j];
	                    if (langSysRecord.tag === scriptTag) {
	                        let langSys = langSysRecord.langSys;
	                        return langSys.featureIndexes;
	                    }
	                }
	            }
	        }
	    }
	    return this.getDefaultScriptFeaturesIndexes();
	};

	/**
	 * Map a feature tag to a gsub feature
	 * @param {any} features gsub features
	 * @param {string} scriptTag script tag
	 */
	FeatureQuery.prototype.mapTagsToFeatures = function (features, scriptTag) {
	    let tags = {};
	    for (let i = 0; i < features.length; i++) {
	        const tag = features[i].tag;
	        const feature = features[i].feature;
	        tags[tag] = feature;
	    }
	    this.features[scriptTag].tags = tags;
	};

	/**
	 * Get features of a specific script
	 * @param {string} scriptTag script tag
	 */
	FeatureQuery.prototype.getScriptFeatures = function (scriptTag) {
	    let features = this.features[scriptTag];
	    if (this.features.hasOwnProperty(scriptTag)) return features;
	    const featuresIndexes = this.getScriptFeaturesIndexes(scriptTag);
	    if (!featuresIndexes) return null;
	    const gsub = this.font.tables.gsub;
	    features = featuresIndexes.map(index => gsub.features[index]);
	    this.features[scriptTag] = features;
	    this.mapTagsToFeatures(features, scriptTag);
	    return features;
	};

	/**
	 * Get substitution type
	 * @param {any} lookupTable lookup table
	 * @param {any} subtable subtable
	 */
	FeatureQuery.prototype.getSubstitutionType = function(lookupTable, subtable) {
	    const lookupType = lookupTable.lookupType.toString();
	    const substFormat = subtable.substFormat.toString();
	    return lookupType + substFormat;
	};

	/**
	 * Get lookup method
	 * @param {any} lookupTable lookup table
	 * @param {any} subtable subtable
	 */
	FeatureQuery.prototype.getLookupMethod = function(lookupTable, subtable) {
	    let substitutionType = this.getSubstitutionType(lookupTable, subtable);
	    switch (substitutionType) {
	        case '12':
	            return glyphIndex => singleSubstitutionFormat2.apply(
	                this, [glyphIndex, subtable]
	            );
	        case '63':
	            return contextParams => chainingSubstitutionFormat3.apply(
	                this, [contextParams, subtable]
	            );
	        case '41':
	            return contextParams => ligatureSubstitutionFormat1.apply(
	                this, [contextParams, subtable]
	            );
	        case '21':
	            return glyphIndex => decompositionSubstitutionFormat1.apply(
	                this, [glyphIndex, subtable]
	            );
	        default:
	            throw new Error(
	                `lookupType: ${lookupTable.lookupType} - ` +
	                `substFormat: ${subtable.substFormat} ` +
	                `is not yet supported`
	            );
	    }
	};

	/**
	 * [ LOOKUP TYPES ]
	 * -------------------------------
	 * Single                        1;
	 * Multiple                      2;
	 * Alternate                     3;
	 * Ligature                      4;
	 * Context                       5;
	 * ChainingContext               6;
	 * ExtensionSubstitution         7;
	 * ReverseChainingContext        8;
	 * -------------------------------
	 *
	 */

	/**
	 * @typedef FQuery
	 * @type Object
	 * @param {string} tag feature tag
	 * @param {string} script feature script
	 * @param {ContextParams} contextParams context params
	 */

	/**
	 * Lookup a feature using a query parameters
	 * @param {FQuery} query feature query
	 */
	FeatureQuery.prototype.lookupFeature = function (query) {
	    let contextParams = query.contextParams;
	    let currentIndex = contextParams.index;
	    const feature = this.getFeature({
	        tag: query.tag, script: query.script
	    });
	    if (!feature) return new Error(
	        `font '${this.font.names.fullName.en}' ` +
	        `doesn't support feature '${query.tag}' ` +
	        `for script '${query.script}'.`
	    );
	    const lookups = this.getFeatureLookups(feature);
	    const substitutions = [].concat(contextParams.context);
	    for (let l = 0; l < lookups.length; l++) {
	        const lookupTable = lookups[l];
	        const subtables = this.getLookupSubtables(lookupTable);
	        for (let s = 0; s < subtables.length; s++) {
	            const subtable = subtables[s];
	            const substType = this.getSubstitutionType(lookupTable, subtable);
	            const lookup = this.getLookupMethod(lookupTable, subtable);
	            let substitution;
	            switch (substType) {
	                case '12':
	                    substitution = lookup(contextParams.current);
	                    if (substitution) {
	                        substitutions.splice(currentIndex, 1, new SubstitutionAction({
	                            id: 12, tag: query.tag, substitution
	                        }));
	                    }
	                    break;
	                case '63':
	                    substitution = lookup(contextParams);
	                    if (Array.isArray(substitution) && substitution.length) {
	                        substitutions.splice(currentIndex, 1, new SubstitutionAction({
	                            id: 63, tag: query.tag, substitution
	                        }));
	                    }
	                    break;
	                case '41':
	                    substitution = lookup(contextParams);
	                    if (substitution) {
	                        substitutions.splice(currentIndex, 1, new SubstitutionAction({
	                            id: 41, tag: query.tag, substitution
	                        }));
	                    }
	                    break;
	                case '21':
	                    substitution = lookup(contextParams.current);
	                    if (substitution) {
	                        substitutions.splice(currentIndex, 1, new SubstitutionAction({
	                            id: 21, tag: query.tag, substitution
	                        }));
	                    }
	                    break;
	            }
	            contextParams = new ContextParams(substitutions, currentIndex);
	            if (Array.isArray(substitution) && !substitution.length) continue;
	            substitution = null;
	        }
	    }
	    return substitutions.length ? substitutions : null;
	};

	/**
	 * Checks if a font supports a specific features
	 * @param {FQuery} query feature query object
	 */
	FeatureQuery.prototype.supports = function (query) {
	    if (!query.script) return false;
	    this.getScriptFeatures(query.script);
	    const supportedScript = this.features.hasOwnProperty(query.script);
	    if (!query.tag) return supportedScript;
	    const supportedFeature = (
	        this.features[query.script].some(feature => feature.tag === query.tag)
	    );
	    return supportedScript && supportedFeature;
	};

	/**
	 * Get lookup table subtables
	 * @param {any} lookupTable lookup table
	 */
	FeatureQuery.prototype.getLookupSubtables = function (lookupTable) {
	    return lookupTable.subtables || null;
	};

	/**
	 * Get lookup table by index
	 * @param {number} index lookup table index
	 */
	FeatureQuery.prototype.getLookupByIndex = function (index) {
	    const lookups = this.font.tables.gsub.lookups;
	    return lookups[index] || null;
	};

	/**
	 * Get lookup tables for a feature
	 * @param {string} feature
	 */
	FeatureQuery.prototype.getFeatureLookups = function (feature) {
	    // TODO: memoize
	    return feature.lookupListIndexes.map(this.getLookupByIndex.bind(this));
	};

	/**
	 * Query a feature by it's properties
	 * @param {any} query an object that describes the properties of a query
	 */
	FeatureQuery.prototype.getFeature = function getFeature(query) {
	    if (!this.font) return { FAIL: `No font was found`};
	    if (!this.features.hasOwnProperty(query.script)) {
	        this.getScriptFeatures(query.script);
	    }
	    const scriptFeatures = this.features[query.script];
	    if (!scriptFeatures) return (
	        { FAIL: `No feature for script ${query.script}`}
	    );
	    if (!scriptFeatures.tags[query.tag]) return null;
	    return this.features[query.script].tags[query.tag];
	};

	/**
	 * Arabic word context checkers
	 */

	function arabicWordStartCheck(contextParams) {
	    const char = contextParams.current;
	    const prevChar = contextParams.get(-1);
	    return (
	        // ? arabic first char
	        (prevChar === null && isArabicChar(char)) ||
	        // ? arabic char preceded with a non arabic char
	        (!isArabicChar(prevChar) && isArabicChar(char))
	    );
	}

	function arabicWordEndCheck(contextParams) {
	    const nextChar = contextParams.get(1);
	    return (
	        // ? last arabic char
	        (nextChar === null) ||
	        // ? next char is not arabic
	        (!isArabicChar(nextChar))
	    );
	}

	var arabicWordCheck = {
	    startCheck: arabicWordStartCheck,
	    endCheck: arabicWordEndCheck
	};

	/**
	 * Arabic sentence context checkers
	 */

	function arabicSentenceStartCheck(contextParams) {
	    const char = contextParams.current;
	    const prevChar = contextParams.get(-1);
	    return (
	        // ? an arabic char preceded with a non arabic char
	        (isArabicChar(char) || isTashkeelArabicChar(char)) &&
	        !isArabicChar(prevChar)
	    );
	}

	function arabicSentenceEndCheck(contextParams) {
	    const nextChar = contextParams.get(1);
	    switch (true) {
	        case nextChar === null:
	            return true;
	        case (!isArabicChar(nextChar) && !isTashkeelArabicChar(nextChar)):
	            const nextIsWhitespace = isWhiteSpace(nextChar);
	            if (!nextIsWhitespace) return true;
	            if (nextIsWhitespace) {
	                let arabicCharAhead = false;
	                arabicCharAhead = (
	                    contextParams.lookahead.some(
	                        c => isArabicChar(c) || isTashkeelArabicChar(c)
	                    )
	                );
	                if (!arabicCharAhead) return true;
	            }
	            break;
	        default:
	            return false;
	    }
	}

	var arabicSentenceCheck = {
	    startCheck: arabicSentenceStartCheck,
	    endCheck: arabicSentenceEndCheck
	};

	/**
	 * Apply single substitution format 2
	 * @param {Array} substitutions substitutions
	 * @param {any} tokens a list of tokens
	 * @param {number} index token index
	 */
	function singleSubstitutionFormat2$1(action, tokens, index) {
	    tokens[index].setState(action.tag, action.substitution);
	}

	/**
	 * Apply chaining context substitution format 3
	 * @param {Array} substitutions substitutions
	 * @param {any} tokens a list of tokens
	 * @param {number} index token index
	 */
	function chainingSubstitutionFormat3$1(action, tokens, index) {
	    action.substitution.forEach((subst, offset) => {
	        const token = tokens[index + offset];
	        token.setState(action.tag, subst);
	    });
	}

	/**
	 * Apply ligature substitution format 1
	 * @param {Array} substitutions substitutions
	 * @param {any} tokens a list of tokens
	 * @param {number} index token index
	 */
	function ligatureSubstitutionFormat1$1(action, tokens, index) {
	    let token = tokens[index];
	    token.setState(action.tag, action.substitution.ligGlyph);
	    const compsCount = action.substitution.components.length;
	    for (let i = 0; i < compsCount; i++) {
	        token = tokens[index + i + 1];
	        token.setState('deleted', true);
	    }
	}

	/**
	 * Supported substitutions
	 */
	const SUBSTITUTIONS = {
	    12: singleSubstitutionFormat2$1,
	    63: chainingSubstitutionFormat3$1,
	    41: ligatureSubstitutionFormat1$1
	};

	/**
	 * Apply substitutions to a list of tokens
	 * @param {Array} substitutions substitutions
	 * @param {any} tokens a list of tokens
	 * @param {number} index token index
	 */
	function applySubstitution(action, tokens, index) {
	    if (action instanceof SubstitutionAction) {
	        SUBSTITUTIONS[action.id](action, tokens, index);
	    }
	}

	/**
	 * Apply Arabic presentation forms to a range of tokens
	 */

	/**
	 * Check if a char can be connected to it's preceding char
	 * @param {ContextParams} charContextParams context params of a char
	 */
	function willConnectPrev(charContextParams) {
	    let backtrack = [].concat(charContextParams.backtrack);
	    for (let i = backtrack.length - 1; i >= 0; i--) {
	        const prevChar = backtrack[i];
	        const isolated = isIsolatedArabicChar(prevChar);
	        const tashkeel = isTashkeelArabicChar(prevChar);
	        if (!isolated && !tashkeel) return true;
	        if (isolated) return false;
	    }
	    return false;
	}

	/**
	 * Check if a char can be connected to it's proceeding char
	 * @param {ContextParams} charContextParams context params of a char
	 */
	function willConnectNext(charContextParams) {
	    if (isIsolatedArabicChar(charContextParams.current)) return false;
	    for (let i = 0; i < charContextParams.lookahead.length; i++) {
	        const nextChar = charContextParams.lookahead[i];
	        const tashkeel = isTashkeelArabicChar(nextChar);
	        if (!tashkeel) return true;
	    }
	    return false;
	}

	/**
	 * Apply arabic presentation forms to a list of tokens
	 * @param {ContextRange} range a range of tokens
	 */
	function arabicPresentationForms(range) {
	    const script = 'arab';
	    const tags = this.featuresTags[script];
	    const tokens = this.tokenizer.getRangeTokens(range);
	    if (tokens.length === 1) return;
	    let contextParams = new ContextParams(
	        tokens.map(token => token.getState('glyphIndex')
	    ), 0);
	    const charContextParams = new ContextParams(
	        tokens.map(token => token.char
	    ), 0);
	    tokens.forEach((token, index) => {
	        if (isTashkeelArabicChar(token.char)) return;
	        contextParams.setCurrentIndex(index);
	        charContextParams.setCurrentIndex(index);
	        let CONNECT = 0; // 2 bits 00 (10: can connect next) (01: can connect prev)
	        if (willConnectPrev(charContextParams)) CONNECT |= 1;
	        if (willConnectNext(charContextParams)) CONNECT |= 2;
	        let tag;
	        switch (CONNECT) {
	            case 1: (tag = 'fina'); break;
	            case 2: (tag = 'init'); break;
	            case 3: (tag = 'medi'); break;
	        }
	        if (tags.indexOf(tag) === -1) return;
	        let substitutions = this.query.lookupFeature({
	            tag, script, contextParams
	        });
	        if (substitutions instanceof Error) return console.info(substitutions.message);
	        substitutions.forEach((action, index) => {
	            if (action instanceof SubstitutionAction) {
	                applySubstitution(action, tokens, index);
	                contextParams.context[index] = action.substitution;
	            }
	        });
	    });
	}

	/**
	 * Apply Arabic required ligatures feature to a range of tokens
	 */

	/**
	 * Update context params
	 * @param {any} tokens a list of tokens
	 * @param {number} index current item index
	 */
	function getContextParams(tokens, index) {
	    const context = tokens.map(token => token.activeState.value);
	    return new ContextParams(context, index || 0);
	}

	/**
	 * Apply Arabic required ligatures to a context range
	 * @param {ContextRange} range a range of tokens
	 */
	function arabicRequiredLigatures(range) {
	    const script = 'arab';
	    let tokens = this.tokenizer.getRangeTokens(range);
	    let contextParams = getContextParams(tokens);
	    contextParams.context.forEach((glyphIndex, index) => {
	        contextParams.setCurrentIndex(index);
	        let substitutions = this.query.lookupFeature({
	            tag: 'rlig', script, contextParams
	        });
	        if (substitutions.length) {
	            substitutions.forEach(
	                action => applySubstitution(action, tokens, index)
	            );
	            contextParams = getContextParams(tokens);
	        }
	    });
	}

	/**
	 * Latin word context checkers
	 */

	function latinWordStartCheck(contextParams) {
	    const char = contextParams.current;
	    const prevChar = contextParams.get(-1);
	    return (
	        // ? latin first char
	        (prevChar === null && isLatinChar(char)) ||
	        // ? latin char preceded with a non latin char
	        (!isLatinChar(prevChar) && isLatinChar(char))
	    );
	}

	function latinWordEndCheck(contextParams) {
	    const nextChar = contextParams.get(1);
	    return (
	        // ? last latin char
	        (nextChar === null) ||
	        // ? next char is not latin
	        (!isLatinChar(nextChar))
	    );
	}

	var latinWordCheck = {
	    startCheck: latinWordStartCheck,
	    endCheck: latinWordEndCheck
	};

	/**
	 * Apply Latin ligature feature to a range of tokens
	 */

	/**
	 * Update context params
	 * @param {any} tokens a list of tokens
	 * @param {number} index current item index
	 */
	function getContextParams$1(tokens, index) {
	    const context = tokens.map(token => token.activeState.value);
	    return new ContextParams(context, index || 0);
	}

	/**
	 * Apply Arabic required ligatures to a context range
	 * @param {ContextRange} range a range of tokens
	 */
	function latinLigature(range) {
	    const script = 'latn';
	    let tokens = this.tokenizer.getRangeTokens(range);
	    let contextParams = getContextParams$1(tokens);
	    contextParams.context.forEach((glyphIndex, index) => {
	        contextParams.setCurrentIndex(index);
	        let substitutions = this.query.lookupFeature({
	            tag: 'liga', script, contextParams
	        });
	        if (substitutions.length) {
	            substitutions.forEach(
	                action => applySubstitution(action, tokens, index)
	            );
	            contextParams = getContextParams$1(tokens);
	        }
	    });
	}

	/**
	 * Infer bidirectional properties for a given text and apply
	 * the corresponding layout rules.
	 */

	/**
	 * Create Bidi. features
	 * @param {string} baseDir text base direction. value either 'ltr' or 'rtl'
	 */
	function Bidi(baseDir) {
	    this.baseDir = baseDir || 'ltr';
	    this.tokenizer = new Tokenizer();
	    this.featuresTags = {};
	}

	/**
	 * Sets Bidi text
	 * @param {string} text a text input
	 */
	Bidi.prototype.setText = function (text) {
	    this.text = text;
	};

	/**
	 * Store essential context checks:
	 * arabic word check for applying gsub features
	 * arabic sentence check for adjusting arabic layout
	 */
	Bidi.prototype.contextChecks = ({
	    latinWordCheck,
	    arabicWordCheck,
	    arabicSentenceCheck
	});

	/**
	 * Register arabic word check
	 */
	function registerContextChecker(checkId) {
	    const check = this.contextChecks[`${checkId}Check`];
	    return this.tokenizer.registerContextChecker(
	        checkId, check.startCheck, check.endCheck
	    );
	}

	/**
	 * Perform pre tokenization procedure then
	 * tokenize text input
	 */
	function tokenizeText() {
	    registerContextChecker.call(this, 'latinWord');
	    registerContextChecker.call(this, 'arabicWord');
	    registerContextChecker.call(this, 'arabicSentence');
	    return this.tokenizer.tokenize(this.text);
	}

	/**
	 * Reverse arabic sentence layout
	 * TODO: check base dir before applying adjustments - priority low
	 */
	function reverseArabicSentences() {
	    const ranges = this.tokenizer.getContextRanges('arabicSentence');
	    ranges.forEach(range => {
	        let rangeTokens = this.tokenizer.getRangeTokens(range);
	        this.tokenizer.replaceRange(
	            range.startIndex,
	            range.endOffset,
	            rangeTokens.reverse()
	        );
	    });
	}

	/**
	 * Register supported features tags
	 * @param {script} script script tag
	 * @param {Array} tags features tags list
	 */
	Bidi.prototype.registerFeatures = function (script, tags) {
	    const supportedTags = tags.filter(
	        tag => this.query.supports({script, tag})
	    );
	    if (!this.featuresTags.hasOwnProperty(script)) {
	        this.featuresTags[script] = supportedTags;
	    } else {
	        this.featuresTags[script] =
	        this.featuresTags[script].concat(supportedTags);
	    }
	};

	/**
	 * Apply GSUB features
	 * @param {Array} tagsList a list of features tags
	 * @param {string} script a script tag
	 * @param {Font} font opentype font instance
	 */
	Bidi.prototype.applyFeatures = function (font, features) {
	    if (!font) throw new Error(
	        'No valid font was provided to apply features'
	    );
	    if (!this.query) this.query = new FeatureQuery(font);
	    for (let f = 0; f < features.length; f++) {
	        const feature = features[f];
	        if (!this.query.supports({script: feature.script})) continue;
	        this.registerFeatures(feature.script, feature.tags);
	    }
	};

	/**
	 * Register a state modifier
	 * @param {string} modifierId state modifier id
	 * @param {function} condition a predicate function that returns true or false
	 * @param {function} modifier a modifier function to set token state
	 */
	Bidi.prototype.registerModifier = function (modifierId, condition, modifier) {
	    this.tokenizer.registerModifier(modifierId, condition, modifier);
	};

	/**
	 * Check if 'glyphIndex' is registered
	 */
	function checkGlyphIndexStatus() {
	    if (this.tokenizer.registeredModifiers.indexOf('glyphIndex') === -1) {
	        throw new Error(
	            'glyphIndex modifier is required to apply ' +
	            'arabic presentation features.'
	        );
	    }
	}

	/**
	 * Apply arabic presentation forms features
	 */
	function applyArabicPresentationForms() {
	    const script = 'arab';
	    if (!this.featuresTags.hasOwnProperty(script)) return;
	    checkGlyphIndexStatus.call(this);
	    const ranges = this.tokenizer.getContextRanges('arabicWord');
	    ranges.forEach(range => {
	        arabicPresentationForms.call(this, range);
	    });
	}

	/**
	 * Apply required arabic ligatures
	 */
	function applyArabicRequireLigatures() {
	    const script = 'arab';
	    if (!this.featuresTags.hasOwnProperty(script)) return;
	    const tags = this.featuresTags[script];
	    if (tags.indexOf('rlig') === -1) return;
	    checkGlyphIndexStatus.call(this);
	    const ranges = this.tokenizer.getContextRanges('arabicWord');
	    ranges.forEach(range => {
	        arabicRequiredLigatures.call(this, range);
	    });
	}

	/**
	 * Apply required arabic ligatures
	 */
	function applyLatinLigatures() {
	    const script = 'latn';
	    if (!this.featuresTags.hasOwnProperty(script)) return;
	    const tags = this.featuresTags[script];
	    if (tags.indexOf('liga') === -1) return;
	    checkGlyphIndexStatus.call(this);
	    const ranges = this.tokenizer.getContextRanges('latinWord');
	    ranges.forEach(range => {
	        latinLigature.call(this, range);
	    });
	}

	/**
	 * Check if a context is registered
	 * @param {string} contextId context id
	 */
	Bidi.prototype.checkContextReady = function (contextId) {
	    return !!this.tokenizer.getContext(contextId);
	};

	/**
	 * Apply features to registered contexts
	 */
	Bidi.prototype.applyFeaturesToContexts = function () {
	    if (this.checkContextReady('arabicWord')) {
	        applyArabicPresentationForms.call(this);
	        applyArabicRequireLigatures.call(this);
	    }
	    if (this.checkContextReady('latinWord')) {
	        applyLatinLigatures.call(this);
	    }
	    if (this.checkContextReady('arabicSentence')) {
	        reverseArabicSentences.call(this);
	    }
	};

	/**
	 * process text input
	 * @param {string} text an input text
	 */
	Bidi.prototype.processText = function(text) {
	    if (!this.text || this.text !== text) {
	        this.setText(text);
	        tokenizeText.call(this);
	        this.applyFeaturesToContexts();
	    }
	};

	/**
	 * Process a string of text to identify and adjust
	 * bidirectional text entities.
	 * @param {string} text input text
	 */
	Bidi.prototype.getBidiText = function (text) {
	    this.processText(text);
	    return this.tokenizer.getText();
	};

	/**
	 * Get the current state index of each token
	 * @param {text} text an input text
	 */
	Bidi.prototype.getTextGlyphs = function (text) {
	    this.processText(text);
	    let indexes = [];
	    for (let i = 0; i < this.tokenizer.tokens.length; i++) {
	        const token = this.tokenizer.tokens[i];
	        if (token.state.deleted) continue;
	        const index = token.activeState.value;
	        indexes.push(Array.isArray(index) ? index[0] : index);
	    }
	    return indexes;
	};

	// The Font object

	/**
	 * @typedef FontOptions
	 * @type Object
	 * @property {Boolean} empty - whether to create a new empty font
	 * @property {string} familyName
	 * @property {string} styleName
	 * @property {string=} fullName
	 * @property {string=} postScriptName
	 * @property {string=} designer
	 * @property {string=} designerURL
	 * @property {string=} manufacturer
	 * @property {string=} manufacturerURL
	 * @property {string=} license
	 * @property {string=} licenseURL
	 * @property {string=} version
	 * @property {string=} description
	 * @property {string=} copyright
	 * @property {string=} trademark
	 * @property {Number} unitsPerEm
	 * @property {Number} ascender
	 * @property {Number} descender
	 * @property {Number} createdTimestamp
	 * @property {string=} weightClass
	 * @property {string=} widthClass
	 * @property {string=} fsSelection
	 */

	/**
	 * A Font represents a loaded OpenType font file.
	 * It contains a set of glyphs and methods to draw text on a drawing context,
	 * or to get a path representing the text.
	 * @exports opentype.Font
	 * @class
	 * @param {FontOptions}
	 * @constructor
	 */
	function Font(options) {
	    options = options || {};

	    if (!options.empty) {
	        // Check that we've provided the minimum set of names.
	        checkArgument(options.familyName, 'When creating a new Font object, familyName is required.');
	        checkArgument(options.styleName, 'When creating a new Font object, styleName is required.');
	        checkArgument(options.unitsPerEm, 'When creating a new Font object, unitsPerEm is required.');
	        checkArgument(options.ascender, 'When creating a new Font object, ascender is required.');
	        checkArgument(options.descender, 'When creating a new Font object, descender is required.');
	        checkArgument(options.descender < 0, 'Descender should be negative (e.g. -512).');

	        // OS X will complain if the names are empty, so we put a single space everywhere by default.
	        this.names = {
	            fontFamily: {en: options.familyName || ' '},
	            fontSubfamily: {en: options.styleName || ' '},
	            fullName: {en: options.fullName || options.familyName + ' ' + options.styleName},
	            // postScriptName may not contain any whitespace
	            postScriptName: {en: options.postScriptName || (options.familyName + options.styleName).replace(/\s/g, '')},
	            designer: {en: options.designer || ' '},
	            designerURL: {en: options.designerURL || ' '},
	            manufacturer: {en: options.manufacturer || ' '},
	            manufacturerURL: {en: options.manufacturerURL || ' '},
	            license: {en: options.license || ' '},
	            licenseURL: {en: options.licenseURL || ' '},
	            version: {en: options.version || 'Version 0.1'},
	            description: {en: options.description || ' '},
	            copyright: {en: options.copyright || ' '},
	            trademark: {en: options.trademark || ' '}
	        };
	        this.unitsPerEm = options.unitsPerEm || 1000;
	        this.ascender = options.ascender;
	        this.descender = options.descender;
	        this.createdTimestamp = options.createdTimestamp;
	        this.tables = { os2: {
	            usWeightClass: options.weightClass || this.usWeightClasses.MEDIUM,
	            usWidthClass: options.widthClass || this.usWidthClasses.MEDIUM,
	            fsSelection: options.fsSelection || this.fsSelectionValues.REGULAR
	        } };
	    }

	    this.supported = true; // Deprecated: parseBuffer will throw an error if font is not supported.
	    this.glyphs = new glyphset.GlyphSet(this, options.glyphs || []);
	    this.encoding = new DefaultEncoding(this);
	    this.position = new Position(this);
	    this.substitution = new Substitution(this);
	    this.tables = this.tables || {};

	    // needed for low memory mode only.
	    this._push = null;
	    this._hmtxTableData = {};

	    Object.defineProperty(this, 'hinting', {
	        get: function() {
	            if (this._hinting) return this._hinting;
	            if (this.outlinesFormat === 'truetype') {
	                return (this._hinting = new HintingTrueType(this));
	            }
	        }
	    });
	}

	/**
	 * Check if the font has a glyph for the given character.
	 * @param  {string}
	 * @return {Boolean}
	 */
	Font.prototype.hasChar = function(c) {
	    return this.encoding.charToGlyphIndex(c) !== null;
	};

	/**
	 * Convert the given character to a single glyph index.
	 * Note that this function assumes that there is a one-to-one mapping between
	 * the given character and a glyph; for complex scripts this might not be the case.
	 * @param  {string}
	 * @return {Number}
	 */
	Font.prototype.charToGlyphIndex = function(s) {
	    return this.encoding.charToGlyphIndex(s);
	};

	/**
	 * Convert the given character to a single Glyph object.
	 * Note that this function assumes that there is a one-to-one mapping between
	 * the given character and a glyph; for complex scripts this might not be the case.
	 * @param  {string}
	 * @return {opentype.Glyph}
	 */
	Font.prototype.charToGlyph = function(c) {
	    const glyphIndex = this.charToGlyphIndex(c);
	    let glyph = this.glyphs.get(glyphIndex);
	    if (!glyph) {
	        // .notdef
	        glyph = this.glyphs.get(0);
	    }

	    return glyph;
	};

	/**
	 * Update features
	 * @param {any} options features options
	 */
	Font.prototype.updateFeatures = function (options) {
	    // TODO: update all features options not only 'latn'.
	    return this.defaultRenderOptions.features.map(feature => {
	        if (feature.script === 'latn') {
	            return {
	                script: 'latn',
	                tags: feature.tags.filter(tag => options[tag])
	            };
	        } else {
	            return feature;
	        }
	    });
	};

	/**
	 * Convert the given text to a list of Glyph objects.
	 * Note that there is no strict one-to-one mapping between characters and
	 * glyphs, so the list of returned glyphs can be larger or smaller than the
	 * length of the given string.
	 * @param  {string}
	 * @param  {GlyphRenderOptions} [options]
	 * @return {opentype.Glyph[]}
	 */
	Font.prototype.stringToGlyphs = function(s, options) {

	    const bidi = new Bidi();

	    // Create and register 'glyphIndex' state modifier
	    const charToGlyphIndexMod = token => this.charToGlyphIndex(token.char);
	    bidi.registerModifier('glyphIndex', null, charToGlyphIndexMod);

	    // roll-back to default features
	    let features = options ?
	    this.updateFeatures(options.features) :
	    this.defaultRenderOptions.features;

	    bidi.applyFeatures(this, features);

	    const indexes = bidi.getTextGlyphs(s);

	    let length = indexes.length;

	    // convert glyph indexes to glyph objects
	    const glyphs = new Array(length);
	    const notdef = this.glyphs.get(0);
	    for (let i = 0; i < length; i += 1) {
	        glyphs[i] = this.glyphs.get(indexes[i]) || notdef;
	    }
	    return glyphs;
	};

	/**
	 * @param  {string}
	 * @return {Number}
	 */
	Font.prototype.nameToGlyphIndex = function(name) {
	    return this.glyphNames.nameToGlyphIndex(name);
	};

	/**
	 * @param  {string}
	 * @return {opentype.Glyph}
	 */
	Font.prototype.nameToGlyph = function(name) {
	    const glyphIndex = this.nameToGlyphIndex(name);
	    let glyph = this.glyphs.get(glyphIndex);
	    if (!glyph) {
	        // .notdef
	        glyph = this.glyphs.get(0);
	    }

	    return glyph;
	};

	/**
	 * @param  {Number}
	 * @return {String}
	 */
	Font.prototype.glyphIndexToName = function(gid) {
	    if (!this.glyphNames.glyphIndexToName) {
	        return '';
	    }

	    return this.glyphNames.glyphIndexToName(gid);
	};

	/**
	 * Retrieve the value of the kerning pair between the left glyph (or its index)
	 * and the right glyph (or its index). If no kerning pair is found, return 0.
	 * The kerning value gets added to the advance width when calculating the spacing
	 * between glyphs.
	 * For GPOS kerning, this method uses the default script and language, which covers
	 * most use cases. To have greater control, use font.position.getKerningValue .
	 * @param  {opentype.Glyph} leftGlyph
	 * @param  {opentype.Glyph} rightGlyph
	 * @return {Number}
	 */
	Font.prototype.getKerningValue = function(leftGlyph, rightGlyph) {
	    leftGlyph = leftGlyph.index || leftGlyph;
	    rightGlyph = rightGlyph.index || rightGlyph;
	    const gposKerning = this.position.defaultKerningTables;
	    if (gposKerning) {
	        return this.position.getKerningValue(gposKerning, leftGlyph, rightGlyph);
	    }
	    // "kern" table
	    return this.kerningPairs[leftGlyph + ',' + rightGlyph] || 0;
	};

	/**
	 * @typedef GlyphRenderOptions
	 * @type Object
	 * @property {string} [script] - script used to determine which features to apply. By default, 'DFLT' or 'latn' is used.
	 *                               See https://www.microsoft.com/typography/otspec/scripttags.htm
	 * @property {string} [language='dflt'] - language system used to determine which features to apply.
	 *                                        See https://www.microsoft.com/typography/developers/opentype/languagetags.aspx
	 * @property {boolean} [kerning=true] - whether to include kerning values
	 * @property {object} [features] - OpenType Layout feature tags. Used to enable or disable the features of the given script/language system.
	 *                                 See https://www.microsoft.com/typography/otspec/featuretags.htm
	 */
	Font.prototype.defaultRenderOptions = {
	    kerning: true,
	    features: [
	        /**
	         * these 4 features are required to render Arabic text properly
	         * and shouldn't be turned off when rendering arabic text.
	         */
	        { script: 'arab', tags: ['init', 'medi', 'fina', 'rlig'] },
	        { script: 'latn', tags: ['liga', 'rlig'] }
	    ]
	};

	/**
	 * Helper function that invokes the given callback for each glyph in the given text.
	 * The callback gets `(glyph, x, y, fontSize, options)`.* @param  {string} text
	 * @param {string} text - The text to apply.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {GlyphRenderOptions=} options
	 * @param  {Function} callback
	 */
	Font.prototype.forEachGlyph = function(text, x, y, fontSize, options, callback) {
	    x = x !== undefined ? x : 0;
	    y = y !== undefined ? y : 0;
	    fontSize = fontSize !== undefined ? fontSize : 72;
	    options = options || this.defaultRenderOptions;
	    const fontScale = 1 / this.unitsPerEm * fontSize;
	    const glyphs = this.stringToGlyphs(text, options);
	    let kerningLookups;
	    if (options.kerning) {
	        const script = options.script || this.position.getDefaultScriptName();
	        kerningLookups = this.position.getKerningTables(script, options.language);
	    }
	    for (let i = 0; i < glyphs.length; i += 1) {
	        const glyph = glyphs[i];
	        callback.call(this, glyph, x, y, fontSize, options);
	        if (glyph.advanceWidth) {
	            x += glyph.advanceWidth * fontScale;
	        }

	        if (options.kerning && i < glyphs.length - 1) {
	            // We should apply position adjustment lookups in a more generic way.
	            // Here we only use the xAdvance value.
	            const kerningValue = kerningLookups ?
	                  this.position.getKerningValue(kerningLookups, glyph.index, glyphs[i + 1].index) :
	                  this.getKerningValue(glyph, glyphs[i + 1]);
	            x += kerningValue * fontScale;
	        }

	        if (options.letterSpacing) {
	            x += options.letterSpacing * fontSize;
	        } else if (options.tracking) {
	            x += (options.tracking / 1000) * fontSize;
	        }
	    }
	    return x;
	};

	/**
	 * Create a Path object that represents the given text.
	 * @param  {string} text - The text to create.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {GlyphRenderOptions=} options
	 * @return {opentype.Path}
	 */
	Font.prototype.getPath = function(text, x, y, fontSize, options) {
	    const fullPath = new Path();
	    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
	        const glyphPath = glyph.getPath(gX, gY, gFontSize, options, this);
	        fullPath.extend(glyphPath);
	    });
	    return fullPath;
	};

	/**
	 * Create an array of Path objects that represent the glyphs of a given text.
	 * @param  {string} text - The text to create.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {GlyphRenderOptions=} options
	 * @return {opentype.Path[]}
	 */
	Font.prototype.getPaths = function(text, x, y, fontSize, options) {
	    const glyphPaths = [];
	    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
	        const glyphPath = glyph.getPath(gX, gY, gFontSize, options, this);
	        glyphPaths.push(glyphPath);
	    });

	    return glyphPaths;
	};

	/**
	 * Returns the advance width of a text.
	 *
	 * This is something different than Path.getBoundingBox() as for example a
	 * suffixed whitespace increases the advanceWidth but not the bounding box
	 * or an overhanging letter like a calligraphic 'f' might have a quite larger
	 * bounding box than its advance width.
	 *
	 * This corresponds to canvas2dContext.measureText(text).width
	 *
	 * @param  {string} text - The text to create.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {GlyphRenderOptions=} options
	 * @return advance width
	 */
	Font.prototype.getAdvanceWidth = function(text, fontSize, options) {
	    return this.forEachGlyph(text, 0, 0, fontSize, options, function() {});
	};

	/**
	 * Draw the text on the given drawing context.
	 * @param  {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
	 * @param  {string} text - The text to create.
	 * @param  {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param  {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param  {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param  {GlyphRenderOptions=} options
	 */
	Font.prototype.draw = function(ctx, text, x, y, fontSize, options) {
	    this.getPath(text, x, y, fontSize, options).draw(ctx);
	};

	/**
	 * Draw the points of all glyphs in the text.
	 * On-curve points will be drawn in blue, off-curve points will be drawn in red.
	 * @param {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
	 * @param {string} text - The text to create.
	 * @param {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param {GlyphRenderOptions=} options
	 */
	Font.prototype.drawPoints = function(ctx, text, x, y, fontSize, options) {
	    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
	        glyph.drawPoints(ctx, gX, gY, gFontSize);
	    });
	};

	/**
	 * Draw lines indicating important font measurements for all glyphs in the text.
	 * Black lines indicate the origin of the coordinate system (point 0,0).
	 * Blue lines indicate the glyph bounding box.
	 * Green line indicates the advance width of the glyph.
	 * @param {CanvasRenderingContext2D} ctx - A 2D drawing context, like Canvas.
	 * @param {string} text - The text to create.
	 * @param {number} [x=0] - Horizontal position of the beginning of the text.
	 * @param {number} [y=0] - Vertical position of the *baseline* of the text.
	 * @param {number} [fontSize=72] - Font size in pixels. We scale the glyph units by `1 / unitsPerEm * fontSize`.
	 * @param {GlyphRenderOptions=} options
	 */
	Font.prototype.drawMetrics = function(ctx, text, x, y, fontSize, options) {
	    this.forEachGlyph(text, x, y, fontSize, options, function(glyph, gX, gY, gFontSize) {
	        glyph.drawMetrics(ctx, gX, gY, gFontSize);
	    });
	};

	/**
	 * @param  {string}
	 * @return {string}
	 */
	Font.prototype.getEnglishName = function(name) {
	    const translations = this.names[name];
	    if (translations) {
	        return translations.en;
	    }
	};

	/**
	 * Validate
	 */
	Font.prototype.validate = function() {
	    const _this = this;

	    function assert(predicate, message) {
	    }

	    function assertNamePresent(name) {
	        const englishName = _this.getEnglishName(name);
	        assert(englishName && englishName.trim().length > 0,
	               'No English ' + name + ' specified.');
	    }

	    // Identification information
	    assertNamePresent('fontFamily');
	    assertNamePresent('weightName');
	    assertNamePresent('manufacturer');
	    assertNamePresent('copyright');
	    assertNamePresent('version');

	    // Dimension information
	    assert(this.unitsPerEm > 0, 'No unitsPerEm specified.');
	};

	/**
	 * Convert the font object to a SFNT data structure.
	 * This structure contains all the necessary tables and metadata to create a binary OTF file.
	 * @return {opentype.Table}
	 */
	Font.prototype.toTables = function() {
	    return sfnt.fontToTable(this);
	};
	/**
	 * @deprecated Font.toBuffer is deprecated. Use Font.toArrayBuffer instead.
	 */
	Font.prototype.toBuffer = function() {
	    console.warn('Font.toBuffer is deprecated. Use Font.toArrayBuffer instead.');
	    return this.toArrayBuffer();
	};
	/**
	 * Converts a `opentype.Font` into an `ArrayBuffer`
	 * @return {ArrayBuffer}
	 */
	Font.prototype.toArrayBuffer = function() {
	    const sfntTable = this.toTables();
	    const bytes = sfntTable.encode();
	    const buffer = new ArrayBuffer(bytes.length);
	    const intArray = new Uint8Array(buffer);
	    for (let i = 0; i < bytes.length; i++) {
	        intArray[i] = bytes[i];
	    }

	    return buffer;
	};

	/**
	 * Initiate a download of the OpenType font.
	 */
	Font.prototype.download = function(fileName) {
	    const familyName = this.getEnglishName('fontFamily');
	    const styleName = this.getEnglishName('fontSubfamily');
	    fileName = fileName || familyName.replace(/\s/g, '') + '-' + styleName + '.otf';
	    const arrayBuffer = this.toArrayBuffer();

	    if (isBrowser()) {
	        window.URL = window.URL || window.webkitURL;

	        if (window.URL) {
	            const dataView = new DataView(arrayBuffer);
	            const blob = new Blob([dataView], {type: 'font/opentype'});

	            let link = document.createElement('a');
	            link.href = window.URL.createObjectURL(blob);
	            link.download = fileName;

	            let event = document.createEvent('MouseEvents');
	            event.initEvent('click', true, false);
	            link.dispatchEvent(event);
	        } else {
	            console.warn('Font file could not be downloaded. Try using a different browser.');
	        }
	    } else {
	        const fs = {};
	        const buffer = arrayBufferToNodeBuffer(arrayBuffer);
	        fs.writeFileSync(fileName, buffer);
	    }
	};
	/**
	 * @private
	 */
	Font.prototype.fsSelectionValues = {
	    ITALIC:              0x001, //1
	    UNDERSCORE:          0x002, //2
	    NEGATIVE:            0x004, //4
	    OUTLINED:            0x008, //8
	    STRIKEOUT:           0x010, //16
	    BOLD:                0x020, //32
	    REGULAR:             0x040, //64
	    USER_TYPO_METRICS:   0x080, //128
	    WWS:                 0x100, //256
	    OBLIQUE:             0x200  //512
	};

	/**
	 * @private
	 */
	Font.prototype.usWidthClasses = {
	    ULTRA_CONDENSED: 1,
	    EXTRA_CONDENSED: 2,
	    CONDENSED: 3,
	    SEMI_CONDENSED: 4,
	    MEDIUM: 5,
	    SEMI_EXPANDED: 6,
	    EXPANDED: 7,
	    EXTRA_EXPANDED: 8,
	    ULTRA_EXPANDED: 9
	};

	/**
	 * @private
	 */
	Font.prototype.usWeightClasses = {
	    THIN: 100,
	    EXTRA_LIGHT: 200,
	    LIGHT: 300,
	    NORMAL: 400,
	    MEDIUM: 500,
	    SEMI_BOLD: 600,
	    BOLD: 700,
	    EXTRA_BOLD: 800,
	    BLACK:    900
	};

	// The `fvar` table stores font variation axes and instances.

	function addName(name, names) {
	    const nameString = JSON.stringify(name);
	    let nameID = 256;
	    for (let nameKey in names) {
	        let n = parseInt(nameKey);
	        if (!n || n < 256) {
	            continue;
	        }

	        if (JSON.stringify(names[nameKey]) === nameString) {
	            return n;
	        }

	        if (nameID <= n) {
	            nameID = n + 1;
	        }
	    }

	    names[nameID] = name;
	    return nameID;
	}

	function makeFvarAxis(n, axis, names) {
	    const nameID = addName(axis.name, names);
	    return [
	        {name: 'tag_' + n, type: 'TAG', value: axis.tag},
	        {name: 'minValue_' + n, type: 'FIXED', value: axis.minValue << 16},
	        {name: 'defaultValue_' + n, type: 'FIXED', value: axis.defaultValue << 16},
	        {name: 'maxValue_' + n, type: 'FIXED', value: axis.maxValue << 16},
	        {name: 'flags_' + n, type: 'USHORT', value: 0},
	        {name: 'nameID_' + n, type: 'USHORT', value: nameID}
	    ];
	}

	function parseFvarAxis(data, start, names) {
	    const axis = {};
	    const p = new parse.Parser(data, start);
	    axis.tag = p.parseTag();
	    axis.minValue = p.parseFixed();
	    axis.defaultValue = p.parseFixed();
	    axis.maxValue = p.parseFixed();
	    p.skip('uShort', 1);  // reserved for flags; no values defined
	    axis.name = names[p.parseUShort()] || {};
	    return axis;
	}

	function makeFvarInstance(n, inst, axes, names) {
	    const nameID = addName(inst.name, names);
	    const fields = [
	        {name: 'nameID_' + n, type: 'USHORT', value: nameID},
	        {name: 'flags_' + n, type: 'USHORT', value: 0}
	    ];

	    for (let i = 0; i < axes.length; ++i) {
	        const axisTag = axes[i].tag;
	        fields.push({
	            name: 'axis_' + n + ' ' + axisTag,
	            type: 'FIXED',
	            value: inst.coordinates[axisTag] << 16
	        });
	    }

	    return fields;
	}

	function parseFvarInstance(data, start, axes, names) {
	    const inst = {};
	    const p = new parse.Parser(data, start);
	    inst.name = names[p.parseUShort()] || {};
	    p.skip('uShort', 1);  // reserved for flags; no values defined

	    inst.coordinates = {};
	    for (let i = 0; i < axes.length; ++i) {
	        inst.coordinates[axes[i].tag] = p.parseFixed();
	    }

	    return inst;
	}

	function makeFvarTable(fvar, names) {
	    const result = new table.Table('fvar', [
	        {name: 'version', type: 'ULONG', value: 0x10000},
	        {name: 'offsetToData', type: 'USHORT', value: 0},
	        {name: 'countSizePairs', type: 'USHORT', value: 2},
	        {name: 'axisCount', type: 'USHORT', value: fvar.axes.length},
	        {name: 'axisSize', type: 'USHORT', value: 20},
	        {name: 'instanceCount', type: 'USHORT', value: fvar.instances.length},
	        {name: 'instanceSize', type: 'USHORT', value: 4 + fvar.axes.length * 4}
	    ]);
	    result.offsetToData = result.sizeOf();

	    for (let i = 0; i < fvar.axes.length; i++) {
	        result.fields = result.fields.concat(makeFvarAxis(i, fvar.axes[i], names));
	    }

	    for (let j = 0; j < fvar.instances.length; j++) {
	        result.fields = result.fields.concat(makeFvarInstance(j, fvar.instances[j], fvar.axes, names));
	    }

	    return result;
	}

	function parseFvarTable(data, start, names) {
	    const p = new parse.Parser(data, start);
	    const tableVersion = p.parseULong();
	    check.argument(tableVersion === 0x00010000, 'Unsupported fvar table version.');
	    const offsetToData = p.parseOffset16();
	    // Skip countSizePairs.
	    p.skip('uShort', 1);
	    const axisCount = p.parseUShort();
	    const axisSize = p.parseUShort();
	    const instanceCount = p.parseUShort();
	    const instanceSize = p.parseUShort();

	    const axes = [];
	    for (let i = 0; i < axisCount; i++) {
	        axes.push(parseFvarAxis(data, start + offsetToData + i * axisSize, names));
	    }

	    const instances = [];
	    const instanceStart = start + offsetToData + axisCount * axisSize;
	    for (let j = 0; j < instanceCount; j++) {
	        instances.push(parseFvarInstance(data, instanceStart + j * instanceSize, axes, names));
	    }

	    return {axes: axes, instances: instances};
	}

	var fvar = { make: makeFvarTable, parse: parseFvarTable };

	// The `glyf` table describes the glyphs in TrueType outline format.

	// Parse the coordinate data for a glyph.
	function parseGlyphCoordinate(p, flag, previousValue, shortVectorBitMask, sameBitMask) {
	    let v;
	    if ((flag & shortVectorBitMask) > 0) {
	        // The coordinate is 1 byte long.
	        v = p.parseByte();
	        // The `same` bit is re-used for short values to signify the sign of the value.
	        if ((flag & sameBitMask) === 0) {
	            v = -v;
	        }

	        v = previousValue + v;
	    } else {
	        //  The coordinate is 2 bytes long.
	        // If the `same` bit is set, the coordinate is the same as the previous coordinate.
	        if ((flag & sameBitMask) > 0) {
	            v = previousValue;
	        } else {
	            // Parse the coordinate as a signed 16-bit delta value.
	            v = previousValue + p.parseShort();
	        }
	    }

	    return v;
	}

	// Parse a TrueType glyph.
	function parseGlyph(glyph, data, start) {
	    const p = new parse.Parser(data, start);
	    glyph.numberOfContours = p.parseShort();
	    glyph._xMin = p.parseShort();
	    glyph._yMin = p.parseShort();
	    glyph._xMax = p.parseShort();
	    glyph._yMax = p.parseShort();
	    let flags;
	    let flag;

	    if (glyph.numberOfContours > 0) {
	        // This glyph is not a composite.
	        const endPointIndices = glyph.endPointIndices = [];
	        for (let i = 0; i < glyph.numberOfContours; i += 1) {
	            endPointIndices.push(p.parseUShort());
	        }

	        glyph.instructionLength = p.parseUShort();
	        glyph.instructions = [];
	        for (let i = 0; i < glyph.instructionLength; i += 1) {
	            glyph.instructions.push(p.parseByte());
	        }

	        const numberOfCoordinates = endPointIndices[endPointIndices.length - 1] + 1;
	        flags = [];
	        for (let i = 0; i < numberOfCoordinates; i += 1) {
	            flag = p.parseByte();
	            flags.push(flag);
	            // If bit 3 is set, we repeat this flag n times, where n is the next byte.
	            if ((flag & 8) > 0) {
	                const repeatCount = p.parseByte();
	                for (let j = 0; j < repeatCount; j += 1) {
	                    flags.push(flag);
	                    i += 1;
	                }
	            }
	        }

	        check.argument(flags.length === numberOfCoordinates, 'Bad flags.');

	        if (endPointIndices.length > 0) {
	            const points = [];
	            let point;
	            // X/Y coordinates are relative to the previous point, except for the first point which is relative to 0,0.
	            if (numberOfCoordinates > 0) {
	                for (let i = 0; i < numberOfCoordinates; i += 1) {
	                    flag = flags[i];
	                    point = {};
	                    point.onCurve = !!(flag & 1);
	                    point.lastPointOfContour = endPointIndices.indexOf(i) >= 0;
	                    points.push(point);
	                }

	                let px = 0;
	                for (let i = 0; i < numberOfCoordinates; i += 1) {
	                    flag = flags[i];
	                    point = points[i];
	                    point.x = parseGlyphCoordinate(p, flag, px, 2, 16);
	                    px = point.x;
	                }

	                let py = 0;
	                for (let i = 0; i < numberOfCoordinates; i += 1) {
	                    flag = flags[i];
	                    point = points[i];
	                    point.y = parseGlyphCoordinate(p, flag, py, 4, 32);
	                    py = point.y;
	                }
	            }

	            glyph.points = points;
	        } else {
	            glyph.points = [];
	        }
	    } else if (glyph.numberOfContours === 0) {
	        glyph.points = [];
	    } else {
	        glyph.isComposite = true;
	        glyph.points = [];
	        glyph.components = [];
	        let moreComponents = true;
	        while (moreComponents) {
	            flags = p.parseUShort();
	            const component = {
	                glyphIndex: p.parseUShort(),
	                xScale: 1,
	                scale01: 0,
	                scale10: 0,
	                yScale: 1,
	                dx: 0,
	                dy: 0
	            };
	            if ((flags & 1) > 0) {
	                // The arguments are words
	                if ((flags & 2) > 0) {
	                    // values are offset
	                    component.dx = p.parseShort();
	                    component.dy = p.parseShort();
	                } else {
	                    // values are matched points
	                    component.matchedPoints = [p.parseUShort(), p.parseUShort()];
	                }

	            } else {
	                // The arguments are bytes
	                if ((flags & 2) > 0) {
	                    // values are offset
	                    component.dx = p.parseChar();
	                    component.dy = p.parseChar();
	                } else {
	                    // values are matched points
	                    component.matchedPoints = [p.parseByte(), p.parseByte()];
	                }
	            }

	            if ((flags & 8) > 0) {
	                // We have a scale
	                component.xScale = component.yScale = p.parseF2Dot14();
	            } else if ((flags & 64) > 0) {
	                // We have an X / Y scale
	                component.xScale = p.parseF2Dot14();
	                component.yScale = p.parseF2Dot14();
	            } else if ((flags & 128) > 0) {
	                // We have a 2x2 transformation
	                component.xScale = p.parseF2Dot14();
	                component.scale01 = p.parseF2Dot14();
	                component.scale10 = p.parseF2Dot14();
	                component.yScale = p.parseF2Dot14();
	            }

	            glyph.components.push(component);
	            moreComponents = !!(flags & 32);
	        }
	        if (flags & 0x100) {
	            // We have instructions
	            glyph.instructionLength = p.parseUShort();
	            glyph.instructions = [];
	            for (let i = 0; i < glyph.instructionLength; i += 1) {
	                glyph.instructions.push(p.parseByte());
	            }
	        }
	    }
	}

	// Transform an array of points and return a new array.
	function transformPoints(points, transform) {
	    const newPoints = [];
	    for (let i = 0; i < points.length; i += 1) {
	        const pt = points[i];
	        const newPt = {
	            x: transform.xScale * pt.x + transform.scale01 * pt.y + transform.dx,
	            y: transform.scale10 * pt.x + transform.yScale * pt.y + transform.dy,
	            onCurve: pt.onCurve,
	            lastPointOfContour: pt.lastPointOfContour
	        };
	        newPoints.push(newPt);
	    }

	    return newPoints;
	}

	function getContours(points) {
	    const contours = [];
	    let currentContour = [];
	    for (let i = 0; i < points.length; i += 1) {
	        const pt = points[i];
	        currentContour.push(pt);
	        if (pt.lastPointOfContour) {
	            contours.push(currentContour);
	            currentContour = [];
	        }
	    }

	    check.argument(currentContour.length === 0, 'There are still points left in the current contour.');
	    return contours;
	}

	// Convert the TrueType glyph outline to a Path.
	function getPath(points) {
	    const p = new Path();
	    if (!points) {
	        return p;
	    }

	    const contours = getContours(points);

	    for (let contourIndex = 0; contourIndex < contours.length; ++contourIndex) {
	        const contour = contours[contourIndex];

	        let prev = null;
	        let curr = contour[contour.length - 1];
	        let next = contour[0];

	        if (curr.onCurve) {
	            p.moveTo(curr.x, curr.y);
	        } else {
	            if (next.onCurve) {
	                p.moveTo(next.x, next.y);
	            } else {
	                // If both first and last points are off-curve, start at their middle.
	                const start = {x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5};
	                p.moveTo(start.x, start.y);
	            }
	        }

	        for (let i = 0; i < contour.length; ++i) {
	            prev = curr;
	            curr = next;
	            next = contour[(i + 1) % contour.length];

	            if (curr.onCurve) {
	                // This is a straight line.
	                p.lineTo(curr.x, curr.y);
	            } else {
	                let prev2 = prev;
	                let next2 = next;

	                if (!prev.onCurve) {
	                    prev2 = { x: (curr.x + prev.x) * 0.5, y: (curr.y + prev.y) * 0.5 };
	                }

	                if (!next.onCurve) {
	                    next2 = { x: (curr.x + next.x) * 0.5, y: (curr.y + next.y) * 0.5 };
	                }

	                p.quadraticCurveTo(curr.x, curr.y, next2.x, next2.y);
	            }
	        }

	        p.closePath();
	    }
	    return p;
	}

	function buildPath(glyphs, glyph) {
	    if (glyph.isComposite) {
	        for (let j = 0; j < glyph.components.length; j += 1) {
	            const component = glyph.components[j];
	            const componentGlyph = glyphs.get(component.glyphIndex);
	            // Force the ttfGlyphLoader to parse the glyph.
	            componentGlyph.getPath();
	            if (componentGlyph.points) {
	                let transformedPoints;
	                if (component.matchedPoints === undefined) {
	                    // component positioned by offset
	                    transformedPoints = transformPoints(componentGlyph.points, component);
	                } else {
	                    // component positioned by matched points
	                    if ((component.matchedPoints[0] > glyph.points.length - 1) ||
	                        (component.matchedPoints[1] > componentGlyph.points.length - 1)) {
	                        throw Error('Matched points out of range in ' + glyph.name);
	                    }
	                    const firstPt = glyph.points[component.matchedPoints[0]];
	                    let secondPt = componentGlyph.points[component.matchedPoints[1]];
	                    const transform = {
	                        xScale: component.xScale, scale01: component.scale01,
	                        scale10: component.scale10, yScale: component.yScale,
	                        dx: 0, dy: 0
	                    };
	                    secondPt = transformPoints([secondPt], transform)[0];
	                    transform.dx = firstPt.x - secondPt.x;
	                    transform.dy = firstPt.y - secondPt.y;
	                    transformedPoints = transformPoints(componentGlyph.points, transform);
	                }
	                glyph.points = glyph.points.concat(transformedPoints);
	            }
	        }
	    }

	    return getPath(glyph.points);
	}

	function parseGlyfTableAll(data, start, loca, font) {
	    const glyphs = new glyphset.GlyphSet(font);

	    // The last element of the loca table is invalid.
	    for (let i = 0; i < loca.length - 1; i += 1) {
	        const offset = loca[i];
	        const nextOffset = loca[i + 1];
	        if (offset !== nextOffset) {
	            glyphs.push(i, glyphset.ttfGlyphLoader(font, i, parseGlyph, data, start + offset, buildPath));
	        } else {
	            glyphs.push(i, glyphset.glyphLoader(font, i));
	        }
	    }

	    return glyphs;
	}

	function parseGlyfTableOnLowMemory(data, start, loca, font) {
	    const glyphs = new glyphset.GlyphSet(font);

	    font._push = function(i) {
	        const offset = loca[i];
	        const nextOffset = loca[i + 1];
	        if (offset !== nextOffset) {
	            glyphs.push(i, glyphset.ttfGlyphLoader(font, i, parseGlyph, data, start + offset, buildPath));
	        } else {
	            glyphs.push(i, glyphset.glyphLoader(font, i));
	        }
	    };

	    return glyphs;
	}

	// Parse all the glyphs according to the offsets from the `loca` table.
	function parseGlyfTable(data, start, loca, font, opt) {
	    if (opt.lowMemory)
	        return parseGlyfTableOnLowMemory(data, start, loca, font);
	    else
	        return parseGlyfTableAll(data, start, loca, font);
	}

	var glyf = { getPath, parse: parseGlyfTable};

	// The `GPOS` table contains kerning pairs, among other things.

	const subtableParsers$1 = new Array(10);         // subtableParsers[0] is unused

	// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-1-single-adjustment-positioning-subtable
	// this = Parser instance
	subtableParsers$1[1] = function parseLookup1() {
	    const start = this.offset + this.relativeOffset;
	    const posformat = this.parseUShort();
	    if (posformat === 1) {
	        return {
	            posFormat: 1,
	            coverage: this.parsePointer(Parser.coverage),
	            value: this.parseValueRecord()
	        };
	    } else if (posformat === 2) {
	        return {
	            posFormat: 2,
	            coverage: this.parsePointer(Parser.coverage),
	            values: this.parseValueRecordList()
	        };
	    }
	    check.assert(false, '0x' + start.toString(16) + ': GPOS lookup type 1 format must be 1 or 2.');
	};

	// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos#lookup-type-2-pair-adjustment-positioning-subtable
	subtableParsers$1[2] = function parseLookup2() {
	    const start = this.offset + this.relativeOffset;
	    const posFormat = this.parseUShort();
	    check.assert(posFormat === 1 || posFormat === 2, '0x' + start.toString(16) + ': GPOS lookup type 2 format must be 1 or 2.');
	    const coverage = this.parsePointer(Parser.coverage);
	    const valueFormat1 = this.parseUShort();
	    const valueFormat2 = this.parseUShort();
	    if (posFormat === 1) {
	        // Adjustments for Glyph Pairs
	        return {
	            posFormat: posFormat,
	            coverage: coverage,
	            valueFormat1: valueFormat1,
	            valueFormat2: valueFormat2,
	            pairSets: this.parseList(Parser.pointer(Parser.list(function() {
	                return {        // pairValueRecord
	                    secondGlyph: this.parseUShort(),
	                    value1: this.parseValueRecord(valueFormat1),
	                    value2: this.parseValueRecord(valueFormat2)
	                };
	            })))
	        };
	    } else if (posFormat === 2) {
	        const classDef1 = this.parsePointer(Parser.classDef);
	        const classDef2 = this.parsePointer(Parser.classDef);
	        const class1Count = this.parseUShort();
	        const class2Count = this.parseUShort();
	        return {
	            // Class Pair Adjustment
	            posFormat: posFormat,
	            coverage: coverage,
	            valueFormat1: valueFormat1,
	            valueFormat2: valueFormat2,
	            classDef1: classDef1,
	            classDef2: classDef2,
	            class1Count: class1Count,
	            class2Count: class2Count,
	            classRecords: this.parseList(class1Count, Parser.list(class2Count, function() {
	                return {
	                    value1: this.parseValueRecord(valueFormat1),
	                    value2: this.parseValueRecord(valueFormat2)
	                };
	            }))
	        };
	    }
	};

	subtableParsers$1[3] = function parseLookup3() { return { error: 'GPOS Lookup 3 not supported' }; };
	subtableParsers$1[4] = function parseLookup4() { return { error: 'GPOS Lookup 4 not supported' }; };
	subtableParsers$1[5] = function parseLookup5() { return { error: 'GPOS Lookup 5 not supported' }; };
	subtableParsers$1[6] = function parseLookup6() { return { error: 'GPOS Lookup 6 not supported' }; };
	subtableParsers$1[7] = function parseLookup7() { return { error: 'GPOS Lookup 7 not supported' }; };
	subtableParsers$1[8] = function parseLookup8() { return { error: 'GPOS Lookup 8 not supported' }; };
	subtableParsers$1[9] = function parseLookup9() { return { error: 'GPOS Lookup 9 not supported' }; };

	// https://docs.microsoft.com/en-us/typography/opentype/spec/gpos
	function parseGposTable(data, start) {
	    start = start || 0;
	    const p = new Parser(data, start);
	    const tableVersion = p.parseVersion(1);
	    check.argument(tableVersion === 1 || tableVersion === 1.1, 'Unsupported GPOS table version ' + tableVersion);

	    if (tableVersion === 1) {
	        return {
	            version: tableVersion,
	            scripts: p.parseScriptList(),
	            features: p.parseFeatureList(),
	            lookups: p.parseLookupList(subtableParsers$1)
	        };
	    } else {
	        return {
	            version: tableVersion,
	            scripts: p.parseScriptList(),
	            features: p.parseFeatureList(),
	            lookups: p.parseLookupList(subtableParsers$1),
	            variations: p.parseFeatureVariationsList()
	        };
	    }

	}

	// GPOS Writing //////////////////////////////////////////////
	// NOT SUPPORTED
	const subtableMakers$1 = new Array(10);

	function makeGposTable(gpos) {
	    return new table.Table('GPOS', [
	        {name: 'version', type: 'ULONG', value: 0x10000},
	        {name: 'scripts', type: 'TABLE', value: new table.ScriptList(gpos.scripts)},
	        {name: 'features', type: 'TABLE', value: new table.FeatureList(gpos.features)},
	        {name: 'lookups', type: 'TABLE', value: new table.LookupList(gpos.lookups, subtableMakers$1)}
	    ]);
	}

	var gpos = { parse: parseGposTable, make: makeGposTable };

	// The `kern` table contains kerning pairs.

	function parseWindowsKernTable(p) {
	    const pairs = {};
	    // Skip nTables.
	    p.skip('uShort');
	    const subtableVersion = p.parseUShort();
	    check.argument(subtableVersion === 0, 'Unsupported kern sub-table version.');
	    // Skip subtableLength, subtableCoverage
	    p.skip('uShort', 2);
	    const nPairs = p.parseUShort();
	    // Skip searchRange, entrySelector, rangeShift.
	    p.skip('uShort', 3);
	    for (let i = 0; i < nPairs; i += 1) {
	        const leftIndex = p.parseUShort();
	        const rightIndex = p.parseUShort();
	        const value = p.parseShort();
	        pairs[leftIndex + ',' + rightIndex] = value;
	    }
	    return pairs;
	}

	function parseMacKernTable(p) {
	    const pairs = {};
	    // The Mac kern table stores the version as a fixed (32 bits) but we only loaded the first 16 bits.
	    // Skip the rest.
	    p.skip('uShort');
	    const nTables = p.parseULong();
	    //check.argument(nTables === 1, 'Only 1 subtable is supported (got ' + nTables + ').');
	    if (nTables > 1) {
	        console.warn('Only the first kern subtable is supported.');
	    }
	    p.skip('uLong');
	    const coverage = p.parseUShort();
	    const subtableVersion = coverage & 0xFF;
	    p.skip('uShort');
	    if (subtableVersion === 0) {
	        const nPairs = p.parseUShort();
	        // Skip searchRange, entrySelector, rangeShift.
	        p.skip('uShort', 3);
	        for (let i = 0; i < nPairs; i += 1) {
	            const leftIndex = p.parseUShort();
	            const rightIndex = p.parseUShort();
	            const value = p.parseShort();
	            pairs[leftIndex + ',' + rightIndex] = value;
	        }
	    }
	    return pairs;
	}

	// Parse the `kern` table which contains kerning pairs.
	function parseKernTable(data, start) {
	    const p = new parse.Parser(data, start);
	    const tableVersion = p.parseUShort();
	    if (tableVersion === 0) {
	        return parseWindowsKernTable(p);
	    } else if (tableVersion === 1) {
	        return parseMacKernTable(p);
	    } else {
	        throw new Error('Unsupported kern table version (' + tableVersion + ').');
	    }
	}

	var kern = { parse: parseKernTable };

	// The `loca` table stores the offsets to the locations of the glyphs in the font.

	// Parse the `loca` table. This table stores the offsets to the locations of the glyphs in the font,
	// relative to the beginning of the glyphData table.
	// The number of glyphs stored in the `loca` table is specified in the `maxp` table (under numGlyphs)
	// The loca table has two versions: a short version where offsets are stored as uShorts, and a long
	// version where offsets are stored as uLongs. The `head` table specifies which version to use
	// (under indexToLocFormat).
	function parseLocaTable(data, start, numGlyphs, shortVersion) {
	    const p = new parse.Parser(data, start);
	    const parseFn = shortVersion ? p.parseUShort : p.parseULong;
	    // There is an extra entry after the last index element to compute the length of the last glyph.
	    // That's why we use numGlyphs + 1.
	    const glyphOffsets = [];
	    for (let i = 0; i < numGlyphs + 1; i += 1) {
	        let glyphOffset = parseFn.call(p);
	        if (shortVersion) {
	            // The short table version stores the actual offset divided by 2.
	            glyphOffset *= 2;
	        }

	        glyphOffsets.push(glyphOffset);
	    }

	    return glyphOffsets;
	}

	var loca = { parse: parseLocaTable };

	// opentype.js

	/**
	 * The opentype library.
	 * @namespace opentype
	 */

	// File loaders /////////////////////////////////////////////////////////
	/**
	 * Loads a font from a file. The callback throws an error message as the first parameter if it fails
	 * and the font as an ArrayBuffer in the second parameter if it succeeds.
	 * @param  {string} path - The path of the file
	 * @param  {Function} callback - The function to call when the font load completes
	 */
	function loadFromFile(path, callback) {
	    const fs = {};
	    fs.readFile(path, function(err, buffer) {
	        if (err) {
	            return callback(err.message);
	        }

	        callback(null, nodeBufferToArrayBuffer(buffer));
	    });
	}
	/**
	 * Loads a font from a URL. The callback throws an error message as the first parameter if it fails
	 * and the font as an ArrayBuffer in the second parameter if it succeeds.
	 * @param  {string} url - The URL of the font file.
	 * @param  {Function} callback - The function to call when the font load completes
	 */
	function loadFromUrl(url, callback) {
	    const request = new XMLHttpRequest();
	    request.open('get', url, true);
	    request.responseType = 'arraybuffer';
	    request.onload = function() {
	        if (request.response) {
	            return callback(null, request.response);
	        } else {
	            return callback('Font could not be loaded: ' + request.statusText);
	        }
	    };

	    request.onerror = function () {
	        callback('Font could not be loaded');
	    };

	    request.send();
	}

	// Table Directory Entries //////////////////////////////////////////////
	/**
	 * Parses OpenType table entries.
	 * @param  {DataView}
	 * @param  {Number}
	 * @return {Object[]}
	 */
	function parseOpenTypeTableEntries(data, numTables) {
	    const tableEntries = [];
	    let p = 12;
	    for (let i = 0; i < numTables; i += 1) {
	        const tag = parse.getTag(data, p);
	        const checksum = parse.getULong(data, p + 4);
	        const offset = parse.getULong(data, p + 8);
	        const length = parse.getULong(data, p + 12);
	        tableEntries.push({tag: tag, checksum: checksum, offset: offset, length: length, compression: false});
	        p += 16;
	    }

	    return tableEntries;
	}

	/**
	 * Parses WOFF table entries.
	 * @param  {DataView}
	 * @param  {Number}
	 * @return {Object[]}
	 */
	function parseWOFFTableEntries(data, numTables) {
	    const tableEntries = [];
	    let p = 44; // offset to the first table directory entry.
	    for (let i = 0; i < numTables; i += 1) {
	        const tag = parse.getTag(data, p);
	        const offset = parse.getULong(data, p + 4);
	        const compLength = parse.getULong(data, p + 8);
	        const origLength = parse.getULong(data, p + 12);
	        let compression;
	        if (compLength < origLength) {
	            compression = 'WOFF';
	        } else {
	            compression = false;
	        }

	        tableEntries.push({tag: tag, offset: offset, compression: compression,
	            compressedLength: compLength, length: origLength});
	        p += 20;
	    }

	    return tableEntries;
	}

	/**
	 * @typedef TableData
	 * @type Object
	 * @property {DataView} data - The DataView
	 * @property {number} offset - The data offset.
	 */

	/**
	 * @param  {DataView}
	 * @param  {Object}
	 * @return {TableData}
	 */
	function uncompressTable(data, tableEntry) {
	    if (tableEntry.compression === 'WOFF') {
	        const inBuffer = new Uint8Array(data.buffer, tableEntry.offset + 2, tableEntry.compressedLength - 2);
	        const outBuffer = new Uint8Array(tableEntry.length);
	        tinyInflate(inBuffer, outBuffer);
	        if (outBuffer.byteLength !== tableEntry.length) {
	            throw new Error('Decompression error: ' + tableEntry.tag + ' decompressed length doesn\'t match recorded length');
	        }

	        const view = new DataView(outBuffer.buffer, 0);
	        return {data: view, offset: 0};
	    } else {
	        return {data: data, offset: tableEntry.offset};
	    }
	}

	// Public API ///////////////////////////////////////////////////////////

	/**
	 * Parse the OpenType file data (as an ArrayBuffer) and return a Font object.
	 * Throws an error if the font could not be parsed.
	 * @param  {ArrayBuffer}
	 * @param  {Object} opt - options for parsing
	 * @return {opentype.Font}
	 */
	function parseBuffer(buffer, opt) {
	    opt = (opt === undefined || opt === null) ?  {} : opt;

	    let indexToLocFormat;
	    let ltagTable;

	    // Since the constructor can also be called to create new fonts from scratch, we indicate this
	    // should be an empty font that we'll fill with our own data.
	    const font = new Font({empty: true});

	    // OpenType fonts use big endian byte ordering.
	    // We can't rely on typed array view types, because they operate with the endianness of the host computer.
	    // Instead we use DataViews where we can specify endianness.
	    const data = new DataView(buffer, 0);
	    let numTables;
	    let tableEntries = [];
	    const signature = parse.getTag(data, 0);
	    if (signature === String.fromCharCode(0, 1, 0, 0) || signature === 'true' || signature === 'typ1') {
	        font.outlinesFormat = 'truetype';
	        numTables = parse.getUShort(data, 4);
	        tableEntries = parseOpenTypeTableEntries(data, numTables);
	    } else if (signature === 'OTTO') {
	        font.outlinesFormat = 'cff';
	        numTables = parse.getUShort(data, 4);
	        tableEntries = parseOpenTypeTableEntries(data, numTables);
	    } else if (signature === 'wOFF') {
	        const flavor = parse.getTag(data, 4);
	        if (flavor === String.fromCharCode(0, 1, 0, 0)) {
	            font.outlinesFormat = 'truetype';
	        } else if (flavor === 'OTTO') {
	            font.outlinesFormat = 'cff';
	        } else {
	            throw new Error('Unsupported OpenType flavor ' + signature);
	        }

	        numTables = parse.getUShort(data, 12);
	        tableEntries = parseWOFFTableEntries(data, numTables);
	    } else {
	        throw new Error('Unsupported OpenType signature ' + signature);
	    }

	    let cffTableEntry;
	    let fvarTableEntry;
	    let glyfTableEntry;
	    let gposTableEntry;
	    let gsubTableEntry;
	    let hmtxTableEntry;
	    let kernTableEntry;
	    let locaTableEntry;
	    let nameTableEntry;
	    let metaTableEntry;
	    let p;

	    for (let i = 0; i < numTables; i += 1) {
	        const tableEntry = tableEntries[i];
	        let table;
	        switch (tableEntry.tag) {
	            case 'cmap':
	                table = uncompressTable(data, tableEntry);
	                font.tables.cmap = cmap.parse(table.data, table.offset);
	                font.encoding = new CmapEncoding(font.tables.cmap);
	                break;
	            case 'cvt ' :
	                table = uncompressTable(data, tableEntry);
	                p = new parse.Parser(table.data, table.offset);
	                font.tables.cvt = p.parseShortList(tableEntry.length / 2);
	                break;
	            case 'fvar':
	                fvarTableEntry = tableEntry;
	                break;
	            case 'fpgm' :
	                table = uncompressTable(data, tableEntry);
	                p = new parse.Parser(table.data, table.offset);
	                font.tables.fpgm = p.parseByteList(tableEntry.length);
	                break;
	            case 'head':
	                table = uncompressTable(data, tableEntry);
	                font.tables.head = head.parse(table.data, table.offset);
	                font.unitsPerEm = font.tables.head.unitsPerEm;
	                indexToLocFormat = font.tables.head.indexToLocFormat;
	                break;
	            case 'hhea':
	                table = uncompressTable(data, tableEntry);
	                font.tables.hhea = hhea.parse(table.data, table.offset);
	                font.ascender = font.tables.hhea.ascender;
	                font.descender = font.tables.hhea.descender;
	                font.numberOfHMetrics = font.tables.hhea.numberOfHMetrics;
	                break;
	            case 'hmtx':
	                hmtxTableEntry = tableEntry;
	                break;
	            case 'ltag':
	                table = uncompressTable(data, tableEntry);
	                ltagTable = ltag.parse(table.data, table.offset);
	                break;
	            case 'maxp':
	                table = uncompressTable(data, tableEntry);
	                font.tables.maxp = maxp.parse(table.data, table.offset);
	                font.numGlyphs = font.tables.maxp.numGlyphs;
	                break;
	            case 'name':
	                nameTableEntry = tableEntry;
	                break;
	            case 'OS/2':
	                table = uncompressTable(data, tableEntry);
	                font.tables.os2 = os2.parse(table.data, table.offset);
	                break;
	            case 'post':
	                table = uncompressTable(data, tableEntry);
	                font.tables.post = post.parse(table.data, table.offset);
	                font.glyphNames = new GlyphNames(font.tables.post);
	                break;
	            case 'prep' :
	                table = uncompressTable(data, tableEntry);
	                p = new parse.Parser(table.data, table.offset);
	                font.tables.prep = p.parseByteList(tableEntry.length);
	                break;
	            case 'glyf':
	                glyfTableEntry = tableEntry;
	                break;
	            case 'loca':
	                locaTableEntry = tableEntry;
	                break;
	            case 'CFF ':
	                cffTableEntry = tableEntry;
	                break;
	            case 'kern':
	                kernTableEntry = tableEntry;
	                break;
	            case 'GPOS':
	                gposTableEntry = tableEntry;
	                break;
	            case 'GSUB':
	                gsubTableEntry = tableEntry;
	                break;
	            case 'meta':
	                metaTableEntry = tableEntry;
	                break;
	        }
	    }

	    const nameTable = uncompressTable(data, nameTableEntry);
	    font.tables.name = _name.parse(nameTable.data, nameTable.offset, ltagTable);
	    font.names = font.tables.name;

	    if (glyfTableEntry && locaTableEntry) {
	        const shortVersion = indexToLocFormat === 0;
	        const locaTable = uncompressTable(data, locaTableEntry);
	        const locaOffsets = loca.parse(locaTable.data, locaTable.offset, font.numGlyphs, shortVersion);
	        const glyfTable = uncompressTable(data, glyfTableEntry);
	        font.glyphs = glyf.parse(glyfTable.data, glyfTable.offset, locaOffsets, font, opt);
	    } else if (cffTableEntry) {
	        const cffTable = uncompressTable(data, cffTableEntry);
	        cff.parse(cffTable.data, cffTable.offset, font, opt);
	    } else {
	        throw new Error('Font doesn\'t contain TrueType or CFF outlines.');
	    }

	    const hmtxTable = uncompressTable(data, hmtxTableEntry);
	    hmtx.parse(font, hmtxTable.data, hmtxTable.offset, font.numberOfHMetrics, font.numGlyphs, font.glyphs, opt);
	    addGlyphNames(font, opt);

	    if (kernTableEntry) {
	        const kernTable = uncompressTable(data, kernTableEntry);
	        font.kerningPairs = kern.parse(kernTable.data, kernTable.offset);
	    } else {
	        font.kerningPairs = {};
	    }

	    if (gposTableEntry) {
	        const gposTable = uncompressTable(data, gposTableEntry);
	        font.tables.gpos = gpos.parse(gposTable.data, gposTable.offset);
	        font.position.init();
	    }

	    if (gsubTableEntry) {
	        const gsubTable = uncompressTable(data, gsubTableEntry);
	        font.tables.gsub = gsub.parse(gsubTable.data, gsubTable.offset);
	    }

	    if (fvarTableEntry) {
	        const fvarTable = uncompressTable(data, fvarTableEntry);
	        font.tables.fvar = fvar.parse(fvarTable.data, fvarTable.offset, font.names);
	    }

	    if (metaTableEntry) {
	        const metaTable = uncompressTable(data, metaTableEntry);
	        font.tables.meta = meta.parse(metaTable.data, metaTable.offset);
	        font.metas = font.tables.meta;
	    }

	    return font;
	}

	/**
	 * Asynchronously load the font from a URL or a filesystem. When done, call the callback
	 * with two arguments `(err, font)`. The `err` will be null on success,
	 * the `font` is a Font object.
	 * We use the node.js callback convention so that
	 * opentype.js can integrate with frameworks like async.js.
	 * @alias opentype.load
	 * @param  {string} url - The URL of the font to load.
	 * @param  {Function} callback - The callback.
	 */
	function load(url, callback, opt) {
	    const isNode$$1 = typeof window === 'undefined';
	    const loadFn = isNode$$1 ? loadFromFile : loadFromUrl;
	    loadFn(url, function(err, arrayBuffer) {
	        if (err) {
	            return callback(err);
	        }
	        let font;
	        try {
	            font = parseBuffer(arrayBuffer, opt);
	        } catch (e) {
	            return callback(e, null);
	        }
	        return callback(null, font);
	    });
	}

	/**
	 * Synchronously load the font from a URL or file.
	 * When done, returns the font object or throws an error.
	 * @alias opentype.loadSync
	 * @param  {string} url - The URL of the font to load.
	 * @param  {Object} opt - opt.lowMemory
	 * @return {opentype.Font}
	 */
	function loadSync(url, opt) {
	    const fs = {};
	    const buffer = fs.readFileSync(url);
	    return parseBuffer(nodeBufferToArrayBuffer(buffer), opt);
	}

	exports.Font = Font;
	exports.Glyph = Glyph;
	exports.Path = Path;
	exports.BoundingBox = BoundingBox;
	exports._parse = parse;
	exports.parse = parseBuffer;
	exports.load = load;
	exports.loadSync = loadSync;

	return exports;

}({}));


  return opentype
}
