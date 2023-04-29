async function foo() {
    return await baz();
}
async function bar() {
    return await foo(baz);
}
async function baz() {
    return await bar();
}
function shouldntChange() {
    return 42;
}
