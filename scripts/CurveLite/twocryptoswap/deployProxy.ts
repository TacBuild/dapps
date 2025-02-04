import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';
import { CurveLiteTwocryptoswapProxy } from '../../../typechain-types';
import hre, { ethers } from 'hardhat';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, deployer);
    const CurveLiteTwocryptoswapProxy = await deploy<CurveLiteTwocryptoswapProxy>(deployer, hre.artifacts.readArtifactSync('CurveLiteTwocryptoswapProxy'), [await tacContracts.settings.getAddress()], undefined, true);
}


main();
