
// Custom bundle of Typr.js (https://github.com/photopea/Typr.js) for use in troika-3d-text. 
// Original MIT license applies: https://github.com/photopea/Typr.js/blob/gh-pages/LICENSE

export default function() {

const window = self

// Begin Typr.js


var Typr = {};

Typr.parse = function(buff)
{
	var bin = Typr._bin;
	var data = new Uint8Array(buff);
	
	var tag = bin.readASCII(data, 0, 4);  
	if(tag=="ttcf") {
		var offset = 4;
		var majV = bin.readUshort(data, offset);  offset+=2;
		var minV = bin.readUshort(data, offset);  offset+=2;
		var numF = bin.readUint  (data, offset);  offset+=4;
		var fnts = [];
		for(var i=0; i<numF; i++) {
			var foff = bin.readUint  (data, offset);  offset+=4;
			fnts.push(Typr._readFont(data, foff));
		}
		return fnts;
	}
	else return [Typr._readFont(data, 0)];
}

Typr._readFont = function(data, offset) {
	var bin = Typr._bin;
	var ooff = offset;
	
	var sfnt_version = bin.readFixed(data, offset);
	offset += 4;
	var numTables = bin.readUshort(data, offset);
	offset += 2;
	var searchRange = bin.readUshort(data, offset);
	offset += 2;
	var entrySelector = bin.readUshort(data, offset);
	offset += 2;
	var rangeShift = bin.readUshort(data, offset);
	offset += 2;
	
	var tags = [
		"cmap",
		"head",
		"hhea",
		"maxp",
		"hmtx",
		"name",
		"OS/2",
		"post",
		
		//"cvt",
		//"fpgm",
		"loca",
		"glyf",
		"kern",
		
		//"prep"
		//"gasp"
		
		"CFF ",
		
		
		"GPOS",
		"GSUB",
		
		"SVG "
		//"VORG",
		];
	
	var obj = {_data:data, _offset:ooff};
	//console.log(sfnt_version, numTables, searchRange, entrySelector, rangeShift);
	
	var tabs = {};
	
	for(var i=0; i<numTables; i++)
	{
		var tag = bin.readASCII(data, offset, 4);   offset += 4;
		var checkSum = bin.readUint(data, offset);  offset += 4;
		var toffset = bin.readUint(data, offset);   offset += 4;
		var length = bin.readUint(data, offset);    offset += 4;
		tabs[tag] = {offset:toffset, length:length};
		
		//if(tags.indexOf(tag)==-1) console.log("unknown tag", tag, length);
	}
	
	for(var i=0; i< tags.length; i++)
	{
		var t = tags[i];
		//console.log(t);
		//if(tabs[t]) console.log(t, tabs[t].offset, tabs[t].length);
		if(tabs[t]) obj[t.trim()] = Typr[t.trim()].parse(data, tabs[t].offset, tabs[t].length, obj);
	}
	
	return obj;
}

Typr._tabOffset = function(data, tab, foff)
{
	var bin = Typr._bin;
	var numTables = bin.readUshort(data, foff+4);
	var offset = foff+12;
	for(var i=0; i<numTables; i++)
	{
		var tag = bin.readASCII(data, offset, 4);   offset += 4;
		var checkSum = bin.readUint(data, offset);  offset += 4;
		var toffset = bin.readUint(data, offset);   offset += 4;
		var length = bin.readUint(data, offset);    offset += 4;
		if(tag==tab) return toffset;
	}
	return 0;
}





Typr._bin = {
	readFixed : function(data, o)
	{
		return ((data[o]<<8) | data[o+1]) +  (((data[o+2]<<8)|data[o+3])/(256*256+4));
	},
	readF2dot14 : function(data, o)
	{
		var num = Typr._bin.readShort(data, o);
		return num / 16384;
	},
	readInt : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		var a = Typr._bin.t.uint8;
		a[0] = buff[p+3];
		a[1] = buff[p+2];
		a[2] = buff[p+1];
		a[3] = buff[p];
		return Typr._bin.t.int32[0];
	},
	
	readInt8 : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		var a = Typr._bin.t.uint8;
		a[0] = buff[p];
		return Typr._bin.t.int8[0];
	},
	readShort : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		var a = Typr._bin.t.uint8;
		a[1] = buff[p]; a[0] = buff[p+1];
		return Typr._bin.t.int16[0];
	},
	readUshort : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		return (buff[p]<<8) | buff[p+1];
	},
	readUshorts : function(buff, p, len)
	{
		var arr = [];
		for(var i=0; i<len; i++) arr.push(Typr._bin.readUshort(buff, p+i*2));
		return arr;
	},
	readUint : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		var a = Typr._bin.t.uint8;
		a[3] = buff[p];  a[2] = buff[p+1];  a[1] = buff[p+2];  a[0] = buff[p+3];
		return Typr._bin.t.uint32[0];
	},
	readUint64 : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		return (Typr._bin.readUint(buff, p)*(0xffffffff+1)) + Typr._bin.readUint(buff, p+4);
	},
	readASCII : function(buff, p, l)	// l : length in Characters (not Bytes)
	{
		//if(p>=buff.length) throw "error";
		var s = "";
		for(var i = 0; i < l; i++) s += String.fromCharCode(buff[p+i]);
		return s;
	},
	readUnicode : function(buff, p, l)
	{
		//if(p>=buff.length) throw "error";
		var s = "";
		for(var i = 0; i < l; i++)	
		{
			var c = (buff[p++]<<8) | buff[p++];
			s += String.fromCharCode(c);
		}
		return s;
	},
	_tdec : window["TextDecoder"] ? new window["TextDecoder"]() : null,
	readUTF8 : function(buff, p, l) {
		var tdec = Typr._bin._tdec;
		if(tdec && p==0 && l==buff.length) return tdec["decode"](buff);
		return Typr._bin.readASCII(buff,p,l);
	},
	readBytes : function(buff, p, l)
	{
		//if(p>=buff.length) throw "error";
		var arr = [];
		for(var i=0; i<l; i++) arr.push(buff[p+i]);
		return arr;
	},
	readASCIIArray : function(buff, p, l)	// l : length in Characters (not Bytes)
	{
		//if(p>=buff.length) throw "error";
		var s = [];
		for(var i = 0; i < l; i++)	
			s.push(String.fromCharCode(buff[p+i]));
		return s;
	}
};

Typr._bin.t = {
	buff: new ArrayBuffer(8),
};
Typr._bin.t.int8   = new Int8Array  (Typr._bin.t.buff);
Typr._bin.t.uint8  = new Uint8Array (Typr._bin.t.buff);
Typr._bin.t.int16  = new Int16Array (Typr._bin.t.buff);
Typr._bin.t.uint16 = new Uint16Array(Typr._bin.t.buff);
Typr._bin.t.int32  = new Int32Array (Typr._bin.t.buff);
Typr._bin.t.uint32 = new Uint32Array(Typr._bin.t.buff);





// OpenType Layout Common Table Formats

Typr._lctf = {};

Typr._lctf.parse = function(data, offset, length, font, subt)
{
	var bin = Typr._bin;
	var obj = {};
	var offset0 = offset;
	var tableVersion = bin.readFixed(data, offset);  offset += 4;
	
	var offScriptList  = bin.readUshort(data, offset);  offset += 2;
	var offFeatureList = bin.readUshort(data, offset);  offset += 2;
	var offLookupList  = bin.readUshort(data, offset);  offset += 2;
	
	
	obj.scriptList  = Typr._lctf.readScriptList (data, offset0 + offScriptList);
	obj.featureList = Typr._lctf.readFeatureList(data, offset0 + offFeatureList);
	obj.lookupList  = Typr._lctf.readLookupList (data, offset0 + offLookupList, subt);
	
	return obj;
}

Typr._lctf.readLookupList = function(data, offset, subt)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = [];
	var count = bin.readUshort(data, offset);  offset+=2;
	for(var i=0; i<count; i++) 
	{
		var noff = bin.readUshort(data, offset);  offset+=2;
		var lut = Typr._lctf.readLookupTable(data, offset0 + noff, subt);
		obj.push(lut);
	}
	return obj;
}

Typr._lctf.readLookupTable = function(data, offset, subt)
{
	//console.log("Parsing lookup table", offset);
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = {tabs:[]};
	
	obj.ltype = bin.readUshort(data, offset);  offset+=2;
	obj.flag  = bin.readUshort(data, offset);  offset+=2;
	var cnt   = bin.readUshort(data, offset);  offset+=2;
	
	for(var i=0; i<cnt; i++)
	{
		var noff = bin.readUshort(data, offset);  offset+=2;
		var tab = subt(data, obj.ltype, offset0 + noff);
		//console.log(obj.type, tab);
		obj.tabs.push(tab);
	}
	return obj;
}

Typr._lctf.numOfOnes = function(n)
{
	var num = 0;
	for(var i=0; i<32; i++) if(((n>>>i)&1) != 0) num++;
	return num;
}

Typr._lctf.readClassDef = function(data, offset)
{
	var bin = Typr._bin;
	var obj = [];
	var format = bin.readUshort(data, offset);  offset+=2;
	if(format==1) 
	{
		var startGlyph  = bin.readUshort(data, offset);  offset+=2;
		var glyphCount  = bin.readUshort(data, offset);  offset+=2;
		for(var i=0; i<glyphCount; i++)
		{
			obj.push(startGlyph+i);
			obj.push(startGlyph+i);
			obj.push(bin.readUshort(data, offset));  offset+=2;
		}
	}
	if(format==2)
	{
		var count = bin.readUshort(data, offset);  offset+=2;
		for(var i=0; i<count; i++)
		{
			obj.push(bin.readUshort(data, offset));  offset+=2;
			obj.push(bin.readUshort(data, offset));  offset+=2;
			obj.push(bin.readUshort(data, offset));  offset+=2;
		}
	}
	return obj;
}
Typr._lctf.getInterval = function(tab, val)
{
	for(var i=0; i<tab.length; i+=3)
	{
		var start = tab[i], end = tab[i+1], index = tab[i+2];
		if(start<=val && val<=end) return i;
	}
	return -1;
}


Typr._lctf.readCoverage = function(data, offset)
{
	var bin = Typr._bin;
	var cvg = {};
	cvg.fmt   = bin.readUshort(data, offset);  offset+=2;
	var count = bin.readUshort(data, offset);  offset+=2;
	//console.log("parsing coverage", offset-4, format, count);
	if(cvg.fmt==1) cvg.tab = bin.readUshorts(data, offset, count); 
	if(cvg.fmt==2) cvg.tab = bin.readUshorts(data, offset, count*3);
	return cvg;
}

Typr._lctf.coverageIndex = function(cvg, val)
{
	var tab = cvg.tab;
	if(cvg.fmt==1) return tab.indexOf(val);
	if(cvg.fmt==2) {
		var ind = Typr._lctf.getInterval(tab, val);
		if(ind!=-1) return tab[ind+2] + (val - tab[ind]);
	}
	return -1;
}

Typr._lctf.readFeatureList = function(data, offset)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = [];
	
	var count = bin.readUshort(data, offset);  offset+=2;
	
	for(var i=0; i<count; i++)
	{
		var tag = bin.readASCII(data, offset, 4);  offset+=4;
		var noff = bin.readUshort(data, offset);  offset+=2;
		obj.push({tag: tag.trim(), tab:Typr._lctf.readFeatureTable(data, offset0 + noff)});
	}
	return obj;
}

Typr._lctf.readFeatureTable = function(data, offset)
{
	var bin = Typr._bin;
	
	var featureParams = bin.readUshort(data, offset);  offset+=2;	// = 0
	var lookupCount = bin.readUshort(data, offset);  offset+=2;
	
	var indices = [];
	for(var i=0; i<lookupCount; i++) indices.push(bin.readUshort(data, offset+2*i));
	return indices;
}


Typr._lctf.readScriptList = function(data, offset)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = {};
	
	var count = bin.readUshort(data, offset);  offset+=2;
	
	for(var i=0; i<count; i++)
	{
		var tag = bin.readASCII(data, offset, 4);  offset+=4;
		var noff = bin.readUshort(data, offset);  offset+=2;
		obj[tag.trim()] = Typr._lctf.readScriptTable(data, offset0 + noff);
	}
	return obj;
}

