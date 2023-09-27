// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Imported2 } from './Imported2.sol';
import { Clones } from '@openzeppelin/contracts/proxy/Clones.sol';

contract NotImported {}

contract Imported is Imported2 {
    function _testNotImported(NotImported ni) internal {}
}
