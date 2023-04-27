// foo
baz = foo;
var biz = foo;
function foo () {
  return 42;
}

function bar () {
	return baz();
}

function bir () {
	return biz();
}