Typr._lctf.readScriptTable = function(data, offset)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = {};
	
	var defLangSysOff = bin.readUshort(data, offset);  offset+=2;
	obj.default = Typr._lctf.readLangSysTable(data, offset0 + defLangSysOff);
	
	var langSysCount = bin.readUshort(data, offset);  offset+=2;
	
	for(var i=0; i<langSysCount; i++)
	{
		var tag = bin.readASCII(data, offset, 4);  offset+=4;
		var langSysOff = bin.readUshort(data, offset);  offset+=2;
		obj[tag.trim()] = Typr._lctf.readLangSysTable(data, offset0 + langSysOff);
	}
	return obj;
}

Typr._lctf.readLangSysTable = function(data, offset)
{
	var bin = Typr._bin;
	var obj = {};
	
	var lookupOrder = bin.readUshort(data, offset);  offset+=2;
	//if(lookupOrder!=0)  throw "lookupOrder not 0";
	obj.reqFeature = bin.readUshort(data, offset);  offset+=2;
	//if(obj.reqFeature != 0xffff) throw "reqFeatureIndex != 0xffff";
	
	//console.log(lookupOrder, obj.reqFeature);
	
	var featureCount = bin.readUshort(data, offset);  offset+=2;
	obj.features = bin.readUshorts(data, offset, featureCount);
	return obj;
}

	Typr.CFF = {};
	Typr.CFF.parse = function(data, offset, length)
	{
		var bin = Typr._bin;
		
		data = new Uint8Array(data.buffer, offset, length);
		offset = 0;
		
		// Header
		var major = data[offset];  offset++;
		var minor = data[offset];  offset++;
		var hdrSize = data[offset];  offset++;
		var offsize = data[offset];  offset++;
		//console.log(major, minor, hdrSize, offsize);
		
		// Name INDEX
		var ninds = [];
		offset = Typr.CFF.readIndex(data, offset, ninds);
		var names = [];
		
		for(var i=0; i<ninds.length-1; i++) names.push(bin.readASCII(data, offset+ninds[i], ninds[i+1]-ninds[i]));
		offset += ninds[ninds.length-1];
		
		
		// Top DICT INDEX
		var tdinds = [];
		offset = Typr.CFF.readIndex(data, offset, tdinds);  //console.log(tdinds);
		// Top DICT Data
		var topDicts = [];
		for(var i=0; i<tdinds.length-1; i++) topDicts.push( Typr.CFF.readDict(data, offset+tdinds[i], offset+tdinds[i+1]) );
		offset += tdinds[tdinds.length-1];
		var topdict = topDicts[0];
		//console.log(topdict);
		
		// String INDEX
		var sinds = [];
		offset = Typr.CFF.readIndex(data, offset, sinds);
		// String Data
		var strings = [];
		for(var i=0; i<sinds.length-1; i++) strings.push(bin.readASCII(data, offset+sinds[i], sinds[i+1]-sinds[i]));
		offset += sinds[sinds.length-1];
		
		// Global Subr INDEX  (subroutines)		
		Typr.CFF.readSubrs(data, offset, topdict);
		
		// charstrings
		if(topdict.CharStrings)
		{
			offset = topdict.CharStrings;
			var sinds = [];
			offset = Typr.CFF.readIndex(data, offset, sinds);
			
			var cstr = [];
			for(var i=0; i<sinds.length-1; i++) cstr.push(bin.readBytes(data, offset+sinds[i], sinds[i+1]-sinds[i]));
			//offset += sinds[sinds.length-1];
			topdict.CharStrings = cstr;
			//console.log(topdict.CharStrings);
		}
		
		// CID font
		if(topdict.ROS) {
			offset = topdict.FDArray;
			var fdind = [];
			offset = Typr.CFF.readIndex(data, offset, fdind);
			
			topdict.FDArray = [];
			for(var i=0; i<fdind.length-1; i++) {
				var dict = Typr.CFF.readDict(data, offset+fdind[i], offset+fdind[i+1]);
				Typr.CFF._readFDict(data, dict, strings);
				topdict.FDArray.push( dict );
			}
			offset += fdind[fdind.length-1];
			
			offset = topdict.FDSelect;
			topdict.FDSelect = [];
			var fmt = data[offset];  offset++;
			if(fmt==3) {
				var rns = bin.readUshort(data, offset);  offset+=2;
				for(var i=0; i<rns+1; i++) {
					topdict.FDSelect.push(bin.readUshort(data, offset), data[offset+2]);  offset+=3;
				}
			}
			else throw fmt;
		}
		
		// Encoding
		if(topdict.Encoding) topdict.Encoding = Typr.CFF.readEncoding(data, topdict.Encoding, topdict.CharStrings.length);
		
		// charset
		if(topdict.charset ) topdict.charset  = Typr.CFF.readCharset (data, topdict.charset , topdict.CharStrings.length);
		
		Typr.CFF._readFDict(data, topdict, strings);
		return topdict;
	}
	Typr.CFF._readFDict = function(data, dict, ss) {
		var offset;
		if(dict.Private) {
			offset = dict.Private[1];
			dict.Private = Typr.CFF.readDict(data, offset, offset+dict.Private[0]);
			if(dict.Private.Subrs)  Typr.CFF.readSubrs(data, offset+dict.Private.Subrs, dict.Private);
		}
		for(var p in dict) if(["FamilyName","FontName","FullName","Notice","version","Copyright"].indexOf(p)!=-1)  dict[p]=ss[dict[p] -426 + 35];
	}
	
	Typr.CFF.readSubrs = function(data, offset, obj)
	{
		var bin = Typr._bin;
		var gsubinds = [];
		offset = Typr.CFF.readIndex(data, offset, gsubinds);
		
		var bias, nSubrs = gsubinds.length;
		if (false) bias = 0;
		else if (nSubrs <  1240) bias = 107;
		else if (nSubrs < 33900) bias = 1131;
		else bias = 32768;
		obj.Bias = bias;
		
		obj.Subrs = [];
		for(var i=0; i<gsubinds.length-1; i++) obj.Subrs.push(bin.readBytes(data, offset+gsubinds[i], gsubinds[i+1]-gsubinds[i]));
		//offset += gsubinds[gsubinds.length-1];
	}
	
	Typr.CFF.tableSE = [
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      1,   2,   3,   4,   5,   6,   7,   8,
      9,  10,  11,  12,  13,  14,  15,  16,
     17,  18,  19,  20,  21,  22,  23,  24,
     25,  26,  27,  28,  29,  30,  31,  32,
     33,  34,  35,  36,  37,  38,  39,  40,
     41,  42,  43,  44,  45,  46,  47,  48,
     49,  50,  51,  52,  53,  54,  55,  56,
     57,  58,  59,  60,  61,  62,  63,  64,
     65,  66,  67,  68,  69,  70,  71,  72,
     73,  74,  75,  76,  77,  78,  79,  80,
     81,  82,  83,  84,  85,  86,  87,  88,
     89,  90,  91,  92,  93,  94,  95,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,  96,  97,  98,  99, 100, 101, 102,
    103, 104, 105, 106, 107, 108, 109, 110,
      0, 111, 112, 113, 114,   0, 115, 116,
    117, 118, 119, 120, 121, 122,   0, 123,
      0, 124, 125, 126, 127, 128, 129, 130,
    131,   0, 132, 133,   0, 134, 135, 136,
    137,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0, 138,   0, 139,   0,   0,   0,   0,
    140, 141, 142, 143,   0,   0,   0,   0,
      0, 144,   0,   0,   0, 145,   0,   0,
    146, 147, 148, 149,   0,   0,   0,   0
  ];
  
	Typr.CFF.glyphByUnicode = function(cff, code)
	{
		for(var i=0; i<cff.charset.length; i++) if(cff.charset[i]==code) return i;
		return -1;
	}
	
	Typr.CFF.glyphBySE = function(cff, charcode)	// glyph by standard encoding
	{
		if ( charcode < 0 || charcode > 255 ) return -1;
		return Typr.CFF.glyphByUnicode(cff, Typr.CFF.tableSE[charcode]);		
	}
	
	Typr.CFF.readEncoding = function(data, offset, num)
	{
		var bin = Typr._bin;
		
		var array = ['.notdef'];
		var format = data[offset];  offset++;
		//console.log("Encoding");
		//console.log(format);
		
		if(format==0)
		{
			var nCodes = data[offset];  offset++;
			for(var i=0; i<nCodes; i++)  array.push(data[offset+i]);
		}
		/*
		else if(format==1 || format==2)
		{
			while(charset.length<num)
			{
				var first = bin.readUshort(data, offset);  offset+=2;
				var nLeft=0;
				if(format==1) {  nLeft = data[offset];  offset++;  }
				else          {  nLeft = bin.readUshort(data, offset);  offset+=2;  }
				for(var i=0; i<=nLeft; i++)  {  charset.push(first);  first++;  }
			}
		}
		*/
		else throw "error: unknown encoding format: " + format;
		
		return array;
	}

	Typr.CFF.readCharset = function(data, offset, num)
	{
		var bin = Typr._bin;
		
		var charset = ['.notdef'];
		var format = data[offset];  offset++;
		
		if(format==0)
		{
			for(var i=0; i<num; i++) 
			{
				var first = bin.readUshort(data, offset);  offset+=2;
				charset.push(first);
			}
		}
		else if(format==1 || format==2)
		{
			while(charset.length<num)
			{
				var first = bin.readUshort(data, offset);  offset+=2;
				var nLeft=0;
				if(format==1) {  nLeft = data[offset];  offset++;  }
				else          {  nLeft = bin.readUshort(data, offset);  offset+=2;  }
				for(var i=0; i<=nLeft; i++)  {  charset.push(first);  first++;  }
			}
		}
		else throw "error: format: " + format;
		
		return charset;
	}

	Typr.CFF.readIndex = function(data, offset, inds)
	{
		var bin = Typr._bin;
		
		var count = bin.readUshort(data, offset)+1;  offset+=2;
		var offsize = data[offset];  offset++;
		
		if     (offsize==1) for(var i=0; i<count; i++) inds.push( data[offset+i] );
		else if(offsize==2) for(var i=0; i<count; i++) inds.push( bin.readUshort(data, offset+i*2) );
		else if(offsize==3) for(var i=0; i<count; i++) inds.push( bin.readUint  (data, offset+i*3 - 1) & 0x00ffffff );
		else if(count!=1) throw "unsupported offset size: " + offsize + ", count: " + count;
		
		offset += count*offsize;
		return offset-1;
	}
	
	Typr.CFF.getCharString = function(data, offset, o)
	{
		var bin = Typr._bin;
		
		var b0 = data[offset], b1 = data[offset+1], b2 = data[offset+2], b3 = data[offset+3], b4=data[offset+4];
		var vs = 1;
		var op=null, val=null;
		// operand
		if(b0<=20) { op = b0;  vs=1;  }
		if(b0==12) { op = b0*100+b1;  vs=2;  }
		//if(b0==19 || b0==20) { op = b0/*+" "+b1*/;  vs=2; }
		if(21 <=b0 && b0<= 27) { op = b0;  vs=1; }
		if(b0==28) { val = bin.readShort(data,offset+1);  vs=3; }
		if(29 <=b0 && b0<= 31) { op = b0;  vs=1; }
		if(32 <=b0 && b0<=246) { val = b0-139;  vs=1; }
		if(247<=b0 && b0<=250) { val = (b0-247)*256+b1+108;  vs=2; }
		if(251<=b0 && b0<=254) { val =-(b0-251)*256-b1-108;  vs=2; }
		if(b0==255) {  val = bin.readInt(data, offset+1)/0xffff;  vs=5;   }
		
		o.val = val!=null ? val : "o"+op;
		o.size = vs;
	}
	
	Typr.CFF.readCharString = function(data, offset, length)
	{
		var end = offset + length;
		var bin = Typr._bin;
		var arr = [];
		
		while(offset<end)
		{
			var b0 = data[offset], b1 = data[offset+1], b2 = data[offset+2], b3 = data[offset+3], b4=data[offset+4];
			var vs = 1;
			var op=null, val=null;
			// operand
			if(b0<=20) { op = b0;  vs=1;  }
			if(b0==12) { op = b0*100+b1;  vs=2;  }
			if(b0==19 || b0==20) { op = b0/*+" "+b1*/;  vs=2; }
			if(21 <=b0 && b0<= 27) { op = b0;  vs=1; }
			if(b0==28) { val = bin.readShort(data,offset+1);  vs=3; }
			if(29 <=b0 && b0<= 31) { op = b0;  vs=1; }
			if(32 <=b0 && b0<=246) { val = b0-139;  vs=1; }
			if(247<=b0 && b0<=250) { val = (b0-247)*256+b1+108;  vs=2; }
			if(251<=b0 && b0<=254) { val =-(b0-251)*256-b1-108;  vs=2; }
			if(b0==255) {  val = bin.readInt(data, offset+1)/0xffff;  vs=5;   }
			
			arr.push(val!=null ? val : "o"+op);
			offset += vs;	

			//var cv = arr[arr.length-1];
			//if(cv==undefined) throw "error";
			//console.log()
		}	
		return arr;
	}

	Typr.CFF.readDict = function(data, offset, end)
	{
		var bin = Typr._bin;
		//var dict = [];
		var dict = {};
		var carr = [];
		
		while(offset<end)
		{
			var b0 = data[offset], b1 = data[offset+1], b2 = data[offset+2], b3 = data[offset+3], b4=data[offset+4];
			var vs = 1;
			var key=null, val=null;
			// operand
			if(b0==28) { val = bin.readShort(data,offset+1);  vs=3; }
			if(b0==29) { val = bin.readInt  (data,offset+1);  vs=5; }
			if(32 <=b0 && b0<=246) { val = b0-139;  vs=1; }
			if(247<=b0 && b0<=250) { val = (b0-247)*256+b1+108;  vs=2; }
			if(251<=b0 && b0<=254) { val =-(b0-251)*256-b1-108;  vs=2; }
			if(b0==255) {  val = bin.readInt(data, offset+1)/0xffff;  vs=5;  throw "unknown number";  }
			
			if(b0==30) 
			{  
				var nibs = [];
				vs = 1;
				while(true)
				{
					var b = data[offset+vs];  vs++;
					var nib0 = b>>4, nib1 = b&0xf;
					if(nib0 != 0xf) nibs.push(nib0);  if(nib1!=0xf) nibs.push(nib1);
					if(nib1==0xf) break;
				}
				var s = "";
				var chars = [0,1,2,3,4,5,6,7,8,9,".","e","e-","reserved","-","endOfNumber"];
				for(var i=0; i<nibs.length; i++) s += chars[nibs[i]];
				//console.log(nibs);
				val = parseFloat(s);
			}
			
			if(b0<=21)	// operator
			{
				var keys = ["version", "Notice", "FullName", "FamilyName", "Weight", "FontBBox", "BlueValues", "OtherBlues", "FamilyBlues","FamilyOtherBlues",
					"StdHW", "StdVW", "escape", "UniqueID", "XUID", "charset", "Encoding", "CharStrings", "Private", "Subrs", 
					"defaultWidthX", "nominalWidthX"];
					
				key = keys[b0];  vs=1;
				if(b0==12) { 
					var keys = [ "Copyright", "isFixedPitch", "ItalicAngle", "UnderlinePosition", "UnderlineThickness", "PaintType", "CharstringType", "FontMatrix", "StrokeWidth", "BlueScale",
					"BlueShift", "BlueFuzz", "StemSnapH", "StemSnapV", "ForceBold", 0,0, "LanguageGroup", "ExpansionFactor", "initialRandomSeed",
					"SyntheticBase", "PostScript", "BaseFontName", "BaseFontBlend", 0,0,0,0,0,0, 
					"ROS", "CIDFontVersion", "CIDFontRevision", "CIDFontType", "CIDCount", "UIDBase", "FDArray", "FDSelect", "FontName"];
					key = keys[b1];  vs=2; 
				}
			}
			
			if(key!=null) {  dict[key] = carr.length==1 ? carr[0] : carr;  carr=[]; }
			else  carr.push(val);  
			
			offset += vs;		
		}	
		return dict;
	}


