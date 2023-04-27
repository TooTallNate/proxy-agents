baz = foo;
var biz = foo;
function foo() {
    return 42;
}
async function bar() {
    return await baz();
}
async function bir() {
    return await biz();
}
