// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NotImported2 {}

contract Imported2 {
    function _testNotImported2(NotImported2 ni) internal {}
}
