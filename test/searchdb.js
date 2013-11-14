console.log(require('yase').build({
	input:'searchdb.xml',
	output:'searchdb.ydb',
	author:'yapcheahshen@gmail.com',
	schema:function() {
		this.paragraph("p").attr("p","n",{"depth":1,"sparseval":true});
	}
}));