Typr.cmap = {};
Typr.cmap.parse = function(data, offset, length)
{
	data = new Uint8Array(data.buffer, offset, length);
	offset = 0;

	var offset0 = offset;
	var bin = Typr._bin;
	var obj = {};
	var version   = bin.readUshort(data, offset);  offset += 2;
	var numTables = bin.readUshort(data, offset);  offset += 2;
	
	//console.log(version, numTables);
	
	var offs = [];
	obj.tables = [];
	
	
	for(var i=0; i<numTables; i++)
	{
		var platformID = bin.readUshort(data, offset);  offset += 2;
		var encodingID = bin.readUshort(data, offset);  offset += 2;
		var noffset = bin.readUint(data, offset);       offset += 4;
		
		var id = "p"+platformID+"e"+encodingID;
		
		//console.log("cmap subtable", platformID, encodingID, noffset);
		
		
		var tind = offs.indexOf(noffset);
		
		if(tind==-1)
		{
			tind = obj.tables.length;
			var subt;
			offs.push(noffset);
			var format = bin.readUshort(data, noffset);
			if     (format== 0) subt = Typr.cmap.parse0(data, noffset);
			else if(format== 4) subt = Typr.cmap.parse4(data, noffset);
			else if(format== 6) subt = Typr.cmap.parse6(data, noffset);
			else if(format==12) subt = Typr.cmap.parse12(data,noffset);
			else console.log("unknown format: "+format, platformID, encodingID, noffset);
			obj.tables.push(subt);
		}
		
		if(obj[id]!=null) throw "multiple tables for one platform+encoding";
		obj[id] = tind;
	}
	return obj;
}

Typr.cmap.parse0 = function(data, offset)
{
	var bin = Typr._bin;
	var obj = {};
	obj.format = bin.readUshort(data, offset);  offset += 2;
	var len    = bin.readUshort(data, offset);  offset += 2;
	var lang   = bin.readUshort(data, offset);  offset += 2;
	obj.map = [];
	for(var i=0; i<len-6; i++) obj.map.push(data[offset+i]);
	return obj;
}

Typr.cmap.parse4 = function(data, offset)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = {};
	
	obj.format = bin.readUshort(data, offset);  offset+=2;
	var length = bin.readUshort(data, offset);  offset+=2;
	var language = bin.readUshort(data, offset);  offset+=2;
	var segCountX2 = bin.readUshort(data, offset);  offset+=2;
	var segCount = segCountX2/2;
	obj.searchRange = bin.readUshort(data, offset);  offset+=2;
	obj.entrySelector = bin.readUshort(data, offset);  offset+=2;
	obj.rangeShift = bin.readUshort(data, offset);  offset+=2;
	obj.endCount   = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
	offset+=2;
	obj.startCount = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
	obj.idDelta = [];
	for(var i=0; i<segCount; i++) {obj.idDelta.push(bin.readShort(data, offset));  offset+=2;}
	obj.idRangeOffset = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
	obj.glyphIdArray = [];
	while(offset< offset0+length) {obj.glyphIdArray.push(bin.readUshort(data, offset));  offset+=2;}
	return obj;
}

Typr.cmap.parse6 = function(data, offset)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = {};
	
	obj.format = bin.readUshort(data, offset);  offset+=2;
	var length = bin.readUshort(data, offset);  offset+=2;
	var language = bin.readUshort(data, offset);  offset+=2;
	obj.firstCode = bin.readUshort(data, offset);  offset+=2;
	var entryCount = bin.readUshort(data, offset);  offset+=2;
	obj.glyphIdArray = [];
	for(var i=0; i<entryCount; i++) {obj.glyphIdArray.push(bin.readUshort(data, offset));  offset+=2;}
	
	return obj;
}

Typr.cmap.parse12 = function(data, offset)
{
	var bin = Typr._bin;
	var offset0 = offset;
	var obj = {};
	
	obj.format = bin.readUshort(data, offset);  offset+=2;
	offset += 2;
	var length = bin.readUint(data, offset);  offset+=4;
	var lang   = bin.readUint(data, offset);  offset+=4;
	var nGroups= bin.readUint(data, offset);  offset+=4;
	obj.groups = [];
	
	for(var i=0; i<nGroups; i++)  
	{
		var off = offset + i * 12;
		var startCharCode = bin.readUint(data, off+0);
		var endCharCode   = bin.readUint(data, off+4);
		var startGlyphID  = bin.readUint(data, off+8);
		obj.groups.push([  startCharCode, endCharCode, startGlyphID  ]);
	}
	return obj;
}

Typr.glyf = {};
Typr.glyf.parse = function(data, offset, length, font)
{
	var obj = [];
	for(var g=0; g<font.maxp.numGlyphs; g++) obj.push(null);
	return obj;
}

Typr.glyf._parseGlyf = function(font, g)
{
	var bin = Typr._bin;
	var data = font._data;
	
	var offset = Typr._tabOffset(data, "glyf", font._offset) + font.loca[g];
		
	if(font.loca[g]==font.loca[g+1]) return null;
		
	var gl = {};
		
	gl.noc  = bin.readShort(data, offset);  offset+=2;		// number of contours
	gl.xMin = bin.readShort(data, offset);  offset+=2;
	gl.yMin = bin.readShort(data, offset);  offset+=2;
	gl.xMax = bin.readShort(data, offset);  offset+=2;
	gl.yMax = bin.readShort(data, offset);  offset+=2;
	
	if(gl.xMin>=gl.xMax || gl.yMin>=gl.yMax) return null;
		
	if(gl.noc>0)
	{
		gl.endPts = [];
		for(var i=0; i<gl.noc; i++) { gl.endPts.push(bin.readUshort(data,offset)); offset+=2; }
		
		var instructionLength = bin.readUshort(data,offset); offset+=2;
		if((data.length-offset)<instructionLength) return null;
		gl.instructions = bin.readBytes(data, offset, instructionLength);   offset+=instructionLength;
		
		var crdnum = gl.endPts[gl.noc-1]+1;
		gl.flags = [];
		for(var i=0; i<crdnum; i++ ) 
		{ 
			var flag = data[offset];  offset++; 
			gl.flags.push(flag); 
			if((flag&8)!=0)
			{
				var rep = data[offset];  offset++;
				for(var j=0; j<rep; j++) { gl.flags.push(flag); i++; }
			}
		}
		gl.xs = [];
		for(var i=0; i<crdnum; i++) {
			var i8=((gl.flags[i]&2)!=0), same=((gl.flags[i]&16)!=0);  
			if(i8) { gl.xs.push(same ? data[offset] : -data[offset]);  offset++; }
			else
			{
				if(same) gl.xs.push(0);
				else { gl.xs.push(bin.readShort(data, offset));  offset+=2; }
			}
		}
		gl.ys = [];
		for(var i=0; i<crdnum; i++) {
			var i8=((gl.flags[i]&4)!=0), same=((gl.flags[i]&32)!=0);  
			if(i8) { gl.ys.push(same ? data[offset] : -data[offset]);  offset++; }
			else
			{
				if(same) gl.ys.push(0);
				else { gl.ys.push(bin.readShort(data, offset));  offset+=2; }
			}
		}
		var x = 0, y = 0;
		for(var i=0; i<crdnum; i++) { x += gl.xs[i]; y += gl.ys[i];  gl.xs[i]=x;  gl.ys[i]=y; }
		//console.log(endPtsOfContours, instructionLength, instructions, flags, xCoordinates, yCoordinates);
	}
	else
	{
		var ARG_1_AND_2_ARE_WORDS	= 1<<0;
		var ARGS_ARE_XY_VALUES		= 1<<1;
		var ROUND_XY_TO_GRID		= 1<<2;
		var WE_HAVE_A_SCALE			= 1<<3;
		var RESERVED				= 1<<4;
		var MORE_COMPONENTS			= 1<<5;
		var WE_HAVE_AN_X_AND_Y_SCALE= 1<<6;
		var WE_HAVE_A_TWO_BY_TWO	= 1<<7;
		var WE_HAVE_INSTRUCTIONS	= 1<<8;
		var USE_MY_METRICS			= 1<<9;
		var OVERLAP_COMPOUND		= 1<<10;
		var SCALED_COMPONENT_OFFSET	= 1<<11;
		var UNSCALED_COMPONENT_OFFSET	= 1<<12;
		
		gl.parts = [];
		var flags;
		do {
			flags = bin.readUshort(data, offset);  offset += 2;
			var part = { m:{a:1,b:0,c:0,d:1,tx:0,ty:0}, p1:-1, p2:-1 };  gl.parts.push(part);
			part.glyphIndex = bin.readUshort(data, offset);  offset += 2;
			if ( flags & ARG_1_AND_2_ARE_WORDS) {
				var arg1 = bin.readShort(data, offset);  offset += 2;
				var arg2 = bin.readShort(data, offset);  offset += 2;
			} else {
				var arg1 = bin.readInt8(data, offset);  offset ++;
				var arg2 = bin.readInt8(data, offset);  offset ++;
			}
			
			if(flags & ARGS_ARE_XY_VALUES) { part.m.tx = arg1;  part.m.ty = arg2; }
			else  {  part.p1=arg1;  part.p2=arg2;  }
			//part.m.tx = arg1;  part.m.ty = arg2;
			//else { throw "params are not XY values"; }
			
			if ( flags & WE_HAVE_A_SCALE ) {
				part.m.a = part.m.d = bin.readF2dot14(data, offset);  offset += 2;    
			} else if ( flags & WE_HAVE_AN_X_AND_Y_SCALE ) {
				part.m.a = bin.readF2dot14(data, offset);  offset += 2; 
				part.m.d = bin.readF2dot14(data, offset);  offset += 2; 
			} else if ( flags & WE_HAVE_A_TWO_BY_TWO ) {
				part.m.a = bin.readF2dot14(data, offset);  offset += 2; 
				part.m.b = bin.readF2dot14(data, offset);  offset += 2; 
				part.m.c = bin.readF2dot14(data, offset);  offset += 2; 
				part.m.d = bin.readF2dot14(data, offset);  offset += 2; 
			}
		} while ( flags & MORE_COMPONENTS ) 
		if (flags & WE_HAVE_INSTRUCTIONS){
			var numInstr = bin.readUshort(data, offset);  offset += 2;
			gl.instr = [];
			for(var i=0; i<numInstr; i++) { gl.instr.push(data[offset]);  offset++; }
		}
	}
	return gl;
}


