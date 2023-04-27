async function myFn() {
    var one = await get('https://google.com');
    var two = await get('http://nodejs.org');
    var three = JSON.parse(await get('http://jsonip.org'));
    return [
        one,
        two,
        three
    ];
}
