
var Parsec = require("./main.js");

function compare (x, y) {
  if (Array.isArray(x) && Array.isArray(y) && x.length === y.length) {
    for (var i=0; i<x.length; i++)
      if (!compare(x[i], y[i]))
        return false
    return true;
  }
  return x === y;
}

function test (code, input, expected) {
  console.log(code + " >> " + input + " >> " + expected);
  var parser = eval(code);
  var [error, result, rest] = parser(input);
  if (error || rest)
    throw error || ("Rest: " + rest);
  if (!compare(result, expected))
    throw "Expected " + expected + ", got " + result;
}

test("Parsec.Number", "123.456", 123.456);
test("Parsec.DoubleQuotedString", "\"abc\"", "abc");
test("Parsec.literal('yo')", "yo", null);
test("Parsec.oneof('abc')", "a", "a");
test("Parsec.many(Parsec.literal('a'))", "aaa", [null,null,null]);
test("Parsec.Spaces", " \t ", [" ", "\t", " "]);
test("Parsec.keyword('yo')", "  yo", null);
test("Parsec.separate(Parsec.Number, Parsec.keyword(','))", "1,2,3", [1,2,3]);