Typr.GPOS = {};
Typr.GPOS.parse = function(data, offset, length, font) {  return Typr._lctf.parse(data, offset, length, font, Typr.GPOS.subt);  }


Typr.GPOS.subt = function(data, ltype, offset)	// lookup type
{
	var bin = Typr._bin, offset0 = offset, tab = {};
	
	tab.fmt  = bin.readUshort(data, offset);  offset+=2;
	
	//console.log(ltype, tab.fmt);
	
	if(ltype==1 || ltype==2 || ltype==3 || ltype==7 || (ltype==8 && tab.fmt<=2)) {
		var covOff  = bin.readUshort(data, offset);  offset+=2;
		tab.coverage = Typr._lctf.readCoverage(data, covOff+offset0);
	}
	if(ltype==1 && tab.fmt==1) {
		var valFmt1 = bin.readUshort(data, offset);  offset+=2;
		var ones1 = Typr._lctf.numOfOnes(valFmt1);
		if(valFmt1!=0)  tab.pos = Typr.GPOS.readValueRecord(data, offset, valFmt1);
	}
	else if(ltype==2) {
		var valFmt1 = bin.readUshort(data, offset);  offset+=2;
		var valFmt2 = bin.readUshort(data, offset);  offset+=2;
		var ones1 = Typr._lctf.numOfOnes(valFmt1);
		var ones2 = Typr._lctf.numOfOnes(valFmt2);
		if(tab.fmt==1)
		{
			tab.pairsets = [];
			var psc = bin.readUshort(data, offset);  offset+=2;  // PairSetCount
			
			for(var i=0; i<psc; i++)
			{
				var psoff = offset0 + bin.readUshort(data, offset);  offset+=2;
				
				var pvc = bin.readUshort(data, psoff);  psoff+=2;
				var arr = [];
				for(var j=0; j<pvc; j++)
				{
					var gid2 = bin.readUshort(data, psoff);  psoff+=2;
					var value1, value2;
					if(valFmt1!=0) {  value1 = Typr.GPOS.readValueRecord(data, psoff, valFmt1);  psoff+=ones1*2;  }
					if(valFmt2!=0) {  value2 = Typr.GPOS.readValueRecord(data, psoff, valFmt2);  psoff+=ones2*2;  }
					//if(value1!=null) throw "e";
					arr.push({gid2:gid2, val1:value1, val2:value2});
				}
				tab.pairsets.push(arr);
			}
		}
		if(tab.fmt==2)
		{
			var classDef1 = bin.readUshort(data, offset);  offset+=2;
			var classDef2 = bin.readUshort(data, offset);  offset+=2;
			var class1Count = bin.readUshort(data, offset);  offset+=2;
			var class2Count = bin.readUshort(data, offset);  offset+=2;
			
			tab.classDef1 = Typr._lctf.readClassDef(data, offset0 + classDef1);
			tab.classDef2 = Typr._lctf.readClassDef(data, offset0 + classDef2);
			
			tab.matrix = [];
			for(var i=0; i<class1Count; i++)
			{
				var row = [];
				for(var j=0; j<class2Count; j++)
				{
					var value1 = null, value2 = null;
					if(tab.valFmt1!=0) { value1 = Typr.GPOS.readValueRecord(data, offset, tab.valFmt1);  offset+=ones1*2; }
					if(tab.valFmt2!=0) { value2 = Typr.GPOS.readValueRecord(data, offset, tab.valFmt2);  offset+=ones2*2; }
					row.push({val1:value1, val2:value2});
				}
				tab.matrix.push(row);
			}
		}
	}
	else if(ltype==4) {
		
	}
	return tab;
}


Typr.GPOS.readValueRecord = function(data, offset, valFmt)
{
	var bin = Typr._bin;
	var arr = [];
	arr.push( (valFmt&1) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&1) ? 2 : 0;  // X_PLACEMENT
	arr.push( (valFmt&2) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&2) ? 2 : 0;  // Y_PLACEMENT
	arr.push( (valFmt&4) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&4) ? 2 : 0;  // X_ADVANCE
	arr.push( (valFmt&8) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&8) ? 2 : 0;  // Y_ADVANCE
	return arr;
}

Typr.GSUB = {};
Typr.GSUB.parse = function(data, offset, length, font) {  return Typr._lctf.parse(data, offset, length, font, Typr.GSUB.subt);  }


Typr.GSUB.subt = function(data, ltype, offset)	// lookup type
{
	var bin = Typr._bin, offset0 = offset, tab = {};
	
	tab.fmt  = bin.readUshort(data, offset);  offset+=2;
	
	if(ltype!=1 && ltype!=4 && ltype!=5 && ltype!=6) return null;
	
	if(ltype==1 || ltype==4 || (ltype==5 && tab.fmt<=2) || (ltype==6 && tab.fmt<=2)) {
		var covOff  = bin.readUshort(data, offset);  offset+=2;
		tab.coverage = Typr._lctf.readCoverage(data, offset0+covOff);	// not always is coverage here
	}
	
	if(false) {}
	//  Single Substitution Subtable
	else if(ltype==1) {	
		if(tab.fmt==1) {
			tab.delta = bin.readShort(data, offset);  offset+=2;
		}
		else if(tab.fmt==2) {
			var cnt = bin.readUshort(data, offset);  offset+=2;
			tab.newg = bin.readUshorts(data, offset, cnt);  offset+=tab.newg.length*2;
		}
	}
	//  Ligature Substitution Subtable
	else if(ltype==4) {
		tab.vals = [];
		var cnt = bin.readUshort(data, offset);  offset+=2;
		for(var i=0; i<cnt; i++) {
			var loff = bin.readUshort(data, offset);  offset+=2;
			tab.vals.push(Typr.GSUB.readLigatureSet(data, offset0+loff));
		}
		//console.log(tab.coverage);
		//console.log(tab.vals);
	} 
	//  Contextual Substitution Subtable
	else if(ltype==5) {
		if(tab.fmt==2) {
			var cDefOffset = bin.readUshort(data, offset);  offset+=2;
			tab.cDef = Typr._lctf.readClassDef(data, offset0 + cDefOffset);
			tab.scset = [];
			var subClassSetCount = bin.readUshort(data, offset);  offset+=2;
			for(var i=0; i<subClassSetCount; i++)
			{
				var scsOff = bin.readUshort(data, offset);  offset+=2;
				tab.scset.push(  scsOff==0 ? null : Typr.GSUB.readSubClassSet(data, offset0 + scsOff)  );
			}
		}
		//else console.log("unknown table format", tab.fmt);
	}
	//*
	else if(ltype==6) {
		/*
		if(tab.fmt==2) {
			var btDef = bin.readUshort(data, offset);  offset+=2;
			var inDef = bin.readUshort(data, offset);  offset+=2;
			var laDef = bin.readUshort(data, offset);  offset+=2;
			
			tab.btDef = Typr._lctf.readClassDef(data, offset0 + btDef);
			tab.inDef = Typr._lctf.readClassDef(data, offset0 + inDef);
			tab.laDef = Typr._lctf.readClassDef(data, offset0 + laDef);
			
			tab.scset = [];
			var cnt = bin.readUshort(data, offset);  offset+=2;
			for(var i=0; i<cnt; i++) {
				var loff = bin.readUshort(data, offset);  offset+=2;
				tab.scset.push(Typr.GSUB.readChainSubClassSet(data, offset0+loff));
			}
		}
		*/
		if(tab.fmt==3) {
			for(var i=0; i<3; i++) {
				var cnt = bin.readUshort(data, offset);  offset+=2;
				var cvgs = [];
				for(var j=0; j<cnt; j++) cvgs.push(  Typr._lctf.readCoverage(data, offset0 + bin.readUshort(data, offset+j*2))   );
				offset+=cnt*2;
				if(i==0) tab.backCvg = cvgs;
				if(i==1) tab.inptCvg = cvgs;
				if(i==2) tab.ahedCvg = cvgs;
			}
			var cnt = bin.readUshort(data, offset);  offset+=2;
			tab.lookupRec = Typr.GSUB.readSubstLookupRecords(data, offset, cnt);
		}
		//console.log(tab);
	} //*/
	//if(tab.coverage.indexOf(3)!=-1) console.log(ltype, fmt, tab);
	
	return tab;
}

Typr.GSUB.readSubClassSet = function(data, offset)
{
	var rUs = Typr._bin.readUshort, offset0 = offset, lset = [];
	var cnt = rUs(data, offset);  offset+=2;
	for(var i=0; i<cnt; i++) {
		var loff = rUs(data, offset);  offset+=2;
		lset.push(Typr.GSUB.readSubClassRule(data, offset0+loff));
	}
	return lset;
}
Typr.GSUB.readSubClassRule= function(data, offset)
{
	var rUs = Typr._bin.readUshort, offset0 = offset, rule = {};
	var gcount = rUs(data, offset);  offset+=2;
	var scount = rUs(data, offset);  offset+=2;
	rule.input = [];
	for(var i=0; i<gcount-1; i++) {
		rule.input.push(rUs(data, offset));  offset+=2;
	}
	rule.substLookupRecords = Typr.GSUB.readSubstLookupRecords(data, offset, scount);
	return rule;
}
Typr.GSUB.readSubstLookupRecords = function(data, offset, cnt)
{
	var rUs = Typr._bin.readUshort;
	var out = [];
	for(var i=0; i<cnt; i++) {  out.push(rUs(data, offset), rUs(data, offset+2));  offset+=4;  }
	return out;
}

Typr.GSUB.readChainSubClassSet = function(data, offset)
{
	var bin = Typr._bin, offset0 = offset, lset = [];
	var cnt = bin.readUshort(data, offset);  offset+=2;
	for(var i=0; i<cnt; i++) {
		var loff = bin.readUshort(data, offset);  offset+=2;
		lset.push(Typr.GSUB.readChainSubClassRule(data, offset0+loff));
	}
	return lset;
}
Typr.GSUB.readChainSubClassRule= function(data, offset)
{
	var bin = Typr._bin, offset0 = offset, rule = {};
	var pps = ["backtrack", "input", "lookahead"];
	for(var pi=0; pi<pps.length; pi++) {
		var cnt = bin.readUshort(data, offset);  offset+=2;  if(pi==1) cnt--;
		rule[pps[pi]]=bin.readUshorts(data, offset, cnt);  offset+= rule[pps[pi]].length*2;
	}
	var cnt = bin.readUshort(data, offset);  offset+=2;
	rule.subst = bin.readUshorts(data, offset, cnt*2);  offset += rule.subst.length*2;
	return rule;
}

