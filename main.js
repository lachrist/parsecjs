
/////////////////////////
// Monadic combinators //
/////////////////////////

exports.bind = (parser, constructor) => {
  return (input) => {
    var [error, result, rest] = parser(input);
    return error ? [error] : (constructor(result)(rest));
  }
};

exports.return = (value) => (input) => [null, value, input];

/////////////////////////////
// First-class combinators //
/////////////////////////////

exports.many = (parser) => {
  return (input) => {
    var results = [];
    var [error, result, rest] = parser(input);
    while (!error) {
      results.push(result);
      [error, result, rest] = parser(input = rest);
    }
    return [null, results, input];
  };
};

exports.oneof = (parsers) => {
  return (input) => {
    for (var i=0; i<parsers.length; i++) {
      var [error, result, rest] = parsers[i](input);
      if (!error)
        return [null, result, rest];
    }
    return ["oneof near: " + input.substring(0,20)];
  }
};

exports.literal = (literal) => (input) => input.startsWith(literal) ? [null, null, input.substring(literal.length)] : ["literal " + literal + " near: " + input.substring(0, 20)];

exports.anyof = (characters) => (input) => (characters.indexOf(input[0]) !== -1) ? [null, input[0], input.substring(1)] : ["anyof " + characters + " near: " + input.substring(0, 20)];

exports.regex = (regex) => {
  return (input) => {
    var array = regex.exec(input);
    return array ? [null, array[0], input.substring(array[0].length)] : ["regex " + regex + " near: " + input.substring(0, 20)];
  }
};

////////////////////////
// Helper combinators //
////////////////////////

exports.then = (parser1, parser2) => exports.bind(parser1, () => parser2);

exports.lift = (parser, f) => exports.bind(parser, (x) => exports.return(f(x)));

exports.some = (parser) => exports.bind(parser,
  (x0) => exports.lift(exports.many(parser), (xs) => (xs.unshift(x0), xs)));

exports.Blanks = exports.many(exports.anyof(" \t\n"));

exports.keyword = (keyword) => exports.then(exports.Blanks, exports.literal(keyword));

exports.separate = (parser, separator) => exports.bind(parser,
  (x0) => exports.lift(exports.many(exports.then(exports.keyword(separator), parser)),
    (xs) => (xs.unshift(x0), xs)));

exports.Number = exports.lift(exports.regex(/^[+-]?[0-9]+(\.[0-9]+)?/) , JSON.parse);

exports.String = exports.lift(exports.regex(/^"(\\.|[^"])*"/), JSON.parse);

