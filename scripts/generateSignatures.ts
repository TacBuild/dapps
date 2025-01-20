import hre, { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import { getContractSignatures } from 'tac-l2-ccl';
import { Artifacts } from 'hardhat/internal/artifacts';

async function main() {
    const [signer] = await ethers.getSigners();

    const filePath = path.resolve(__dirname, '../signatures.json');

    const artifacts = new Artifacts(hre.config.paths.artifacts);
    const contractSignatures = await getContractSignatures(artifacts);

    console.log(contractSignatures);

    fs.writeFileSync(filePath, JSON.stringify(contractSignatures, null, 2));
}

main();