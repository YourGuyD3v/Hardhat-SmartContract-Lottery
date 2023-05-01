const { network, ethers } = require("hardhat")
const { networkConfig, developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
require("dotenv").config()

const FUND_AMOUNT = ethers.utils.parseEther("1") // 1 Ether, or 1e18 (10^18) Wei

module.exports = async ({getNamedAccounts, deployments}) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    chainId = network.config.chainId
    let vrfCoordinatorV2Mock, vrfCoordinatorV2Address, subscriptionId

    if(chainId == 31337) {
         // create VRFV2 Subscription
         vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
         vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
         const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
         const transactionReceipt = await transactionResponse.wait()
         subscriptionId = transactionReceipt.events[0].args.subId
         // Fund the subscription
         // Our mock makes it so we don't actually have to worry about sending fund
         await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const arguments = [
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId]["entranceFee"],
        networkConfig[chainId]["gasLane"],
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["interval"]
    ]

    const raffle = await deploy("Raffle", {
        from: deployer, 
        args: arguments,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1
    })

     // Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
     if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying..")
        await verify(raffle.address, arguments)
    }
    log("-------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]