const { ethers } = require('hardhat')

const {
    printEvents,
    getContract,
    waitForNextEpoch,
}  = require('../../scripts/utils.js');
const {
    baseSetUp,
    printBalances
} = require('./UniswapV2.utils.js');


it('UniswapV2: addLiquidity', async() => {
    await baseSetUp();

    const utilsContract = await getContract('MerkleTreeUtils', 'MerkleTreeUtils');
    const crossChainLayerContract = await getContract('CrossChainLayer', 'CrossChainLayer');
    const groupContract = await getContract('Group', 'Group1');
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy');
    const tokenTKAContract = await getContract('CrossChainLayerToken', 'TKA');
    const tokenTKBContract = await getContract('CrossChainLayerToken', 'TKB');

    await printBalances('Balances before operation');

    // set an message (the only one in a Tree for simplicity)
    const tokenA = await tokenTKAContract.getAddress();
    const tokenB = await tokenTKBContract.getAddress();
    const amountADesired = 10000n * 10n**9n;
    const amountBDesired = 20000n * 10n**9n;
    const amountAMin = 5000n * 10n**9n;
    const amountBMin = 10000n * 10n**9n;
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;
    const message = {
        queryId: 123,
        timestamp: Math.floor(Math.random() * 2**32),
        target: await appProxyContract.getAddress(),
        methodName: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: tokenA, amount: amountADesired},
            {tokenAddress: tokenB, amount: amountBDesired},
        ],
        unlock: [],
    };

    const messageHash = await utilsContract.hashInMessage(message);

    // clear epoch
    await waitForNextEpoch(currentEpoch=null, forceNext=true)

    // set proper Merkle root for a single message (one leaf tree)
    console.log('setting Merkle root to ', messageHash)
    console.log(
        'GROUP epoch before setting Merkle root:', 
        await groupContract.getCurrentEpoch(), 
        await groupContract.getMerkleRoot(),
        await groupContract.totalVoters(),
    )
    console.log(
        'CCL   epoch before setting Merkle root:', 
        await crossChainLayerContract.getCurrentEpoch(), 
        await crossChainLayerContract.getMerkleRoot(),
        await crossChainLayerContract.totalVoters(),
    )

    await groupContract.vote(messageHash)

    // check voting is success
    var result = await crossChainLayerContract.getMerkleRoot()
    console.log('current Merkle root: ', result)
    console.log(
        'GROUP epoch after setting Merkle root:', 
        await groupContract.getCurrentEpoch(), 
        await groupContract.getMerkleRoot(),
        await groupContract.totalVoters(),
    )
    console.log(
        'CCL   epoch after setting Merkle root:',
        await crossChainLayerContract.getCurrentEpoch(), 
        await crossChainLayerContract.getMerkleRoot(),
        await crossChainLayerContract.totalVoters(),
    )

    // execute message
    console.log('CrossChainLayer execute message');
    tx = await crossChainLayerContract.receiveMessage(message, [], 0)
    const receipt = await tx.wait()

    await printBalances('After call message');

    console.log('\n------------------- Events -------------------\n')
    printEvents(receipt, crossChainLayerContract);
})
