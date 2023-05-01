const { network } = require("hardhat")

BASE_FEE = "250000000000000000" // 0.25;
GAS_PRICE_LINK = 1e9 // link per gas;

module.exports = async ({getNamedAccounts, deployments}) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    chainId = network.config.chainId

    if (chainId == 31337) {
        log("Local network detected! Deploying, please wait...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            args: [BASE_FEE, GAS_PRICE_LINK],
            log: true,
        })
        log("Mock deployed!")
        log("-----------------------------------------")
    }
}

module.exports.tags = ["all", "mocks"]