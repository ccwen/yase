module.exports={
	"TEI": {
			'div':{newslot:false,savepos:true,indexattributes:{ id: {regstr: ' id="(.*?)"', allowrepeat: true, depth:1}}},
			'pb':{savepos:true,remove:false,handler:'pb',indexattributes:{ n: {regstr: ' n="(.*?)"', allowrepeat: false, depth:2}  } }
	},
	"Accelon": {
		'chapter':{newslot:true,savepos:true,savehead:true,indexattributes:{ n: {regstr: ' n="(.*?)"', depth:2}}},		
		'sutra':{newslot:true,savepos:true,savehead:true},
	}
}