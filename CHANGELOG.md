# Changelog

## 0.2.1

- Expose internal functions with storage pointer arguments.

## 0.2.0

- **Breaking change**: Exposed contracts and functions now use a `$` prefix by default.

The previous prefix `x` can be restored by configuring the plugin as explained in the README.

## 0.1.11

- Expose internal variables.

## 0.1.10

- Add all libary functions in exposed contract.

## 0.1.9

- Fix contracts that override a function through a public variable.

## 0.1.8

- Fix import paths on Windows.

## 0.1.7

- Fix import paths on Windows.

## 0.1.6

- Improve performance a little by not requesting bytecode or optimizations for first compilation

## 0.1.5

- Remove duplicate functions in exposed contract when overriding.

## 0.1.4

- Fix storage location for constructor arguments.

## 0.1.3

- Fix functions with enum and contract arguments.

## 0.1.2

- Fix missing dependency.

## 0.1.1

- Add support for libraries.
- Add support for abstract contracts and interfaces.
- Generate a constructor that invokes all uninitialized parents.

## 0.1.0

First release.
