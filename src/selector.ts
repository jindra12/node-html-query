/*

fragment Newline
    : '\n'
    | '\r\n'
    | '\r'
    | '\f'
    ;

fragment Hex
    : [0-9a-fA-F]
    ;

fragment Unicode
    : '\\' Hex Hex? Hex? Hex? Hex? Hex? NewlineOrSpace
    ;

fragment Escape
    : Unicode
    | '\\' ~[\r\n\f0-9a-fA-F]
    ;

fragment Nonascii
    : ~[\u0000-\u007f]
    ;

Plus
    : '+'
    ;

Minus
    : '-'
    ;

Greater
    : '>'
    ;

Comma
    : ','
    ;

Tilde
    : '~'
    ;

PseudoNot
    : ':' N O T '('
    ;

Number
    : [0-9]+
    | [0-9]* '.' [0-9]+
    ;

Includes
    : '~='
    ;

Space
    : [ \t\r\n\f]+
    ;

String_
    : '"' ( ~[\n\r\f\\"] | '\\' Newline | Nonascii | Escape )* '"'
    | '\'' ( ~[\n\r\f\\'] | '\\' Newline | Nonascii | Escape )* '\''
    ;

PrefixMatch
    : '^='
    ;

SuffixMatch
    : '$='
    ;

SubstringMatch
    : '*='
    ;

fragment Nmchar
    : [_a-zA-Z0-9\-]
    | Nonascii
    | Escape
    ;

fragment Nmstart
    : [_a-zA-Z]
    | Nonascii
    | Escape
    ;

Function_
    : Ident '('
    ;

Hash
    : '#' Name
    ;

// Give Ident least priority so that more specific rules matches first
Ident
    : '-'? Nmstart Nmchar*
    ;

 */

/*
selectorGroup
    : selector ( Comma ws selector )*
    ;

selector
    : simpleSelectorSequence ws ( combinator simpleSelectorSequence ws )*
    ;

combinator
    : Plus ws
    | Greater ws
    | Tilde ws
    | Space ws
    ;

simpleSelectorSequence
    : ( typeSelector | universal ) ( Hash | className | attrib | pseudo | negation )*
    | ( Hash | className | attrib | pseudo | negation )+
    ;

typeSelector
    : typeNamespacePrefix? elementName
    ;

typeNamespacePrefix
    : ( ident | '*' )? '|'
    ;

elementName
    : ident
    ;

universal
    : typeNamespacePrefix? '*'
    ;

className
    : '.' ident
    ;

attrib
    : '[' ws typeNamespacePrefix? ident ws ( ( PrefixMatch | SuffixMatch | SubstringMatch | '=' | Includes | DashMatch ) ws ( ident | String_ ) ws )? ']'
    ;

pseudo
    // '::' starts a pseudo-element, ':' a pseudo-class
    // Exceptions: :first-line, :first-letter, :before And :after.
    // Note that pseudo-elements are restricted to one per selector And
    // occur MediaOnly in the last simple_selector_sequence.
    : ':' ':'? ( ident | functionalPseudo )
    ;

functionalPseudo
    : Function_ ws expression ')'
    ;

expression
    // In CSS3, the expressions are identifiers, strings,
    // or of the form "an+b"
    : ( ( Plus | Minus | Dimension | UnknownDimension | Number | String_ | ident ) ws )+
    ;

negation
    : PseudoNot ws negationArg ws ')'
    ;

negationArg
    : typeSelector
    | universal
    | Hash
    | className
    | attrib
    | pseudo
    ;

// Comments might be part of CSS hacks, thus pass them to visitor to decide whether to skip
// Spaces are significant around '+' '-' '(', thus they should not be skipped
ws
    : Space*
    ;

 */