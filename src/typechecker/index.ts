// Kapy-script Type System — v0.1
export type { KapyType, PrimitiveType, NamedType, ArrayType, RecordType, GenericType, FunctionType, UnionType, NullableType } from "../parser/ast";
export { TypeChecker, TypeEnv, typesCompatible, typeName } from "./checker";
export { TypeCheckError, formatTypeError } from "./errors";
export type { TypeCheckResult } from "./errors";