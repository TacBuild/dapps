import { ethers } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployCurveLiteTricryptoswapProxy } from './deployProxy';
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const CurveLiteTricryptoswapProxy = await deployCurveLiteTricryptoswapProxy(deployer, await  tacContracts.crossChainLayer.getAddress());

    saveContractAddress(addressesFilePath, 'CurveLiteTricryptoswapProxy', await CurveLiteTricryptoswapProxy.getAddress());
    
}


main();
