
var descriptions = new WeakMap();

exports.description = WeakMap.prototype.get.bind(descriptions);

var register = (parser, description) => {
  descriptions.set(parser, description);
  return parser;
};

var truncate = (string) => JSON.stringify((string.length <= 20) ? string : (string.substring(0,20) + "..."));

exports.run = (parser, input) => {
  var [error, result, rest] = parser(input);
  if (error)
    throw new Error(error + "near: " + truncate(rest));
  if (rest)
    throw new Error("Incomplete parsing, rest: " + truncate(rest));
  return result;
};

exports.debug = () => {
  var indent = 0;
  return (parser, name) => {
    if (!descriptions.has(parser))
      throw new TypeError("Parsec.debug: first argument has to be a parser, got: " + parser);
    var description = name + "@" + descriptions.get(parser);
    return register((input) => {
      var spaces = Array(++indent).join("    ");
      console.log(spaces + description);
      console.log(spaces + Array(description.length+1).join("="));
      console.log(spaces + ">> Input: " + truncate(input));
      var [error, result, rest] = parser(input);
      console.log(spaces + (error ? (">> ERROR: " + error) : (">> Result: " + JSON.stringify(result))));
      console.log(spaces + ">> Rest: " + truncate(rest));
      return (indent--, [error, result, rest]);
    }, description);
  }
};

//////////////////////////////////
// First-class monadic function //
//////////////////////////////////

exports.bind = (parser, constructor) => {
  if (!descriptions.has(parser))
    throw new TypeError("Parsec.bind: first argument has to be a parser, got: " + parser);
  if (typeof constructor !== "function")
    throw new TypeError("Parsec.bind: second argument has to be a function, got: " + constructor);
  var description = "Parsec.bind(" + descriptions.get(parser) + ", " + (constructor.name || "anonymous") + ")"
  return register((input) => {
    var [error, result, rest] = parser(input);
    if (error)
      return [error, null, rest];
    var next = constructor(result);
    if (!descriptions.has(next))
      throw new TypeError("Parsec.bind: second argument should return a parser, got: " + next);
    return next(rest);
  }, description);
};

exports.return = (value) => {
  var description = "Parsec.return(" + JSON.stringify(String(value)) + ")";
  return register((input) => [null, value, input], description);
};

exports.fail = (error) => {
  var description = "Parsec.fail(" + JSON.stringify(String(error)) + ")";
  return register((input) => [error, null, input], description);
};

/////////////////////
// Monadic helpers //
/////////////////////

exports.then = (parser1, parser2) => exports.bind(parser1, () => parser2);

exports.lift = (parser, f) => exports.bind(parser, (x) => exports.return(f(x)));

/////////////////////////////
// First-class combinators //
/////////////////////////////

// String -> Parser Char
exports.oneof = (characters) => {
  if (typeof characters !== "string")
    throw new TypeError("Parsec.oneof: first argument has to be a string, got: " + characters);
  var description = "Parsec.oneof(" + JSON.stringify(characters) + ")";
  return register((input) => (characters.indexOf(input[0]) !== -1)
    ? [null, input[0], input.substring(1)]
    : [description, null, input], description);
};

// String -> Parser Null
exports.literal = (string) => {
  if (typeof string !== "string")
    throw new TypeError("Parsec.literal: first argument has to be a string, got: " + string);
  var description = "Parsec.literal(" + JSON.stringify(string) + ")";
  return register((input) => input.startsWith(string)
    ? [null, null, input.substring(string.length)]
    : [description, null, input], description);
};

// Regexp -> Parser String
exports.regexp = (regexp) => {
  if (!(regexp instanceof RegExp))
    throw new TypeError("Parsec.regexp: first argument has to be a RegExp, got: " + regexp);
  if (regexp.global)
    throw new Error("Parsec.regexp: fist argument cannot be a global RegExp, got " + regexp);
  if (regexp.source[0] !== "^")
    throw new Error("Parsec.regexp: first argument should start with ^, got " + regexp);
  var description = "Parsec.regexp(" + regexp + ")";
  return register((input) => {
    var result = regexp.exec(input);
    return result
      ? [null, result[0], input.substring(result[0].length)]
      : [description, null, input];
  }, description);
};

// Parser a -> Parser [a]
exports.many = (parser) => {
  if (!descriptions.has(parser))
    throw new TypeError("Parsec.many: first argument has to be parser, got: " + parser);
  var description = "Parsec.many(" + descriptions.get(parser) + ")";
  return register((input) => {
    var error, result, rest, results = [];
    while (([error, result, rest] = parser(input), !error)) {
      input = rest;
      results.push(result);
    }
    return [null, results, input];
  }, description);
};

// [Parser a] -> Parser a
exports.choice = (parsers) => {
  if (!Array.isArray(parsers))
    throw new TypeError("Parsec.choice: first argument has to be an array, got: " + parsers);
  var description = "Parsec.choice([" + parsers.map((parser, index) => {
    if (!descriptions.has(parser))
      throw new TypeError("Parsec.choice: first argument has to be an array of parsers, got at index " + index + ": " + parser);
    return descriptions.get(parser);
  }).join(", ") + "])";
  return register((input) => {
    for (var i=0; i<parsers.length; i++) {
      var [error, result, rest] = parsers[i](input);
      if (!error)
        return [null, result, rest];
    }
    return [description, null, input];
  }, description);
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

exports.Number = exports.lift(exports.regexp(/^[+-]?[0-9]+(\.[0-9]+)?/), JSON.parse);

exports.DoubleQuotedString = exports.lift(exports.regexp(/^"(\\.|[^"])*"/), JSON.parse);
