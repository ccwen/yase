console.log(require('yase').build({
	input:'search-test-db.xml',
	output:'search-test-db.ydb',
	author:'yapcheahshen@gmail.com',
	schema:function() {
		this.paragraph("p").attr("p","n",{"depth":1,"sparseval":true});
	}
}));