Typr.GSUB.readLigatureSet = function(data, offset)
{
	var bin = Typr._bin, offset0 = offset, lset = [];
	var lcnt = bin.readUshort(data, offset);  offset+=2;
	for(var j=0; j<lcnt; j++) {
		var loff = bin.readUshort(data, offset);  offset+=2;
		lset.push(Typr.GSUB.readLigature(data, offset0+loff));
	}
	return lset;
}
Typr.GSUB.readLigature = function(data, offset)
{
	var bin = Typr._bin, lig = {chain:[]};
	lig.nglyph = bin.readUshort(data, offset);  offset+=2;
	var ccnt = bin.readUshort(data, offset);  offset+=2;
	for(var k=0; k<ccnt-1; k++) {  lig.chain.push(bin.readUshort(data, offset));  offset+=2;  }
	return lig;
}



Typr.head = {};
Typr.head.parse = function(data, offset, length)
{
	var bin = Typr._bin;
	var obj = {};
	var tableVersion = bin.readFixed(data, offset);  offset += 4;
	obj.fontRevision = bin.readFixed(data, offset);  offset += 4;
	var checkSumAdjustment = bin.readUint(data, offset);  offset += 4;
	var magicNumber = bin.readUint(data, offset);  offset += 4;
	obj.flags = bin.readUshort(data, offset);  offset += 2;
	obj.unitsPerEm = bin.readUshort(data, offset);  offset += 2;
	obj.created  = bin.readUint64(data, offset);  offset += 8;
	obj.modified = bin.readUint64(data, offset);  offset += 8;
	obj.xMin = bin.readShort(data, offset);  offset += 2;
	obj.yMin = bin.readShort(data, offset);  offset += 2;
	obj.xMax = bin.readShort(data, offset);  offset += 2;
	obj.yMax = bin.readShort(data, offset);  offset += 2;
	obj.macStyle = bin.readUshort(data, offset);  offset += 2;
	obj.lowestRecPPEM = bin.readUshort(data, offset);  offset += 2;
	obj.fontDirectionHint = bin.readShort(data, offset);  offset += 2;
	obj.indexToLocFormat  = bin.readShort(data, offset);  offset += 2;
	obj.glyphDataFormat   = bin.readShort(data, offset);  offset += 2;
	return obj;
}


Typr.hhea = {};
Typr.hhea.parse = function(data, offset, length)
{
	var bin = Typr._bin;
	var obj = {};
	var tableVersion = bin.readFixed(data, offset);  offset += 4;
	obj.ascender  = bin.readShort(data, offset);  offset += 2;
	obj.descender = bin.readShort(data, offset);  offset += 2;
	obj.lineGap = bin.readShort(data, offset);  offset += 2;
	
	obj.advanceWidthMax = bin.readUshort(data, offset);  offset += 2;
	obj.minLeftSideBearing  = bin.readShort(data, offset);  offset += 2;
	obj.minRightSideBearing = bin.readShort(data, offset);  offset += 2;
	obj.xMaxExtent = bin.readShort(data, offset);  offset += 2;
	
	obj.caretSlopeRise = bin.readShort(data, offset);  offset += 2;
	obj.caretSlopeRun  = bin.readShort(data, offset);  offset += 2;
	obj.caretOffset    = bin.readShort(data, offset);  offset += 2;
	
	offset += 4*2;
	
	obj.metricDataFormat = bin.readShort (data, offset);  offset += 2;
	obj.numberOfHMetrics = bin.readUshort(data, offset);  offset += 2;
	return obj;
}


Typr.hmtx = {};
Typr.hmtx.parse = function(data, offset, length, font)
{
	var bin = Typr._bin;
	var obj = {};
	
	obj.aWidth = [];
	obj.lsBearing = [];
	
	
	var aw = 0, lsb = 0;
	
	for(var i=0; i<font.maxp.numGlyphs; i++)
	{
		if(i<font.hhea.numberOfHMetrics) {  aw=bin.readUshort(data, offset);  offset += 2;  lsb=bin.readShort(data, offset);  offset+=2;  }
		obj.aWidth.push(aw);
		obj.lsBearing.push(lsb);
	}
	
	return obj;
}


Typr.kern = {};
Typr.kern.parse = function(data, offset, length, font)
{
	var bin = Typr._bin;
	
	var version = bin.readUshort(data, offset);  offset+=2;
	if(version==1) return Typr.kern.parseV1(data, offset-2, length, font);
	var nTables = bin.readUshort(data, offset);  offset+=2;
	
	var map = {glyph1: [], rval:[]};
	for(var i=0; i<nTables; i++)
	{
		offset+=2;	// skip version
		var length  = bin.readUshort(data, offset);  offset+=2;
		var coverage = bin.readUshort(data, offset);  offset+=2;
		var format = coverage>>>8;
		/* I have seen format 128 once, that's why I do */ format &= 0xf;
		if(format==0) offset = Typr.kern.readFormat0(data, offset, map);
		else throw "unknown kern table format: "+format;
	}
	return map;
}

Typr.kern.parseV1 = function(data, offset, length, font)
{
	var bin = Typr._bin;
	
	var version = bin.readFixed(data, offset);  offset+=4;
	var nTables = bin.readUint(data, offset);  offset+=4;
	
	var map = {glyph1: [], rval:[]};
	for(var i=0; i<nTables; i++)
	{
		var length = bin.readUint(data, offset);   offset+=4;
		var coverage = bin.readUshort(data, offset);  offset+=2;
		var tupleIndex = bin.readUshort(data, offset);  offset+=2;
		var format = coverage>>>8;
		/* I have seen format 128 once, that's why I do */ format &= 0xf;
		if(format==0) offset = Typr.kern.readFormat0(data, offset, map);
		else throw "unknown kern table format: "+format;
	}
	return map;
}

Typr.kern.readFormat0 = function(data, offset, map)
{
	var bin = Typr._bin;
	var pleft = -1;
	var nPairs        = bin.readUshort(data, offset);  offset+=2;
	var searchRange   = bin.readUshort(data, offset);  offset+=2;
	var entrySelector = bin.readUshort(data, offset);  offset+=2;
	var rangeShift    = bin.readUshort(data, offset);  offset+=2;
	for(var j=0; j<nPairs; j++)
	{
		var left  = bin.readUshort(data, offset);  offset+=2;
		var right = bin.readUshort(data, offset);  offset+=2;
		var value = bin.readShort (data, offset);  offset+=2;
		if(left!=pleft) { map.glyph1.push(left);  map.rval.push({ glyph2:[], vals:[] }) }
		var rval = map.rval[map.rval.length-1];
		rval.glyph2.push(right);   rval.vals.push(value);
		pleft = left;
	}
	return offset;
}



Typr.loca = {};
Typr.loca.parse = function(data, offset, length, font)
{
	var bin = Typr._bin;
	var obj = [];
	
	var ver = font.head.indexToLocFormat;
	//console.log("loca", ver, length, 4*font.maxp.numGlyphs);
	var len = font.maxp.numGlyphs+1;
	
	if(ver==0) for(var i=0; i<len; i++) obj.push(bin.readUshort(data, offset+(i<<1))<<1);
	if(ver==1) for(var i=0; i<len; i++) obj.push(bin.readUint  (data, offset+(i<<2))   );
	
	return obj;
}


Typr.maxp = {};
Typr.maxp.parse = function(data, offset, length)
{
	//console.log(data.length, offset, length);
	
	var bin = Typr._bin;
	var obj = {};
	
	// both versions 0.5 and 1.0
	var ver = bin.readUint(data, offset); offset += 4;
	obj.numGlyphs = bin.readUshort(data, offset);  offset += 2;
	
	// only 1.0
	if(ver == 0x00010000)
	{
		obj.maxPoints             = bin.readUshort(data, offset);  offset += 2;
		obj.maxContours           = bin.readUshort(data, offset);  offset += 2;
		obj.maxCompositePoints    = bin.readUshort(data, offset);  offset += 2;
		obj.maxCompositeContours  = bin.readUshort(data, offset);  offset += 2;
		obj.maxZones              = bin.readUshort(data, offset);  offset += 2;
		obj.maxTwilightPoints     = bin.readUshort(data, offset);  offset += 2;
		obj.maxStorage            = bin.readUshort(data, offset);  offset += 2;
		obj.maxFunctionDefs       = bin.readUshort(data, offset);  offset += 2;
		obj.maxInstructionDefs    = bin.readUshort(data, offset);  offset += 2;
		obj.maxStackElements      = bin.readUshort(data, offset);  offset += 2;
		obj.maxSizeOfInstructions = bin.readUshort(data, offset);  offset += 2;
		obj.maxComponentElements  = bin.readUshort(data, offset);  offset += 2;
		obj.maxComponentDepth     = bin.readUshort(data, offset);  offset += 2;
	}
	
	return obj;
}


Typr.name = {};
Typr.name.parse = function(data, offset, length)
{
	var bin = Typr._bin;
	var obj = {};
	var format = bin.readUshort(data, offset);  offset += 2;
	var count  = bin.readUshort(data, offset);  offset += 2;
	var stringOffset = bin.readUshort(data, offset);  offset += 2;
	
	//console.log(format,count);
	
	var names = [
		"copyright",
		"fontFamily",
		"fontSubfamily",
		"ID",
		"fullName",
		"version",
		"postScriptName",
		"trademark",
		"manufacturer",
		"designer",
		"description",
		"urlVendor",
		"urlDesigner",
		"licence",
		"licenceURL",
		"---",
		"typoFamilyName",
		"typoSubfamilyName",
		"compatibleFull",
		"sampleText",
		"postScriptCID",
		"wwsFamilyName",
		"wwsSubfamilyName",
		"lightPalette",
		"darkPalette"
	];
	
	var offset0 = offset;
	
	for(var i=0; i<count; i++)
	{
		var platformID = bin.readUshort(data, offset);  offset += 2;
		var encodingID = bin.readUshort(data, offset);  offset += 2;
		var languageID = bin.readUshort(data, offset);  offset += 2;
		var nameID     = bin.readUshort(data, offset);  offset += 2;
		var slen       = bin.readUshort(data, offset);  offset += 2;
		var noffset    = bin.readUshort(data, offset);  offset += 2;
		//console.log(platformID, encodingID, languageID.toString(16), nameID, length, noffset);
		
		var cname = names[nameID];
		var soff = offset0 + count*12 + noffset;
		var str;
		if(false){}
		else if(platformID == 0) str = bin.readUnicode(data, soff, slen/2);
		else if(platformID == 3 && encodingID == 0) str = bin.readUnicode(data, soff, slen/2);
		else if(encodingID == 0) str = bin.readASCII  (data, soff, slen);
		else if(encodingID == 1) str = bin.readUnicode(data, soff, slen/2);
		else if(encodingID == 3) str = bin.readUnicode(data, soff, slen/2);
		
		else if(platformID == 1) { str = bin.readASCII(data, soff, slen);  console.log("reading unknown MAC encoding "+encodingID+" as ASCII") }
		else throw "unknown encoding "+encodingID + ", platformID: "+platformID;
		
		var tid = "p"+platformID+","+(languageID).toString(16);//Typr._platforms[platformID];
		if(obj[tid]==null) obj[tid] = {};
		obj[tid][cname] = str;
		obj[tid]._lang = languageID;
		//console.log(tid, obj[tid]);
	}
	/*
	if(format == 1)
	{
		var langTagCount = bin.readUshort(data, offset);  offset += 2;
		for(var i=0; i<langTagCount; i++)
		{
			var length  = bin.readUshort(data, offset);  offset += 2;
			var noffset = bin.readUshort(data, offset);  offset += 2;
		}
	}
	*/
	
	//console.log(obj);
	
	for(var p in obj) if(obj[p].postScriptName!=null && obj[p]._lang==0x0409) return obj[p];		// United States
	for(var p in obj) if(obj[p].postScriptName!=null && obj[p]._lang==0x0000) return obj[p];		// Universal
	for(var p in obj) if(obj[p].postScriptName!=null && obj[p]._lang==0x0c0c) return obj[p];		// Canada
	for(var p in obj) if(obj[p].postScriptName!=null) return obj[p];
	
	var tname;
	for(var p in obj) { tname=p; break; }
	console.log("returning name table with languageID "+ obj[tname]._lang);
	return obj[tname];
}


Typr["OS/2"] = {};
Typr["OS/2"].parse = function(data, offset, length)
{
	var bin = Typr._bin;
	var ver = bin.readUshort(data, offset); offset += 2;
	
	var obj = {};
	if     (ver==0) Typr["OS/2"].version0(data, offset, obj);
	else if(ver==1) Typr["OS/2"].version1(data, offset, obj);
	else if(ver==2 || ver==3 || ver==4) Typr["OS/2"].version2(data, offset, obj);
	else if(ver==5) Typr["OS/2"].version5(data, offset, obj);
	else throw "unknown OS/2 table version: "+ver;
	
	return obj;
}

