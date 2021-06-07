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

    function _testStructStorageInput(S storage t) internal pure returns (S storage) {
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
}

interface Iface {
    function _abstract() external pure returns (uint);
}

abstract contract Abs {
    function _abstract() internal pure virtual returns (uint);
}

contract Concrete is Abs {
    function _abstract() internal pure override returns (uint) {
        return 42;
    }
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
    function _testMappingType(mapping (uint => uint) storage m) internal {}
}
