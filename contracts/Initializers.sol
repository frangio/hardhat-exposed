// SPDX-License-Identifier: MIT
pragma solidity ^0.8.8;

contract A {
    uint $a;
    function __A_init(uint a) internal {}
    function __A_init_unchained(uint a) internal {
        $a = a;
    }
}

contract B is A {
    function __B_init(uint b) internal {
        __A_init_unchained(b);
    }
    function __B_init_unchained(uint b) internal {}
}

contract C is B {
    function __C_init() internal {}
    function __C_init_unchained() internal {}
}
