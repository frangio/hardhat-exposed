// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Foo {
    function _testFoo() internal pure returns (uint) {
        return 0xf00;
    }

    function _testString() internal pure returns (string memory) {
        return "foo";
    }

    struct S {
        uint x;
    }

    S s;

    function _testStruct() internal pure returns (S memory) {
        return S(42);
    }

    function _testStructStorageOutput() internal view returns (S storage) {
        return s;
    }

    function _testStructStorageInput(S storage t)
        internal
        pure
        returns (S storage)
    {
        return t;
    }
}

contract Bar is Foo {
    function _testBar() internal pure returns (uint) {
        return 0xba2;
    }
}

library Lib {
    function _testLib() internal pure returns (uint) {
        return 0x11b;
    }

    function _testExt() external pure returns (uint) {
        return 0x11b;
    }
}

interface Iface {
    function _abstract() external pure returns (uint);
}

abstract contract Abs {
    function abs() external view virtual returns (uint);
}

contract Concrete1 is Abs {
    function abs() public pure override returns (uint) {
        return 42;
    }
}

contract Concrete2 is Abs {
    uint public override abs = 42;
}

abstract contract Parent1 {
    constructor(uint x) {}

    function _testParent1() internal {}
}

abstract contract Parent2 {
    constructor(uint y) {}
}

abstract contract Parent3 {
    constructor(uint z) {}
}

abstract contract Child1 is Parent1 {}

abstract contract Child2 is Parent1, Parent2 {}

abstract contract Child3 is Parent1, Parent2, Child2 {}

abstract contract Child4 is Parent1, Parent2, Parent3 {
    constructor(uint c) {}
}

contract Types {
    enum Enum {
        A
    }

    function _testEnumType(Enum e) internal {}

    function _testContractType(Types t) internal {}

    function _testMappingType(mapping(uint => uint) storage m) internal {}
}

contract ConstructorStorageLocation {
    constructor(string memory name) {}
}

contract Chained0 {
    function _chained() internal virtual {}
}

contract Chained1 is Chained0 {
    function _chained() internal virtual override {}
}

contract Chained2 is Chained1 {
    function _chained() internal virtual override {}
}

contract WithVars {
    uint internal var1 = 55;
    uint[] internal var2;
    mapping(uint => uint8) internal var3;

    struct Struct {
        uint a;
    }
    Struct internal var4 = Struct({a: 1});
    Struct[] internal var5;
    mapping(uint => Struct) internal var6;

    mapping(uint => mapping(bool => Struct)) internal var7;
    mapping(uint => mapping(bool => Struct[])) internal var8;

    struct StructWithNestedMapping {
        uint a;
        bytes3 b;
        mapping(uint => uint) map;
    }

    // TODO: TypeError: Types containing (nested) mappings can only be parameters or return variables of internal or library functions.
    // StructWithNestedMapping internal var9;
    // StructWithNestedMapping[] internal var10;
    // mapping(uint => StructWithNestedMapping) internal var11;

    constructor() {
        var2.push(1);
        var2.push(2);
        var2.push(3);

        var3[0] = 1;
        var3[1] = 2;
        var3[2] = 3;

        var5.push(Struct({a: 1}));
        var5.push(Struct({a: 2}));
        var5.push(Struct({a: 3}));

        var6[0] = Struct({a: 1});
        var6[1] = Struct({a: 2});
        var6[2] = Struct({a: 3});

        var7[1][true] = Struct({a: 10});
        var8[1][true].push(Struct({a: 11}));
    }
}
