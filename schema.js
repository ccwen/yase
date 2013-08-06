module.exports={
	"TEI": {
			'div':{newslot:false,savepos:true,indexattributes:{ id: {regex: / id="(.*?)"/, allowrepeat: true, depth:1}}},
			'pb':{savepos:true,remove:false,handler:'pb',indexattributes:{ id: {regex: / id="(.*?)"/, allowrepeat: false, depth:2}  } }
	}
}