Typr["OS/2"].version0 = function(data, offset, obj)
{
	var bin = Typr._bin;
	obj.xAvgCharWidth = bin.readShort(data, offset); offset += 2;
	obj.usWeightClass = bin.readUshort(data, offset); offset += 2;
	obj.usWidthClass  = bin.readUshort(data, offset); offset += 2;
	obj.fsType = bin.readUshort(data, offset); offset += 2;
	obj.ySubscriptXSize = bin.readShort(data, offset); offset += 2;
	obj.ySubscriptYSize = bin.readShort(data, offset); offset += 2;
	obj.ySubscriptXOffset = bin.readShort(data, offset); offset += 2;
	obj.ySubscriptYOffset = bin.readShort(data, offset); offset += 2; 
	obj.ySuperscriptXSize = bin.readShort(data, offset); offset += 2; 
	obj.ySuperscriptYSize = bin.readShort(data, offset); offset += 2; 
	obj.ySuperscriptXOffset = bin.readShort(data, offset); offset += 2;
	obj.ySuperscriptYOffset = bin.readShort(data, offset); offset += 2;
	obj.yStrikeoutSize = bin.readShort(data, offset); offset += 2;
	obj.yStrikeoutPosition = bin.readShort(data, offset); offset += 2;
	obj.sFamilyClass = bin.readShort(data, offset); offset += 2;
	obj.panose = bin.readBytes(data, offset, 10);  offset += 10;
	obj.ulUnicodeRange1	= bin.readUint(data, offset);  offset += 4;
	obj.ulUnicodeRange2	= bin.readUint(data, offset);  offset += 4;
	obj.ulUnicodeRange3	= bin.readUint(data, offset);  offset += 4;
	obj.ulUnicodeRange4	= bin.readUint(data, offset);  offset += 4;
	obj.achVendID = [bin.readInt8(data, offset), bin.readInt8(data, offset+1),bin.readInt8(data, offset+2),bin.readInt8(data, offset+3)];  offset += 4;
	obj.fsSelection	 = bin.readUshort(data, offset); offset += 2;
	obj.usFirstCharIndex = bin.readUshort(data, offset); offset += 2;
	obj.usLastCharIndex = bin.readUshort(data, offset); offset += 2;
	obj.sTypoAscender = bin.readShort(data, offset); offset += 2;
	obj.sTypoDescender = bin.readShort(data, offset); offset += 2;
	obj.sTypoLineGap = bin.readShort(data, offset); offset += 2;
	obj.usWinAscent = bin.readUshort(data, offset); offset += 2;
	obj.usWinDescent = bin.readUshort(data, offset); offset += 2;
	return offset;
}

Typr["OS/2"].version1 = function(data, offset, obj)
{
	var bin = Typr._bin;
	offset = Typr["OS/2"].version0(data, offset, obj);
	
	obj.ulCodePageRange1 = bin.readUint(data, offset); offset += 4;
	obj.ulCodePageRange2 = bin.readUint(data, offset); offset += 4;
	return offset;
}

Typr["OS/2"].version2 = function(data, offset, obj)
{
	var bin = Typr._bin;
	offset = Typr["OS/2"].version1(data, offset, obj);
	
	obj.sxHeight = bin.readShort(data, offset); offset += 2;
	obj.sCapHeight = bin.readShort(data, offset); offset += 2;
	obj.usDefault = bin.readUshort(data, offset); offset += 2;
	obj.usBreak = bin.readUshort(data, offset); offset += 2;
	obj.usMaxContext = bin.readUshort(data, offset); offset += 2;
	return offset;
}

Typr["OS/2"].version5 = function(data, offset, obj)
{
	var bin = Typr._bin;
	offset = Typr["OS/2"].version2(data, offset, obj);

	obj.usLowerOpticalPointSize = bin.readUshort(data, offset); offset += 2;
	obj.usUpperOpticalPointSize = bin.readUshort(data, offset); offset += 2;
	return offset;
}

Typr.post = {};
Typr.post.parse = function(data, offset, length)
{
	var bin = Typr._bin;
	var obj = {};
	
	obj.version           = bin.readFixed(data, offset);  offset+=4;
	obj.italicAngle       = bin.readFixed(data, offset);  offset+=4;
	obj.underlinePosition = bin.readShort(data, offset);  offset+=2;
	obj.underlineThickness = bin.readShort(data, offset);  offset+=2;

	return obj;
}
Typr.SVG = {};
Typr.SVG.parse = function(data, offset, length)
{
	var bin = Typr._bin;
	var obj = { entries: []};

	var offset0 = offset;

	var tableVersion = bin.readUshort(data, offset);	offset += 2;
	var svgDocIndexOffset = bin.readUint(data, offset);	offset += 4;
	var reserved = bin.readUint(data, offset); offset += 4;

	offset = svgDocIndexOffset + offset0;

	var numEntries = bin.readUshort(data, offset);	offset += 2;

	for(var i=0; i<numEntries; i++)
	{
		var startGlyphID = bin.readUshort(data, offset);  offset += 2;
		var endGlyphID   = bin.readUshort(data, offset);  offset += 2;
		var svgDocOffset = bin.readUint  (data, offset);  offset += 4;
		var svgDocLength = bin.readUint  (data, offset);  offset += 4;

		var sbuf = new Uint8Array(data.buffer, offset0 + svgDocOffset + svgDocIndexOffset, svgDocLength);
		var svg = bin.readUTF8(sbuf, 0, sbuf.length);
		
		for(var f=startGlyphID; f<=endGlyphID; f++) {
			obj.entries[f] = svg;
		}
	}
	return obj;
}

Typr.SVG.toPath = function(str)
{
	var pth = {cmds:[], crds:[]};
	if(str==null) return pth;
	
	var prsr = new DOMParser();
	var doc = prsr["parseFromString"](str,"image/svg+xml");
	
	var svg = doc.firstChild;  while(svg.tagName!="svg") svg = svg.nextSibling;
	var vb = svg.getAttribute("viewBox");
	if(vb) vb = vb.trim().split(" ").map(parseFloat);  else   vb = [0,0,1000,1000];
	Typr.SVG._toPath(svg.children, pth);
	for(var i=0; i<pth.crds.length; i+=2) {
		var x = pth.crds[i], y = pth.crds[i+1];
		x -= vb[0];
		y -= vb[1];
		y = -y;
		pth.crds[i] = x;
		pth.crds[i+1] = y;
	}
	return pth;
}

Typr.SVG._toPath = function(nds, pth, fill) {
	for(var ni=0; ni<nds.length; ni++) {
		var nd = nds[ni], tn = nd.tagName;
		var cfl = nd.getAttribute("fill");  if(cfl==null) cfl = fill;
		if(tn=="g") Typr.SVG._toPath(nd.children, pth, cfl);
		else if(tn=="path") {
			pth.cmds.push(cfl?cfl:"#000000");
			var d = nd.getAttribute("d");  //console.log(d);
			var toks = Typr.SVG._tokens(d);  //console.log(toks);
			Typr.SVG._toksToPath(toks, pth);  pth.cmds.push("X");
		}
		else if(tn=="defs") {}
		else console.log(tn, nd);
	}
}

Typr.SVG._tokens = function(d) {
	var ts = [], off = 0, rn=false, cn="";  // reading number, current number
	while(off<d.length){
		var cc=d.charCodeAt(off), ch = d.charAt(off);  off++;
		var isNum = (48<=cc && cc<=57) || ch=="." || ch=="-";
		
		if(rn) {
			if(ch=="-") {  ts.push(parseFloat(cn));  cn=ch;  }
			else if(isNum) cn+=ch;
			else {  ts.push(parseFloat(cn));  if(ch!="," && ch!=" ") ts.push(ch);  rn=false;  }
		}
		else {
			if(isNum) {  cn=ch;  rn=true;  }
			else if(ch!="," && ch!=" ") ts.push(ch);
		}
	}
	if(rn) ts.push(parseFloat(cn));
	return ts;
}

Typr.SVG._toksToPath = function(ts, pth) {	
	var i = 0, x = 0, y = 0, ox = 0, oy = 0;
	var pc = {"M":2,"L":2,"H":1,"V":1,   "S":4,   "C":6};
	var cmds = pth.cmds, crds = pth.crds;
	
	while(i<ts.length) {
		var cmd = ts[i];  i++;
		
		if(cmd=="z") {  cmds.push("Z");  x=ox;  y=oy;  }
		else {
			var cmu = cmd.toUpperCase();
			var ps = pc[cmu], reps = Typr.SVG._reps(ts, i, ps);
		
			for(var j=0; j<reps; j++) {
				var xi = 0, yi = 0;   if(cmd!=cmu) {  xi=x;  yi=y;  }
				
				if(false) {}
				else if(cmu=="M") {  x = xi+ts[i++];  y = yi+ts[i++];  cmds.push("M");  crds.push(x,y);  ox=x;  oy=y; }
				else if(cmu=="L") {  x = xi+ts[i++];  y = yi+ts[i++];  cmds.push("L");  crds.push(x,y);  }
				else if(cmu=="H") {  x = xi+ts[i++];                   cmds.push("L");  crds.push(x,y);  }
				else if(cmu=="V") {  y = yi+ts[i++];                   cmds.push("L");  crds.push(x,y);  }
				else if(cmu=="C") {
					var x1=xi+ts[i++], y1=yi+ts[i++], x2=xi+ts[i++], y2=yi+ts[i++], x3=xi+ts[i++], y3=yi+ts[i++];
					cmds.push("C");  crds.push(x1,y1,x2,y2,x3,y3);  x=x3;  y=y3;
				}
				else if(cmu=="S") {
					var co = Math.max(crds.length-4, 0);
					var x1 = x+x-crds[co], y1 = y+y-crds[co+1];
					var x2=xi+ts[i++], y2=yi+ts[i++], x3=xi+ts[i++], y3=yi+ts[i++];  
					cmds.push("C");  crds.push(x1,y1,x2,y2,x3,y3);  x=x3;  y=y3;
				}
				else console.log("Unknown SVG command "+cmd);
			}
		}
	}
}
Typr.SVG._reps = function(ts, off, ps) {
	var i = off;
	while(i<ts.length) {  if((typeof ts[i]) == "string") break;  i+=ps;  }
	return (i-off)/ps;
}
// End Typr.js

// Begin Typr.U.js

if(Typr  ==null) Typr   = {};
if(Typr.U==null) Typr.U = {};


Typr.U.codeToGlyph = function(font, code)
{
	var cmap = font.cmap;
	
	var tind = -1;
	if(cmap.p0e4!=null) tind = cmap.p0e4;
	else if(cmap.p3e1!=null) tind = cmap.p3e1;
	else if(cmap.p1e0!=null) tind = cmap.p1e0;
	else if(cmap.p0e3!=null) tind = cmap.p0e3;
	
	if(tind==-1) throw "no familiar platform and encoding!";
	
	var tab = cmap.tables[tind];
	
	if(tab.format==0)
	{
		if(code>=tab.map.length) return 0;
		return tab.map[code];
	}
	else if(tab.format==4)
	{
		var sind = -1;
		for(var i=0; i<tab.endCount.length; i++)   if(code<=tab.endCount[i]){  sind=i;  break;  } 
		if(sind==-1) return 0;
		if(tab.startCount[sind]>code) return 0;
		
		var gli = 0;
		if(tab.idRangeOffset[sind]!=0) gli = tab.glyphIdArray[(code-tab.startCount[sind]) + (tab.idRangeOffset[sind]>>1) - (tab.idRangeOffset.length-sind)];
		else                           gli = code + tab.idDelta[sind];
		return gli & 0xFFFF;
	}
	else if(tab.format==12)
	{
		if(code>tab.groups[tab.groups.length-1][1]) return 0;
		for(var i=0; i<tab.groups.length; i++)
		{
			var grp = tab.groups[i];
			if(grp[0]<=code && code<=grp[1]) return grp[2] + (code-grp[0]);
		}
		return 0;
	}
	else throw "unknown cmap table format "+tab.format;
}


