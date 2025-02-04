import hre, { ethers } from "hardhat";
import path from 'path';
import { getCCLArtifacts, loadTacContracts, loadGroupContracts } from "tac-l2-ccl";
import { CrossChainLayerToken, WTAC } from "tac-l2-ccl/dist/typechain-types";
import { loadContractFromFile } from "../utils";
import { Contract, Signer } from "ethers";
import { UniswapV2Proxy, IUniswapV2Router02, IUniswapV2Factory } from "../../typechain-types";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";



export async function loadTestEnv(signer: Signer) {
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const groups = await loadGroupContracts(addressesFilePath, signer, ["Group-0"]);
    return {tacContracts, groups}
}