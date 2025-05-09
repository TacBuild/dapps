// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OutMessageV1, TokenAmount, TacHeaderV1 } from "@tonappchain/evm-ccl/contracts/core/Structs.sol";

library ReplacementLib {

    enum Type { Amount, Direct, Bridge }
    struct AmountChange{
        uint16 position;
        uint16 len;
        address token;
    }

    struct Bridge{
        TokenAmount[] tokens;
    }
    struct SlippageChange{
        uint16 position;
        uint16 len;
        address tokenIn;
        uint256 initialAmountIn;
        uint256 expectedAmountOut;
    }

    function mapEncoder(Type[] memory missionType, bytes[] memory mission) internal pure returns(bytes[] memory)  {
        bytes[] memory result = new bytes[](missionType.length);
        for (uint256 i = 0; i < missionType.length; i++) {
            result[i] = abi.encode(missionType[i], mission[i]);
        }
        return result;
    }

    function decoder(bytes memory dataInfo, bytes memory encodedMission) internal view returns(bytes memory improvedMissionBytes, address callTo){
            (Type mission, bytes memory missionInfo, address addresser) = abi.decode(dataInfo, (Type, bytes, address));
            callTo = addresser;
            if(mission == Type.Amount){
                
                improvedMissionBytes = changeAmount(missionInfo, encodedMission);
            }
            if (mission == Type.Direct) {
                improvedMissionBytes = encodedMission;
            }   
    }

    function changeAmount(bytes memory missionInfo, bytes memory encodedMission) internal view returns (bytes memory) {
        AmountChange memory decodedData = abi.decode(missionInfo, (AmountChange));
        bytes32 amount = bytes32(IERC20(decodedData.token).balanceOf(address(this)));
        bytes memory inp = encodedMission;
        for (uint256 i; i < decodedData.len; i++) 
        {
            inp[decodedData.position + i] = amount[i];
        }
        return inp;
    }


}
