const { deployToken } = require('../utils.js');


async function main() {
    const wethAddress = await deployToken(
        'Token wETH', 'wETH', 9, 
        'EQD_OypVyiEgi7PqXNHTHuGx7ANKj8ZLX_DzSfVxV_oTt9aw'
    );

    console.log(wethAddress);  
}


main();
