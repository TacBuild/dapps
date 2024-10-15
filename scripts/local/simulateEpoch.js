const { useContract, waitForNextEpoch } = require('../../scripts/utils.js');


async function main(numEpochs) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);

    console.log(`simulationg ${numEpochs} epoch(s)...`)

    for (let i = 0; i < numEpochs; i++) {
        const info = await crossChainLayerContract.getCurrentEpoch();
        console.log('current epoch:', info)
        await waitForNextEpoch(currentEpoch=null, forceNext=true);
    }

    const info = await crossChainLayerContract.getCurrentEpoch();
    console.log('current epoch:', info)
}


main(100);