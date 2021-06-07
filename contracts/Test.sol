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