Typr.U.glyphToPath = function(font, gid)
{
	var path = { cmds:[], crds:[] };
	if(font.SVG && font.SVG.entries[gid]) {
		var p = font.SVG.entries[gid];  if(p==null) return path;
		if(typeof p == "string") {  p = Typr.SVG.toPath(p);  font.SVG.entries[gid]=p;  }
		return p;
	}
	else if(font.CFF) {
		var state = {x:0,y:0,stack:[],nStems:0,haveWidth:false,width: font.CFF.Private ? font.CFF.Private.defaultWidthX : 0,open:false};
		var cff=font.CFF, pdct = font.CFF.Private;
		if(cff.ROS) {
			var gi = 0;
			while(cff.FDSelect[gi+2]<=gid) gi+=2;
			pdct = cff.FDArray[cff.FDSelect[gi+1]].Private;
		}
		Typr.U._drawCFF(font.CFF.CharStrings[gid], state, cff, pdct, path);
	}
	else if(font.glyf) {  Typr.U._drawGlyf(gid, font, path);  }
	return path;
}

Typr.U._drawGlyf = function(gid, font, path)
{
	var gl = font.glyf[gid];
	if(gl==null) gl = font.glyf[gid] = Typr.glyf._parseGlyf(font, gid);
	if(gl!=null){
		if(gl.noc>-1) Typr.U._simpleGlyph(gl, path);
		else          Typr.U._compoGlyph (gl, font, path);
	}
}
Typr.U._simpleGlyph = function(gl, p)
{
	for(var c=0; c<gl.noc; c++)
	{
		var i0 = (c==0) ? 0 : (gl.endPts[c-1] + 1);
		var il = gl.endPts[c];
		
		for(var i=i0; i<=il; i++)
		{
			var pr = (i==i0)?il:(i-1);
			var nx = (i==il)?i0:(i+1);
			var onCurve = gl.flags[i]&1;
			var prOnCurve = gl.flags[pr]&1;
			var nxOnCurve = gl.flags[nx]&1;
			
			var x = gl.xs[i], y = gl.ys[i];
			
			if(i==i0) { 
				if(onCurve)  
				{
					if(prOnCurve) Typr.U.P.moveTo(p, gl.xs[pr], gl.ys[pr]); 
					else          {  Typr.U.P.moveTo(p,x,y);  continue;  /*  will do curveTo at il  */  }
				}
				else        
				{
					if(prOnCurve) Typr.U.P.moveTo(p,  gl.xs[pr],       gl.ys[pr]        );
					else          Typr.U.P.moveTo(p, (gl.xs[pr]+x)/2, (gl.ys[pr]+y)/2   ); 
				}
			}
			if(onCurve)
			{
				if(prOnCurve) Typr.U.P.lineTo(p,x,y);
			}
			else
			{
				if(nxOnCurve) Typr.U.P.qcurveTo(p, x, y, gl.xs[nx], gl.ys[nx]); 
				else          Typr.U.P.qcurveTo(p, x, y, (x+gl.xs[nx])/2, (y+gl.ys[nx])/2); 
			}
		}
		Typr.U.P.closePath(p);
	}
}
Typr.U._compoGlyph = function(gl, font, p)
{
	for(var j=0; j<gl.parts.length; j++)
	{
		var path = { cmds:[], crds:[] };
		var prt = gl.parts[j];
		Typr.U._drawGlyf(prt.glyphIndex, font, path);
		
		var m = prt.m;
		for(var i=0; i<path.crds.length; i+=2)
		{
			var x = path.crds[i  ], y = path.crds[i+1];
			p.crds.push(x*m.a + y*m.b + m.tx);
			p.crds.push(x*m.c + y*m.d + m.ty);
		}
		for(var i=0; i<path.cmds.length; i++) p.cmds.push(path.cmds[i]);
	}
}


Typr.U._getGlyphClass = function(g, cd)
{
	var intr = Typr._lctf.getInterval(cd, g);
	return intr==-1 ? 0 : cd[intr+2];
	//for(var i=0; i<cd.start.length; i++) 
	//	if(cd.start[i]<=g && cd.end[i]>=g) return cd.class[i];
	//return 0;
}

Typr.U.getPairAdjustment = function(font, g1, g2)
{
	//return 0;
	if(font.GPOS) {
		var gpos = font["GPOS"];
		var llist = gpos.lookupList, flist = gpos.featureList;
		var tused = [];
		for(var i=0; i<flist.length; i++) 
		{
			var fl = flist[i];  //console.log(fl);
			if(fl.tag!="kern") continue;
			for(var ti=0; ti<fl.tab.length; ti++) {
				if(tused[fl.tab[ti]]) continue;  tused[fl.tab[ti]] = true;
				var tab = llist[fl.tab[ti]];
				//console.log(tab);
				
				for(var j=0; j<tab.tabs.length; j++)
				{
					if(tab.tabs[i]==null) continue;
					var ltab = tab.tabs[j], ind;
					if(ltab.coverage) {  ind = Typr._lctf.coverageIndex(ltab.coverage, g1);  if(ind==-1) continue;  }
					
					if(tab.ltype==1) {
						//console.log(ltab);
					}
					else if(tab.ltype==2)
					{
						var adj;
						if(ltab.fmt==1)
						{
							var right = ltab.pairsets[ind];
							for(var i=0; i<right.length; i++) if(right[i].gid2==g2) adj = right[i];
						}
						else if(ltab.fmt==2)
						{
							var c1 = Typr.U._getGlyphClass(g1, ltab.classDef1);
							var c2 = Typr.U._getGlyphClass(g2, ltab.classDef2);
							adj = ltab.matrix[c1][c2];
						}
						//if(adj) console.log(ltab, adj);
						if(adj && adj.val2) return adj.val2[2];
					}
				}
			}
		}
	}
	if(font.kern)
	{
		var ind1 = font.kern.glyph1.indexOf(g1);
		if(ind1!=-1)
		{
			var ind2 = font.kern.rval[ind1].glyph2.indexOf(g2);
			if(ind2!=-1) return font.kern.rval[ind1].vals[ind2];
		}
	}
	
	return 0;
}

Typr.U.stringToGlyphs = function(font, str)
{
	var gls = [];
	for(var i=0; i<str.length; i++) {
		var cc = str.codePointAt(i);  if(cc>0xffff) i++;
		gls.push(Typr.U.codeToGlyph(font, cc));
	}
	for(var i=0; i<str.length; i++) {
		var cc = str.codePointAt(i);  //
		if(cc==2367) {  var t=gls[i-1];  gls[i-1]=gls[i];  gls[i]=t;  }
		//if(cc==2381) {  var t=gls[i+1];  gls[i+1]=gls[i];  gls[i]=t;  }
		if(cc>0xffff) i++;
	}
	//console.log(gls.slice(0));
	
	//console.log(gls);  return gls;
	
	var gsub = font["GSUB"];  if(gsub==null) return gls;
	var llist = gsub.lookupList, flist = gsub.featureList;
	
	var cligs = ["rlig", "liga", "mset",  "isol","init","fina","medi",   "half", "pres", 
				"blws" /* Tibetan fonts like Himalaya.ttf */ ];
	
	//console.log(gls.slice(0));
	var tused = [];
	for(var fi=0; fi<flist.length; fi++)
	{
		var fl = flist[fi];  if(cligs.indexOf(fl.tag)==-1) continue;
		//if(fl.tag=="blwf") continue;
		//console.log(fl);
		//console.log(fl.tag);
		for(var ti=0; ti<fl.tab.length; ti++) {
			if(tused[fl.tab[ti]]) continue;  tused[fl.tab[ti]] = true;
			var tab = llist[fl.tab[ti]];
			//console.log(fl.tab[ti], tab.ltype);
			//console.log(fl.tag, tab);
			for(var ci=0; ci<gls.length; ci++) {
				var feat = Typr.U._getWPfeature(str, ci);
				if("isol,init,fina,medi".indexOf(fl.tag)!=-1 && fl.tag!=feat) continue;
				
				Typr.U._applySubs(gls, ci, tab, llist);
			}
		}
	}
	
	return gls;
}
Typr.U._getWPfeature = function(str, ci) {  // get Word Position feature
	var wsep = "\n\t\" ,.:;!?()  ،";
	var R = "آأؤإاةدذرزوٱٲٳٵٶٷڈډڊڋڌڍڎڏڐڑڒړڔڕږڗژڙۀۃۄۅۆۇۈۉۊۋۍۏےۓەۮۯܐܕܖܗܘܙܞܨܪܬܯݍݙݚݛݫݬݱݳݴݸݹࡀࡆࡇࡉࡔࡧࡩࡪࢪࢫࢬࢮࢱࢲࢹૅેૉ૊૎૏ૐ૑૒૝ૡ૤૯஁ஃ஄அஉ஌எஏ஑னப஫஬";
	var L = "ꡲ્૗";
	
	var slft = ci==0            || wsep.indexOf(str[ci-1])!=-1;
	var srgt = ci==str.length-1 || wsep.indexOf(str[ci+1])!=-1;
		
	if(!slft && R.indexOf(str[ci-1])!=-1) slft=true;
	if(!srgt && R.indexOf(str[ci  ])!=-1) srgt=true;
		
	if(!srgt && L.indexOf(str[ci+1])!=-1) srgt=true;
	if(!slft && L.indexOf(str[ci  ])!=-1) slft=true;
		
	var feat = null;
	if(slft) feat = srgt ? "isol" : "init";
	else     feat = srgt ? "fina" : "medi";
	
	return feat;
}
Typr.U._applySubs = function(gls, ci, tab, llist) {
	var rlim = gls.length-ci-1;
	//if(ci==0) console.log("++++ ", tab.ltype);
	for(var j=0; j<tab.tabs.length; j++)
	{
		if(tab.tabs[j]==null) continue;
		var ltab = tab.tabs[j], ind;
		if(ltab.coverage) {  ind = Typr._lctf.coverageIndex(ltab.coverage, gls[ci]);  if(ind==-1) continue;  }
		//if(ci==0) console.log(ind, ltab);
		//*
		if(tab.ltype==1) {
			var gl = gls[ci];
			if(ltab.fmt==1) gls[ci] = gls[ci]+ltab.delta;
			else            gls[ci] = ltab.newg[ind];
			//console.log("applying ... 1", ci, gl, gls[ci]);
		}//*
		else if(tab.ltype==4) {
			var vals = ltab.vals[ind];
			
			for(var k=0; k<vals.length; k++) {
				var lig = vals[k], rl = lig.chain.length;  if(rl>rlim) continue;
				var good = true, em1 = 0;
				for(var l=0; l<rl; l++) {  while(gls[ci+em1+(1+l)]==-1)em1++;  if(lig.chain[l]!=gls[ci+em1+(1+l)]) good=false;  }
				if(!good) continue;
				gls[ci]=lig.nglyph;
				for(var l=0; l<rl+em1; l++) gls[ci+l+1]=-1;   break;  // first character changed, other ligatures do not apply anymore
				//console.log("lig", ci, lig.chain, lig.nglyph);
				//console.log("applying ...");
			}
		}
		else  if(tab.ltype==5 && ltab.fmt==2) {
			var cind = Typr._lctf.getInterval(ltab.cDef, gls[ci]);
			var cls = ltab.cDef[cind+2], scs = ltab.scset[cls]; 
			for(var i=0; i<scs.length; i++) {
				var sc = scs[i], inp = sc.input;
				if(inp.length>rlim) continue;
				var good = true;
				for(var l=0; l<inp.length; l++) {
					var cind2 = Typr._lctf.getInterval(ltab.cDef, gls[ci+1+l]);
					if(cind==-1 && ltab.cDef[cind2+2]!=inp[l]) {  good=false;  break;  }
				}
				if(!good) continue;
				//console.log(ci, gl);
				var lrs = sc.substLookupRecords;
				for(var k=0; k<lrs.length; k+=2)
				{
					var gi = lrs[k], tabi = lrs[k+1];
					//Typr.U._applyType1(gls, ci+gi, llist[tabi]);
					//console.log(tabi, gls[ci+gi], llist[tabi]);
				}
			}
		}
		else if(tab.ltype==6 && ltab.fmt==3) {
			//if(ltab.backCvg.length==0) return;
			if(!Typr.U._glsCovered(gls, ltab.backCvg, ci-ltab.backCvg.length)) continue;
			if(!Typr.U._glsCovered(gls, ltab.inptCvg, ci)) continue;
			if(!Typr.U._glsCovered(gls, ltab.ahedCvg, ci+ltab.inptCvg.length)) continue;
			//console.log(ci, ltab);
			var lr = ltab.lookupRec;  //console.log(ci, gl, lr);
			for(var i=0; i<lr.length; i+=2) {
				var cind = lr[i], tab2 = llist[lr[i+1]];
				//console.log("-", lr[i+1], tab2);
				Typr.U._applySubs(gls, ci+cind, tab2, llist);
			}
		}
		//else console.log("Unknown table", tab.ltype, ltab.fmt);
		//*/
	}
}

