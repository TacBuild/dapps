import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import { deployCurveLiteTwocryptoswapProxy } from './deployProxy';
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const CurveLiteTwocryptoswapProxy = await deployCurveLiteTwocryptoswapProxy(deployer, await  tacContracts.crossChainLayer.getAddress());

    saveContractAddress(addressesFilePath, 'CurveLiteTwocryptoswapProxy', await CurveLiteTwocryptoswapProxy.getAddress());
    
}


main();
