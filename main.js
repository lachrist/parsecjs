
var truncate = (string) => JSON.stringify((string.length <= 20) ? string : (string.substring(0,20) + "..."));

exports.run = (parser, input) => {
  var [error, result, rest] = parser(input);
  if (error)
    throw new Error(error + "near: " + truncate(rest));
  if (rest)
    throw new Error("Incomplete parsing, rest: " + truncate(rest));
  return result;
}

exports.debug = () => {
  var indent = 0;
  return (parser, name) => (input) => {
    var spaces = Array(++indent).join("    ");
    console.log(spaces + ""+ name + "(" + truncate(input)) + ")";
    var [error, result, rest] = parser(input);
    console.log(spaces + (error ? ("ERROR: " + error) : ("Result: " + JSON.stringify(result))));
    console.log(spaces + "Rest: " + truncate(rest));
    return (indent--, [error, result, rest]);
  }
}

//////////////////////////////////
// First-class monadic function //
//////////////////////////////////

exports.bind = (parser, constructor) => {
  return (input) => {
    var [error, result, rest] = parser(input);
    return error ? [error, null, rest] : (constructor(result)(rest));
  }
};

exports.return = (value) => (input) => [null, value, input];

exports.fail = (error) => (input) => [error, null, input];

/////////////////////
// Monadic helpers //
/////////////////////

exports.then = (parser1, parser2) => exports.bind(parser1, () => parser2);

exports.lift = (parser, f) => exports.bind(parser, (x) => exports.return(f(x)));

/////////////////////////////
// First-class combinators //
/////////////////////////////

exports.oneof = (characters) => {
  var error = "Parsec.oneof(" + JSON.stringify(characters) + ")";
  return (input) => (characters.indexOf(input[0]) !== -1)
    ? [null, input[0], input.substring(1)]
    : [error, null, input];
};

exports.literal = (string) => {
  var error = "Parsec.literal(" + JSON.stringify(string) + ")";
  return (input) => input.startsWith(string)
    ? [null, null, input.substring(string.length)]
    : [error, null, input];
};

exports.regex = (regex) => {
  if (regex.global)
    throw new Error("Parsec.regex does not accept global regexes, got " + regex);
  if (regex.source[0] !== "^")
    throw new Error("Regexes passed to Parsec.regex should start with ^, got " + regex);
  var error = "Parsec.regex(" + regex + ")";
  return (input) => {
    var result = regex.exec(input);
    return result
      ? [null, result[0], input.substring(result[0].length)]
      : [error, null, input];
  };
};

exports.many = (parser) => (input) => {
  var error, result, rest, results = [];
  while (([error, result, rest] = parser(input), !error)) {
    input = rest;
    results.push(result);
  }
  return [null, results, input];
};

exports.choice = (parsers) => (input) => {
  var errors = [];
  for (var i=0; i<parsers.length; i++) {
    var [error, result, rest] = parsers[i](input);
    if (!error)
      return [null, result, rest];
    errors.push(error);
  }
  return ["Parsec.choice(" + errors.join(",") + ")", null, input];
};

////////////////////////
// Helper combinators //
////////////////////////

exports.some = (parser) => exports.bind(parser,
  (x0) => exports.lift(exports.many(parser), Array.prototype.concat.bind([x0])));

exports.Spaces = exports.many(exports.oneof(" \t\n"));

exports.keyword = (keyword) => exports.then(exports.Spaces, exports.literal(keyword));

exports.separate = (parser, separator) => exports.choice([
  exports.bind(parser,
    (x0) => exports.lift(exports.many(exports.then(separator, parser)), Array.prototype.concat.bind([x0]))),
  exports.return([])]);

exports.Number = exports.lift(exports.regex(/^[+-]?[0-9]+(\.[0-9]+)?/), JSON.parse);

exports.DoubleQuotedString = exports.lift(exports.regex(/^"(\\.|[^"])*"/), JSON.parse);