Typr.U._glsCovered = function(gls, cvgs, ci) {
	for(var i=0; i<cvgs.length; i++) {
		var ind = Typr._lctf.coverageIndex(cvgs[i], gls[ci+i]);  if(ind==-1) return false;
	}
	return true;
}

Typr.U.glyphsToPath = function(font, gls, clr)
{	
	//gls = gls.reverse();//gls.slice(0,12).concat(gls.slice(12).reverse());
	
	var tpath = {cmds:[], crds:[]};
	var x = 0;
	
	for(var i=0; i<gls.length; i++)
	{
		var gid = gls[i];  if(gid==-1) continue;
		var gid2 = (i<gls.length-1 && gls[i+1]!=-1)  ? gls[i+1] : 0;
		var path = Typr.U.glyphToPath(font, gid);
		for(var j=0; j<path.crds.length; j+=2)
		{
			tpath.crds.push(path.crds[j] + x);
			tpath.crds.push(path.crds[j+1]);
		}
		if(clr) tpath.cmds.push(clr);
		for(var j=0; j<path.cmds.length; j++) tpath.cmds.push(path.cmds[j]);
		if(clr) tpath.cmds.push("X");
		x += font.hmtx.aWidth[gid];// - font.hmtx.lsBearing[gid];
		if(i<gls.length-1) x += Typr.U.getPairAdjustment(font, gid, gid2);
	}
	return tpath;
}

Typr.U.pathToSVG = function(path, prec)
{
	if(prec==null) prec = 5;
	var out = [], co = 0, lmap = {"M":2,"L":2,"Q":4,"C":6};
	for(var i=0; i<path.cmds.length; i++)
	{
		var cmd = path.cmds[i], cn = co+(lmap[cmd]?lmap[cmd]:0);  
		out.push(cmd);
		while(co<cn) {  var c = path.crds[co++];  out.push(parseFloat(c.toFixed(prec))+(co==cn?"":" "));  }
	}
	return out.join("");
}

Typr.U.pathToContext = function(path, ctx)
{
	var c = 0, crds = path.crds;
	
	for(var j=0; j<path.cmds.length; j++)
	{
		var cmd = path.cmds[j];
		if     (cmd=="M") {
			ctx.moveTo(crds[c], crds[c+1]);
			c+=2;
		}
		else if(cmd=="L") {
			ctx.lineTo(crds[c], crds[c+1]);
			c+=2;
		}
		else if(cmd=="C") {
			ctx.bezierCurveTo(crds[c], crds[c+1], crds[c+2], crds[c+3], crds[c+4], crds[c+5]);
			c+=6;
		}
		else if(cmd=="Q") {
			ctx.quadraticCurveTo(crds[c], crds[c+1], crds[c+2], crds[c+3]);
			c+=4;
		}
		else if(cmd.charAt(0)=="#") {
			ctx.beginPath();
			ctx.fillStyle = cmd;
		}
		else if(cmd=="Z") {
			ctx.closePath();
		}
		else if(cmd=="X") {
			ctx.fill();
		}
	}
}


Typr.U.P = {};
Typr.U.P.moveTo = function(p, x, y)
{
	p.cmds.push("M");  p.crds.push(x,y);
}
Typr.U.P.lineTo = function(p, x, y)
{
	p.cmds.push("L");  p.crds.push(x,y);
}
Typr.U.P.curveTo = function(p, a,b,c,d,e,f)
{
	p.cmds.push("C");  p.crds.push(a,b,c,d,e,f);
}
Typr.U.P.qcurveTo = function(p, a,b,c,d)
{
	p.cmds.push("Q");  p.crds.push(a,b,c,d);
}
Typr.U.P.closePath = function(p) {  p.cmds.push("Z");  }




Typr.U._drawCFF = function(cmds, state, font, pdct, p)
{
	var stack = state.stack;
	var nStems = state.nStems, haveWidth=state.haveWidth, width=state.width, open=state.open;
	var i=0;
	var x=state.x, y=state.y, c1x=0, c1y=0, c2x=0, c2y=0, c3x=0, c3y=0, c4x=0, c4y=0, jpx=0, jpy=0;
	
	var o = {val:0,size:0};
	//console.log(cmds);
	while(i<cmds.length)
	{
		Typr.CFF.getCharString(cmds, i, o);
		var v = o.val;
		i += o.size;
			
		if(false) {}
		else if(v=="o1" || v=="o18")  //  hstem || hstemhm
		{
			var hasWidthArg;

			// The number of stem operators on the stack is always even.
			// If the value is uneven, that means a width is specified.
			hasWidthArg = stack.length % 2 !== 0;
			if (hasWidthArg && !haveWidth) {
				width = stack.shift() + pdct.nominalWidthX;
			}

			nStems += stack.length >> 1;
			stack.length = 0;
			haveWidth = true;
		}
		else if(v=="o3" || v=="o23")  // vstem || vstemhm
		{
			var hasWidthArg;

			// The number of stem operators on the stack is always even.
			// If the value is uneven, that means a width is specified.
			hasWidthArg = stack.length % 2 !== 0;
			if (hasWidthArg && !haveWidth) {
				width = stack.shift() + pdct.nominalWidthX;
			}

			nStems += stack.length >> 1;
			stack.length = 0;
			haveWidth = true;
		}
		else if(v=="o4")
		{
			if (stack.length > 1 && !haveWidth) {
                        width = stack.shift() + pdct.nominalWidthX;
                        haveWidth = true;
                    }
			if(open) Typr.U.P.closePath(p);

                    y += stack.pop();
					Typr.U.P.moveTo(p,x,y);   open=true;
		}
		else if(v=="o5")
		{
			while (stack.length > 0) {
                        x += stack.shift();
                        y += stack.shift();
                        Typr.U.P.lineTo(p, x, y);
                    }
		}
		else if(v=="o6" || v=="o7")  // hlineto || vlineto
		{
			var count = stack.length;
			var isX = (v == "o6");
			
			for(var j=0; j<count; j++) {
				var sval = stack.shift();
				
				if(isX) x += sval;  else  y += sval;
				isX = !isX;
				Typr.U.P.lineTo(p, x, y);
			}
		}
		else if(v=="o8" || v=="o24")	// rrcurveto || rcurveline
		{
			var count = stack.length;
			var index = 0;
			while(index+6 <= count) {
				c1x = x + stack.shift();
				c1y = y + stack.shift();
				c2x = c1x + stack.shift();
				c2y = c1y + stack.shift();
				x = c2x + stack.shift();
				y = c2y + stack.shift();
				Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
				index+=6;
			}
			if(v=="o24")
			{
				x += stack.shift();
				y += stack.shift();
				Typr.U.P.lineTo(p, x, y);
			}
		}
		else if(v=="o11")  break;
		else if(v=="o1234" || v=="o1235" || v=="o1236" || v=="o1237")//if((v+"").slice(0,3)=="o12")
		{
			if(v=="o1234")
			{
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
				Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
				Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
				
			}
			if(v=="o1235")
			{
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
				x = c4x + stack.shift();      // dx6
				y = c4y + stack.shift();      // dy6
				stack.shift();                // flex depth
				Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
				Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
			}
			if(v=="o1236")
			{
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
				Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
				Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
			}
			if(v=="o1237")
			{
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
				Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
				Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
			}
		}
		else if(v=="o14")
		{
			if (stack.length > 0 && !haveWidth) {
                        width = stack.shift() + font.nominalWidthX;
                        haveWidth = true;
                    }
			if(stack.length==4) // seac = standard encoding accented character
			{
			
				var asb = 0;
				var adx = stack.shift();
				var ady = stack.shift();
				var bchar = stack.shift();
				var achar = stack.shift();
			
				
				var bind = Typr.CFF.glyphBySE(font, bchar);
				var aind = Typr.CFF.glyphBySE(font, achar);
				
				//console.log(bchar, bind);
				//console.log(achar, aind);
				//state.x=x; state.y=y; state.nStems=nStems; state.haveWidth=haveWidth; state.width=width;  state.open=open;
				
				Typr.U._drawCFF(font.CharStrings[bind], state,font,pdct,p);
				state.x = adx; state.y = ady;
				Typr.U._drawCFF(font.CharStrings[aind], state,font,pdct,p);
				
				//x=state.x; y=state.y; nStems=state.nStems; haveWidth=state.haveWidth; width=state.width;  open=state.open;
			}
			if(open) {  Typr.U.P.closePath(p);  open=false;  }
		}		
		else if(v=="o19" || v=="o20") 
		{ 
			var hasWidthArg;

			// The number of stem operators on the stack is always even.
			// If the value is uneven, that means a width is specified.
			hasWidthArg = stack.length % 2 !== 0;
			if (hasWidthArg && !haveWidth) {
				width = stack.shift() + pdct.nominalWidthX;
			}

			nStems += stack.length >> 1;
			stack.length = 0;
			haveWidth = true;
			
			i += (nStems + 7) >> 3;
		}
		
		else if(v=="o21") {
			if (stack.length > 2 && !haveWidth) {
                        width = stack.shift() + pdct.nominalWidthX;
                        haveWidth = true;
                    }

                    y += stack.pop();
                    x += stack.pop();
					
					if(open) Typr.U.P.closePath(p);
                    Typr.U.P.moveTo(p,x,y);   open=true;
		}
		else if(v=="o22")
		{
			 if (stack.length > 1 && !haveWidth) {
                        width = stack.shift() + pdct.nominalWidthX;
                        haveWidth = true;
                    }
					
                    x += stack.pop();
					
					if(open) Typr.U.P.closePath(p);
					Typr.U.P.moveTo(p,x,y);   open=true;                    
		}
		else if(v=="o25")
		{
			while (stack.length > 6) {
                        x += stack.shift();
                        y += stack.shift();
                        Typr.U.P.lineTo(p, x, y);
                    }

                    c1x = x + stack.shift();
                    c1y = y + stack.shift();
                    c2x = c1x + stack.shift();
                    c2y = c1y + stack.shift();
                    x = c2x + stack.shift();
                    y = c2y + stack.shift();
                    Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
		}
		else if(v=="o26") 
		{
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
                        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
                    }

		}
		else if(v=="o27")
		{
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
                        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
                    }
		}
		else if(v=="o10" || v=="o29")	// callsubr || callgsubr
		{
			var obj = (v=="o10" ? pdct : font);
			if(stack.length==0) { console.log("error: empty stack");  }
			else {
				var ind = stack.pop();
				var subr = obj.Subrs[ ind + obj.Bias ];
				state.x=x; state.y=y; state.nStems=nStems; state.haveWidth=haveWidth; state.width=width;  state.open=open;
				Typr.U._drawCFF(subr, state,font,pdct,p);
				x=state.x; y=state.y; nStems=state.nStems; haveWidth=state.haveWidth; width=state.width;  open=state.open;
			}
		}
		else if(v=="o30" || v=="o31")   // vhcurveto || hvcurveto
		{
			var count, count1 = stack.length;
			var index = 0;
			var alternate = v == "o31";
			
			count  = count1 & ~2;
			index += count1 - count;
			
			while ( index < count ) 
			{
				if(alternate)
				{
					c1x = x + stack.shift();
					c1y = y;
					c2x = c1x + stack.shift();
					c2y = c1y + stack.shift();
					y = c2y + stack.shift();
					if(count-index == 5) {  x = c2x + stack.shift();  index++;  }
					else x = c2x;
					alternate = false;
				}
				else
				{
					c1x = x;
					c1y = y + stack.shift();
					c2x = c1x + stack.shift();
					c2y = c1y + stack.shift();
					x = c2x + stack.shift();
					if(count-index == 5) {  y = c2y + stack.shift();  index++;  }
					else y = c2y;
					alternate = true;
				}
                Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
				index += 4;
			}
		}
		
		else if((v+"").charAt(0)=="o") {   console.log("Unknown operation: "+v, cmds); throw v;  }
		else stack.push(v);
	}
	//console.log(cmds);
	state.x=x; state.y=y; state.nStems=nStems; state.haveWidth=haveWidth; state.width=width; state.open=open;
}

// End Typr.U.js

return Typr

}
